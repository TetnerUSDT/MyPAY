---
name: Invoice tx dedup design
description: How pollInvoiceForPayment prevents double-crediting old/cross-invoice transactions
---

## The bug
Scanner functions look back N blocks (~5 hours). If the same wallet address was reused across invoices, old transactions to that address appear in scanner results and get credited to the new invoice.

Also: the old code only looked at `transfers[0]` (first result), so a legitimate new tx behind an old one would never be processed ("starvation" bug).

## The fix (three layers)

### 1. Global atomic dedup via `merchant_payment_txs`
`merchant_payment_txs` has `tx_hash VARCHAR(255) NOT NULL UNIQUE`. Every tx credited to ANY invoice or payment is inserted here first via `INSERT INTO merchant_payment_txs (payment_id=0, invoice_id=N, tx_hash, amount)`. If the INSERT throws a duplicate-key error, the tx was already credited elsewhere → skip it.

Migration adds `invoice_id INT NULL` column to this table (checked via `columnExists`).

### 2. Timestamp cutoff (defense-in-depth)
All scanner adapters now return an optional `blockTimestampMs` (unix ms):
- TRON: TronScan `tx.timestamp`, TronGrid `tx.block_timestamp`
- TON: TonCenter `t.transaction_now ?? t.utime` × 1000
- Solana: `sig.blockTime` × 1000
- EVM/BSC: no direct timestamp, returns `blockNumber` instead (no time filter applied, global dedup handles it)

`pollInvoiceForPayment` receives `invoiceCreatedAt?: Date`. Cutoff = `invoiceCreatedAt - 2min` (clock skew buffer). Any tx with `blockTimestampMs < cutoffMs` is skipped.

### 3. Iterate ALL scanner results
Previously only `transfers[0]` was processed. Now every candidate in the scanner response is looped and checked independently. Prevents starvation when an old (already-deduped) tx sits at index 0.

## Key invariant
A `tx_hash` in `merchant_payment_txs` means that transaction's value has been credited to exactly one invoice or payment. No further crediting is possible.

**Why:** The comma-separated `tx_hash` in `merchant_invoices.tx_hash` was limited to VARCHAR(255) (~3-4 hashes) and used a fragile LIKE guard — both unsafe. The global table gives a proper UNIQUE index across all invoices/payments.

**How to apply:** When adding new invoice pollers or payment types, always use atomic INSERT into `merchant_payment_txs` as the dedup gate. Never rely on the `tx_hash` column of the invoice/payment row for dedup.
