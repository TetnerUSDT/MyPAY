const path = require("node:path");

const processName = process.env.SWIFTX_PM2_NAME || "swiftx-api";
const apiPort = process.env.PORT || process.env.SWIFTX_API_PORT;

if (!apiPort) {
  throw new Error(
    "PORT or SWIFTX_API_PORT must be set before starting SwiftX with PM2.",
  );
}

module.exports = {
  apps: [
    {
      name: processName,
      script: "dist/index.mjs",
      cwd: path.resolve(__dirname, "artifacts/api-server"),
      interpreter: "node",
      node_args: "--enable-source-maps",

      instances: 1,
      exec_mode: "fork",
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 1000,
      max_memory_restart: "1G",

      env_production: {
        NODE_ENV: "production",
        PORT: apiPort,
      },

      error_file: "./logs/err.log",
      out_file: "./logs/out.log",
      log_file: "./logs/combined.log",
      merge_logs: true,
      time: true,
    },
  ],
};