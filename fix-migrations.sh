#!/bin/bash

##############################################################################
# Script para Regenerar Migrations do Prisma (SQLite → PostgreSQL)
##############################################################################

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_step() {
    echo -e "\n${BLUE}==>${NC} ${GREEN}$1${NC}\n"
}

print_error() {
    echo -e "${RED}ERRO:${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}AVISO:${NC} $1"
}

echo -e "${BLUE}"
cat << "EOF"
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║     FIX: REGENERAR MIGRATIONS (SQLite → PostgreSQL)  ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

print_step "Removendo migrations antigas do SQLite..."

# Backup das migrations antigas (caso necessário)
if [ -d "prisma/migrations" ]; then
    BACKUP_DIR="prisma/migrations_backup_$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    cp -r prisma/migrations/* "$BACKUP_DIR/" 2>/dev/null || true
    print_success "Backup criado em: $BACKUP_DIR"
    
    # Remover migrations antigas
    rm -rf prisma/migrations
    print_success "Migrations antigas removidas"
else
    print_warning "Nenhuma migration antiga encontrada"
fi

print_step "Criando nova migration inicial para PostgreSQL..."

# Criar nova migration
npx prisma migrate dev --name init_postgresql

print_success "Nova migration criada com sucesso!"

echo ""
echo -e "${GREEN}✓ Migrations regeneradas!${NC}"
echo ""
echo -e "${YELLOW}Próximos passos:${NC}"
echo "  1. Verifique a nova migration em: ${BLUE}prisma/migrations/${NC}"
echo "  2. Faça commit das mudanças:"
echo -e "     ${BLUE}git add prisma/migrations${NC}"
echo -e "     ${BLUE}git commit -m 'chore: regenerar migrations para PostgreSQL'${NC}"
echo -e "     ${BLUE}git push${NC}"
echo ""
