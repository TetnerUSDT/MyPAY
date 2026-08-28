---
name: Legacy balance-row uniqueness
description: Legacy database environments may not enforce one balance row per user and asset.
---

Do not assume every existing database enforces a single balance row for each user and asset, even when the current ORM schema declares that uniqueness.

**Why:** A legacy development database accepted duplicate balance rows, so upsert-based credits created an additional row instead of updating the existing row.

**How to apply:** For financial verification against an existing database, compare the summed balance for the user and asset. Treat adding the missing database constraint and safely merging duplicates as separate migration work.

Balance-row consolidation must preserve the total, retain required metadata, and repoint dependent records before redundant row IDs are removed.

**Why:** Duplicate rows may carry unique metadata or be referenced by historical records; deleting them directly can either violate constraints or orphan dependent data.

**How to apply:** Treat consolidation as an atomic identity merge, not just a sum update and delete.