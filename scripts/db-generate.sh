#!/bin/bash

# MySQL migration generation script
# Generates SQL migration files for MySQL

echo "📝 Generating MySQL migrations..."
npx drizzle-kit generate --config=drizzle.mysql.config.ts "$@"
