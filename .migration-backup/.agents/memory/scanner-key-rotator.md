---
name: Scanner key rotator
description: How the merchant API key pool works for blockchain scanning (TRON, BSC, ETH)
---

## leaseKey pattern
- `server/merchant-key-rotator.ts` — `leaseKey(network)`, `recordKeyError(keyId)`, `recordKeySuccess(keyId)`
- Fetches all `is_active=1` keys ordered by oldest `last_used_at` (round-robin)
- `networks` column is TEXT storing a JSON array e.g. `["TRON","TRC20"]` — parsed in JS, NOT with SQL JSON functions
- Skips keys where `monthly_limit > 0 AND usage_this_month >= monthly_limit`
- Auto-resets `usage_this_month` if `reset_month != currentMonth` (YYYY-MM)

## TRON scan fallback chain
In `server/business-routes.ts`:  
`scanTronIncoming(address)`:
1. Public TronScan API (no key) — falls through ONLY on HTTP error (non-2xx), NOT on empty result
2. TronGrid API with leased key from pool — headers: `TGRID-API-Key: <key>`
3. Returns `TronTransfer[]` with `{ txHash, amountRaw }` normalized interface

TronGrid TRC20 endpoint: `GET /v1/accounts/{address}/transactions/trc20?contract_address=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t&limit=10&only_to=true`

## Admin UI
- Admin routes at `/${adminPath}/api/business/scanner-keys` in `server/admin-routes.ts`
- Frontend: `adminRequest("/business/scanner-keys")` in `client/src/pages/admin/business.tsx`
- "API Ключи" button opens a Tabs modal (TronGrid | TronScan | BscScan | Etherscan)
- Provider networks are hardcoded in PROVIDERS constant in business.tsx

**Why:** TronScan public API has rate limits and occasional outages; TronGrid provides reliable fallback with keyed access. BSC uses eth_getLogs via public RPC — no key ever needed.
