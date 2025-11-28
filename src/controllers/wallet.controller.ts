/**
 * Controller de Carteiras
 * Gerencia operações CRUD de carteiras (contas bancárias, carteiras físicas, etc)
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

// ==================== SCHEMAS DE VALIDAÇÃO ====================

const createWalletSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  description: z.string().optional(),
  balance: z.number().default(0),
  color: z.string().default('#3B82F6'),
  icon: z.string().default('wallet'),
});

const updateWalletSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  isActive: z.boolean().optional(),
});

// ==================== CONTROLLERS ====================

/**
 * Lista todas as carteiras do usuário
 */
export const listWallets = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;

    const wallets = await prisma.wallet.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(wallets);
  } catch (error) {
    console.error('Erro ao listar carteiras:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

/**
 * Busca uma carteira específica
 */
export const getWallet = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const wallet = await prisma.wallet.findFirst({
      where: { 
        id,
        userId,
      },
    });

    if (!wallet) {
      return res.status(404).json({ error: 'Carteira não encontrada' });
    }

    return res.json(wallet);
  } catch (error) {
    console.error('Erro ao buscar carteira:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

/**
 * Cria uma nova carteira
 */
export const createWallet = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const data = createWalletSchema.parse(req.body);

    const wallet = await prisma.wallet.create({
      data: {
        ...data,
        userId,
      },
    });

    return res.status(201).json(wallet);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Erro ao criar carteira:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

/**
 * Atualiza uma carteira existente
 */
export const updateWallet = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const data = updateWalletSchema.parse(req.body);

    // Verifica se a carteira pertence ao usuário
    const wallet = await prisma.wallet.findFirst({
      where: { id, userId },
    });

    if (!wallet) {
      return res.status(404).json({ error: 'Carteira não encontrada' });
    }

    const updatedWallet = await prisma.wallet.update({
      where: { id },
      data,
    });

    return res.json(updatedWallet);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Erro ao atualizar carteira:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

/**
 * Deleta uma carteira
 */
export const deleteWallet = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    // Verifica se a carteira pertence ao usuário
    const wallet = await prisma.wallet.findFirst({
      where: { id, userId },
    });

    if (!wallet) {
      return res.status(404).json({ error: 'Carteira não encontrada' });
    }

    await prisma.wallet.delete({
      where: { id },
    });

    return res.status(204).send();
  } catch (error) {
    console.error('Erro ao deletar carteira:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};
