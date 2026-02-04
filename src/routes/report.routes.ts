/**
 * Rotas de Relatórios
 * Endpoints para geração de relatórios financeiros
 */

import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { getReport } from '../controllers/report.controller';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

/**
 * GET /api/reports
 * Busca relatório com filtros personalizados
 * Query params:
 * - startDate: data inicial (obrigatório)
 * - endDate: data final (obrigatório)
 * - walletIds: IDs das carteiras separados por vírgula (opcional)
 * - categoryIds: IDs das categorias separados por vírgula (opcional)
 * - type: INCOME ou EXPENSE (opcional)
 * - isPaid: true ou false (opcional)
 */
router.get('/', getReport);

export default router;
