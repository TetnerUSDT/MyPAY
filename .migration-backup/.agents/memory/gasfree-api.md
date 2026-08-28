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
`serviceProvider` in EIP-712 is the **provider's address from the API**, NOT a per-developer wallet.

**How to obtain:** `GET https://open.gasfree.io/tron/api/v1/config/provider/all`
→ `data.providers[0].address` = `TLntW9Z59LYY5KEi9cmwk3PKjQga828ird`

Set as `TRON_GASFREE_SERVICE_PROVIDER`. This is a global constant per provider, not per developer account.

## gasFreeAddress (per wallet)
Each user TRON wallet has a unique `gasFreeAddress` (CREATE2 derived). This is where clients send USDT to pay for transfers.
- Get via API: `GET /tron/api/v1/address/{walletAddress}` → `data.gasFreeAddress`
- `registerGasFreeWallet(address)` in blockchain-transfer.ts calls the API (primary) or SDK (fallback)
- Store in `merchant_wallets.gasfree_address`
- Scanner should monitor `gasFreeAddress`, not the regular wallet address, for incoming USDT

## EIP-712 domain (confirmed correct)
- name: `"GasFreeController"`, version: `"V1.0.0"`, chainId: `728126428` (decimal string)
- verifyingContract: `TFFAMQLZybALaLb4uxHA9RBE7pxhUAjF3U`
- All address fields in struct: TRON base58 format (NOT EVM hex)
- Signature: secp256k1, r||s||v (65 bytes hex without 0x), v = 27 + recovery

## Transfer fees
- transferFee: 1,500,000 (1.5 USDT in micro-USDT, 6 decimals)
- activateFee: 1,500,000 (1.5 USDT, first time only if active=false)
- maxFee = transferFee + (active ? 0 : activateFee)

## check-gas endpoint GasFree branch
`/check-gas` now has a dedicated branch for `wallet.mode === 'gasfree'` (before the standard TRON branch).
Calls `getGasFreeQuote(fromAddress)` (exported from blockchain-transfer.ts) which fetches:
- `/api/v1/address/{addr}` → `active`, `allowSubmit`
- `/api/v1/config/token/all` → `transferFee`, `activateFee`
Returns: `{ mode:"gasfree", hasEnoughGas:true, gasCurrency:"USDT", transferFee, activationFee, totalFee, willReceive, payoutAmount, gasfreeActive }`

## Frontend GasFree display (business.tsx)
`GasInfo` type extended with optional GasFree fields (`mode`, `transferFee`, `activationFee`, `totalFee`, `willReceive`, `payoutAmount`, `gasfreeActive`, `allowSubmit`).
Gas display block checks `gasInfo.mode === "gasfree"` first → shows blue card with USDT fee breakdown and "Получатель получит X USDT". Falls through to standard TRX block otherwise.

## Validation guards added (2026-07-26)
1. All 3 env vars checked upfront (PROVIDER, SERVICE_PROVIDER, VERIFYING_CONTRACT)
2. Private key → derived address verified == fromAddress before signing
3. `allowSubmit` field checked from /address API
4. Poll fallback: `txnHash ?? txHash` (resilient to API field drift)
5. Terminal status detection: fail/reject/cancel in poll loop → early exit

## SDK constants (TRON mainnet)
- `gasFreeController` (= verifyingContract) = `TFFAMQLZybALaLb4uxHA9RBE7pxhUAjF3U`
- `beacon` = `TSP9UW6FQhT76XD2jWA6ipGMx3yGbjDffP`
- `chainId` = `728126428` (0x2b6653dc)

Neither beacon nor gasFreeController is the serviceProvider.

## Code location
`server/blockchain-transfer.ts` — `gasFreeRequest()` function handles URL + HMAC.
The `chainPrefix = "/tron"` is prepended to all paths in BOTH the URL and the HMAC message.
