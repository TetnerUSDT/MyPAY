---
name: Legacy balance-row uniqueness
description: Legacy database environments may not enforce one balance row per user and asset.
---

Do not assume every existing database enforces a single balance row for each user and asset, even when the current ORM schema declares that uniqueness.

**Why:** A legacy development database accepted duplicate balance rows, so upsert-based credits created an additional row instead of updating the existing row.

**How to apply:** For financial verification against an existing database, compare the summed balance for the user and asset. Treat adding the missing database constraint and safely merging duplicates as separate migration work.