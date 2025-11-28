/**
 * Controller de Lançamentos (Transações)
 * Gerencia entradas e saídas financeiras com controle de vencimento
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

// ==================== SCHEMAS DE VALIDAÇÃO ====================

const createTransactionSchema = z.object({
  description: z.string().min(1, 'Descrição é obrigatória'),
  amount: z.number().positive('Valor deve ser positivo'),
  type: z.enum(['INCOME', 'EXPENSE'], {
    errorMap: () => ({ message: 'Tipo deve ser INCOME ou EXPENSE' }),
  }),
  dueDate: z.string().transform((str) => new Date(str)),
  paymentDate: z.string().transform((str) => new Date(str)).optional(),
  isPaid: z.boolean().default(false),
  isRecurring: z.boolean().default(false),
  notes: z.string().optional(),
  walletId: z.string().min(1, 'Carteira é obrigatória'),
  categoryId: z.string().min(1, 'Categoria é obrigatória'),
});

const updateTransactionSchema = z.object({
  description: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  dueDate: z.string().transform((str) => new Date(str)).optional(),
  paymentDate: z.string().transform((str) => new Date(str)).optional().nullable(),
  isPaid: z.boolean().optional(),
  isRecurring: z.boolean().optional(),
  notes: z.string().optional().nullable(),
  walletId: z.string().optional(),
  categoryId: z.string().optional(),
});

// ==================== CONTROLLERS ====================

/**
 * Lista todos os lançamentos do usuário
 * Suporta filtros: tipo, período, status de pagamento
 */
export const listTransactions = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { type, isPaid, startDate, endDate, walletId, categoryId } = req.query;

    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        ...(type && { type: type as string }),
        ...(isPaid !== undefined && { isPaid: isPaid === 'true' }),
        ...(walletId && { walletId: walletId as string }),
        ...(categoryId && { categoryId: categoryId as string }),
        ...(startDate && endDate && {
          dueDate: {
            gte: new Date(startDate as string),
            lte: new Date(endDate as string),
          },
        }),
      },
      include: {
        wallet: {
          select: {
            id: true,
            name: true,
            color: true,
            icon: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            color: true,
            icon: true,
            type: true,
          },
        },
      },
      orderBy: { dueDate: 'desc' },
    });

    return res.json(transactions);
  } catch (error) {
    console.error('Erro ao listar lançamentos:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

/**
 * Busca um lançamento específico
 */
export const getTransaction = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const transaction = await prisma.transaction.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        wallet: true,
        category: true,
      },
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Lançamento não encontrado' });
    }

    return res.json(transaction);
  } catch (error) {
    console.error('Erro ao buscar lançamento:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

/**
 * Cria um novo lançamento
 * Atualiza o saldo da carteira automaticamente se o lançamento estiver pago
 */
export const createTransaction = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const data = createTransactionSchema.parse(req.body);

    // Verifica se a carteira e categoria pertencem ao usuário
    const [wallet, category] = await Promise.all([
      prisma.wallet.findFirst({ where: { id: data.walletId, userId } }),
      prisma.category.findFirst({ where: { id: data.categoryId, userId } }),
    ]);

    if (!wallet) {
      return res.status(404).json({ error: 'Carteira não encontrada' });
    }

    if (!category) {
      return res.status(404).json({ error: 'Categoria não encontrada' });
    }

    // Verifica se o tipo da transação corresponde ao tipo da categoria
    if (data.type !== category.type) {
      return res.status(400).json({
        error: 'Tipo da transação não corresponde ao tipo da categoria',
      });
    }

    // Cria a transação e atualiza o saldo da carteira se estiver pago
    const transaction = await prisma.$transaction(async (tx) => {
      const newTransaction = await tx.transaction.create({
        data: {
          ...data,
          userId,
        },
        include: {
          wallet: true,
          category: true,
        },
      });

      // Se a transação estiver paga, atualiza o saldo da carteira
      if (data.isPaid) {
        const balanceChange = data.type === 'INCOME' ? data.amount : -data.amount;
        await tx.wallet.update({
          where: { id: data.walletId },
          data: {
            balance: {
              increment: balanceChange,
            },
          },
        });
      }

      return newTransaction;
    });

    return res.status(201).json(transaction);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Erro ao criar lançamento:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

/**
 * Atualiza um lançamento existente
 * Ajusta o saldo da carteira se o status de pagamento mudar
 */
export const updateTransaction = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const data = updateTransactionSchema.parse(req.body);

    // Busca a transação atual
    const currentTransaction = await prisma.transaction.findFirst({
      where: { id, userId },
    });

    if (!currentTransaction) {
      return res.status(404).json({ error: 'Lançamento não encontrado' });
    }

    // Se está mudando a carteira ou categoria, valida
    if (data.walletId || data.categoryId) {
      const checks = [];
      if (data.walletId) {
        checks.push(prisma.wallet.findFirst({ where: { id: data.walletId, userId } }));
      }
      if (data.categoryId) {
        checks.push(prisma.category.findFirst({ where: { id: data.categoryId, userId } }));
      }

      const results = await Promise.all(checks);
      if (results.some((r) => !r)) {
        return res.status(404).json({ error: 'Carteira ou categoria não encontrada' });
      }
    }

    // Atualiza a transação e ajusta saldos se necessário
    const transaction = await prisma.$transaction(async (tx) => {
      // Se o status de pagamento mudou, ajusta os saldos
      if (data.isPaid !== undefined && data.isPaid !== currentTransaction.isPaid) {
        const amount = data.amount || currentTransaction.amount;
        const walletId = data.walletId || currentTransaction.walletId;
        const type = currentTransaction.type;

        const balanceChange = type === 'INCOME' ? amount : -amount;
        const increment = data.isPaid ? balanceChange : -balanceChange;

        // Reverte o saldo antigo se estava pago
        if (currentTransaction.isPaid && currentTransaction.walletId !== walletId) {
          const oldBalanceChange = type === 'INCOME' ? currentTransaction.amount : -currentTransaction.amount;
          await tx.wallet.update({
            where: { id: currentTransaction.walletId },
            data: { balance: { increment: -oldBalanceChange } },
          });
        }

        // Aplica o novo saldo
        await tx.wallet.update({
          where: { id: walletId },
          data: { balance: { increment } },
        });
      }

      return tx.transaction.update({
        where: { id },
        data,
        include: {
          wallet: true,
          category: true,
        },
      });
    });

    return res.json(transaction);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Erro ao atualizar lançamento:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

/**
 * Deleta um lançamento
 * Reverte o saldo da carteira se o lançamento estava pago
 */
export const deleteTransaction = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const transaction = await prisma.transaction.findFirst({
      where: { id, userId },
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Lançamento não encontrado' });
    }

    await prisma.$transaction(async (tx) => {
      // Se a transação estava paga, reverte o saldo
      if (transaction.isPaid) {
        const balanceChange = transaction.type === 'INCOME' 
          ? -transaction.amount 
          : transaction.amount;

        await tx.wallet.update({
          where: { id: transaction.walletId },
          data: {
            balance: {
              increment: balanceChange,
            },
          },
        });
      }

      await tx.transaction.delete({
        where: { id },
      });
    });

    return res.status(204).send();
  } catch (error) {
    console.error('Erro ao deletar lançamento:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

/**
 * Marca um lançamento como pago
 */
export const payTransaction = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const { paymentDate } = req.body;

    const transaction = await prisma.transaction.findFirst({
      where: { id, userId },
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Lançamento não encontrado' });
    }

    if (transaction.isPaid) {
      return res.status(400).json({ error: 'Lançamento já está pago' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Atualiza o saldo da carteira
      const balanceChange = transaction.type === 'INCOME' 
        ? transaction.amount 
        : -transaction.amount;

      await tx.wallet.update({
        where: { id: transaction.walletId },
        data: {
          balance: {
            increment: balanceChange,
          },
        },
      });

      // Marca como pago
      return tx.transaction.update({
        where: { id },
        data: {
          isPaid: true,
          paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        },
        include: {
          wallet: true,
          category: true,
        },
      });
    });

    return res.json(updated);
  } catch (error) {
    console.error('Erro ao marcar lançamento como pago:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};
