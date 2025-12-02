# Migração: Lançamentos Recorrentes e Parcelados

## Alterações no Schema

Esta migração adiciona suporte para lançamentos recorrentes e parcelados no sistema.

### Novos Campos no Modelo Transaction

```prisma
// Campos de Recorrência
isRecurring      Boolean  @default(false) // Se é recorrente
recurringType    String? // "WEEKLY", "MONTHLY", "YEARLY", "INDEFINITE"
recurringGroupId String? // Agrupa lançamentos recorrentes

// Campos de Parcelamento
isInstallment      Boolean @default(false) // Se é parcelado
installments       Int? // Número total de parcelas
currentInstallment Int? // Número da parcela atual (1, 2, 3...)
installmentGroupId String? // Agrupa lançamentos parcelados
```

## Como Aplicar a Migração

### 1. Gerar a migração

```bash
cd backend
npm run prisma:migrate
```

Quando solicitado, dê um nome descritivo: `add_recurring_installment_fields`

### 2. O Prisma vai criar o arquivo SQL automaticamente

### 3. Aplicar a migração

```bash
npm run prisma:generate
```

## Funcionalidades Implementadas

### Lançamentos Recorrentes

- **Semanal**: Cria lançamentos a cada 7 dias
- **Mensal**: Cria lançamentos a cada mês
- **Anual**: Cria lançamentos a cada ano
- **Sem data definida**: Cria 36 lançamentos mensais

Ao criar um lançamento recorrente, o sistema automaticamente:
1. Gera todos os lançamentos futuros
2. Agrupa-os com um `recurringGroupId` único
3. Permite editar/excluir um único lançamento ou todo o grupo

### Lançamentos Parcelados

- Define o número de parcelas
- Divide o valor total igualmente entre as parcelas
- Cria lançamentos mensais
- Adiciona "(X/Y)" na descrição de cada parcela

Ao criar um lançamento parcelado, o sistema automaticamente:
1. Divide o valor pelo número de parcelas
2. Cria um lançamento para cada parcela
3. Agrupa-os com um `installmentGroupId` único
4. Numera as parcelas (1, 2, 3, etc.)
5. Permite editar/excluir uma única parcela ou todas

## API Endpoints Atualizados

### POST /api/transactions
Novos campos aceitos:
```json
{
  "isRecurring": true,
  "recurringType": "MONTHLY",
  
  // OU
  
  "isInstallment": true,
  "installments": 12
}
```

### PUT /api/transactions/:id
Novo campo aceito:
```json
{
  "updateAll": true  // Atualiza todos do grupo
}
```

### DELETE /api/transactions/:id
Novo query parameter:
```
DELETE /api/transactions/:id?deleteAll=true
```

## Interface do Usuário

### Formulário de Criação/Edição

- Checkbox "Lançamento Recorrente"
  - Habilita select com opções: Semanal, Mensal, Anual, Sem data definida
- Checkbox "Lançamento Parcelado"
  - Habilita input para número de parcelas
- Os dois tipos são mutuamente exclusivos

### Confirmações

Ao editar ou excluir um lançamento recorrente/parcelado, um modal pergunta:
- "Apenas este lançamento"
- "Todos do grupo"

### Visualização

Os lançamentos exibem chips indicando:
- Status: Pago / Pendente
- Tipo: Recorrente (se aplicável)
- Parcela: "X/Y" (se parcelado)

## Regras de Negócio

1. Um lançamento NÃO pode ser recorrente E parcelado ao mesmo tempo
2. Lançamentos recorrentes/parcelados são criados não pagos por padrão
3. Cada grupo tem um ID único para facilitar operações em massa
4. Ao deletar todos de um grupo, o saldo é ajustado apenas para os lançamentos que estavam pagos
5. A descrição das parcelas é automaticamente alterada para incluir "(X/Y)"
