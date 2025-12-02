/**
 * Controller de Lançamentos (Transações)
 * Gerencia entradas e saídas financeiras com controle de vencimento
 * Suporta lançamentos recorrentes e parcelados
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
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
  recurringType: z.enum(['WEEKLY', 'MONTHLY', 'YEARLY', 'INDEFINITE']).optional(),
  isInstallment: z.boolean().default(false),
  installments: z.number().int().positive().optional(),
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
  recurringType: z.enum(['WEEKLY', 'MONTHLY', 'YEARLY', 'INDEFINITE']).optional().nullable(),
  isInstallment: z.boolean().optional(),
  installments: z.number().int().positive().optional().nullable(),
  currentInstallment: z.number().int().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
  walletId: z.string().optional(),
  categoryId: z.string().optional(),
});

// ==================== FUNÇÕES AUXILIARES ====================

/**
 * Calcula a próxima data baseada no tipo de recorrência
 */
function getNextRecurringDate(currentDate: Date, recurringType: string): Date {
  const nextDate = new Date(currentDate);
  
  switch (recurringType) {
    case 'WEEKLY':
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case 'MONTHLY':
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    case 'YEARLY':
      nextDate.setFullYear(nextDate.getFullYear() + 1);
      break;
    case 'INDEFINITE':
      nextDate.setMonth(nextDate.getMonth() + 1); // Padrão mensal para indefinido
      break;
  }
  
  return nextDate;
}

/**
 * Gera array com todas as datas de recorrência
 */
function generateRecurringDates(startDate: Date, recurringType: string): Date[] {
  const dates: Date[] = [];
  let currentDate = new Date(startDate);
  
  // Se indefinido, gera 36 meses
  const maxOccurrences = recurringType === 'INDEFINITE' ? 36 : 36;
  
  for (let i = 0; i < maxOccurrences; i++) {
    dates.push(new Date(currentDate));
    currentDate = getNextRecurringDate(currentDate, recurringType);
  }
  
  return dates;
}

/**
 * Gera array com todas as datas de parcelamento
 */
function generateInstallmentDates(startDate: Date, installments: number): Date[] {
  const dates: Date[] = [];
  let currentDate = new Date(startDate);
  
  for (let i = 0; i < installments; i++) {
    dates.push(new Date(currentDate));
    currentDate.setMonth(currentDate.getMonth() + 1);
  }
  
  return dates;
}

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
 * Suporta lançamentos recorrentes e parcelados
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

    // Validações de recorrência e parcelamento
    if (data.isRecurring && !data.recurringType) {
      return res.status(400).json({
        error: 'Tipo de recorrência é obrigatório para lançamentos recorrentes',
      });
    }

    if (data.isInstallment && !data.installments) {
      return res.status(400).json({
        error: 'Número de parcelas é obrigatório para lançamentos parcelados',
      });
    }

    if (data.isRecurring && data.isInstallment) {
      return res.status(400).json({
        error: 'Lançamento não pode ser recorrente e parcelado ao mesmo tempo',
      });
    }

    // Cria a(s) transação(ões)
    const transactions = await prisma.$transaction(async (tx) => {
      const createdTransactions = [];

      // Lançamento Recorrente
      if (data.isRecurring && data.recurringType) {
        const recurringGroupId = crypto.randomUUID();
        const dates = generateRecurringDates(data.dueDate, data.recurringType);

        for (const dueDate of dates) {
          const newTransaction = await tx.transaction.create({
            data: {
              description: data.description,
              amount: data.amount,
              type: data.type,
              dueDate,
              isPaid: false, // Recorrentes sempre começam não pagos
              isRecurring: true,
              recurringType: data.recurringType,
              recurringGroupId,
              notes: data.notes,
              userId,
              walletId: data.walletId,
              categoryId: data.categoryId,
            },
            include: {
              wallet: true,
              category: true,
            },
          });
          createdTransactions.push(newTransaction);
        }
      }
      // Lançamento Parcelado
      else if (data.isInstallment && data.installments) {
        const installmentGroupId = crypto.randomUUID();
        const dates = generateInstallmentDates(data.dueDate, data.installments);
        const installmentAmount = data.amount / data.installments;

        for (let i = 0; i < dates.length; i++) {
          const newTransaction = await tx.transaction.create({
            data: {
              description: `${data.description} (${i + 1}/${data.installments})`,
              amount: installmentAmount,
              type: data.type,
              dueDate: dates[i],
              isPaid: false, // Parcelados sempre começam não pagos
              isInstallment: true,
              installments: data.installments,
              currentInstallment: i + 1,
              installmentGroupId,
              notes: data.notes,
              userId,
              walletId: data.walletId,
              categoryId: data.categoryId,
            },
            include: {
              wallet: true,
              category: true,
            },
          });
          createdTransactions.push(newTransaction);
        }
      }
      // Lançamento Normal
      else {
        const newTransaction = await tx.transaction.create({
          data: {
            description: data.description,
            amount: data.amount,
            type: data.type,
            dueDate: data.dueDate,
            isPaid: data.isPaid,
            paymentDate: data.paymentDate,
            notes: data.notes,
            userId,
            walletId: data.walletId,
            categoryId: data.categoryId,
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

        createdTransactions.push(newTransaction);
      }

      return createdTransactions;
    });

    return res.status(201).json(transactions);
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
 * Permite escolher entre atualizar apenas o atual ou todos do grupo (recorrentes/parcelados)
 * Ajusta o saldo da carteira se o status de pagamento mudar
 */
export const updateTransaction = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const { updateAll, ...updateData } = req.body; // updateAll: boolean para atualizar grupo inteiro
    const data = updateTransactionSchema.parse(updateData);

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

    // Determina quais transações atualizar
    const whereCondition: any = { id, userId };
    
    if (updateAll) {
      // Se tem grupo de recorrência, atualiza todos do grupo
      if (currentTransaction.recurringGroupId) {
        whereCondition.recurringGroupId = currentTransaction.recurringGroupId;
        delete whereCondition.id;
      }
      // Se tem grupo de parcelamento, atualiza todos do grupo
      else if (currentTransaction.installmentGroupId) {
        whereCondition.installmentGroupId = currentTransaction.installmentGroupId;
        delete whereCondition.id;
      }
    }

    // Atualiza a(s) transação(ões)
    const transactions = await prisma.$transaction(async (tx) => {
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

      // Atualiza uma ou várias transações
      if (whereCondition.id) {
        const updated = await tx.transaction.update({
          where: { id },
          data,
          include: {
            wallet: true,
            category: true,
          },
        });
        return [updated];
      } else {
        await tx.transaction.updateMany({
          where: whereCondition,
          data,
        });
        
        // Busca as transações atualizadas
        const updated = await tx.transaction.findMany({
          where: whereCondition,
          include: {
            wallet: true,
            category: true,
          },
        });
        return updated;
      }
    });

    return res.json(transactions);
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
 * Permite escolher entre deletar apenas o atual ou todos do grupo (recorrentes/parcelados)
 * Reverte o saldo da carteira se o lançamento estava pago
 */
export const deleteTransaction = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const { deleteAll } = req.query; // deleteAll: 'true' para deletar grupo inteiro

    const transaction = await prisma.transaction.findFirst({
      where: { id, userId },
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Lançamento não encontrado' });
    }

    await prisma.$transaction(async (tx) => {
      // Determina quais transações deletar
      const whereCondition: any = { id, userId };
      let transactionsToDelete: any[] = [transaction];

      if (deleteAll === 'true') {
        // Se tem grupo de recorrência, busca todos do grupo
        if (transaction.recurringGroupId) {
          transactionsToDelete = await tx.transaction.findMany({
            where: { 
              recurringGroupId: transaction.recurringGroupId,
              userId 
            },
          });
          whereCondition.recurringGroupId = transaction.recurringGroupId;
          delete whereCondition.id;
        }
        // Se tem grupo de parcelamento, busca todos do grupo
        else if (transaction.installmentGroupId) {
          transactionsToDelete = await tx.transaction.findMany({
            where: { 
              installmentGroupId: transaction.installmentGroupId,
              userId 
            },
          });
          whereCondition.installmentGroupId = transaction.installmentGroupId;
          delete whereCondition.id;
        }
      }

      // Reverte saldo de todas as transações pagas
      for (const t of transactionsToDelete) {
        if (t.isPaid) {
          const balanceChange = t.type === 'INCOME' ? -t.amount : t.amount;
          await tx.wallet.update({
            where: { id: t.walletId },
            data: {
              balance: {
                increment: balanceChange,
              },
            },
          });
        }
      }

      // Deleta a(s) transação(ões)
      if (whereCondition.id) {
        await tx.transaction.delete({
          where: { id },
        });
      } else {
        await tx.transaction.deleteMany({
          where: whereCondition,
        });
      }
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
