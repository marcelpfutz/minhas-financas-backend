/**
 * Controller de Autenticação
 * Gerencia registro, login e informações do usuário
 */

import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { sendPasswordResetEmail } from '../services/email.service';

// ==================== SCHEMAS DE VALIDAÇÃO ====================

const registerSchema = z.object({
  name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Email inválido'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token é obrigatório'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

// ==================== FUNÇÕES AUXILIARES ====================

/**
 * Gera um token JWT para o usuário
 */
const generateToken = (userId: string): string => {
  const secret = process.env.JWT_SECRET || 'secret';
  // Usando apenas 2 parâmetros primeiro para evitar erro de tipos
  const token = jwt.sign({ userId, exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) }, secret);
  return token;
};

// ==================== CONTROLLERS ====================

/**
 * Registra um novo usuário no sistema
 */
export const register = async (req: Request, res: Response) => {
  try {
    // Valida os dados de entrada
    const { name, email, password } = registerSchema.parse(req.body);

    // Verifica se o email já está em uso
    const userExists = await prisma.user.findUnique({
      where: { email },
    });

    if (userExists) {
      return res.status(400).json({ error: 'Email já cadastrado' });
    }

    // Criptografa a senha
    const hashedPassword = await bcrypt.hash(password, 10);

    // Cria o usuário no banco
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
    });

    // Gera o token
    const token = generateToken(user.id);

    return res.status(201).json({
      user,
      token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Erro ao registrar usuário:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

/**
 * Realiza login do usuário
 */
export const login = async (req: Request, res: Response) => {
  try {
    // Valida os dados de entrada
    const { email, password } = loginSchema.parse(req.body);

    // Busca o usuário pelo email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Verifica a senha
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Gera o token
    const token = generateToken(user.id);

    return res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      },
      token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Erro ao fazer login:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

/**
 * Retorna as informações do usuário autenticado
 */
export const me = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    return res.json(user);
  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

/**
 * Solicita recuperação de senha
 * SEGURANÇA:
 * - Gera token único criptografado com crypto
 * - Token expira em 1 hora
 * - Invalida tokens anteriores do mesmo usuário
 * - Registra IP e User-Agent para auditoria
 * - Não revela se email existe (sempre retorna sucesso)
 */
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    // Valida os dados de entrada
    const { email } = forgotPasswordSchema.parse(req.body);

    // Busca o usuário pelo email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    // SEGURANÇA: Sempre retorna sucesso, mesmo se email não existir
    // Isso previne descoberta de emails válidos no sistema
    if (!user) {
      console.log(`Tentativa de recuperação para email inexistente: ${email}`);
      return res.json({ 
        message: 'Se o email existir, você receberá instruções de recuperação' 
      });
    }

    // Gera token seguro de 32 bytes (64 caracteres hex)
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // Criptografa o token antes de salvar no banco (SHA-256)
    const hashedToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // Captura dados para auditoria
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';

    // Invalida todos os tokens anteriores deste usuário (segurança extra)
    await prisma.passwordResetToken.deleteMany({
      where: {
        userId: user.id,
        usedAt: null, // Apenas tokens não usados
      },
    });

    // Cria novo token com expiração de 1 hora
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    await prisma.passwordResetToken.create({
      data: {
        token: hashedToken,
        userId: user.id,
        expiresAt,
        ipAddress,
        userAgent,
      },
    });

    // Gera URL de recuperação
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

    // Envia email de recuperação
    await sendPasswordResetEmail(user.email, user.name, resetUrl);

    console.log(`✅ Token de recuperação gerado para: ${user.email}`);
    console.log(`IP: ${ipAddress} | User-Agent: ${userAgent}`);

    return res.json({ 
      message: 'Se o email existir, você receberá instruções de recuperação' 
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Erro ao solicitar recuperação de senha:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

/**
 * Redefine a senha usando o token
 * SEGURANÇA:
 * - Valida token criptografado
 * - Verifica expiração (1 hora)
 * - Token só pode ser usado uma vez
 * - Invalida todos os tokens do usuário após uso
 * - Registra IP e User-Agent da redefinição
 */
export const resetPassword = async (req: Request, res: Response) => {
  try {
    // Valida os dados de entrada
    const { token, password } = resetPasswordSchema.parse(req.body);

    // Criptografa o token recebido para comparar com o banco
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Busca o token no banco
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token: hashedToken },
      include: { user: true },
    });

    // Valida se token existe
    if (!resetToken) {
      console.log('❌ Tentativa de uso de token inválido');
      return res.status(400).json({ 
        error: 'Token inválido ou expirado. Solicite um novo link de recuperação.' 
      });
    }

    // Valida se token já foi usado
    if (resetToken.usedAt) {
      console.log(`❌ Tentativa de reutilizar token já usado (User: ${resetToken.user.email})`);
      return res.status(400).json({ 
        error: 'Este link de recuperação já foi utilizado. Solicite um novo.' 
      });
    }

    // Valida se token está expirado
    if (new Date() > resetToken.expiresAt) {
      console.log(`❌ Tentativa de uso de token expirado (User: ${resetToken.user.email})`);
      return res.status(400).json({ 
        error: 'Este link de recuperação expirou. Solicite um novo.' 
      });
    }

    // Captura dados para auditoria
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';

    // SEGURANÇA ADICIONAL: Verifica se IP/User-Agent são muito diferentes
    // (pode indicar tentativa de uso malicioso do token)
    if (resetToken.ipAddress !== ipAddress) {
      console.log(`⚠️ ALERTA: IP diferente na recuperação!`);
      console.log(`  Solicitação: ${resetToken.ipAddress}`);
      console.log(`  Redefinição: ${ipAddress}`);
      console.log(`  User: ${resetToken.user.email}`);
      // Não bloqueia, mas registra (pode ser usuário mudou de rede)
    }

    // Criptografa a nova senha
    const hashedPassword = await bcrypt.hash(password, 10);

    // Atualiza a senha do usuário e marca o token como usado
    await prisma.$transaction([
      // Atualiza a senha
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { password: hashedPassword },
      }),
      // Marca o token como usado
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      // Invalida todos os outros tokens não usados do usuário (segurança extra)
      prisma.passwordResetToken.deleteMany({
        where: {
          userId: resetToken.userId,
          usedAt: null,
          id: { not: resetToken.id },
        },
      }),
    ]);

    console.log(`✅ Senha redefinida com sucesso para: ${resetToken.user.email}`);
    console.log(`IP: ${ipAddress} | User-Agent: ${userAgent}`);

    return res.json({ 
      message: 'Senha redefinida com sucesso! Você já pode fazer login.' 
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Erro ao redefinir senha:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};
