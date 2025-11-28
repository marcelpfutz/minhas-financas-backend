/**
 * Controller do Dashboard
 * Fornece dados consolidados e estatísticas para o painel principal
 */

import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

/**
 * Retorna o resumo financeiro do usuário
 * Inclui: saldo total, receitas, despesas, lançamentos pendentes
 */
export const getSummary = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { month, year } = req.query;

    // Define o período (mês atual se não especificado)
    const now = new Date();
    const targetMonth = month ? parseInt(month as string) : now.getMonth() + 1;
    const targetYear = year ? parseInt(year as string) : now.getFullYear();

    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);

    // Busca dados em paralelo
    const [
      wallets,
      totalIncome,
      totalExpense,
      paidIncome,
      paidExpense,
      pendingTransactions,
      overdueTransactions,
    ] = await Promise.all([
      // Saldo total de todas as carteiras
      prisma.wallet.findMany({
        where: { userId, isActive: true },
        select: { id: true, name: true, balance: true, color: true, icon: true },
      }),

      // Total de receitas do período
      prisma.transaction.aggregate({
        where: {
          userId,
          type: 'INCOME',
          dueDate: { gte: startDate, lte: endDate },
        },
        _sum: { amount: true },
      }),

      // Total de despesas do período
      prisma.transaction.aggregate({
        where: {
          userId,
          type: 'EXPENSE',
          dueDate: { gte: startDate, lte: endDate },
        },
        _sum: { amount: true },
      }),

      // Receitas pagas do período
      prisma.transaction.aggregate({
        where: {
          userId,
          type: 'INCOME',
          isPaid: true,
          dueDate: { gte: startDate, lte: endDate },
        },
        _sum: { amount: true },
      }),

      // Despesas pagas do período
      prisma.transaction.aggregate({
        where: {
          userId,
          type: 'EXPENSE',
          isPaid: true,
          dueDate: { gte: startDate, lte: endDate },
        },
        _sum: { amount: true },
      }),

      // Lançamentos pendentes (não pagos)
      prisma.transaction.count({
        where: {
          userId,
          isPaid: false,
          dueDate: { gte: startDate, lte: endDate },
        },
      }),

      // Lançamentos vencidos (não pagos e vencimento passou)
      prisma.transaction.count({
        where: {
          userId,
          isPaid: false,
          dueDate: { lt: now },
        },
      }),
    ]);

    // Calcula o saldo total de todas as carteiras
    const totalBalance = wallets.reduce((sum, wallet) => sum + wallet.balance, 0);

    return res.json({
      period: {
        month: targetMonth,
        year: targetYear,
      },
      wallets,
      totalBalance,
      income: {
        total: totalIncome._sum.amount || 0,
        paid: paidIncome._sum.amount || 0,
        pending: (totalIncome._sum.amount || 0) - (paidIncome._sum.amount || 0),
      },
      expense: {
        total: totalExpense._sum.amount || 0,
        paid: paidExpense._sum.amount || 0,
        pending: (totalExpense._sum.amount || 0) - (paidExpense._sum.amount || 0),
      },
      balance: (paidIncome._sum.amount || 0) - (paidExpense._sum.amount || 0),
      pendingTransactions,
      overdueTransactions,
    });
  } catch (error) {
    console.error('Erro ao buscar resumo:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

/**
 * Retorna lançamentos próximos do vencimento
 */
export const getUpcoming = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { days = 7 } = req.query;

    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + parseInt(days as string));

    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        isPaid: false,
        dueDate: {
          gte: now,
          lte: futureDate,
        },
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
      orderBy: { dueDate: 'asc' },
    });

    return res.json(transactions);
  } catch (error) {
    console.error('Erro ao buscar lançamentos próximos:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

/**
 * Retorna estatísticas por categoria
 */
export const getCategoryStats = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { month, year, type } = req.query;

    const now = new Date();
    const targetMonth = month ? parseInt(month as string) : now.getMonth() + 1;
    const targetYear = year ? parseInt(year as string) : now.getFullYear();

    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);

    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        isPaid: true,
        dueDate: { gte: startDate, lte: endDate },
        ...(type && { type: type as string }),
      },
      include: {
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
    });

    // Agrupa por categoria
    const categoryMap = new Map<string, {
      category: any;
      total: number;
      count: number;
    }>();

    transactions.forEach((transaction) => {
      const categoryId = transaction.category.id;
      const existing = categoryMap.get(categoryId);

      if (existing) {
        existing.total += transaction.amount;
        existing.count += 1;
      } else {
        categoryMap.set(categoryId, {
          category: transaction.category,
          total: transaction.amount,
          count: 1,
        });
      }
    });

    const stats = Array.from(categoryMap.values())
      .sort((a, b) => b.total - a.total);

    return res.json(stats);
  } catch (error) {
    console.error('Erro ao buscar estatísticas por categoria:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

/**
 * Retorna projeção financeira dos próximos meses
 */
export const getProjection = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { months = 3 } = req.query;

    const projections = [];
    const now = new Date();

    for (let i = 0; i < parseInt(months as string); i++) {
      const month = now.getMonth() + i;
      const year = now.getFullYear() + Math.floor(month / 12);
      const adjustedMonth = month % 12;

      const startDate = new Date(year, adjustedMonth, 1);
      const endDate = new Date(year, adjustedMonth + 1, 0, 23, 59, 59);

      const [income, expense] = await Promise.all([
        prisma.transaction.aggregate({
          where: {
            userId,
            type: 'INCOME',
            dueDate: { gte: startDate, lte: endDate },
          },
          _sum: { amount: true },
        }),
        prisma.transaction.aggregate({
          where: {
            userId,
            type: 'EXPENSE',
            dueDate: { gte: startDate, lte: endDate },
          },
          _sum: { amount: true },
        }),
      ]);

      projections.push({
        month: adjustedMonth + 1,
        year,
        income: income._sum.amount || 0,
        expense: expense._sum.amount || 0,
        balance: (income._sum.amount || 0) - (expense._sum.amount || 0),
      });
    }

    return res.json(projections);
  } catch (error) {
    console.error('Erro ao buscar projeções:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};
