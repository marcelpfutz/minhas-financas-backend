/**
 * Rotas de Carteiras
 * Define os endpoints para gerenciamento de carteiras
 */

import { Router } from 'express';
import {
  listWallets,
  getWallet,
  createWallet,
  updateWallet,
  deleteWallet,
  getWalletTransactions,
} from '../controllers/wallet.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// Todas as rotas de carteiras requerem autenticação
router.use(authMiddleware);

// Listar todas as carteiras do usuário
router.get('/', listWallets);

// Buscar uma carteira específica
router.get('/:id', getWallet);

// Buscar transações de uma carteira
router.get('/:id/transactions', getWalletTransactions);

// Criar nova carteira
router.post('/', createWallet);

// Atualizar carteira
router.put('/:id', updateWallet);

// Deletar carteira (soft delete)
router.delete('/:id', deleteWallet);

export { router as walletRoutes };
