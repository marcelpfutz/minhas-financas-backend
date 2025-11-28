/**
 * Rotas de Lançamentos (Transações)
 * Define os endpoints para gerenciamento de lançamentos financeiros
 */

import { Router } from 'express';
import {
  listTransactions,
  getTransaction,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  payTransaction,
} from '../controllers/transaction.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// Todas as rotas de transações requerem autenticação
router.use(authMiddleware);

// Listar todos os lançamentos (suporta filtros via query params)
router.get('/', listTransactions);

// Buscar um lançamento específico
router.get('/:id', getTransaction);

// Criar novo lançamento
router.post('/', createTransaction);

// Atualizar lançamento
router.put('/:id', updateTransaction);

// Deletar lançamento
router.delete('/:id', deleteTransaction);

// Marcar lançamento como pago
router.post('/:id/pay', payTransaction);

export { router as transactionRoutes };
