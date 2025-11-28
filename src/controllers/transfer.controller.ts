/**
 * Controller de Transferências
 * Gerencia transferências de valores entre carteiras
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

// ==================== SCHEMAS DE VALIDAÇÃO ====================

const createTransferSchema = z.object({
  amount: z.number().positive('Valor deve ser positivo'),
  description: z.string().optional(),
  date: z.string().transform((str) => new Date(str)).optional(),
  fromWalletId: z.string().min(1, 'Carteira de origem é obrigatória'),
  toWalletId: z.string().min(1, 'Carteira de destino é obrigatória'),
}).refine((data) => data.fromWalletId !== data.toWalletId, {
  message: 'Carteira de origem e destino devem ser diferentes',
  path: ['toWalletId'],
});

// ==================== CONTROLLERS ====================

/**
 * Lista todas as transferências do usuário
 */
export const listTransfers = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { startDate, endDate } = req.query;

    const transfers = await prisma.transfer.findMany({
      where: {
        userId,
        ...(startDate && endDate && {
          date: {
            gte: new Date(startDate as string),
            lte: new Date(endDate as string),
          },
        }),
      },
      include: {
        fromWallet: {
          select: {
            id: true,
            name: true,
            color: true,
            icon: true,
          },
        },
        toWallet: {
          select: {
            id: true,
            name: true,
            color: true,
            icon: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    return res.json(transfers);
  } catch (error) {
    console.error('Erro ao listar transferências:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

/**
 * Busca uma transferência específica
 */
export const getTransfer = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const transfer = await prisma.transfer.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        fromWallet: true,
        toWallet: true,
      },
    });

    if (!transfer) {
      return res.status(404).json({ error: 'Transferência não encontrada' });
    }

    return res.json(transfer);
  } catch (error) {
    console.error('Erro ao buscar transferência:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

/**
 * Cria uma nova transferência entre carteiras
 * Atualiza os saldos das carteiras automaticamente
 */
export const createTransfer = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const data = createTransferSchema.parse(req.body);

    // Verifica se ambas as carteiras pertencem ao usuário
    const [fromWallet, toWallet] = await Promise.all([
      prisma.wallet.findFirst({ where: { id: data.fromWalletId, userId } }),
      prisma.wallet.findFirst({ where: { id: data.toWalletId, userId } }),
    ]);

    if (!fromWallet) {
      return res.status(404).json({ error: 'Carteira de origem não encontrada' });
    }

    if (!toWallet) {
      return res.status(404).json({ error: 'Carteira de destino não encontrada' });
    }

    // Verifica se a carteira de origem tem saldo suficiente
    if (fromWallet.balance < data.amount) {
      return res.status(400).json({ error: 'Saldo insuficiente na carteira de origem' });
    }

    // Cria a transferência e atualiza os saldos
    const transfer = await prisma.$transaction(async (tx) => {
      // Debita da carteira de origem
      await tx.wallet.update({
        where: { id: data.fromWalletId },
        data: {
          balance: {
            decrement: data.amount,
          },
        },
      });

      // Credita na carteira de destino
      await tx.wallet.update({
        where: { id: data.toWalletId },
        data: {
          balance: {
            increment: data.amount,
          },
        },
      });

      // Cria o registro da transferência
      return tx.transfer.create({
        data: {
          ...data,
          userId,
          date: data.date || new Date(),
        },
        include: {
          fromWallet: true,
          toWallet: true,
        },
      });
    });

    return res.status(201).json(transfer);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Erro ao criar transferência:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

/**
 * Deleta uma transferência
 * Reverte os saldos das carteiras
 */
export const deleteTransfer = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const transfer = await prisma.transfer.findFirst({
      where: { id, userId },
    });

    if (!transfer) {
      return res.status(404).json({ error: 'Transferência não encontrada' });
    }

    await prisma.$transaction(async (tx) => {
      // Reverte: adiciona de volta na origem
      await tx.wallet.update({
        where: { id: transfer.fromWalletId },
        data: {
          balance: {
            increment: transfer.amount,
          },
        },
      });

      // Reverte: remove do destino
      await tx.wallet.update({
        where: { id: transfer.toWalletId },
        data: {
          balance: {
            decrement: transfer.amount,
          },
        },
      });

      // Deleta a transferência
      await tx.transfer.delete({
        where: { id },
      });
    });

    return res.status(204).send();
  } catch (error) {
    console.error('Erro ao deletar transferência:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};
