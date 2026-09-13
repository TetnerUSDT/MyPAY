import { createRequire } from "node:module";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const require = createRequire(import.meta.url);
const statePath = process.env.SWIFTX_TEST_PM2_STATE;
const logPath = process.env.SWIFTX_TEST_PM2_LOG;

if (!statePath || !logPath) {
  throw new Error("SWIFTX_TEST_PM2_STATE and SWIFTX_TEST_PM2_LOG are required");
}

function readState() {
  if (!existsSync(statePath)) return null;
  return JSON.parse(readFileSync(statePath, "utf8"));
}

function writeState(state) {
  writeFileSync(statePath, JSON.stringify(state));
}

function getApp() {
  const actionIndex = process.argv.indexOf("start") >= 0
    ? process.argv.indexOf("start")
    : process.argv.indexOf("reload");
  const ecosystemPath = actionIndex >= 0 && process.argv[actionIndex + 1]?.endsWith(".cjs")
    ? process.argv[actionIndex + 1]
    : process.env.SWIFTX_TEST_ECOSYSTEM || path.resolve("ecosystem.config.cjs");
  const config = require(ecosystemPath);
  const requestedName = process.env.SWIFTX_PM2_NAME || "swiftx-api";
  const app = config.apps.find(({ name }) => name === requestedName) || config.apps[0];
  if (!app) throw new Error(`No PM2 app found for ${requestedName}`);
  return app;
}

function stopProcess(state) {
  if (!state?.pid) return;
  try {
    process.kill(state.pid, "SIGTERM");
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
}

function startProcess(app) {
  const env = {
    ...process.env,
    ...(app.env || {}),
    ...(app.env_production || {}),
  };
  const cwd = path.resolve(app.cwd);
  const entrypoint = path.resolve(cwd, app.script);
  const child = spawn(process.execPath, [entrypoint], {
    cwd,
    env,
    detached: true,
    stdio: ["ignore", "ignore", "ignore"],
  });
  child.unref();

  writeState({
    name: app.name,
    pid: child.pid,
    cwd,
    entrypoint,
    env: {
      NODE_ENV: env.NODE_ENV,
      PORT: env.PORT,
      SWIFTX_UPLOADS_DIR: env.SWIFTX_UPLOADS_DIR,
    },
  });
}

const action = process.argv[2];

if (action === "jlist") {
  const state = readState();
  if (!state) {
    process.stdout.write("[]");
  } else {
    let running = true;
    try {
      process.kill(state.pid, 0);
    } catch {
      running = false;
    }
    if (!running) {
      unlinkSync(statePath);
      process.stdout.write("[]");
    } else {
      process.stdout.write(JSON.stringify([{
        name: state.name,
        pm2_env: {
          pm_cwd: state.cwd,
          pm_exec_path: state.entrypoint,
          pid: state.pid,
          status: "online",
          env: state.env,
        },
        pm_exec_path: state.entrypoint,
      }]));
    }
  }
  process.exit(0);
}

if (action === "start" || action === "reload") {
  const previous = readState();
  if (action === "reload" && process.env.SWIFTX_TEST_PM2_FAIL_RELOAD === "1") {
    process.stderr.write("simulated replacement process failed to start\n");
    process.exit(23);
  }
  if (action === "reload") stopProcess(previous);
  startProcess(getApp());
  process.exit(0);
}

if (action === "save") {
  process.exit(0);
}

if (action === "describe") {
  const state = readState();
  process.stdout.write(state ? JSON.stringify(state) : "missing");
  process.exit(0);
}

if (action === "delete") {
  stopProcess(readState());
  if (existsSync(statePath)) unlinkSync(statePath);
  process.exit(0);
}

writeFileSync(logPath, `${process.argv.slice(2).join(" ")}\n`, { flag: "a" });
process.exit(1);