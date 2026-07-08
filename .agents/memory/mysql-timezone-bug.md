---
name: MySQL timezone bug — expires_at instant expiry
description: Remote MySQL server is in UTC+3 (Moscow); storing JS Date() as DATETIME causes comparison with NOW() to fail — looks expired immediately
---

# MySQL Timezone Mismatch — expires_at Instant Expiry

## The Rule
Never use `new Date(Date.now() + X)` in Node.js and then compare with MySQL `NOW()`. The MySQL server at 89.163.242.87 runs in UTC+3 (Moscow time). Node.js `Date.now()` is always UTC. A 60-minute window set via JS appears as -180 minutes to MySQL → instant expiry.

**Why:** MySQL DATETIME has no timezone. If Node.js stores UTC time `13:44` and MySQL's `NOW()` returns `16:44` (Moscow), then `expires_at < NOW()` is `13:44 < 16:44` = TRUE = expired immediately.

**How to apply:**
- Always set time-limited columns using MySQL's own functions: `SET expires_at = NOW() + INTERVAL ${minutes} MINUTE`
- Always read them back via `UNIX_TIMESTAMP(expires_at)` and convert in Node.js: `new Date(unixTs * 1000).toISOString()`
- This makes both the write and the comparison use the same MySQL timezone → always correct.
- Applies to: merchant_invoices.expires_at, and any future time-window columns.

## Example — Wrong
```ts
const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // UTC time
await db.execute(sql`UPDATE t SET expires_at = ${expiresAt} WHERE id = ${id}`);
// MySQL stores "13:44", NOW() = "16:44" → INSTANT EXPIRY
```

## Example — Correct
```sql
UPDATE merchant_invoices
  SET expires_at = NOW() + INTERVAL 60 MINUTE
  WHERE id = ?;

SELECT UNIX_TIMESTAMP(expires_at) AS expires_at_unix FROM merchant_invoices WHERE id = ?;
-- Then in Node.js: new Date(row.expires_at_unix * 1000).toISOString()
```
