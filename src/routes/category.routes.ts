/**
 * Rotas de Categorias
 * Define os endpoints para gerenciamento de categorias
 */

import { Router } from 'express';
import {
  listCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/category.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// Todas as rotas de categorias requerem autenticação
router.use(authMiddleware);

// Listar todas as categorias (pode filtrar por tipo via query ?type=INCOME ou ?type=EXPENSE)
router.get('/', listCategories);

// Buscar uma categoria específica
router.get('/:id', getCategory);

// Criar nova categoria
router.post('/', createCategory);

// Atualizar categoria
router.put('/:id', updateCategory);

// Deletar categoria
router.delete('/:id', deleteCategory);

export { router as categoryRoutes };
