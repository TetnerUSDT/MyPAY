#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
#  Crown Line Properties — PM2 start / reload wrapper
#  Загружает .env в окружение, затем запускает PM2.
#
#  Usage:
#    chmod +x pm2-start.sh
#    ./pm2-start.sh          # первый запуск
#    ./pm2-start.sh reload   # zero-downtime перезапуск
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -f ".env" ]; then
  echo "ERROR: .env not found in $(pwd)"
  exit 1
fi

# Экспортируем все переменные из .env в окружение текущего процесса
set -a
# shellcheck disable=SC1091
source .env
set +a

ACTION="${1:-start}"

if [ "$ACTION" = "reload" ]; then
  echo "Reloading PM2 process (zero-downtime)..."
  pm2 reload ecosystem.config.cjs --env production
else
  echo "Starting PM2 process..."
  pm2 start ecosystem.config.cjs --env production
fi

pm2 save
echo "Done."
