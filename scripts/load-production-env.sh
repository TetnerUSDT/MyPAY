#!/usr/bin/env bash

# Shared helpers for the root production deployment scripts.
# This file is sourced; it is not a standalone command.

load_env_file() {
  local env_file="$1"
  local line key value

  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"

    [[ "$line" =~ ^[[:space:]]*$ ]] && continue
    [[ "$line" =~ ^[[:space:]]*# ]] && continue

    if [[ ! "$line" =~ ^[[:space:]]*(export[[:space:]]+)?([_a-zA-Z][_a-zA-Z0-9]*)[[:space:]]*=(.*)$ ]]; then
      echo "ERROR: unsupported line in environment file: ${env_file}" >&2
      echo "       Expected KEY=value or export KEY=value." >&2
      return 1
    fi

    key="${BASH_REMATCH[2]}"
    value="${BASH_REMATCH[3]}"
    value="${value#"${value%%[![:space:]]*}"}"

    if [[ "$value" == \'* ]]; then
      [[ "$value" == *\' ]] || {
        echo "ERROR: unterminated single-quoted value for ${key}." >&2
        return 1
      }
      value="${value:1:${#value}-2}"
    elif [[ "$value" == \"* ]]; then
      [[ "$value" == *\" ]] || {
        echo "ERROR: unterminated double-quoted value for ${key}." >&2
        return 1
      }
      value="${value:1:${#value}-2}"
    fi

    # Quoting the complete assignment prevents values from being evaluated
    # as shell code, even when they contain $, &, ;, or spaces.
    export "$key=$value"
  done < "$env_file"
}

require_env_value() {
  local key="$1"

  if [[ -z "${!key:-}" ]]; then
    echo "ERROR: ${key} is required in the production environment." >&2
    return 1
  fi
}

validate_production_env() {
  require_env_value "DATABASE_URL" || return 1

  if [[ -z "${PORT:-}" && -n "${SWIFTX_API_PORT:-}" ]]; then
    export PORT="$SWIFTX_API_PORT"
  fi

  require_env_value "PORT" || {
    echo "       Set PORT or SWIFTX_API_PORT in the environment file." >&2
    return 1
  }

  if [[ ! "$PORT" =~ ^[0-9]+$ ]] || (( PORT < 1 || PORT > 65535 )); then
    echo "ERROR: PORT must be an integer between 1 and 65535." >&2
    return 1
  fi
}

validate_admin_credentials() {
  require_env_value "ADMIN_LOGIN" || return 1
  require_env_value "ADMIN_PASSWORD" || return 1
  require_env_value "ADMIN_URL" || return 1
}

validate_persistent_uploads_dir() {
  local api_dir="$1"
  local uploads_dir="${SWIFTX_UPLOADS_DIR:-/var/lib/swiftx/uploads}"
  local api_real uploads_candidate uploads_real

  if [[ "$uploads_dir" != /* ]]; then
    echo "ERROR: SWIFTX_UPLOADS_DIR must be an absolute path." >&2
    echo "       Received: ${uploads_dir}" >&2
    return 1
  fi

  api_real="$(readlink -f -- "$api_dir")" || {
    echo "ERROR: could not resolve the API checkout: ${api_dir}" >&2
    return 1
  }
  uploads_candidate="$(readlink -m -- "$uploads_dir")" || {
    echo "ERROR: could not resolve SWIFTX_UPLOADS_DIR: ${uploads_dir}" >&2
    return 1
  }

  if [[ "$uploads_candidate" == "$api_real" || "$uploads_candidate" == "$api_real/"* ]]; then
    echo "ERROR: SWIFTX_UPLOADS_DIR must be outside the disposable API checkout." >&2
    echo "       API checkout: ${api_real}" >&2
    echo "       Uploads path:  ${uploads_dir}" >&2
    return 1
  fi

  [[ -d "$uploads_dir" ]] || {
    echo "ERROR: SWIFTX_UPLOADS_DIR does not exist as a directory: ${uploads_dir}" >&2
    echo "       Create it and grant the PM2 user write access before deploying." >&2
    return 1
  }

  [[ -w "$uploads_dir" ]] || {
    echo "ERROR: SWIFTX_UPLOADS_DIR is not writable by the deploy user: ${uploads_dir}" >&2
    echo "       Grant the PM2 user write access before deploying." >&2
    return 1
  }

  uploads_real="$(readlink -f -- "$uploads_dir")" || {
    echo "ERROR: could not resolve SWIFTX_UPLOADS_DIR: ${uploads_dir}" >&2
    return 1
  }
  if [[ "$uploads_real" == "$api_real" || "$uploads_real" == "$api_real/"* ]]; then
    echo "ERROR: SWIFTX_UPLOADS_DIR resolves inside the disposable API checkout." >&2
    echo "       API checkout: ${api_real}" >&2
    echo "       Resolved path: ${uploads_real}" >&2
    return 1
  fi

  # Keep the default explicit so PM2 and the API receive the same path that
  # the preflight checked.
  export SWIFTX_UPLOADS_DIR="$uploads_dir"
}

validate_pm2_name() {
  local name="$1"

  if [[ ! "$name" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]]; then
    echo "ERROR: SWIFTX_PM2_NAME contains unsupported characters." >&2
    echo "       Use letters, numbers, dots, underscores, or hyphens." >&2
    return 1
  fi
}

ensure_env_symlink() {
  local env_file="$1"
  local link_path="$2"
  local expected_target current_target

  expected_target="$(readlink -f "$env_file")"

  if [[ -L "$link_path" ]]; then
    current_target="$(readlink -f "$link_path" || true)"
    if [[ "$current_target" != "$expected_target" ]]; then
      echo "ERROR: refusing to replace an existing .env symlink: ${link_path}" >&2
      echo "       It does not point to the selected production environment file." >&2
      return 1
    fi
    return 0
  fi

  if [[ -e "$link_path" ]]; then
    echo "ERROR: refusing to replace an existing file: ${link_path}" >&2
    echo "       Remove it manually or make it point to the production .env." >&2
    return 1
  fi

  ln -s "$env_file" "$link_path"
}