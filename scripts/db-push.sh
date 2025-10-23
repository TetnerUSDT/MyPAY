#!/bin/bash

# MySQL database migration script
# Uses drizzle.mysql.config.ts for MySQL-specific configuration

echo "🗄️  Pushing schema changes to MySQL database..."
npx drizzle-kit push --config=drizzle.mysql.config.ts "$@"
