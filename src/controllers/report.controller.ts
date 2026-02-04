/**
 * Controller de Relatórios
 * Fornece dados detalhados e análises financeiras com filtros avançados
 */

import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

interface ReportFilters {
  startDate: Date;
  endDate: Date;
  walletIds?: string[];
  categoryIds?: string[];
  type?: 'INCOME' | 'EXPENSE';
  isPaid?: boolean;
}

/**
 * Retorna relatório financeiro completo com filtros personalizados
 * Inclui: métricas resumidas, transações por categoria, evolução mensal, etc.
 */
export const getReport = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const {
      startDate: startDateParam,
      endDate: endDateParam,
      walletIds: walletIdsParam,
      categoryIds: categoryIdsParam,
      type,
      isPaid: isPaidParam,
    } = req.query;

    // Validação de datas obrigatórias
    if (!startDateParam || !endDateParam) {
      return res.status(400).json({ 
        error: 'As datas de início e fim são obrigatórias' 
      });
    }

    const startDate = new Date(startDateParam as string);
    const endDate = new Date(endDateParam as string);

    // Monta o filtro base
    const whereClause: any = {
      userId,
      dueDate: {
        gte: startDate,
        lte: endDate,
      },
    };

    // Adiciona filtros opcionais
    if (walletIdsParam) {
      const walletIds = (walletIdsParam as string).split(',');
      whereClause.walletId = { in: walletIds };
    }

    if (categoryIdsParam) {
      const categoryIds = (categoryIdsParam as string).split(',');
      whereClause.categoryId = { in: categoryIds };
    }

    if (type) {
      whereClause.type = type;
    }

    if (isPaidParam !== undefined) {
      whereClause.isPaid = isPaidParam === 'true';
    }

    // Busca dados em paralelo
    const [
      // Transações do período com filtros
      transactions,
      
      // Total de receitas
      totalIncome,
      
      // Total de despesas
      totalExpense,
      
      // Receitas pagas
      paidIncome,
      
      // Despesas pagas
      paidExpense,
      
      // Média diária de gastos
      allExpenses,
      
      // Evolução mensal (últimos 6 meses)
      evolutionData,
    ] = await Promise.all([
      // Transações filtradas
      prisma.transaction.findMany({
        where: whereClause,
        include: {
          category: true,
          wallet: true,
        },
        orderBy: { dueDate: 'desc' },
      }),

      // Total de receitas
      prisma.transaction.aggregate({
        where: { ...whereClause, type: 'INCOME' },
        _sum: { amount: true },
        _count: true,
      }),

      // Total de despesas
      prisma.transaction.aggregate({
        where: { ...whereClause, type: 'EXPENSE' },
        _sum: { amount: true },
        _count: true,
      }),

      // Receitas pagas
      prisma.transaction.aggregate({
        where: { ...whereClause, type: 'INCOME', isPaid: true },
        _sum: { amount: true },
        _count: true,
      }),

      // Despesas pagas
      prisma.transaction.aggregate({
        where: { ...whereClause, type: 'EXPENSE', isPaid: true },
        _sum: { amount: true },
        _count: true,
      }),

      // Todas as despesas para calcular média
      prisma.transaction.findMany({
        where: { ...whereClause, type: 'EXPENSE' },
        select: { amount: true, dueDate: true },
      }),

      // Evolução dos últimos 6 meses
      prisma.transaction.findMany({
        where: {
          userId,
          dueDate: {
            gte: new Date(new Date().setMonth(new Date().getMonth() - 6)),
            lte: endDate,
          },
        },
        select: {
          amount: true,
          type: true,
          dueDate: true,
          isPaid: true,
        },
      }),
    ]);

    // Calcula gastos por categoria
    const expensesByCategory = transactions
      .filter((t) => t.type === 'EXPENSE')
      .reduce((acc, transaction) => {
        const categoryId = transaction.category.id;
        if (!acc[categoryId]) {
          acc[categoryId] = {
            category: transaction.category,
            total: 0,
            count: 0,
            paid: 0,
            pending: 0,
          };
        }
        acc[categoryId].total += transaction.amount;
        acc[categoryId].count += 1;
        if (transaction.isPaid) {
          acc[categoryId].paid += transaction.amount;
        } else {
          acc[categoryId].pending += transaction.amount;
        }
        return acc;
      }, {} as Record<string, any>);

    // Calcula receitas por categoria
    const incomeByCategory = transactions
      .filter((t) => t.type === 'INCOME')
      .reduce((acc, transaction) => {
        const categoryId = transaction.category.id;
        if (!acc[categoryId]) {
          acc[categoryId] = {
            category: transaction.category,
            total: 0,
            count: 0,
            paid: 0,
            pending: 0,
          };
        }
        acc[categoryId].total += transaction.amount;
        acc[categoryId].count += 1;
        if (transaction.isPaid) {
          acc[categoryId].paid += transaction.amount;
        } else {
          acc[categoryId].pending += transaction.amount;
        }
        return acc;
      }, {} as Record<string, any>);

    // Calcula distribuição por carteira
    const byWallet = transactions.reduce((acc, transaction) => {
      const walletId = transaction.wallet.id;
      if (!acc[walletId]) {
        acc[walletId] = {
          wallet: transaction.wallet,
          income: 0,
          expense: 0,
          count: 0,
        };
      }
      if (transaction.type === 'INCOME') {
        acc[walletId].income += transaction.amount;
      } else {
        acc[walletId].expense += transaction.amount;
      }
      acc[walletId].count += 1;
      return acc;
    }, {} as Record<string, any>);

    // Calcula média diária de gastos
    const daysDiff = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const avgDailyExpense =
      daysDiff > 0
        ? (totalExpense._sum.amount || 0) / daysDiff
        : 0;

    // Calcula maior gasto e maior receita
    const biggestExpense = transactions
      .filter((t) => t.type === 'EXPENSE')
      .sort((a, b) => b.amount - a.amount)[0];

    const biggestIncome = transactions
      .filter((t) => t.type === 'INCOME')
      .sort((a, b) => b.amount - a.amount)[0];

    // Evolução mensal (últimos 6 meses)
    const monthlyEvolution = Array.from({ length: 6 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (5 - i));
      const month = date.getMonth() + 1;
      const year = date.getFullYear();

      const monthData = evolutionData.filter((t) => {
        const tDate = new Date(t.dueDate);
        return tDate.getMonth() + 1 === month && tDate.getFullYear() === year;
      });

      const income = monthData
        .filter((t) => t.type === 'INCOME' && t.isPaid)
        .reduce((sum, t) => sum + t.amount, 0);

      const expense = monthData
        .filter((t) => t.type === 'EXPENSE' && t.isPaid)
        .reduce((sum, t) => sum + t.amount, 0);

      return {
        month,
        year,
        income,
        expense,
        balance: income - expense,
      };
    });

    // Monta o resultado
    const report = {
      period: {
        startDate,
        endDate,
        days: daysDiff,
      },
      filters: {
        walletIds: walletIdsParam ? (walletIdsParam as string).split(',') : null,
        categoryIds: categoryIdsParam ? (categoryIdsParam as string).split(',') : null,
        type: type || null,
        isPaid: isPaidParam !== undefined ? isPaidParam === 'true' : null,
      },
      summary: {
        income: {
          total: totalIncome._sum.amount || 0,
          paid: paidIncome._sum.amount || 0,
          pending: (totalIncome._sum.amount || 0) - (paidIncome._sum.amount || 0),
          count: totalIncome._count,
        },
        expense: {
          total: totalExpense._sum.amount || 0,
          paid: paidExpense._sum.amount || 0,
          pending: (totalExpense._sum.amount || 0) - (paidExpense._sum.amount || 0),
          count: totalExpense._count,
        },
        balance: (totalIncome._sum.amount || 0) - (totalExpense._sum.amount || 0),
        avgDailyExpense,
      },
      byCategory: {
        expenses: Object.values(expensesByCategory).sort(
          (a: any, b: any) => b.total - a.total
        ),
        income: Object.values(incomeByCategory).sort(
          (a: any, b: any) => b.total - a.total
        ),
      },
      byWallet: Object.values(byWallet),
      highlights: {
        biggestExpense: biggestExpense || null,
        biggestIncome: biggestIncome || null,
      },
      evolution: monthlyEvolution,
      transactionCount: transactions.length,
    };

    res.json(report);
  } catch (error) {
    console.error('Erro ao buscar relatório:', error);
    res.status(500).json({ error: 'Erro ao buscar relatório' });
  }
};
