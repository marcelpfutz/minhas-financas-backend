/**
 * Rotas de Autenticação
 * Define os endpoints para registro, login e informações do usuário
 */

import { Router } from 'express';
import { register, login, me, forgotPassword, resetPassword } from '../controllers/auth.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// Rota pública - Registro de novo usuário
router.post('/register', register);

// Rota pública - Login
router.post('/login', login);

// Rota pública - Solicitar recuperação de senha
router.post('/forgot-password', forgotPassword);

// Rota pública - Redefinir senha com token
router.post('/reset-password', resetPassword);

// Rota protegida - Informações do usuário autenticado
router.get('/me', authMiddleware, me);

export { router as authRoutes };
