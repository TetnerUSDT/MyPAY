#!/bin/bash
set -euo pipefail
pnpm install --frozen-lockfile
set +e
node scripts/reconcile-db-schema.mjs
reconcile_status=$?
set -e

if [ "$reconcile_status" -eq 42 ]; then
  push_log="$(mktemp)"
  trap 'rm -f "$push_log"' EXIT
  pnpm --filter @workspace/db run push-force 2>&1 | tee "$push_log"
  if grep -Eq "Interactive prompts require a TTY terminal|^Error:" "$push_log"; then
    echo "Database schema bootstrap failed" >&2
    exit 1
  fi
elif [ "$reconcile_status" -ne 0 ]; then
  exit "$reconcile_status"
else
  echo "[schema] Existing database reconciled without destructive schema push"
fi
