---
name: TRON standard transfer safety
description: Pre-flight energy/bandwidth check before USDT/TRX transfers; how to avoid burning TRX on failed txs
---

## Problem solved
Previously `tronTransfer()` used hardcoded `feeLimit: 30_000_000` (30 TRX) with no pre-flight.
With 0 staked energy the real USDT transfer cost is ~7.5 TRX — but if feeLimit < actual cost the tx reverts ON-CHAIN (TRX burned, USDT not sent).

## Pre-flight: getTronTransferQuote()
`blockchain-transfer.ts` exports `getTronTransferQuote(fromAddress, toAddress, amountSun, currency)`.
Calls 3 TronGrid APIs in parallel:
- `GET /v1/accounts/{address}` → TRX balance
- `POST /wallet/getaccountresource` → EnergyLimit/EnergyUsed/NetLimit/NetUsed/freeNet*
- `GET /wallet/getchainparameters` → `getEnergyFee` (sun/energy) and `getTransactionFee` (sun/bandwidth byte)

Then optionally calls `POST /wallet/estimateenergy` — but the **public TronGrid node returns `CONTRACT_VALIDATE_ERROR: this node does not support estimate energy`**. Code falls back to 65,000 energy for USDT (conservative but safe).

**Why:** API key or dedicated node required for `estimateenergy`. Free public endpoint doesn't support it.

## Current chain params (mainnet, 2025-2026)
- Energy fee: **100 sun/unit** (NOT 420 — that's an outdated value)
- Bandwidth fee: 1000 sun/byte
- USDT transfer energy with 15% margin: ~74,750 units → ~7.5 TRX at 100 sun/unit
- feeLimit minimum: 15 TRX (our cap) — actual cost ~8.97 TRX → min kicks in

## Address encoding
`tronBase58ToAbiHex(addr)` in blockchain-transfer.ts converts TRON base58check address to 32-byte ABI hex without TronWeb dependency. `TronWeb.address.toHex` is NOT a static — needs an instance.

## Error codes
- `INSUFFICIENT_TRX:` prefix → pre-flight failure; payout stays `pending`; no TRX burned
- `TRON_REVERT:` prefix → on-chain revert after broadcast; TRX burned; payout → `failed`, balance restored
- `TRON broadcast failed:` → sendRawTransaction returned false; payout → `failed`, balance restored

## Payout failure handling
- auto-transfer (.catch): any error → `failed` status + balance restored
- execute route (.catch): `INSUFFICIENT_TRX` → 422 (payout stays pending); other → `failed` + balance restored

## check-gas endpoint
For TRON, `POST /api/business/shops/:id/payouts/:payoutId/check-gas` now calls `getTronTransferQuote` and returns detailed breakdown: energyRequired/Available/Shortfall, feeLimitTrx, etc.
