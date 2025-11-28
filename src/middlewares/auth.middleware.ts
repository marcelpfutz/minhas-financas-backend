/**
 * Middleware de Autenticação
 * Verifica se o usuário está autenticado através do token JWT
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Estende o tipo Request do Express para incluir o userId
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

interface JwtPayload {
  userId: string;
}

/**
 * Middleware que valida o token JWT e adiciona o userId à request
 */
export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Pega o token do header Authorization
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  // Token vem no formato: Bearer <token>
  const [, token] = authHeader.split(' ');

  if (!token) {
    return res.status(401).json({ error: 'Token mal formatado' });
  }

  try {
    // Verifica e decodifica o token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'secret'
    ) as JwtPayload;

    // Adiciona o userId à request para uso nas rotas
    req.userId = decoded.userId;

    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
};
