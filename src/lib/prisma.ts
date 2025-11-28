/**
 * Cliente do Prisma - Singleton
 * Gerencia a conexão com o banco de dados
 */

import { PrismaClient } from '@prisma/client';

// Cria uma única instância do Prisma Client para toda a aplicação
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

export { prisma };
