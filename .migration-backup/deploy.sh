#!/bin/bash

# =============================================================================
# myPay — Deploy Script
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh             # install + build + start/reload PM2
#   ./deploy.sh --no-build  # skip build, just reload PM2
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log()     { echo -e "${CYAN}[deploy]${NC} $1"; }
success() { echo -e "${GREEN}[✔]${NC} $1"; }
warn()    { echo -e "${YELLOW}[⚠]${NC} $1"; }
error()   { echo -e "${RED}[✘]${NC} $1"; exit 1; }

DO_BUILD=true
PM2_APP_NAME="myPay"

for arg in "$@"; do
  case $arg in
    --no-build) DO_BUILD=false ;;
    --help|-h)
      echo "Usage: ./deploy.sh [--no-build]"
      exit 0
      ;;
    *) warn "Unknown flag: $arg (ignored)" ;;
  esac
done

echo ""
echo -e "${BOLD}${CYAN}╔══════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║        myPay Deployment              ║${NC}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════╝${NC}"
echo -e "  Started: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# ── Checks ────────────────────────────────────────────────────────────────────
[ -f "package.json" ] || error "package.json not found. Run from project root."
[ -f ".env" ]         || error ".env not found. Create it before deploying."
command -v node &>/dev/null || error "Node.js is not installed."
command -v pm2  &>/dev/null || error "PM2 is not installed. Run: npm i -g pm2"

success "Node $(node --version) / npm $(npm --version) / PM2 $(pm2 --version)"

# ── Install dependencies ───────────────────────────────────────────────────────
# Fix Replit-internal registry URLs in lockfile (not resolvable outside Replit)
if [ -f "package-lock.json" ] && grep -q "package-firewall.replit.local" package-lock.json 2>/dev/null; then
  log "Patching package-lock.json: replacing Replit registry URLs..."
  sed -i 's|http://package-firewall.replit.local/npm/|https://registry.npmjs.org/|g' package-lock.json
  success "package-lock.json patched"
fi

log "Installing dependencies..."
npm install --registry https://registry.npmjs.org 2>&1 | tail -3
success "Dependencies installed"

# ── Build ─────────────────────────────────────────────────────────────────────
if [ "$DO_BUILD" = true ]; then
  log "Building application..."
  npm run build 2>&1 || error "Build failed."
  success "Build completed"
fi

# ── Upload dirs ────────────────────────────────────────────────────────────────
mkdir -p public/uploads/{system,users,icons/cryptocurrency,balances,assets,support}
mkdir -p logs

# ── PM2: reload or start ───────────────────────────────────────────────────────
log "Starting/reloading PM2 process '$PM2_APP_NAME'..."

if pm2 describe "$PM2_APP_NAME" &>/dev/null; then
  pm2 reload ecosystem.config.cjs --update-env
  success "PM2 process reloaded (zero-downtime)"
else
  pm2 start ecosystem.config.cjs
  pm2 save
  success "PM2 process started: $PM2_APP_NAME"
fi

# ── Status ────────────────────────────────────────────────────────────────────
sleep 2
PM2_STATUS=$(pm2 jlist 2>/dev/null | node -e "
  let d=''; process.stdin.on('data',c=>d+=c).on('end',()=>{
    try{ const p=JSON.parse(d).find(x=>x.name==='$PM2_APP_NAME');
    console.log(p?p.pm2_env.status:'not found'); }catch(e){ console.log('unknown'); }
  });
" 2>/dev/null || echo "unknown")

echo ""
if [ "$PM2_STATUS" = "online" ]; then
  echo -e "${BOLD}${GREEN}╔══════════════════════════════════════╗${NC}"
  echo -e "${BOLD}${GREEN}║     Deployment complete ✔            ║${NC}"
  echo -e "${BOLD}${GREEN}╚══════════════════════════════════════╝${NC}"
else
  echo -e "${BOLD}${YELLOW}╔══════════════════════════════════════╗${NC}"
  echo -e "${BOLD}${YELLOW}║  Done, but status: ${PM2_STATUS}           ${NC}"
  echo -e "${BOLD}${YELLOW}╚══════════════════════════════════════╝${NC}"
  warn "Check logs: pm2 logs $PM2_APP_NAME"
fi
echo -e "  Finished: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

pm2 list
