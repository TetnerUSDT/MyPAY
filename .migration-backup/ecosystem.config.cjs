/**
 * PM2 Ecosystem Config — myPay
 *
 * Parses .env with built-in Node.js (no extra dependencies).
 * All variables are loaded from .env automatically — no duplication.
 *
 * Usage:
 *   pm2 start ecosystem.config.cjs
 *   pm2 reload ecosystem.config.cjs --update-env
 *   pm2 stop myPay
 *   pm2 delete myPay
 */

'use strict';

const path = require('path');
const fs   = require('fs');

// ── Parse .env file (built-in, no dotenv needed) ─────────────────────────────
function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error('[ecosystem] ERROR: .env file not found at', filePath);
    process.exit(1);
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const result = {};

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 1) continue;

    const key   = trimmed.slice(0, eqIdx).trim();
    let   value = trimmed.slice(eqIdx + 1).trim();

    // Strip surrounding quotes (single or double)
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

// ── Project root ──────────────────────────────────────────────────────────────
const appRoot = __dirname;
const envVars = parseEnvFile(path.join(appRoot, '.env'));

// ── Build env: .env values + force production overrides ──────────────────────
const env = {
  ...envVars,
  NODE_ENV: 'production',
};

// ── Read app version safely ───────────────────────────────────────────────────
let appVersion = '1.0.0';
try {
  appVersion = require(path.join(appRoot, 'package.json')).version;
} catch (_) {}

// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  apps: [
    {
      // ── Identity ────────────────────────────────────────────────────────────
      name:    'myPay',
      version: appVersion,
      script:  path.join(appRoot, 'dist', 'index.js'),
      cwd:     appRoot,

      // ── Environment ─────────────────────────────────────────────────────────
      env,                          // all vars from .env + NODE_ENV=production

      // ── Execution mode ──────────────────────────────────────────────────────
      exec_mode: 'fork',            // change to 'cluster' + instances:'max' for multi-core
      instances:  1,

      // ── Restart / crash policy (safe) ───────────────────────────────────────
      autorestart:              true,
      restart_delay:            3000,  // wait 3 s before restarting on crash
      max_restarts:             10,    // give up after 10 consecutive crashes
      min_uptime:               '10s', // must stay up 10 s to reset crash counter
      exp_backoff_restart_delay: 100,  // exponential back-off between restarts

      // ── Graceful shutdown ────────────────────────────────────────────────────
      kill_timeout:    5000,   // ms to wait for SIGTERM before SIGKILL
      wait_ready:      true,   // wait for process.send('ready') — emit in app if needed
      listen_timeout:  10000,  // ms to wait for 'ready' signal before giving up

      // ── Logging ─────────────────────────────────────────────────────────────
      out_file:        path.join(appRoot, 'logs', 'out.log'),
      error_file:      path.join(appRoot, 'logs', 'error.log'),
      merge_logs:      true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      log_type:        'json',

      // ── Watch (always off in production) ────────────────────────────────────
      watch: false,

      // ── Source maps ─────────────────────────────────────────────────────────
      source_map_support: true,
    },
  ],
};
