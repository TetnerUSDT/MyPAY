#!/bin/bash

# =============================================================================
# SwiftX — Safe Deployment Script
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh             # full deploy (pull + install + build + reload)
#   ./deploy.sh --migrate   # also run DB schema push after build
#   ./deploy.sh --no-pull   # skip git pull (deploy current code)
#   ./deploy.sh --no-build  # skip npm build (just reload PM2)
# =============================================================================

set -euo pipefail

# ─── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log()     { echo -e "${BLUE}[deploy]${NC} $1"; }
success() { echo -e "${GREEN}[✔]${NC} $1"; }
warn()    { echo -e "${YELLOW}[⚠]${NC} $1"; }
error()   { echo -e "${RED}[✘]${NC} $1"; }
section() { echo -e "\n${BOLD}${CYAN}══ $1 ══${NC}"; }

# ─── Default flags ───────────────────────────────────────────────────────────
DO_PULL=true
DO_BUILD=true
DO_MIGRATE=false
PM2_APP_NAME="swiftx"
DIST_BACKUP_DIR=".dist_backup"

for arg in "$@"; do
  case $arg in
    --migrate)   DO_MIGRATE=true ;;
    --no-pull)   DO_PULL=false ;;
    --no-build)  DO_BUILD=false ;;
    --help|-h)
      echo "Usage: ./deploy.sh [--migrate] [--no-pull] [--no-build]"
      exit 0
      ;;
    *)
      warn "Unknown flag: $arg (ignored)"
      ;;
  esac
done

# ─── Timing ──────────────────────────────────────────────────────────────────
START_TIME=$(date +%s)

echo ""
echo -e "${BOLD}${CYAN}╔══════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║        SwiftX Deployment             ║${NC}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════╝${NC}"
echo -e "  Started: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# ─── 1. Pre-flight checks ─────────────────────────────────────────────────────
section "Pre-flight checks"

# Must be run from project root
if [ ! -f "package.json" ]; then
  error "package.json not found. Run this script from the project root."
  exit 1
fi

# Check .env file exists
if [ ! -f ".env" ]; then
  error ".env file not found. Create it from .env.example before deploying."
  exit 1
fi

# Check required environment variables are set in .env
REQUIRED_VARS=(DATABASE_URL TELEGRAM_BOT_TOKEN ADMIN_URL ADMIN_LOGIN ADMIN_PASSWORD)
MISSING_VARS=()
for var in "${REQUIRED_VARS[@]}"; do
  if ! grep -qE "^${var}=.+" .env 2>/dev/null; then
    MISSING_VARS+=("$var")
  fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
  error "Missing required variables in .env:"
  for v in "${MISSING_VARS[@]}"; do
    echo "   - $v"
  done
  exit 1
fi

# Check Node.js
if ! command -v node &>/dev/null; then
  error "Node.js is not installed."
  exit 1
fi
NODE_VER=$(node --version)
success "Node.js: $NODE_VER"

# Check npm
if ! command -v npm &>/dev/null; then
  error "npm is not installed."
  exit 1
fi
success "npm: $(npm --version)"

# Check PM2
PM2_AVAILABLE=false
if command -v pm2 &>/dev/null; then
  PM2_AVAILABLE=true
  success "PM2: $(pm2 --version)"
else
  warn "PM2 not found — will start process directly with node."
fi

success "Pre-flight checks passed"

# ─── 2. Git pull ──────────────────────────────────────────────────────────────
if [ "$DO_PULL" = true ]; then
  section "Pulling latest code"
  if [ -d ".git" ]; then
    # Stash any local uncommitted changes to prevent pull conflicts
    if ! git diff --quiet 2>/dev/null; then
      warn "Uncommitted local changes detected — stashing them"
      git stash push -m "deploy-script-autostash-$(date +%s)"
    fi
    CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
    log "Branch: $CURRENT_BRANCH"
    git pull --ff-only origin "$CURRENT_BRANCH"
    success "Code updated ($(git rev-parse --short HEAD))"
  else
    warn "Not a git repository — skipping git pull"
  fi
fi

# ─── 3. Install dependencies ──────────────────────────────────────────────────
section "Installing dependencies"
log "Running npm install..."
npm install --prefer-offline 2>&1 | tail -3
success "Dependencies installed"

# ─── 4. Build ─────────────────────────────────────────────────────────────────
if [ "$DO_BUILD" = true ]; then
  section "Building application"

  # Backup previous dist so we can rollback if build fails
  if [ -d "dist" ]; then
    log "Backing up previous dist to $DIST_BACKUP_DIR ..."
    rm -rf "$DIST_BACKUP_DIR"
    cp -r dist "$DIST_BACKUP_DIR"
  fi

  log "Building (vite + esbuild) ..."
  if npm run build 2>&1; then
    success "Build completed successfully"
    rm -rf "$DIST_BACKUP_DIR"
  else
    error "Build FAILED!"
    if [ -d "$DIST_BACKUP_DIR" ]; then
      warn "Restoring previous dist from backup..."
      rm -rf dist
      mv "$DIST_BACKUP_DIR" dist
      warn "Previous build restored — existing process should still work"
    fi
    exit 1
  fi
fi

# ─── 5. DB Migration (optional, behind flag) ──────────────────────────────────
if [ "$DO_MIGRATE" = true ]; then
  section "Database migration"
  warn "Running DB schema push — this modifies the database!"
  log "Using config: drizzle.mysql.config.ts"
  # Load env so drizzle-kit can connect
  set -a; source .env; set +a
  if npx drizzle-kit push --config=drizzle.mysql.config.ts 2>&1; then
    success "DB migration completed"
  else
    error "DB migration FAILED — application may still work with current schema"
    exit 1
  fi
fi

# ─── 6. Upload directories ────────────────────────────────────────────────────
section "Ensuring upload directories"
mkdir -p public/uploads/system
mkdir -p public/uploads/users
mkdir -p public/uploads/icons/cryptocurrency
mkdir -p public/uploads/balances
mkdir -p public/uploads/assets
mkdir -p public/uploads/support
success "Upload directories ready"

# ─── 7. PM2 / Process reload ─────────────────────────────────────────────────
section "Reloading application"

if [ "$PM2_AVAILABLE" = true ]; then
  # Check if the process already exists in PM2
  if pm2 describe "$PM2_APP_NAME" &>/dev/null; then
    log "PM2 process '$PM2_APP_NAME' found — performing graceful reload..."
    pm2 reload "$PM2_APP_NAME" --update-env
    success "PM2 process reloaded (zero-downtime)"
  else
    log "PM2 process '$PM2_APP_NAME' not found — starting fresh..."
    pm2 start dist/index.js \
      --name "$PM2_APP_NAME" \
      --node-args="--experimental-vm-modules" \
      --env production \
      --restart-delay=3000 \
      --max-restarts=10 \
      --wait-ready \
      --listen-timeout=10000
    success "PM2 process started: $PM2_APP_NAME"
    pm2 save
    log "PM2 startup saved (run 'pm2 startup' once to enable auto-start on reboot)"
  fi

  # Wait briefly then check status
  sleep 2
  PM2_STATUS=$(pm2 describe "$PM2_APP_NAME" 2>/dev/null | grep "status" | awk '{print $4}' | head -1)
  if [ "$PM2_STATUS" = "online" ]; then
    success "Process is ONLINE"
  else
    warn "Process status: ${PM2_STATUS:-unknown} — check 'pm2 logs $PM2_APP_NAME'"
  fi
else
  # Fallback: kill old node process on port 5000 (if any) and restart
  PORT=${PORT:-5000}
  EXISTING_PID=$(lsof -ti tcp:"$PORT" 2>/dev/null || true)
  if [ -n "$EXISTING_PID" ]; then
    warn "Killing existing process on port $PORT (PID $EXISTING_PID) ..."
    kill -SIGTERM "$EXISTING_PID" 2>/dev/null || true
    sleep 2
  fi
  log "Starting application in background..."
  nohup NODE_ENV=production node dist/index.js >> logs/app.log 2>&1 &
  NEW_PID=$!
  success "Application started (PID $NEW_PID)"
  log "Logs: logs/app.log"
fi

# ─── 8. Summary ───────────────────────────────────────────────────────────────
END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo ""
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}║     Deployment complete ✔            ║${NC}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════╝${NC}"
echo -e "  Finished: $(date '+%Y-%m-%d %H:%M:%S')"
echo -e "  Duration: ${ELAPSED}s"
echo ""

if [ "$PM2_AVAILABLE" = true ]; then
  pm2 list
fi
