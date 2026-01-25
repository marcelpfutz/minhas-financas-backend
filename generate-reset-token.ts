/**
 * Script para gerar um novo token de recuperação e mostrar o token original
 * USO: npx tsx generate-reset-token.ts EMAIL_DO_USUARIO
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import dotenv from 'dotenv';

// Carrega variáveis de ambiente
dotenv.config();

const prisma = new PrismaClient();

async function generateToken() {
  try {
    const email = process.argv[2] || 'marcelknucles@gmail.com';
    
    console.log(`\n🔐 Gerando token de recuperação para: ${email}\n`);

    // Busca o usuário
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.log('❌ Usuário não encontrado!');
      return;
    }

    // Gera token seguro de 32 bytes (64 caracteres hex)
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // Criptografa o token antes de salvar no banco (SHA-256)
    const hashedToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // Invalida todos os tokens anteriores deste usuário
    await prisma.passwordResetToken.deleteMany({
      where: {
        userId: user.id,
        usedAt: null,
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
        ipAddress: '127.0.0.1',
        userAgent: 'Script CLI',
      },
    });

    console.log('✅ Token gerado com sucesso!\n');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📋 INFORMAÇÕES DO TOKEN:');
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log(`👤 Usuário: ${user.name} (${user.email})`);
    console.log(`⏰ Expira em: ${expiresAt.toLocaleString('pt-BR')}`);
    console.log('');
    console.log('🔑 TOKEN ORIGINAL (use este na URL):');
    console.log(resetToken);
    console.log('');
    console.log('🌐 URL COMPLETA:');
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000/minhas-financas';
    console.log(`${frontendUrl}/reset-password?token=${resetToken}`);
    console.log('');
    console.log('🔐 Token no banco (SHA-256):');
    console.log(hashedToken);
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('📝 PRÓXIMOS PASSOS:');
    console.log('1. Copie a URL completa acima');
    console.log('2. Cole no navegador');
    console.log('3. Digite sua nova senha');
    console.log('4. Faça login com a nova senha\n');

  } catch (error) {
    console.error('❌ Erro ao gerar token:', error);
  } finally {
    await prisma.$disconnect();
  }
}

generateToken();
