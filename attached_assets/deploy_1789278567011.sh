#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
#  Crown Line Properties — Deploy Script
#  Usage:
#    chmod +x deploy.sh
#    ./deploy.sh
#    pm2 start ecosystem.config.cjs --env production   # первый запуск
#    pm2 reload ecosystem.config.cjs --env production  # последующие (zero-downtime)
#    pm2 save                                          # сохранить список процессов
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Цвета ──────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# ── Всегда работаем из корня проекта ──────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e ""
echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   Crown Line Properties — Deploy         ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
echo -e ""

# ── [0] Проверка .env ─────────────────────────────────────────────
echo -e "${YELLOW}[0/5] Checking .env ...${NC}"
if [ ! -f ".env" ]; then
  echo -e "${RED}✗  .env not found in: $(pwd)${NC}"
  echo -e ""
  echo -e "Create a .env file with the following variables:"
  echo -e "  DATABASE_URL=postgresql://user:pass@host:5432/dbname"
  echo -e "  SESSION_SECRET=<random 64-char string>"
  echo -e "  ADMIN_URL=/your-secret-admin-path"
  echo -e "  ADMIN_LOGIN=admin"
  echo -e "  ADMIN_PASSWORD=<strong password>"
  exit 1
fi
echo -e "${GREEN}  ✓ .env found${NC}"

# ── Проверяем нужные переменные ───────────────────────────────────
REQUIRED_VARS=(DATABASE_URL SESSION_SECRET ADMIN_URL ADMIN_LOGIN ADMIN_PASSWORD)
MISSING=()
for var in "${REQUIRED_VARS[@]}"; do
  if ! grep -qE "^${var}=" .env; then
    MISSING+=("$var")
  fi
done
if [ ${#MISSING[@]} -gt 0 ]; then
  echo -e "${RED}✗  Missing required variables in .env:${NC}"
  for v in "${MISSING[@]}"; do echo -e "     - $v"; done
  exit 1
fi
echo -e "${GREEN}  ✓ All required variables present${NC}"
# BASE_PATH is optional — defaults to '/' if not set in .env
if ! grep -qE "^BASE_PATH=" .env; then
  echo -e "  ℹ  BASE_PATH not set in .env — frontend will be built with base path '/'"
fi

# ── [1] Зависимости ───────────────────────────────────────────────
echo -e ""
echo -e "${YELLOW}[1/4] Installing dependencies (pnpm) ...${NC}"
pnpm install --frozen-lockfile
echo -e "${GREEN}  ✓ Dependencies installed${NC}"

# ── [2] Сборка API сервера ────────────────────────────────────────
echo -e ""
echo -e "${YELLOW}[2/4] Building API server ...${NC}"
pnpm --filter @workspace/api-server run build
echo -e "${GREEN}  ✓ API server built → artifacts/api-server/dist/${NC}"

# ── [3] Сборка фронтенда ──────────────────────────────────────────
echo -e ""
echo -e "${YELLOW}[3/4] Building frontend (coming-soon) ...${NC}"
pnpm --filter @workspace/coming-soon run build
echo -e "${GREEN}  ✓ Frontend built → artifacts/coming-soon/dist/${NC}"

# ── [4] Директория логов ──────────────────────────────────────────
echo -e ""
echo -e "${YELLOW}[4/4] Preparing logs directory ...${NC}"
mkdir -p artifacts/api-server/logs
echo -e "${GREEN}  ✓ logs/ ready at artifacts/api-server/logs/${NC}"

# ── [5] Симлинк .env → artifacts/api-server/.env ─────────────────
# PM2 запускает api-server с cwd=artifacts/api-server/, поэтому
# dotenv ищет .env именно там. Создаём симлинк на корневой .env.
echo -e ""
echo -e "${YELLOW}[PM2-pre] Linking .env into api-server directory ...${NC}"
ln -sf "$SCRIPT_DIR/.env" "$SCRIPT_DIR/artifacts/api-server/.env"
echo -e "${GREEN}  ✓ artifacts/api-server/.env → .env (symlink)${NC}"

# ── PM2: запуск или перезагрузка через pm2-start.sh ──────────────
# pm2-start.sh сам загружает .env в окружение перед вызовом PM2,
# поэтому никогда не вызывайте pm2 напрямую — только через этот скрипт.
echo -e ""
echo -e "${YELLOW}[PM2] Starting / reloading application via pm2-start.sh ...${NC}"
if pm2 describe crownline > /dev/null 2>&1; then
  bash "$SCRIPT_DIR/pm2-start.sh" reload
  echo -e "${GREEN}  ✓ crownline reloaded (zero-downtime)${NC}"
else
  bash "$SCRIPT_DIR/pm2-start.sh"
  echo -e "${GREEN}  ✓ crownline started${NC}"
fi

# ── Итог ──────────────────────────────────────────────────────────
echo -e ""
echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   ✓  Deploy complete                     ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
echo -e ""
echo -e "  ${GREEN}API server:${NC}     pm2 logs crownline"
echo -e "  ${GREEN}Frontend files:${NC} $(pwd)/artifacts/coming-soon/dist"
echo -e "  ${GREEN}Persist reboots:${NC} pm2 startup  (if not done yet)"
echo -e ""
