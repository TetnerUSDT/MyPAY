---
name: Invoice wallet reservation bug
description: Wallet reuse bug for invoice select-network — root cause and fix applied to findOrReserveMerchantWallet
---

## Rule
In `findOrReserveMerchantWallet` (temporary/invoice branch), always use `NOW() + INTERVAL X MINUTE` in SQL for `reserved_until` — never pass a JS `Date` object. Additionally, exclude wallets already tied to a pending/partially_paid invoice via NOT EXISTS subquery.

## Why
Two compounding issues:
1. **Timezone bug** (same as mysql-timezone-bug): MySQL is UTC+3. A JS `Date` computed as `new Date(Date.now() + N * 60000)` is stored as a UTC timestamp literal. MySQL's `NOW()` returns UTC+3, so MySQL immediately sees `reserved_until < NOW()` as true. `releaseExpiredMerchantWallets` fires on the next request and frees the wallet instantly.
2. **No invoice cross-check**: The free-wallet query only checked `merchant_wallets.status = 'active'`, not whether any `merchant_invoices` row with `status IN ('pending', 'partially_paid')` referenced that wallet. So if the timezone fix above allowed a wallet to remain `reserved`, a race or restart could still re-expose it.

## How to apply
- `reserved_until = NOW() + INTERVAL ${reserveMinutes} MINUTE` in the UPDATE.
- Read back via `UNIX_TIMESTAMP(reserved_until)` to return a correct JS Date.
- Free-wallet SELECT must include:
  ```sql
  AND NOT EXISTS (
    SELECT 1 FROM merchant_invoices mi
    WHERE mi.shop_id = mw.shop_id
      AND mi.status IN ('pending', 'partially_paid')
      AND (mi.wallet_id = mw.id OR mi.wallet_address = mw.address)
  )
  ```
- Same pattern applies anywhere `reserved_until` is written for temporary payments.
