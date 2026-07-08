---
name: Merchant payment_mode per-request design
description: myPay per-request payment_mode replaces shop-level address_mode. Three modes, two pollers.
---

## Rule
`payment_mode` is sent per-request in `/api/merchant/address`, NOT a shop-level setting.
Values: `"permanent"` | `"temporary"` | `"invoice"`.

**Why:** Shops need to accept both permanent (subscriptions/top-ups) and temporary (orders) payments from the same shop without changing a global setting.

## How to apply
- Fallback: if client omits `payment_mode`, code falls back to `shop.address_mode` for backward compat.
- `permanent` → calls `pollPermanentAddress(paymentId, address, network, currency, monitorMinutes)` — fires `payment.received` webhook for every new incoming tx, no amount matching. Status goes `pending` → `closed` after monitoring window.
- `temporary` → calls `pollAddressForPayment(...)` — accumulates until `>= amount * 0.99`. Fires `payment.partial` then `payment.confirmed`.
- `invoice` → creates invoice record, returns `/pay/...` URL.

## DB columns added
- `merchant_shops.permanent_monitor_minutes INT DEFAULT 20` — configures permanent polling window per shop.
- `merchant_payments.payment_mode VARCHAR(20) DEFAULT 'temporary'` — records which mode was used.
- `merchant_shops.address_mode` kept in DB for backward compat but no longer used in UI/new requests.

## Webhooks by mode
- permanent: `payment.received` `{ event, payment_id, order_id, external_user_id, amount, currency, network, tx_hash }`
- temporary/invoice partial: `payment.partial` `{ event, payment_id, amount_required, amount_received, amount_remaining, ... }`
- temporary/invoice full: `payment.confirmed` `{ event, payment_id, amount_required, amount_received, ... }`

## check-payment endpoint
Branches on `payment.payment_mode`. Permanent: scans all txs, fires `payment.received` for new ones. Temporary: existing partial/confirm logic.
