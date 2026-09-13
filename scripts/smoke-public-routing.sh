#!/usr/bin/env bash

# Verify the public reverse-proxy routes after a production deployment.
#
# Usage:
#   ./scripts/smoke-public-routing.sh --env-file .env
#   ./scripts/smoke-public-routing.sh --url https://pay.example.com

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${SWIFTX_ENV_FILE:-$ROOT_DIR/.env}"
PUBLIC_URL="${SWIFTX_PUBLIC_URL:-}"
CLIENT_ROUTE="/wallet"
UPLOAD_PATH="/uploads/assets/start-bg.webp"
TIMEOUT_SECONDS=15

usage() {
  cat <<'USAGE'
Usage: ./scripts/smoke-public-routing.sh [options]

Options:
  --url URL             Public HTTPS/HTTP origin to check. Defaults to PROJECT_URL.
  --env-file PATH       Load PROJECT_URL from this environment file.
  --client-route PATH   Client-side route to verify (default: /wallet).
  --upload-path PATH    Representative upload to verify
                       (default: /uploads/assets/start-bg.webp).
  --timeout SECONDS    Curl timeout for each request (default: 15).
  --help               Show this help.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --url)
      [[ $# -ge 2 ]] || { echo "ERROR: --url needs a value." >&2; exit 1; }
      PUBLIC_URL="$2"
      shift 2
      ;;
    --env-file)
      [[ $# -ge 2 ]] || { echo "ERROR: --env-file needs a path." >&2; exit 1; }
      ENV_FILE="$2"
      shift 2
      ;;
    --client-route)
      [[ $# -ge 2 ]] || { echo "ERROR: --client-route needs a path." >&2; exit 1; }
      CLIENT_ROUTE="$2"
      shift 2
      ;;
    --upload-path)
      [[ $# -ge 2 ]] || { echo "ERROR: --upload-path needs a path." >&2; exit 1; }
      UPLOAD_PATH="$2"
      shift 2
      ;;
    --timeout)
      [[ $# -ge 2 ]] || { echo "ERROR: --timeout needs a value." >&2; exit 1; }
      TIMEOUT_SECONDS="$2"
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
  ENV_FILE="$ROOT_DIR/$ENV_FILE"
fi

if [[ -z "$PUBLIC_URL" && -f "$ENV_FILE" ]]; then
  # shellcheck source=scripts/load-production-env.sh
  source "$SCRIPT_DIR/load-production-env.sh"
  load_env_file "$ENV_FILE"
  PUBLIC_URL="${PROJECT_URL:-}"
fi

if [[ -z "$PUBLIC_URL" ]]; then
  PUBLIC_URL="${PROJECT_URL:-}"
fi

[[ -n "$PUBLIC_URL" ]] || {
  echo "ERROR: public URL is not configured." >&2
  echo "       Set PROJECT_URL in ${ENV_FILE}, or pass --url https://example.com." >&2
  exit 1
}

[[ "$PUBLIC_URL" =~ ^https?://[^[:space:]]+$ ]] || {
  echo "ERROR: public URL must start with http:// or https:// and contain no spaces: ${PUBLIC_URL}" >&2
  exit 1
}

[[ "$TIMEOUT_SECONDS" =~ ^[1-9][0-9]*$ ]] || {
  echo "ERROR: --timeout must be a positive integer." >&2
  exit 1
}

normalize_path() {
  local path="$1"
  [[ "$path" == /* ]] || path="/$path"
  printf '%s' "$path"
}

CLIENT_ROUTE="$(normalize_path "$CLIENT_ROUTE")"
UPLOAD_PATH="$(normalize_path "$UPLOAD_PATH")"
PUBLIC_URL="${PUBLIC_URL%/}"

TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/swiftx-routing-smoke.XXXXXX")"
trap 'rm -rf "$TMP_DIR"' EXIT

request() {
  local label="$1"
  local path="$2"
  local body_file="$TMP_DIR/${label}.body"
  local headers_file="$TMP_DIR/${label}.headers"
  local error_file="$TMP_DIR/${label}.error"
  local url="${PUBLIC_URL}${path}"
  local status

  if ! status="$(
    curl \
      --silent \
      --show-error \
      --location \
      --max-time "$TIMEOUT_SECONDS" \
      --output "$body_file" \
      --dump-header "$headers_file" \
      --write-out '%{http_code}' \
      "$url" 2>"$error_file"
  )"; then
    echo "FAIL: ${label} could not reach ${url}." >&2
    sed 's/^/      /' "$error_file" >&2
    return 1
  fi

  if [[ "$status" != 2* ]]; then
    echo "FAIL: ${label} returned HTTP ${status}; expected a 2xx response from ${url}." >&2
    if [[ -s "$body_file" ]]; then
      head -c 240 "$body_file" | tr '\n' ' ' | sed 's/^/      response: /' >&2
      echo >&2
    fi
    return 1
  fi

  REQUEST_BODY_FILE="$body_file"
  REQUEST_HEADERS_FILE="$headers_file"
  echo "PASS: ${label} ${url} (HTTP ${status})"
}

check_health() {
  local label="$1"
  local path="$2"

  request "$label" "$path"
  if ! grep -Eq '"status"[[:space:]]*:[[:space:]]*"ok"' "$REQUEST_BODY_FILE"; then
    echo "FAIL: ${label} returned 2xx but did not contain JSON status=ok." >&2
    head -c 240 "$REQUEST_BODY_FILE" | tr '\n' ' ' | sed 's/^/      response: /' >&2
    echo >&2
    return 1
  fi
}

check_health "proxy health" "/healthz"
check_health "API health" "/api/healthz"

request "SPA client route" "$CLIENT_ROUTE"
if ! grep -Fq '<div id="root">' "$REQUEST_BODY_FILE"; then
  echo "FAIL: SPA client route ${CLIENT_ROUTE} did not return the frontend HTML root." >&2
  echo "      The SPA fallback may be missing or the route may be handled by the wrong upstream." >&2
  exit 1
fi

request "upload asset" "$UPLOAD_PATH"
if ! grep -Eiq '^content-type:[[:space:]]*image/' "$REQUEST_HEADERS_FILE"; then
  echo "FAIL: upload asset ${UPLOAD_PATH} was not served as an image response." >&2
  echo "      An HTML response usually means /uploads was routed to the frontend instead of the API." >&2
  grep -i '^content-type:' "$REQUEST_HEADERS_FILE" | sed 's/^/      /' >&2 || true
  exit 1
fi

echo "Public routing smoke check passed for ${PUBLIC_URL}."