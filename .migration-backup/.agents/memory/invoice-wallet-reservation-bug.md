---
name: Invoice wallet reservation bug
description: Dual root cause of wallet reuse across invoices, and the complete atomic fix.
---

## Root Causes (Two, Compounding)

### 1. Timezone bug (JS Date → MySQL UTC+3)
`reserved_until` was set with `new Date(Date.now() + N*60000)` in JS (UTC).  
MySQL is UTC+3, so `UNIX_TIMESTAMP(reserved_until)` returns a value 3 h smaller than intended.  
`releaseExpiredMerchantWallets` uses `reserved_until < NOW()` (all SQL) — so it saw the wallet as already expired immediately after reservation.

**Fix:** Always use `NOW() + INTERVAL N MINUTE` in SQL. Never pass a JS Date to MySQL for time arithmetic.

### 2. SELECT-then-UPDATE race condition (critical)
Old code did `SELECT ... WHERE status='active'` then separately `UPDATE ... WHERE id=?`.  
Between the SELECT and the UPDATE, a concurrent request could SELECT the same wallet — both would succeed and both invoices would get the same address.

This happened even after NOT EXISTS was added to the SELECT — the SELECT → UPDATE gap remained.

### Complete Fix: Atomic UPDATE

Replace SELECT + UPDATE with a single atomic UPDATE:
```sql
UPDATE merchant_wallets mw
SET mw.order_id = ?, mw.reserved_until = NOW() + INTERVAL ? MINUTE, mw.status = 'reserved'
WHERE mw.shop_id = ? AND mw.network = ? AND mw.mode = ?
  AND mw.status = 'active'
  AND mw.external_user_id IS NULL AND mw.order_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM merchant_invoices mi
    WHERE mi.shop_id = mw.shop_id
      AND mi.status IN ('pending', 'partially_paid')
      AND (mi.wallet_id = mw.id OR (mi.wallet_address IS NOT NULL AND mi.wallet_address = mw.address))
  )
LIMIT 1
```

Then check `affectedRows > 0`:
- If 0 → no wallet available → call `generateMerchantWallet`
- If 1 → wallet claimed atomically; fetch it by `order_id` to get the row

**Why this works:**  
InnoDB serializes row-level locks. If two concurrent requests race, only one UPDATE succeeds (sets status='reserved'); the second finds `status != 'active'` and gets `affectedRows=0`.  
The NOT EXISTS check on `merchant_invoices.wallet_id` protects even wallets that `releaseExpiredMerchantWallets` has already freed at the `merchant_wallets` level — the invoice rows still point to the wallet.

### Why the server fix wasn't applying
Vite HMR only updates client-side code. Server-side changes (business-routes.ts) require a **full server restart** to take effect. Always restart the workflow after server edits.

### Data consequence of the bug
Multiple invoices sharing the same `wallet_id` and `wallet_address` will all poll the same blockchain address. When payment arrives, whichever invoice's poller processes it first gets credited. The rest expire naturally. No money is lost; attribution is non-deterministic.

### Verification
```sql
-- Should return affectedRows=0 when any pending invoice references the wallet:
UPDATE merchant_wallets mw SET ... WHERE ... AND NOT EXISTS (...)
```
