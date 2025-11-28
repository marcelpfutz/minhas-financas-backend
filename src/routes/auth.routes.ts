/**
 * Rotas de Autenticação
 * Define os endpoints para registro, login e informações do usuário
 */

import { Router } from 'express';
import { register, login, me } from '../controllers/auth.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// Rota pública - Registro de novo usuário
router.post('/register', register);

// Rota pública - Login
router.post('/login', login);

// Rota protegida - Informações do usuário autenticado
router.get('/me', authMiddleware, me);

export { router as authRoutes };
