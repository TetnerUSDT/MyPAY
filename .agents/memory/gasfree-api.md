---
name: GasFree API wiring
description: Configuration and auth details for the open.gasfree.io GasFree relay used for TRON payout
---

## Relay URL
`TRON_GASFREE_PROVIDER` = `https://open.gasfree.io`
- `developer.gasfree.io` is the developer PORTAL (key management UI), NOT an API endpoint.
- `open.gasfree.io` is the actual relay API.

## URL path format
All paths must include the `/tron` chain prefix in the URL:
```
https://open.gasfree.io/tron/api/v1/config/token/all
https://open.gasfree.io/tron/api/v1/address/{addr}
https://open.gasfree.io/tron/api/v1/gasfree/submit
https://open.gasfree.io/tron/api/v1/gasfree/{id}
```

## HMAC auth
```
Timestamp: <unix_seconds>
Authorization: ApiKey <key>:<base64(HMAC-SHA256(method + fullPath + timestamp, secret))>
```
Where `fullPath` = `/tron/api/v1/...` (full path including `/tron` prefix, same as URL path).

**Why:** The HMAC message must include the full URL path. `401 Authorization hash not match` if you use only `/api/v1/...` in the HMAC.

## serviceProvider (critical)
`serviceProvider` in the EIP-712 PermitTransfer struct is **per-developer**: it is the TRON wallet address the developer binds to their developer.gasfree.io account (NOT a global constant).

On-chain verification: each of 20 recent GasFreeController txs had a different serviceProvider — confirming per-developer assignment.

**How to obtain:** 
1. Verify email at developer.gasfree.io
2. Go to "Wallet Bind" / "Bind Wallet" section
3. Bind a TRON address → that address = `TRON_GASFREE_SERVICE_PROVIDER`

## SDK constants (TRON mainnet)
- `gasFreeController` (= verifyingContract) = `TFFAMQLZybALaLb4uxHA9RBE7pxhUAjF3U`
- `beacon` = `TSP9UW6FQhT76XD2jWA6ipGMx3yGbjDffP`
- `chainId` = `728126428` (0x2b6653dc)

Neither beacon nor gasFreeController is the serviceProvider.

## Code location
`server/blockchain-transfer.ts` — `gasFreeRequest()` function handles URL + HMAC.
The `chainPrefix = "/tron"` is prepended to all paths in BOTH the URL and the HMAC message.
