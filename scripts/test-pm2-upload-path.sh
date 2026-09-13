#!/usr/bin/env bash

# End-to-end coverage for the upload directory passed through the production
# PM2 wrapper. A small PM2-compatible fixture is used because PM2 is not a
# project dependency and is not available in every development environment.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
API_DIR="$ROOT_DIR/artifacts/api-server"
FIXTURE_PM2="$SCRIPT_DIR/test-fixtures/fake-pm2.mjs"
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/swiftx-pm2-upload-path.XXXXXX")"
FAKE_BIN="$TMP_DIR/bin"
STATE_FILE="$TMP_DIR/pm2-state.json"
PM2_LOG="$TMP_DIR/pm2.log"
API_LOG="$TMP_DIR/api.log"
PROCESS_NAME="swiftx-upload-path-test"
API_PORT=""

cleanup() {
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