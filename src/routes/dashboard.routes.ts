/**
 * Rotas do Dashboard
 * Define os endpoints para visualização de dados consolidados
 */

import { Router } from 'express';
import {
  getSummary,
  getUpcoming,
  getCategoryStats,
  getProjection,
} from '../controllers/dashboard.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// Todas as rotas do dashboard requerem autenticação
router.use(authMiddleware);

// Resumo financeiro geral
router.get('/summary', getSummary);

// Lançamentos próximos do vencimento
router.get('/upcoming', getUpcoming);

// Estatísticas por categoria
router.get('/category-stats', getCategoryStats);

// Projeção financeira
router.get('/projection', getProjection);

export { router as dashboardRoutes };
