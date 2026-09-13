#!/usr/bin/env bash

# SwiftX production deploy.
#
# Usage:
#   ./deploy.sh
#   ./deploy.sh --dry-run
#   ./deploy.sh --env-file /srv/swiftx/.env
#
# This script builds both workspace packages and then delegates the only PM2
# operation to pm2-start.sh. It never uses global PM2 commands such as
# "restart all" and refuses a name collision with another project.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SWIFTX_ENV_FILE:-$SCRIPT_DIR/.env}"
DRY_RUN=0

usage() {
  cat <<'USAGE'
Usage: ./deploy.sh [--dry-run] [--env-file PATH]

Options:
  --dry-run      Validate the environment and print the deployment plan.
                 It does not install, build, create links, or change PM2.
  --env-file     Use a different environment file instead of ./.env.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --env-file)
      [[ $# -ge 2 ]] || { echo "ERROR: --env-file needs a path." >&2; exit 1; }
      ENV_FILE="$2"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "ERROR: unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ "$ENV_FILE" != /* ]]; then
  ENV_FILE="$SCRIPT_DIR/$ENV_FILE"
fi

cd "$SCRIPT_DIR"

[[ -f "$ENV_FILE" ]] || {
  echo "ERROR: production environment file not found: ${ENV_FILE}" >&2
  echo "       Copy .env.example to .env and fill it on the server." >&2
  exit 1
}
[[ -f "$SCRIPT_DIR/pnpm-lock.yaml" ]] || {
  echo "ERROR: pnpm-lock.yaml is missing." >&2
  exit 1
}
[[ -f "$SCRIPT_DIR/artifacts/api-server/package.json" ]] || {
  echo "ERROR: API package is missing." >&2
  exit 1
}
[[ -f "$SCRIPT_DIR/artifacts/swiftx/package.json" ]] || {
  echo "ERROR: frontend package is missing." >&2
  exit 1
}

# shellcheck source=scripts/load-production-env.sh
source "$SCRIPT_DIR/scripts/load-production-env.sh"
load_env_file "$ENV_FILE"
validate_production_env

PM2_NAME="${SWIFTX_PM2_NAME:-swiftx-api}"
validate_pm2_name "$PM2_NAME"

for command_name in node pnpm; do
  command -v "$command_name" >/dev/null 2>&1 || {
    echo "ERROR: ${command_name} is not installed or not available in PATH." >&2
    exit 1
  }
done

export NODE_ENV="production"
export SWIFTX_PM2_NAME="$PM2_NAME"

run_step() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    printf 'DRY RUN:'
    printf ' %q' "$@"
    printf '\n'
    return 0
  fi

  "$@"
}

echo "SwiftX production deploy"
echo "  environment: ${ENV_FILE}"
echo "  PM2 process: ${PM2_NAME}"
echo "  API port: ${PORT}"
echo "  Uploads:     ${SWIFTX_UPLOADS_DIR:-/var/lib/swiftx/uploads}"
echo

run_step pnpm install --frozen-lockfile
run_step pnpm --filter @workspace/api-server run build
run_step pnpm --filter @workspace/swiftx run build

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "DRY RUN: would create artifacts/api-server/logs."
  echo "DRY RUN: would verify artifacts/api-server/.env points to the selected environment file."
else
  mkdir -p "$SCRIPT_DIR/artifacts/api-server/logs"
  ensure_env_symlink \
    "$ENV_FILE" \
    "$SCRIPT_DIR/artifacts/api-server/.env"
fi

if [[ "$DRY_RUN" -eq 1 ]]; then
  bash "$SCRIPT_DIR/pm2-start.sh" \
    --dry-run \
    --env-file "$ENV_FILE" \
    --name "$PM2_NAME"
else
  bash "$SCRIPT_DIR/pm2-start.sh" \
    --env-file "$ENV_FILE" \
    --name "$PM2_NAME"
fi

# Verify the public proxy only after the API is ready. Keep this behind
# run_step so --dry-run prints the release plan without making network calls.
run_step bash "$SCRIPT_DIR/scripts/smoke-public-routing.sh" \
  --env-file "$ENV_FILE"

echo
echo "Deploy complete."
echo "  Frontend files: ${SCRIPT_DIR}/artifacts/swiftx/dist/public"
echo "  API logs:       pm2 logs ${PM2_NAME}"
echo "  API endpoint:   127.0.0.1:${PORT}"
echo "  Configure nginx to serve the frontend directory and proxy /api and /uploads to this port."
echo "  Reverse proxy:  ${SCRIPT_DIR}/deploy/nginx/swiftx.conf.template"
echo "  Public routing check (manual): ${SCRIPT_DIR}/scripts/smoke-public-routing.sh --env-file ${ENV_FILE}"
echo "  Setup guide:    ${SCRIPT_DIR}/DEPLOYMENT.md"
