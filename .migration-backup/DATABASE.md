# Database Management Guide

This project uses **MySQL** as the database with **Drizzle ORM** for type-safe database operations.

## Quick Start

### Database Schema

All database tables are defined in `shared/schema.ts` using Drizzle ORM syntax.

### Migration Commands

We provide convenient shell scripts for database operations:

```bash
# Push schema changes to database (recommended for development)
./scripts/db-push.sh

# Force push if there are data-loss warnings
./scripts/db-push.sh --force

# Generate migration files (for production deployments)
./scripts/db-generate.sh

# Launch Drizzle Studio (visual database browser)
./scripts/db-studio.sh
```

## Development Workflow

### 1. Modify Schema

Edit `shared/schema.ts` to add or modify tables:

```typescript
export const myNewTable = mysqlTable("my_new_table", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
});
```

### 2. Push Changes

Run the push script to sync your changes:

```bash
./scripts/db-push.sh
```

If you get a data-loss warning and want to proceed:

```bash
./scripts/db-push.sh --force
```

### 3. Update Storage Layer

Update `server/storage.ts` to add methods for your new table:

```typescript
async getMyNewItems(): Promise<MyNewItem[]> {
  return await db.select().from(myNewTable);
}
```

## Important Notes

### MySQL-Specific Helpers

The project includes MySQL-specific helpers in `server/mysql-helpers.ts`:

- `insertAndReturn()` - Insert and return the created record
- `updateAndReturn()` - Update and return the modified record
- `insertAndReturnTx()` - Insert within a transaction and return

These helpers are necessary because MySQL doesn't support `RETURNING` clause like PostgreSQL.

### Type Safety

- All tables use Drizzle's type inference
- Zod schemas are generated from Drizzle schemas using `drizzle-zod`
- Insert/Select types are automatically derived

### Schema Best Practices

1. **Primary Keys**: Use `serial("id").primaryKey()` for auto-increment IDs
2. **Timestamps**: Use `timestamp("created_at").defaultNow()` for creation time
3. **Decimals**: Use `decimal("amount", { precision: 20, scale: 8 })` for crypto amounts
4. **Foreign Keys**: Always define relationships using `.references()`

## Configuration

Database configuration is in `server/config.ts`:

- **DATABASE_URL**: Connection string from environment variables
- The project uses MySQL connection pooling via `mysql2/promise`

## Drizzle Configuration

MySQL configuration is in `drizzle.mysql.config.ts`:

```typescript
export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "mysql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
```

## Migration Files

Generated migration files are stored in `./migrations/` directory. These are SQL files that can be:

- Applied manually in production
- Tracked in version control
- Used for deployment automation

## Drizzle Studio

Launch the visual database browser:

```bash
./scripts/db-studio.sh
```

This opens a web interface where you can:
- Browse all tables
- View and edit data
- Inspect relationships
- Execute queries

## Troubleshooting

### Connection Issues

Make sure `DATABASE_URL` environment variable is set:

```bash
echo $DATABASE_URL
```

### Schema Sync Issues

If push fails, try force push:

```bash
./scripts/db-push.sh --force
```

### Type Errors

Regenerate types after schema changes:

```bash
npm run check
```

## Production Deployment

For production:

1. Generate migration files:
   ```bash
   ./scripts/db-generate.sh
   ```

2. Review generated SQL in `./migrations/`

3. Apply migrations to production database manually or using your deployment pipeline

4. Never use `--force` in production
