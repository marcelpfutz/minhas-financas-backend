/**
 * Rotas de Transferências
 * Define os endpoints para gerenciamento de transferências entre carteiras
 */

import { Router } from 'express';
import {
  listTransfers,
  getTransfer,
  createTransfer,
  deleteTransfer,
} from '../controllers/transfer.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// Todas as rotas de transferências requerem autenticação
router.use(authMiddleware);

// Listar todas as transferências
router.get('/', listTransfers);

// Buscar uma transferência específica
router.get('/:id', getTransfer);

// Criar nova transferência
router.post('/', createTransfer);

// Deletar transferência
router.delete('/:id', deleteTransfer);

export { router as transferRoutes };
