---
name: Safe post-merge schema setup
description: Why existing SwiftX databases require explicit reconciliation instead of automatic Drizzle force-pushes.
---

Never run an automatically approved Drizzle schema push against an existing database. Use explicit, idempotent reconciliation for known legacy drift; reserve full schema bootstrap for an empty database.

**Why:** Drizzle can require TTY prompts despite force flags, can return a zero exit code after printing an error, and may attempt destructive truncation when the live legacy schema differs from the model.

**How to apply:** Treat new schema differences as migrations with deliberate data-preservation logic. Keep post-merge checks able to fail on hidden CLI errors, and only use force-based bootstrap after confirming the database has no core tables.