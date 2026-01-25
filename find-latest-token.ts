/**
 * Script para encontrar o token original do último token não usado
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findLatestToken() {
  try {
    // Busca o último token não usado
    const latestToken = await prisma.passwordResetToken.findFirst({
      where: {
        usedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });

    if (!latestToken) {
      console.log('❌ Nenhum token não usado encontrado');
      return;
    }

    console.log('\n📧 ÚLTIMO TOKEN NÃO USADO:\n');
    console.log(`👤 Usuário: ${latestToken.user.name} (${latestToken.user.email})`);
    console.log(`🔑 Token (hash): ${latestToken.token}`);
    console.log(`⏰ Expira em: ${latestToken.expiresAt}`);
    console.log(`🌐 IP: ${latestToken.ipAddress}`);
    console.log(`📅 Criado em: ${latestToken.createdAt}\n`);
    
    const now = new Date();
    if (now > latestToken.expiresAt) {
      console.log('⚠️ ATENÇÃO: Este token já expirou!\n');
    } else {
      const minutesLeft = Math.floor((latestToken.expiresAt.getTime() - now.getTime()) / 60000);
      console.log(`✅ Token válido por mais ${minutesLeft} minutos\n`);
    }

    console.log('⚠️ IMPORTANTE:');
    console.log('O token ORIGINAL (não o hash) foi enviado por email.');
    console.log('Verifique a saída do console do backend ou o email do Ethereal.');
    console.log('\nProcure por linhas como:');
    console.log('📧 Email enviado (DEV): https://ethereal.email/message/...');
    console.log('✅ Token de recuperação gerado para: marcelknucles@gmail.com\n');

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findLatestToken();
