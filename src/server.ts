/**
 * Servidor Principal da Aplicação
 * Configura e inicia o servidor Express com todas as rotas e middlewares
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { authRoutes } from './routes/auth.routes';
import { walletRoutes } from './routes/wallet.routes';
import { categoryRoutes } from './routes/category.routes';
import { transactionRoutes } from './routes/transaction.routes';
import { transferRoutes } from './routes/transfer.routes';
import { dashboardRoutes } from './routes/dashboard.routes';

// Carrega variáveis de ambiente
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3333;

// ==================== MIDDLEWARES ====================

// Permite requisições de diferentes origens (CORS)
app.use(cors());

// Parse de JSON no body das requisições
app.use(express.json());

// ==================== ROTAS ====================

// Rota de saúde da API
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'API Minhas Finanças está funcionando!',
    timestamp: new Date().toISOString()
  });
});

// Rotas da aplicação
app.use('/api/auth', authRoutes);
app.use('/api/wallets', walletRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Rota para endpoints não encontrados
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Endpoint não encontrado',
    path: req.originalUrl 
  });
});

// ==================== INICIALIZAÇÃO ====================

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📊 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});
