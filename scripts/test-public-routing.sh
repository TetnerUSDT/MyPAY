#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROUTING_CHECK="$SCRIPT_DIR/smoke-public-routing.sh"
FIXTURE_SERVER="$SCRIPT_DIR/test-fixtures/public-routing-server.mjs"
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/swiftx-routing-test.XXXXXX")"
FIXTURE_PID=""
FIXTURE_URL=""
CLIENT_ROUTE="/dashboard"
UPLOAD_PATH="/media/custom-start-bg.webp"

cleanup() {
  if [[ -n "$FIXTURE_PID" ]] && kill -0 "$FIXTURE_PID" 2>/dev/null; then
    kill "$FIXTURE_PID" 2>/dev/null || true
    wait "$FIXTURE_PID" 2>/dev/null || true
  fi
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

start_fixture() {
  local mode="$1"
  local log_file="$TMP_DIR/fixture.log"
  local port

  : >"$log_file"
  node "$FIXTURE_SERVER" "$mode" >"$log_file" 2>&1 &
  FIXTURE_PID=$!

  for _ in {1..100}; do
    if port="$(sed -n 's/^READY //p' "$log_file" | head -n 1)" && [[ -n "$port" ]]; then
      FIXTURE_URL="http://127.0.0.1:$port"
      return
    fi

    if ! kill -0 "$FIXTURE_PID" 2>/dev/null; then
      cat "$log_file" >&2
      fail "fixture server exited before becoming ready."
    fi
    sleep 0.01
  done

  cat "$log_file" >&2
  fail "fixture server did not become ready."
}

stop_fixture() {
  if [[ -n "$FIXTURE_PID" ]] && kill -0 "$FIXTURE_PID" 2>/dev/null; then
    kill "$FIXTURE_PID" 2>/dev/null || true
    wait "$FIXTURE_PID" 2>/dev/null || true
  fi
  FIXTURE_PID=""
  FIXTURE_URL=""
}

assert_passes() {
  local output
  if ! output="$("$ROUTING_CHECK" \
    --url "$FIXTURE_URL" \
    --client-route "$CLIENT_ROUTE" \
    --upload-path "$UPLOAD_PATH" \
    --timeout 2 2>&1)"; then
    printf '%s\n' "$output" >&2
    fail "all-routes-pass fixture was rejected."
  fi

  grep -Fq "Public routing smoke check passed" <<<"$output" || {
    printf '%s\n' "$output" >&2
    fail "successful routing check did not print its completion message."
  }
  echo "PASS: all routes pass"
}

assert_fails() {
  local label="$1"
  local mode="$2"
  local expected_message="$3"
  local output

  stop_fixture
  start_fixture "$mode"
  if output="$("$ROUTING_CHECK" \
    --url "$FIXTURE_URL" \
    --client-route "$CLIENT_ROUTE" \
    --upload-path "$UPLOAD_PATH" \
    --timeout 2 2>&1)"; then
    printf '%s\n' "$output" >&2
    fail "$label fixture unexpectedly passed."
  fi

  grep -Fq "$expected_message" <<<"$output" || {
    printf '%s\n' "$output" >&2
    fail "$label fixture failed without the expected diagnostic: $expected_message"
  }
  echo "PASS: $label fails with the expected diagnostic"
}

start_fixture "pass"
assert_passes
assert_fails \
  "API reachability" \
  "api-unreachable" \
  "FAIL: API health could not reach"
assert_fails \
  "API timeout" \
  "api-hanging" \
  "FAIL: API health timed out after 2s"
assert_fails \
  "SPA fallback" \
  "spa-fallback" \
  "did not return the frontend HTML root"
assert_fails \
  "upload content type" \
  "upload-content-type" \
  "was not served as an image response"

echo "Public routing regression tests passed."