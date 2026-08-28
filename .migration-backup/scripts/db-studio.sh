#!/bin/bash

# Drizzle Studio for MySQL
# Launch Drizzle Studio to inspect and manage your MySQL database

echo "🎨 Launching Drizzle Studio..."
npx drizzle-kit studio --config=drizzle.mysql.config.ts
