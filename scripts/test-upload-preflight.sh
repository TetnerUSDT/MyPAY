#!/usr/bin/env bash

# Regression coverage for the persistent upload preflight used by deploy.sh and
# pm2-start.sh. The tests intentionally run the production shell entry points
# instead of reimplementing their sequencing in a separate test harness.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
API_DIR="$ROOT_DIR/artifacts/api-server"
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/swiftx-upload-preflight.XXXXXX")"
ENV_FILE="$TMP_DIR/production.env"
FAKE_BIN="$TMP_DIR/bin"
PM2_MARKER="$TMP_DIR/pm2-invoked"

cleanup() {
  if [[ -d "$TMP_DIR/unwritable" ]]; then
    chmod u+rwx "$TMP_DIR/unwritable" 2>/dev/null || true
  fi
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

fail() {
  echo "FAIL: $*" >&2
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

assert_preflight_fails() {
  local label="$1"
  local uploads_dir="$2"
  local expected_message="$3"
  local output

  if output="$(
    SWIFTX_UPLOADS_DIR="$uploads_dir" \
      bash -c '
        set -euo pipefail
        source "$1/scripts/load-production-env.sh"
        validate_persistent_uploads_dir "$2"
      ' _ "$ROOT_DIR" "$API_DIR" 2>&1
  )"; then
    printf '%s\n' "$output" >&2
    fail "${label} unexpectedly passed."
  fi

  assert_contains "$label" "$expected_message" "$output"
  echo "PASS: ${label}"
}

mkdir -p "$FAKE_BIN"
cat >"$FAKE_BIN/pm2" <<'PM2_STUB'
#!/usr/bin/env bash
printf '%s\n' "$*" >"${PM2_MARKER:?}"
exit 99
PM2_STUB
chmod +x "$FAKE_BIN/pm2"
export PM2_MARKER

cat >"$ENV_FILE" <<'ENV'
DATABASE_URL=postgres://preflight-test.invalid/swiftx
PORT=54321
PROJECT_URL=https://preflight-test.invalid
ENV

absolute_dir="$TMP_DIR/absolute-uploads"
mkdir "$absolute_dir"
SWIFTX_UPLOADS_DIR="$absolute_dir" bash -c '
  set -euo pipefail
  source "$1/scripts/load-production-env.sh"
  validate_persistent_uploads_dir "$2"
' _ "$ROOT_DIR" "$API_DIR"
echo "PASS: absolute upload directory is accepted"

assert_preflight_fails \
  "checkout-local upload directory" \
  "$API_DIR/runtime/uploads" \
  "must be outside the disposable API checkout"

missing_dir="$TMP_DIR/missing-uploads"
assert_preflight_fails \
  "missing upload directory" \
  "$missing_dir" \
  "does not exist as a directory"

unwritable_dir="$TMP_DIR/unwritable"
mkdir "$unwritable_dir"
chmod u-w "$unwritable_dir"
if [[ -w "$unwritable_dir" ]]; then
  chmod u+w "$unwritable_dir"
  fail "test fixture for the unwritable upload directory is still writable"
fi
assert_preflight_fails \
  "unwritable upload directory" \
  "$unwritable_dir" \
  "is not writable by the deploy user"

dry_run_dir="$TMP_DIR/dry-run-uploads"
mkdir "$dry_run_dir"
printf 'keep this file unchanged\n' >"$dry_run_dir/sentinel.txt"
before_metadata="$(stat -c '%a:%u:%g:%s:%Y' "$dry_run_dir")"
before_contents="$(find "$dry_run_dir" -mindepth 1 -maxdepth 1 -printf '%P:%s:%m:%T@\n' | sort)"

if ! dry_run_output="$(
  SWIFTX_UPLOADS_DIR="$dry_run_dir" \
    "$ROOT_DIR/deploy.sh" \
    --dry-run \
    --env-file "$ENV_FILE" \
)"; then
  printf '%s\n' "$dry_run_output" >&2
  fail "deploy dry-run rejected a valid upload directory"
fi

assert_contains "deploy dry-run" "Uploads:     ${dry_run_dir}" "$dry_run_output"
assert_contains \
  "pm2 dry-run" \
  "DRY RUN: persistent uploads directory '${dry_run_dir}' is present and writable." \
  "$dry_run_output"

after_metadata="$(stat -c '%a:%u:%g:%s:%Y' "$dry_run_dir")"
after_contents="$(find "$dry_run_dir" -mindepth 1 -maxdepth 1 -printf '%P:%s:%m:%T@\n' | sort)"
[[ "$after_metadata" == "$before_metadata" ]] || {
  echo "Before: ${before_metadata}" >&2
  echo "After:  ${after_metadata}" >&2
  fail "deploy dry-run modified upload directory metadata"
}
[[ "$after_contents" == "$before_contents" ]] || {
  echo "Before: ${before_contents}" >&2
  echo "After:  ${after_contents}" >&2
  fail "deploy dry-run modified upload directory contents"
}
echo "PASS: deploy dry-run reports the selected directory without modifying it"

if output="$(
  PATH="$FAKE_BIN:$PATH" \
    SWIFTX_UPLOADS_DIR="$missing_dir" \
    "$ROOT_DIR/deploy.sh" \
    --env-file "$ENV_FILE" \
    2>&1
)"; then
  printf '%s\n' "$output" >&2
  fail "deploy unexpectedly continued with a missing upload directory"
fi
assert_contains \
  "deploy preflight failure" \
  "does not exist as a directory: ${missing_dir}" \
  "$output"
[[ ! -e "$PM2_MARKER" ]] || {
  cat "$PM2_MARKER" >&2
  fail "deploy invoked PM2 after the upload preflight failed"
}
echo "PASS: failed upload preflight does not invoke PM2"

echo "Upload preflight regression tests passed."