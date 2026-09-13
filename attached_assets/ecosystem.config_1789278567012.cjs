const path = require('path');

module.exports = {
  apps: [
    {
      name: 'crownline',
      script: 'dist/index.mjs',
      cwd: path.resolve(__dirname, 'artifacts/api-server'),

      instances: 1,
      exec_mode: 'fork',

      env: {
        NODE_ENV: 'development',
        PORT: 5000,
      },

      env_production: {
        NODE_ENV: 'production',
        PORT: 10014,
      },

      watch: false,
      max_memory_restart: '1G',

      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
      merge_logs: true,

      autorestart: true,
      max_restarts: 10,
      restart_delay: 1000,
    },
  ],
};
