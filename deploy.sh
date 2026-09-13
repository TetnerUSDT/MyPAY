#!/usr/bin/env bash

# SwiftX production deploy.
#
# Usage:
#   ./deploy.sh
#   ./deploy.sh --dry-run
#   ./deploy.sh --env-file /srv/swiftx/.env
#
# This script builds both workspace packages, applies the reverse-proxy
# configuration, and then delegates the only PM2 operation to pm2-start.sh.
# It never uses global PM2 commands such as "restart all" and refuses a name
# collision with another project.

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

RELEASE_REVISION="$(git rev-parse --verify HEAD 2>/dev/null || printf 'unknown')"
RELEASE_TREE_STATE="clean"
if [[ -n "$(git status --porcelain 2>/dev/null)" ]]; then
  RELEASE_TREE_STATE="dirty"
fi

report_failed_release() {
  local exit_status="$?"
  trap - EXIT

  if [[ "$exit_status" -eq 0 ]]; then
    exit 0
  fi

  echo >&2
  echo "ERROR: release failed (exit status ${exit_status})." >&2
  echo "Active release and process state:" >&2
  echo "  checkout:       ${SCRIPT_DIR}" >&2
  echo "  source revision: ${RELEASE_REVISION} (${RELEASE_TREE_STATE} worktree)" >&2
  echo "  API entrypoint:  ${SCRIPT_DIR}/artifacts/api-server/dist/index.mjs" >&2
  echo "  PM2 process:     ${PM2_NAME:-unknown}" >&2
  echo "  API port:        ${PORT:-unknown}" >&2
  echo "  uploads:         ${SWIFTX_UPLOADS_DIR:-unknown} (not modified by recovery reporting)" >&2

  if [[ "$DRY_RUN" -eq 0 && -f "$ENV_FILE" && -x "$SCRIPT_DIR/pm2-start.sh" ]] &&
    command -v pm2 >/dev/null 2>&1; then
    echo "  scoped PM2 inspection:" >&2
    bash "$SCRIPT_DIR/pm2-start.sh" \
      --status \
      --env-file "$ENV_FILE" \
      --name "${PM2_NAME:-swiftx-api}" >&2 || {
      echo "  PM2 status inspection could not complete; inspect it manually with the commands in DEPLOYMENT.md." >&2
    }
  else
    echo "  PM2 status inspection was unavailable during this failure." >&2
  fi

  echo "The checkout may already be serving this release if PM2 was reloaded." >&2
  echo "Inspect the scoped process before deciding whether to keep it or recover a known-good revision." >&2
  echo "Recovery guide: ${SCRIPT_DIR}/DEPLOYMENT.md (Recover a failed release)." >&2
  exit "$exit_status"
}

trap report_failed_release EXIT

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
NGINX_TEMPLATE="$SCRIPT_DIR/deploy/nginx/swiftx.conf.template"
[[ -f "$NGINX_TEMPLATE" ]] || {
  echo "ERROR: Nginx configuration template is missing: ${NGINX_TEMPLATE}" >&2
  exit 1
}

# shellcheck source=scripts/load-production-env.sh
source "$SCRIPT_DIR/scripts/load-production-env.sh"
load_env_file "$ENV_FILE"
validate_production_env
validate_admin_credentials
validate_persistent_uploads_dir "$SCRIPT_DIR/artifacts/api-server"

derive_nginx_domain() {
  if [[ -n "${SWIFTX_DOMAIN:-}" ]]; then
    printf '%s' "$SWIFTX_DOMAIN"
    return 0
  fi

  [[ -n "${PROJECT_URL:-}" ]] || {
    echo "ERROR: PROJECT_URL or SWIFTX_DOMAIN is required to configure Nginx." >&2
    return 1
  }

  node -e '
    const rawUrl = process.argv[1];
    try {
      const url = new URL(rawUrl);
      if (!["http:", "https:"].includes(url.protocol) || !url.hostname) {
        process.exit(1);
      }
      process.stdout.write(url.hostname);
    } catch {
      process.exit(1);
    }
  ' "$PROJECT_URL" || {
    echo "ERROR: PROJECT_URL must be a valid http:// or https:// URL." >&2
    return 1
  }
}

validate_nginx_domain() {
  local domain="$1"

  [[ -n "$domain" ]] || {
    echo "ERROR: Nginx server name cannot be empty." >&2
    return 1
  }
  [[ "$domain" =~ ^[A-Za-z0-9.*_-]+([[:space:]]+[A-Za-z0-9.*_-]+)*$ ]] || {
    echo "ERROR: SWIFTX_DOMAIN contains unsupported Nginx server-name characters." >&2
    echo "       Use one or more hostnames separated by spaces." >&2
    return 1
  }
}

PM2_NAME="${SWIFTX_PM2_NAME:-swiftx-api}"
validate_pm2_name "$PM2_NAME"

SWIFTX_ROOT="$SCRIPT_DIR"
SWIFTX_API_PORT="$PORT"
SWIFTX_DOMAIN="$(derive_nginx_domain)"
validate_nginx_domain "$SWIFTX_DOMAIN"
export SWIFTX_ROOT SWIFTX_API_PORT SWIFTX_DOMAIN

NGINX_CONFIG="${SWIFTX_NGINX_CONFIG:-/etc/nginx/sites-available/swiftx.conf}"
NGINX_ENABLED_CONFIG="${SWIFTX_NGINX_ENABLED_CONFIG:-/etc/nginx/sites-enabled/swiftx.conf}"
for nginx_path in "$NGINX_CONFIG" "$NGINX_ENABLED_CONFIG"; do
  [[ "$nginx_path" == /* ]] || {
    echo "ERROR: Nginx paths must be absolute: ${nginx_path}" >&2
    exit 1
  }
done
[[ "$NGINX_CONFIG" != "$NGINX_ENABLED_CONFIG" ]] || {
  echo "ERROR: Nginx config and enabled-link paths must be different." >&2
  exit 1
}

for command_name in node pnpm; do
  command -v "$command_name" >/dev/null 2>&1 || {
    echo "ERROR: ${command_name} is not installed or not available in PATH." >&2
    exit 1
  }
done
if [[ "$DRY_RUN" -eq 0 ]]; then
  for command_name in envsubst sudo nginx systemctl; do
    command -v "$command_name" >/dev/null 2>&1 || {
      echo "ERROR: ${command_name} is not installed or not available in PATH." >&2
      exit 1
    }
  done
fi

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

render_nginx_config() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "DRY RUN: would render ${NGINX_TEMPLATE} to ${NGINX_CONFIG}."
    echo "DRY RUN: would enable ${NGINX_ENABLED_CONFIG}."
    return 0
  fi

  local rendered_file
  rendered_file="$(mktemp "${TMPDIR:-/tmp}/swiftx-nginx.XXXXXX")"

  if ! envsubst \
    '${SWIFTX_DOMAIN} ${SWIFTX_ROOT} ${SWIFTX_API_PORT} ${SWIFTX_UPLOADS_DIR}' \
    < "$NGINX_TEMPLATE" \
    > "$rendered_file"; then
    rm -f "$rendered_file"
    echo "ERROR: failed to render the Nginx configuration template." >&2
    return 1
  fi

  if ! sudo install -D -m 0644 "$rendered_file" "$NGINX_CONFIG"; then
    rm -f "$rendered_file"
    echo "ERROR: failed to install the rendered Nginx configuration." >&2
    return 1
  fi
  rm -f "$rendered_file"

  sudo install -d -m 0755 "$(dirname "$NGINX_ENABLED_CONFIG")"
  sudo ln -sfn "$NGINX_CONFIG" "$NGINX_ENABLED_CONFIG"
}

echo "SwiftX production deploy"
echo "  environment: ${ENV_FILE}"
echo "  PM2 process: ${PM2_NAME}"
echo "  API port: ${PORT}"
echo "  Uploads:     ${SWIFTX_UPLOADS_DIR}"
echo "  Nginx site:  ${NGINX_CONFIG}"
echo "  Nginx domain: ${SWIFTX_DOMAIN}"
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

# Render and validate the proxy before reloading it. With set -e, a failed
# nginx -t stops the release before systemctl can reload the invalid config.
render_nginx_config
run_step sudo nginx -t
run_step sudo systemctl reload nginx

# Verify public routing only after both the API and the newly reloaded proxy
# are ready. Keep this behind run_step so --dry-run prints the release plan
# without making network calls.
run_step bash "$SCRIPT_DIR/scripts/smoke-public-routing.sh" \
  --env-file "$ENV_FILE"

echo
echo "Deploy complete."
echo "  Active release: ${RELEASE_REVISION} (${RELEASE_TREE_STATE} worktree)"
echo "  Frontend files: ${SCRIPT_DIR}/artifacts/swiftx/dist/public"
echo "  API logs:       pm2 logs ${PM2_NAME}"
echo "  API endpoint:   127.0.0.1:${PORT}"
echo "  Nginx config:   ${NGINX_CONFIG}"
echo "  Nginx recovery: sudo nginx -t && sudo systemctl reload nginx"
echo "  Public routing check (manual): ${SCRIPT_DIR}/scripts/smoke-public-routing.sh --env-file ${ENV_FILE}"
echo "  Setup guide:    ${SCRIPT_DIR}/DEPLOYMENT.md"
