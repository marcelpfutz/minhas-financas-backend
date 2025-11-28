/**
 * Controller de Categorias
 * Gerencia categorias de entrada (receitas) e saída (despesas)
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

// ==================== SCHEMAS DE VALIDAÇÃO ====================

const createCategorySchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  description: z.string().optional(),
  type: z.enum(['INCOME', 'EXPENSE'], {
    errorMap: () => ({ message: 'Tipo deve ser INCOME ou EXPENSE' }),
  }),
  color: z.string().default('#3B82F6'),
  icon: z.string().default('tag'),
});

const updateCategorySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  isActive: z.boolean().optional(),
});

// ==================== CONTROLLERS ====================

/**
 * Lista todas as categorias do usuário
 * Pode filtrar por tipo (INCOME ou EXPENSE)
 */
export const listCategories = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { type } = req.query;

    const categories = await prisma.category.findMany({
      where: {
        userId,
        ...(type && { type: type as string }),
      },
      orderBy: { name: 'asc' },
    });

    return res.json(categories);
  } catch (error) {
    console.error('Erro ao listar categorias:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

/**
 * Busca uma categoria específica
 */
export const getCategory = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const category = await prisma.category.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!category) {
      return res.status(404).json({ error: 'Categoria não encontrada' });
    }

    return res.json(category);
  } catch (error) {
    console.error('Erro ao buscar categoria:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

/**
 * Cria uma nova categoria
 */
export const createCategory = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const data = createCategorySchema.parse(req.body);

    const category = await prisma.category.create({
      data: {
        ...data,
        userId,
      },
    });

    return res.status(201).json(category);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Erro ao criar categoria:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

/**
 * Atualiza uma categoria existente
 */
export const updateCategory = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const data = updateCategorySchema.parse(req.body);

    // Verifica se a categoria pertence ao usuário
    const category = await prisma.category.findFirst({
      where: { id, userId },
    });

    if (!category) {
      return res.status(404).json({ error: 'Categoria não encontrada' });
    }

    const updatedCategory = await prisma.category.update({
      where: { id },
      data,
    });

    return res.json(updatedCategory);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Erro ao atualizar categoria:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

/**
 * Deleta uma categoria
 */
export const deleteCategory = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    // Verifica se a categoria pertence ao usuário
    const category = await prisma.category.findFirst({
      where: { id, userId },
    });

    if (!category) {
      return res.status(404).json({ error: 'Categoria não encontrada' });
    }

    // Verifica se há transações usando esta categoria
    const transactionsCount = await prisma.transaction.count({
      where: { categoryId: id },
    });

    if (transactionsCount > 0) {
      return res.status(400).json({
        error: 'Não é possível deletar categoria com lançamentos vinculados',
      });
    }

    await prisma.category.delete({
      where: { id },
    });

    return res.status(204).send();
  } catch (error) {
    console.error('Erro ao deletar categoria:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};
