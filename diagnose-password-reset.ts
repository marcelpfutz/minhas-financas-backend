/**
 * Script de Diagnóstico - Recuperação de Senha
 * Verifica o que está acontecendo com os tokens
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function diagnose() {
  try {
    console.log('🔍 DIAGNÓSTICO DO SISTEMA DE RECUPERAÇÃO\n');

    // 1. Verifica se a tabela existe
    console.log('1️⃣ Verificando tabela password_reset_tokens...');
    const count = await prisma.passwordResetToken.count();
    console.log(`   ✅ Tabela existe! Total de tokens: ${count}\n`);

    // 2. Lista todos os tokens
    console.log('2️⃣ Listando todos os tokens:');
    const tokens = await prisma.passwordResetToken.findMany({
      include: {
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });

    if (tokens.length === 0) {
      console.log('   ⚠️ Nenhum token encontrado no banco\n');
    } else {
      tokens.forEach((token, index) => {
        console.log(`\n   Token ${index + 1}:`);
        console.log(`   - ID: ${token.id}`);
        console.log(`   - User: ${token.user.name} (${token.user.email})`);
        console.log(`   - Token (hash): ${token.token.substring(0, 20)}...`);
        console.log(`   - Expira em: ${token.expiresAt}`);
        console.log(`   - Usado em: ${token.usedAt || 'Não usado'}`);
        console.log(`   - IP: ${token.ipAddress}`);
        console.log(`   - Criado em: ${token.createdAt}`);
      });
      console.log('');
    }

    // 3. Testa o token que você recebeu
    const tokenFromUrl = '61167d38347d2124f1307eb1586cf79237f1fdfead8d6b68666c836f9362523a';
    console.log('3️⃣ Testando token da URL:', tokenFromUrl.substring(0, 20) + '...');
    
    // Busca diretamente pelo token (sem hash)
    const directMatch = await prisma.passwordResetToken.findUnique({
      where: { token: tokenFromUrl },
    });
    
    if (directMatch) {
      console.log('   ✅ Token encontrado DIRETAMENTE (sem hash)');
    } else {
      console.log('   ❌ Token NÃO encontrado diretamente');
      
      // Tenta com hash
      const hashedToken = crypto.createHash('sha256').update(tokenFromUrl).digest('hex');
      console.log('   Tentando com SHA-256:', hashedToken.substring(0, 20) + '...');
      
      const hashedMatch = await prisma.passwordResetToken.findUnique({
        where: { token: hashedToken },
      });
      
      if (hashedMatch) {
        console.log('   ✅ Token encontrado COM HASH!');
      } else {
        console.log('   ❌ Token NÃO encontrado nem com hash');
      }
    }

    console.log('\n4️⃣ Verificando usuários no sistema:');
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
      },
    });
    console.log(`   Total de usuários: ${users.length}`);
    users.forEach(user => {
      console.log(`   - ${user.name} (${user.email})`);
    });

  } catch (error) {
    console.error('\n❌ ERRO no diagnóstico:', error);
  } finally {
    await prisma.$disconnect();
  }
}

diagnose();
