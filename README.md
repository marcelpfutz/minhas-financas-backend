# 💰 Minhas Finanças - Backend

API RESTful para sistema de controle financeiro pessoal desenvolvida em Node.js com TypeScript.

## 🚀 Tecnologias

- **Node.js** - Runtime JavaScript
- **TypeScript** - Superset tipado do JavaScript
- **Express** - Framework web
- **Prisma** - ORM para banco de dados
- **SQLite** - Banco de dados (com possibilidade de migração)
- **JWT** - Autenticação via JSON Web Token
- **Zod** - Validação de schemas

## 📋 Funcionalidades

- ✅ Autenticação de usuários (registro e login)
- ✅ Gestão de carteiras (contas bancárias, carteira física, etc)
- ✅ Categorias personalizadas (receitas e despesas)
- ✅ Lançamentos financeiros com controle de vencimento
- ✅ Transferências entre carteiras
- ✅ Dashboard com estatísticas e projeções
- ✅ Controle de lançamentos pagos e pendentes
- ✅ Alertas de vencimento

## 🗂️ Estrutura do Projeto

```
backend/
├── prisma/
│   └── schema.prisma          # Schema do banco de dados
├── src/
│   ├── controllers/           # Lógica de negócio
│   │   ├── auth.controller.ts
│   │   ├── wallet.controller.ts
│   │   ├── category.controller.ts
│   │   ├── transaction.controller.ts
│   │   ├── transfer.controller.ts
│   │   └── dashboard.controller.ts
│   ├── routes/                # Definição de rotas
│   │   ├── auth.routes.ts
│   │   ├── wallet.routes.ts
│   │   ├── category.routes.ts
│   │   ├── transaction.routes.ts
│   │   ├── transfer.routes.ts
│   │   └── dashboard.routes.ts
│   ├── middlewares/           # Middlewares personalizados
│   │   └── auth.middleware.ts
│   ├── lib/                   # Bibliotecas e utilitários
│   │   └── prisma.ts
│   └── server.ts              # Arquivo principal
├── package.json
├── tsconfig.json
└── .env.example
```

## 🔧 Instalação

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

Copie o arquivo `.env.example` para `.env` e configure as variáveis:

```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas configurações:

```env
PORT=3333
NODE_ENV=development
DATABASE_URL="file:./dev.db"
JWT_SECRET=sua_chave_secreta_aqui
JWT_EXPIRES_IN=7d
```

### 3. Configurar banco de dados

Execute as migrations do Prisma:

```bash
npm run prisma:generate
npm run prisma:migrate
```

### 4. Iniciar o servidor

**Modo desenvolvimento (com hot reload):**
```bash
npm run dev
```

**Modo produção:**
```bash
npm run build
npm start
```

O servidor estará rodando em `http://localhost:3333`

## 📡 Endpoints da API

### Autenticação

| Método | Endpoint | Descrição | Autenticação |
|--------|----------|-----------|--------------|
| POST | `/api/auth/register` | Registrar novo usuário | Não |
| POST | `/api/auth/login` | Login de usuário | Não |
| GET | `/api/auth/me` | Dados do usuário autenticado | Sim |

### Carteiras

| Método | Endpoint | Descrição | Autenticação |
|--------|----------|-----------|--------------|
| GET | `/api/wallets` | Listar todas as carteiras | Sim |
| GET | `/api/wallets/:id` | Buscar carteira específica | Sim |
| POST | `/api/wallets` | Criar nova carteira | Sim |
| PUT | `/api/wallets/:id` | Atualizar carteira | Sim |
| DELETE | `/api/wallets/:id` | Deletar carteira | Sim |

### Categorias

| Método | Endpoint | Descrição | Autenticação |
|--------|----------|-----------|--------------|
| GET | `/api/categories` | Listar categorias (filtro: `?type=INCOME` ou `?type=EXPENSE`) | Sim |
| GET | `/api/categories/:id` | Buscar categoria específica | Sim |
| POST | `/api/categories` | Criar nova categoria | Sim |
| PUT | `/api/categories/:id` | Atualizar categoria | Sim |
| DELETE | `/api/categories/:id` | Deletar categoria | Sim |

### Lançamentos

| Método | Endpoint | Descrição | Autenticação |
|--------|----------|-----------|--------------|
| GET | `/api/transactions` | Listar lançamentos (suporta filtros) | Sim |
| GET | `/api/transactions/:id` | Buscar lançamento específico | Sim |
| POST | `/api/transactions` | Criar novo lançamento | Sim |
| PUT | `/api/transactions/:id` | Atualizar lançamento | Sim |
| DELETE | `/api/transactions/:id` | Deletar lançamento | Sim |
| POST | `/api/transactions/:id/pay` | Marcar como pago | Sim |

**Filtros disponíveis:**
- `?type=INCOME` ou `?type=EXPENSE`
- `?isPaid=true` ou `?isPaid=false`
- `?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
- `?walletId=uuid`
- `?categoryId=uuid`

### Transferências

| Método | Endpoint | Descrição | Autenticação |
|--------|----------|-----------|--------------|
| GET | `/api/transfers` | Listar transferências | Sim |
| GET | `/api/transfers/:id` | Buscar transferência específica | Sim |
| POST | `/api/transfers` | Criar nova transferência | Sim |
| DELETE | `/api/transfers/:id` | Deletar transferência | Sim |

### Dashboard

| Método | Endpoint | Descrição | Autenticação |
|--------|----------|-----------|--------------|
| GET | `/api/dashboard/summary` | Resumo financeiro (filtro: `?month=1&year=2025`) | Sim |
| GET | `/api/dashboard/upcoming` | Lançamentos próximos (filtro: `?days=7`) | Sim |
| GET | `/api/dashboard/category-stats` | Estatísticas por categoria | Sim |
| GET | `/api/dashboard/projection` | Projeção financeira (filtro: `?months=3`) | Sim |

## 🔐 Autenticação

A API usa JWT (JSON Web Token) para autenticação. Inclua o token no header de todas as requisições protegidas:

```
Authorization: Bearer seu_token_aqui
```

## 📝 Exemplos de Requisições

### Registro de Usuário

```bash
POST /api/auth/register
Content-Type: application/json

{
  "name": "João Silva",
  "email": "joao@email.com",
  "password": "senha123"
}
```

### Criar Carteira

```bash
POST /api/wallets
Authorization: Bearer seu_token
Content-Type: application/json

{
  "name": "Conta Corrente",
  "description": "Banco XYZ",
  "balance": 1000.00,
  "color": "#3B82F6",
  "icon": "bank"
}
```

### Criar Lançamento

```bash
POST /api/transactions
Authorization: Bearer seu_token
Content-Type: application/json

{
  "description": "Salário",
  "amount": 5000.00,
  "type": "INCOME",
  "dueDate": "2025-12-05",
  "isPaid": true,
  "walletId": "uuid-da-carteira",
  "categoryId": "uuid-da-categoria"
}
```

### Criar Transferência

```bash
POST /api/transfers
Authorization: Bearer seu_token
Content-Type: application/json

{
  "amount": 500.00,
  "description": "Transferência para poupança",
  "fromWalletId": "uuid-carteira-origem",
  "toWalletId": "uuid-carteira-destino"
}
```

## 🎯 Scripts Disponíveis

```bash
npm run dev              # Inicia em modo desenvolvimento
npm run build            # Compila TypeScript para JavaScript
npm start                # Inicia em modo produção
npm run prisma:generate  # Gera o Prisma Client
npm run prisma:migrate   # Executa migrations do banco
npm run prisma:studio    # Abre interface visual do Prisma
```

## 🔄 Migração de Banco de Dados

O projeto está configurado com SQLite para facilitar o desenvolvimento, mas pode ser migrado para PostgreSQL, MySQL ou outro banco:

1. Instale o driver do banco desejado
2. Altere o `provider` em `prisma/schema.prisma`
3. Atualize a `DATABASE_URL` no `.env`
4. Execute as migrations: `npm run prisma:migrate`

Exemplo para PostgreSQL:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

## 📄 Licença

Este projeto é de código aberto e está disponível sob a licença ISC.
