#!/usr/bin/env bash

# SwiftX PM2 wrapper.
#
# Usage:
#   ./pm2-start.sh
#   ./pm2-start.sh --reload
#   ./pm2-start.sh --status
#   ./pm2-start.sh --dry-run
#
# The default action is safe auto mode: start on the first deploy, reload on
# later deploys, and refuse to touch a process with the same name if it belongs
# to another cwd or entrypoint.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$SCRIPT_DIR/artifacts/api-server"
API_ENTRYPOINT="$API_DIR/dist/index.mjs"
ENV_FILE="${SWIFTX_ENV_FILE:-$SCRIPT_DIR/.env}"
ACTION="auto"
DRY_RUN=0

usage() {
  cat <<'USAGE'
Usage: ./pm2-start.sh [--reload|--start|--status|--dry-run] [--env-file PATH] [--name NAME]

Options:
  --reload       Reload the existing SwiftX process; fail if it is not running.
  --start        Start SwiftX; fail if the configured name is already running.
  --status       Show the scoped PM2 process state without changing PM2.
  --dry-run      Validate and print the PM2 action without changing PM2 state.
  --env-file     Use a different environment file instead of ./.env.
  --name         Override the PM2 process name (default: swiftx-api).
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --reload)
      ACTION="reload"
      shift
      ;;
    --start)
      ACTION="start"
      shift
      ;;
    --status)
      ACTION="status"
      shift
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --env-file)
      [[ $# -ge 2 ]] || { echo "ERROR: --env-file needs a path." >&2; exit 1; }
      ENV_FILE="$2"
      shift 2
      ;;
    --name)
      [[ $# -ge 2 ]] || { echo "ERROR: --name needs a value." >&2; exit 1; }
      SWIFTX_PM2_NAME="$2"
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

[[ -f "$ENV_FILE" ]] || {
  echo "ERROR: production environment file not found: ${ENV_FILE}" >&2
  exit 1
}
[[ -f "$SCRIPT_DIR/ecosystem.config.cjs" ]] || {
  echo "ERROR: ecosystem.config.cjs not found in ${SCRIPT_DIR}" >&2
  exit 1
}
if [[ "$DRY_RUN" -eq 0 && "$ACTION" != "status" ]]; then
  [[ -f "$API_ENTRYPOINT" ]] || {
    echo "ERROR: API build not found: ${API_ENTRYPOINT}" >&2
    echo "       Run ./deploy.sh first." >&2
    exit 1
  }
fi

# shellcheck source=scripts/load-production-env.sh
source "$SCRIPT_DIR/scripts/load-production-env.sh"
load_env_file "$ENV_FILE"
validate_production_env
validate_admin_credentials
validate_persistent_uploads_dir "$API_DIR"

PM2_NAME="${SWIFTX_PM2_NAME:-swiftx-api}"
validate_pm2_name "$PM2_NAME"
export NODE_ENV="production"
export SWIFTX_PM2_NAME="$PM2_NAME"

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "DRY RUN: would manage PM2 process '${PM2_NAME}'."
  echo "DRY RUN: expected cwd '${API_DIR}'."
  echo "DRY RUN: expected entrypoint '${API_ENTRYPOINT}'."
  echo "DRY RUN: persistent uploads directory '${SWIFTX_UPLOADS_DIR}' is present and writable."
  if [[ "$ACTION" == "status" ]]; then
    echo "DRY RUN: would show the scoped PM2 process state."
  else
    echo "DRY RUN: would reload an owned process or start it if absent."
  fi
  echo "DRY RUN: no PM2 process, saved process list, or files were changed."
  exit 0
fi

command -v pm2 >/dev/null 2>&1 || {
  echo "ERROR: pm2 is not installed or not available in PATH." >&2
  exit 1
}

PROCESS_STATE="$(
  pm2 jlist | node -e '
const fs = require("node:fs");

const [name, expectedCwd, expectedEntrypoint] = process.argv.slice(1);
const input = fs.readFileSync(0, "utf8").trim();
const processes = input ? JSON.parse(input) : [];
const processInfo = processes.find((item) => item.name === name);

if (!processInfo) {
  process.stdout.write("missing");
  process.exit(0);
}

const env = processInfo.pm2_env || {};
const actualCwd = env.pm_cwd || "";
const actualEntrypoint = env.pm_exec_path || processInfo.pm_exec_path || "";

if (actualCwd !== expectedCwd || actualEntrypoint !== expectedEntrypoint) {
  process.stdout.write("conflict");
  process.exit(0);
}

process.stdout.write("owned");
' "$PM2_NAME" "$API_DIR" "$API_ENTRYPOINT"
)"

if [[ "$ACTION" == "status" ]]; then
  echo "PM2 process '${PM2_NAME}' ownership state: ${PROCESS_STATE}"
  if [[ "$PROCESS_STATE" != "missing" ]]; then
    pm2 describe "$PM2_NAME" 2>&1 || true
  fi
  echo "No PM2 process, saved process list, or files were changed."
  exit 0
fi

case "$PROCESS_STATE" in
  owned)
    [[ "$ACTION" != "start" ]] || {
      echo "ERROR: PM2 process '${PM2_NAME}' is already running." >&2
      echo "       Use --reload or run ./deploy.sh for an update." >&2
      exit 1
    }
    echo "Reloading owned PM2 process '${PM2_NAME}'..."
    if pm2 reload "$PM2_NAME" --update-env; then
      :
    else
      reload_status="$?"
      post_reload_state="$(
        pm2 jlist | node -e '
const fs = require("node:fs");

const [name, expectedCwd, expectedEntrypoint] = process.argv.slice(1);
const input = fs.readFileSync(0, "utf8").trim();
const processes = input ? JSON.parse(input) : [];
const processInfo = processes.find((item) => item.name === name);

if (!processInfo) {
  process.stdout.write("missing");
  process.exit(0);
}

const env = processInfo.pm2_env || {};
const actualCwd = env.pm_cwd || "";
const actualEntrypoint = env.pm_exec_path || processInfo.pm_exec_path || "";
const status = env.status || "";

if (
  actualCwd !== expectedCwd ||
  actualEntrypoint !== expectedEntrypoint ||
  status !== "online"
) {
  process.stdout.write("not-active");
  process.exit(0);
}

process.stdout.write("owned");
' "$PM2_NAME" "$API_DIR" "$API_ENTRYPOINT"
      )" || post_reload_state="unknown"

      echo "ERROR: PM2 reload for '${PM2_NAME}' failed; the replacement process did not start (exit status ${reload_status})." >&2
      case "$post_reload_state" in
        owned)
          echo "RECOVERY: previous owned PM2 process '${PM2_NAME}' remains active." >&2
          echo "RECOVERY: persistent uploads directory remains '${SWIFTX_UPLOADS_DIR}'." >&2
          echo "RECOVERY: no unrelated PM2 processes were changed." >&2
          ;;
        missing|not-active)
          echo "RECOVERY: previous owned PM2 process '${PM2_NAME}' is not active." >&2
          echo "RECOVERY: no unrelated PM2 processes were changed; inspect the named process before retrying." >&2
          ;;
        *)
          echo "RECOVERY: could not confirm the named PM2 process state." >&2
          echo "RECOVERY: no unrelated PM2 processes were changed; inspect '${PM2_NAME}' before retrying." >&2
          ;;
      esac
      exit "$reload_status"
    fi
    ;;
  conflict)
    echo "ERROR: PM2 process '${PM2_NAME}' already exists but is not SwiftX." >&2
    echo "       Refusing to reload or overwrite another project." >&2
    exit 1
    ;;
  missing)
    [[ "$ACTION" != "reload" ]] || {
      echo "ERROR: PM2 process '${PM2_NAME}' is not running." >&2
      exit 1
    }
    echo "Starting PM2 process '${PM2_NAME}'..."
    pm2 start "$SCRIPT_DIR/ecosystem.config.cjs" --only "$PM2_NAME" --env production
    ;;
  *)
    echo "ERROR: could not determine PM2 process state safely." >&2
    exit 1
    ;;
esac

pm2 save
echo "PM2 process '${PM2_NAME}' is active and saved."