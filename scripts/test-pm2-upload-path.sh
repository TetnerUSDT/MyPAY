#!/usr/bin/env bash

# End-to-end coverage for the upload directory passed through the production
# PM2 wrapper. The default fixture mode is safe for development. The
# --real-pm2 mode is deliberately explicit and is only for a release server
# with the real PM2 daemon and production resources available.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
API_DIR="$ROOT_DIR/artifacts/api-server"
FIXTURE_PM2="$SCRIPT_DIR/test-fixtures/fake-pm2.mjs"
REAL_PM2=0
ENV_FILE=""
PROJECT_ROOT=""
PROCESS_NAME="swiftx-upload-path-test"
ENV_FILE_SET=0
PROJECT_ROOT_SET=0
PROCESS_NAME_SET=0

usage() {
  cat <<'USAGE'
Usage: ./scripts/test-pm2-upload-path.sh
       ./scripts/test-pm2-upload-path.sh --real-pm2 \
         --project-root /srv/swiftx \
         --env-file /srv/swiftx/.env \
         --name swiftx-upload-path-check

Options:
  --real-pm2       Run against the real PM2 binary on the release server.
                   This mode does not use the development fixture.
  --project-root   Expected absolute release checkout path. Required with
                   --real-pm2 and must match the checkout containing this
                   script.
  --env-file       Production environment file. Required with --real-pm2.
  --name           Isolated SwiftX PM2 process name. Required with
                   --real-pm2; it must begin with "swiftx-".
  --help           Show this help.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --real-pm2)
      REAL_PM2=1
      shift
      ;;
    --project-root)
      [[ $# -ge 2 ]] || { echo "ERROR: --project-root needs a path." >&2; exit 1; }
      PROJECT_ROOT="$2"
      PROJECT_ROOT_SET=1
      shift 2
      ;;
    --env-file)
      [[ $# -ge 2 ]] || { echo "ERROR: --env-file needs a path." >&2; exit 1; }
      ENV_FILE="$2"
      ENV_FILE_SET=1
      shift 2
      ;;
    --name)
      [[ $# -ge 2 ]] || { echo "ERROR: --name needs a value." >&2; exit 1; }
      PROCESS_NAME="$2"
      PROCESS_NAME_SET=1
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

TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/swiftx-pm2-upload-path.XXXXXX")"
FAKE_BIN="$TMP_DIR/bin"
STATE_FILE="$TMP_DIR/pm2-state.json"
PM2_LOG="$TMP_DIR/pm2.log"
API_LOG="$TMP_DIR/api.log"
API_PORT=""
REAL_PM2_BIN=""

cleanup() {
  if [[ "$REAL_PM2" -eq 1 && -n "${PM2_HOME:-}" && -n "$REAL_PM2_BIN" ]]; then
    PM2_HOME="$PM2_HOME" "$REAL_PM2_BIN" delete "$PROCESS_NAME" >/dev/null 2>&1 || true
    PM2_HOME="$PM2_HOME" "$REAL_PM2_BIN" kill >/dev/null 2>&1 || true
  fi
  if [[ -x "$FAKE_BIN/pm2" ]]; then
    SWIFTX_TEST_PM2_STATE="$STATE_FILE" \
      SWIFTX_TEST_PM2_LOG="$PM2_LOG" \
      "$FAKE_BIN/pm2" delete "$PROCESS_NAME" >/dev/null 2>&1 || true
  fi
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

fail() {
  echo "FAIL: $*" >&2
  [[ ! -s "$API_LOG" ]] || cat "$API_LOG" >&2
  exit 1
}

assert_contains() {
  local label="$1"
  local expected="$2"
  local output="$3"

  grep -Fq "$expected" <<<"$output" || {
    printf '%s\n' "$output" >&2
    fail "${label} did not contain: ${expected}"
  }
}

wait_for_health() {
  for _ in {1..100}; do
    if curl --silent --show-error --fail \
      "http://127.0.0.1:${API_PORT}/api/healthz" >/dev/null 2>&1; then
      return
    fi
    sleep 0.05
  done
  fail "API did not become healthy on port ${API_PORT}."
}

read_process_state() {
  SWIFTX_TEST_PM2_STATE="$STATE_FILE" \
    SWIFTX_TEST_PM2_LOG="$PM2_LOG" \
    "$FAKE_BIN/pm2" jlist
}

assert_process_upload_dir() {
  local expected="$1"
  local state
  state="$(read_process_state)"
  assert_contains "PM2 process state" "\"SWIFTX_UPLOADS_DIR\":\"${expected}\"" "$state"
}

read_process_pid() {
  read_process_state | node -e '
const fs = require("node:fs");
const processes = JSON.parse(fs.readFileSync(0, "utf8"));
if (!processes[0]?.pm2_env?.pid) process.exit(1);
process.stdout.write(String(processes[0].pm2_env.pid));
'
}

assert_real_process_state() {
  local expected_uploads="$1"
  local state

  state="$("$REAL_PM2_BIN" jlist)"
  node -e '
const fs = require("node:fs");

const [name, expectedUploads, expectedCwd, expectedEntrypoint] = process.argv.slice(1);
const processes = JSON.parse(fs.readFileSync(0, "utf8"));
const processInfo = processes.find((item) => item.name === name);
const env = processInfo?.pm2_env || {};
const processEnv = env.env || {};

if (!processInfo || env.status !== "online") {
  console.error(`PM2 process ${name} is not online.`);
  process.exit(1);
}
if ((env.pm_cwd || "") !== expectedCwd) {
  console.error(`PM2 process ${name} has unexpected cwd: ${env.pm_cwd || "<missing>"}`);
  process.exit(1);
}
if ((env.pm_exec_path || processInfo.pm_exec_path || "") !== expectedEntrypoint) {
  console.error(`PM2 process ${name} has unexpected entrypoint.`);
  process.exit(1);
}
if (processEnv.SWIFTX_UPLOADS_DIR !== expectedUploads) {
  console.error(
    `PM2 process ${name} has unexpected SWIFTX_UPLOADS_DIR: ` +
      `${processEnv.SWIFTX_UPLOADS_DIR || "<missing>"}`,
  );
  process.exit(1);
}
' "$PROCESS_NAME" "$expected_uploads" "$API_DIR" "$API_DIR/dist/index.mjs" <<<"$state" || {
    fail "real PM2 process state did not match the release checkout and upload directory."
  }
}

run_real_pm2_check() {
  [[ "$ENV_FILE_SET" -eq 1 ]] || {
    fail "real PM2 mode requires --env-file pointing to the production environment."
  }
  [[ "$PROJECT_ROOT_SET" -eq 1 ]] || {
    fail "real PM2 mode requires --project-root pointing to the release checkout."
  }
  [[ "$PROCESS_NAME_SET" -eq 1 ]] || {
    fail "real PM2 mode requires an isolated --name for the SwiftX process."
  }
  [[ "$PROCESS_NAME" == swiftx-* ]] || {
    fail "real PM2 process name must begin with 'swiftx-'."
  }

  command -v pm2 >/dev/null 2>&1 || {
    fail "real PM2 mode is only available on a release server with pm2 installed."
  }
  command -v curl >/dev/null 2>&1 || fail "curl is required for the real PM2 check."
  [[ -f "$API_DIR/dist/index.mjs" ]] || {
    fail "built API entrypoint not found: $API_DIR/dist/index.mjs"
  }
  [[ -f "$ROOT_DIR/ecosystem.config.cjs" ]] || {
    fail "ecosystem.config.cjs not found in the release checkout."
  }

  local expected_root actual_root
  expected_root="$(readlink -f -- "$PROJECT_ROOT")" || {
    fail "could not resolve the requested release root: $PROJECT_ROOT"
  }
  actual_root="$(readlink -f -- "$ROOT_DIR")" || {
    fail "could not resolve the checkout containing this script: $ROOT_DIR"
  }
  [[ "$expected_root" == "$actual_root" ]] || {
    fail "release root does not match this checkout (expected=$expected_root, actual=$actual_root)."
  }

  [[ "$ENV_FILE" == /* ]] || ENV_FILE="$ROOT_DIR/$ENV_FILE"
  [[ -f "$ENV_FILE" ]] || {
    fail "production environment file not found: $ENV_FILE"
  }

  # Load only the selected production environment. In particular, do not let
  # an inherited development upload path or port satisfy the release checks.
  unset DATABASE_URL PORT SWIFTX_API_PORT SWIFTX_UPLOADS_DIR
  # shellcheck source=scripts/load-production-env.sh
  source "$SCRIPT_DIR/load-production-env.sh"
  load_env_file "$ENV_FILE" || exit 1
  validate_production_env || exit 1

  local explicit_uploads default_uploads production_port
  explicit_uploads="${SWIFTX_UPLOADS_DIR:-}"
  [[ -n "$explicit_uploads" ]] || {
    fail "production environment must explicitly configure SWIFTX_UPLOADS_DIR."
  }
  validate_persistent_uploads_dir "$API_DIR" || exit 1
  explicit_uploads="$SWIFTX_UPLOADS_DIR"
  production_port="$PORT"

  # The release check verifies both the configured production path and the
  # documented fallback, so both must already be persistent directories.
  unset SWIFTX_UPLOADS_DIR
  validate_persistent_uploads_dir "$API_DIR" || exit 1
  default_uploads="$SWIFTX_UPLOADS_DIR"
  export SWIFTX_UPLOADS_DIR="$explicit_uploads"

  # A real release port must be available before this isolated PM2 run starts.
  # Refuse to compete with an already-running API instead of touching it.
  if curl --silent --show-error --fail \
    "http://127.0.0.1:${production_port}/api/healthz" >/dev/null 2>&1; then
    fail "production port ${production_port} is already serving an API; refusing to touch it."
  fi

  REAL_PM2_BIN="$(command -v pm2)"
  PM2_HOME="$TMP_DIR/pm2-home"
  mkdir -p "$PM2_HOME"
  export PM2_HOME
  export NODE_ENV=production
  export SWIFTX_PM2_NAME="$PROCESS_NAME"
  API_PORT="$production_port"

  local explicit_marker default_marker
  explicit_marker="$explicit_uploads/.swiftx-pm2-upload-path-${BASHPID}-explicit.txt"
  default_marker="$default_uploads/.swiftx-pm2-upload-path-${BASHPID}-default.txt"
  printf 'real explicit upload path\n' >"$explicit_marker"
  printf 'real default upload path\n' >"$default_marker"
  trap 'rm -f "$explicit_marker" "$default_marker"; cleanup' EXIT

  local start_output reload_output
  if ! start_output="$(
    "$ROOT_DIR/pm2-start.sh" \
      --start \
      --env-file "$ENV_FILE" \
      --name "$PROCESS_NAME" 2>&1
  )"; then
    printf '%s\n' "$start_output" >&2
    fail "real PM2 could not start the isolated SwiftX process."
  fi
  assert_contains "real PM2 start" \
    "PM2 process '${PROCESS_NAME}' is active and saved." "$start_output"
  wait_for_health
  assert_real_process_state "$explicit_uploads"
  assert_contains "real explicit upload response" \
    "real explicit upload path" \
    "$(curl --silent --show-error --fail \
      "http://127.0.0.1:${API_PORT}/uploads/$(basename "$explicit_marker")")"
  echo "PASS: real PM2 serves the configured persistent upload directory"

  if ! reload_output="$(
    "$ROOT_DIR/pm2-start.sh" \
      --reload \
      --env-file "$ENV_FILE" \
      --name "$PROCESS_NAME" 2>&1
  )"; then
    printf '%s\n' "$reload_output" >&2
    fail "real PM2 could not reload the isolated SwiftX process."
  fi
  assert_contains "real PM2 reload" \
    "Reloading owned PM2 process '${PROCESS_NAME}'..." "$reload_output"
  wait_for_health
  assert_real_process_state "$explicit_uploads"
  assert_contains "real reloaded upload response" \
    "real explicit upload path" \
    "$(curl --silent --show-error --fail \
      "http://127.0.0.1:${API_PORT}/uploads/$(basename "$explicit_marker")")"
  echo "PASS: real PM2 reload keeps the configured upload directory"

  "$REAL_PM2_BIN" delete "$PROCESS_NAME" >/dev/null
  rm -f "$explicit_marker"
  unset SWIFTX_UPLOADS_DIR
  if ! start_output="$(
    env -u SWIFTX_UPLOADS_DIR \
      "$REAL_PM2_BIN" \
      start "$ROOT_DIR/ecosystem.config.cjs" \
      --only "$PROCESS_NAME" \
      --env production 2>&1
  )"; then
    printf '%s\n' "$start_output" >&2
    fail "real PM2 could not start the default upload-path process."
  fi
  wait_for_health
  assert_real_process_state "$default_uploads"
  assert_contains "real default upload response" \
    "real default upload path" \
    "$(curl --silent --show-error --fail \
      "http://127.0.0.1:${API_PORT}/uploads/$(basename "$default_marker")")"
  echo "PASS: real PM2 serves the documented default upload directory"
  echo "Real PM2 upload-path regression tests passed on the release server."
}

if [[ "$REAL_PM2" -eq 1 ]]; then
  run_real_pm2_check
  exit 0
fi

mkdir -p "$FAKE_BIN"
cat >"$FAKE_BIN/pm2" <<'PM2'
#!/usr/bin/env bash
exec node "${SWIFTX_TEST_PM2_FIXTURE:?}" "$@"
PM2
chmod +x "$FAKE_BIN/pm2"
export PATH="$FAKE_BIN:$PATH"
export SWIFTX_TEST_PM2_FIXTURE="$FIXTURE_PM2"
export SWIFTX_TEST_PM2_STATE="$STATE_FILE"
export SWIFTX_TEST_PM2_LOG="$PM2_LOG"
export SWIFTX_TEST_ECOSYSTEM="$ROOT_DIR/ecosystem.config.cjs"

pnpm --filter @workspace/api-server run build >"$API_LOG" 2>&1

explicit_uploads="$TMP_DIR/explicit-uploads"
mkdir "$explicit_uploads"
printf 'explicit upload path\n' >"$explicit_uploads/reload-marker.txt"
API_PORT="$(node -e 'console.log(35000 + Math.floor(Math.random() * 1000))')"
explicit_env="$TMP_DIR/explicit.env"
cat >"$explicit_env" <<ENV
DATABASE_URL=mysql://upload-path-test.invalid/swiftx
PORT=${API_PORT}
AUTH_MODE=test
PROJECT_URL=https://upload-path-test.invalid
SWIFTX_UPLOADS_DIR=${explicit_uploads}
ENV

if ! explicit_start_output="$(
  "$ROOT_DIR/pm2-start.sh" \
    --start \
    --env-file "$explicit_env" \
    --name "$PROCESS_NAME" 2>&1
)"; then
  printf '%s\n' "$explicit_start_output" >&2
  fail "PM2 wrapper could not start the explicit upload-path API."
fi
assert_contains "explicit start" "PM2 process '${PROCESS_NAME}' is active and saved." "$explicit_start_output"
wait_for_health
assert_process_upload_dir "$explicit_uploads"
assert_contains \
  "explicit upload response" \
  "explicit upload path" \
  "$(curl --silent --show-error --fail "http://127.0.0.1:${API_PORT}/uploads/reload-marker.txt")"
echo "PASS: explicit upload directory is served by the started API"

if ! explicit_reload_output="$(
  "$ROOT_DIR/pm2-start.sh" \
    --reload \
    --env-file "$explicit_env" \
    --name "$PROCESS_NAME" 2>&1
)"; then
  printf '%s\n' "$explicit_reload_output" >&2
  fail "PM2 wrapper could not reload the owned upload-path API."
fi
assert_contains "explicit reload" "Reloading owned PM2 process '${PROCESS_NAME}'..." "$explicit_reload_output"
wait_for_health
assert_process_upload_dir "$explicit_uploads"
assert_contains \
  "reloaded upload response" \
  "explicit upload path" \
  "$(curl --silent --show-error --fail "http://127.0.0.1:${API_PORT}/uploads/reload-marker.txt")"
echo "PASS: reload keeps the explicit upload directory"

previous_pid="$(read_process_pid)"
if failed_reload_output="$(
  SWIFTX_TEST_PM2_FAIL_RELOAD=1 \
    "$ROOT_DIR/pm2-start.sh" \
    --reload \
    --env-file "$explicit_env" \
    --name "$PROCESS_NAME" 2>&1
)"; then
  printf '%s\n' "$failed_reload_output" >&2
  fail "PM2 wrapper unexpectedly accepted the failed replacement process."
fi
assert_contains \
  "failed reload" \
  "ERROR: PM2 reload for '${PROCESS_NAME}' failed; the replacement process did not start (exit status 23)." \
  "$failed_reload_output"
assert_contains \
  "failed reload recovery" \
  "RECOVERY: previous owned PM2 process '${PROCESS_NAME}' remains active." \
  "$failed_reload_output"
assert_contains \
  "failed reload upload recovery" \
  "RECOVERY: persistent uploads directory remains '${explicit_uploads}'." \
  "$failed_reload_output"
assert_contains \
  "failed reload PM2 scope" \
  "RECOVERY: no unrelated PM2 processes were changed." \
  "$failed_reload_output"
assert_contains \
  "failed replacement process" \
  "simulated replacement process failed to start" \
  "$failed_reload_output"
recovered_pid="$(read_process_pid)"
[[ "$recovered_pid" == "$previous_pid" ]] || {
  fail "failed reload replaced the previous process (before=${previous_pid}, after=${recovered_pid})."
}
wait_for_health
assert_process_upload_dir "$explicit_uploads"
assert_contains \
  "failed reload upload response" \
  "explicit upload path" \
  "$(curl --silent --show-error --fail "http://127.0.0.1:${API_PORT}/uploads/reload-marker.txt")"
echo "PASS: failed replacement keeps the previous API and upload directory"

"$FAKE_BIN/pm2" delete "$PROCESS_NAME"
rm -f "$STATE_FILE"

default_port="$(node -e 'console.log(36000 + Math.floor(Math.random() * 1000))')"

if ! default_start_output="$(
  env -u SWIFTX_UPLOADS_DIR \
    DATABASE_URL=mysql://upload-path-test.invalid/swiftx \
    AUTH_MODE=test \
    NODE_ENV=production \
    PROJECT_URL=https://upload-path-test.invalid \
  PORT="$default_port" \
    SWIFTX_PM2_NAME="$PROCESS_NAME" \
    "$FAKE_BIN/pm2" \
    start "$ROOT_DIR/ecosystem.config.cjs" \
    --only "$PROCESS_NAME" \
    --env production 2>&1
)"; then
  printf '%s\n' "$default_start_output" >&2
  fail "PM2 fixture could not start the default upload-path API."
fi
API_PORT="$default_port"
wait_for_health
assert_process_upload_dir "/var/lib/swiftx/uploads"
echo "PASS: documented default upload directory is passed to the running API"

echo "PM2 upload-path regression tests passed."