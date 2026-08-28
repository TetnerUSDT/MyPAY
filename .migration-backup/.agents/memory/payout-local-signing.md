---
name: Payout local signing
description: All payouts use local private-key signing via server/blockchain-transfer.ts; no external wallet API for transfers. Includes GasFree TRON implementation.
---

## Rule
Payouts NEVER call `pay.swiftx /wallet/transfer`. The private key stored in `merchant_wallets.private_key` is used to sign and broadcast locally via `server/blockchain-transfer.ts`.

**Why:** `pay.swiftx` `/wallet/transfer` endpoint returned HTML error pages, and relying on a third-party for signing creates a single point of failure. Local signing is more reliable and gives full control.

**How to apply:** Both payout callsites in `server/business-routes.ts` call `localTransfer()`. No gasfree branching at the route level — both standard and gasfree TRON go through `localTransfer`, which dispatches internally based on `mode`.

---

## Network → SDK mapping

| Network   | SDK              | Notes                                      |
|-----------|------------------|--------------------------------------------|
| BSC       | ethers v6        | ERC20 `transfer()` for USDT               |
| ETH       | ethers v6        | ERC20 `transfer()` for USDT               |
| ARBITRUM  | ethers v6        | ERC20 `transfer()` for USDT               |
| POLYGON   | ethers v6        | ERC20 `transfer()` for USDT               |
| TRON      | tronweb (CJS)    | `createRequire(import.meta.url)` required  |
| TRON GasFree | tronweb + @noble/curves/secp256k1 | PermitTransfer EIP-712 signed locally, submitted to relayer |
| TON       | @ton/ton         | WalletContractV4 + Jetton for USDT        |
| SOLANA    | @solana/web3.js  | SPL token for USDT, bs58 for keypair      |

---

## USDT contract addresses + decimals

| Network   | Address                                          | Decimals |
|-----------|--------------------------------------------------|----------|
| BSC       | 0x55d398326f99059fF775485246999027B3197955       | **18**   |
| ETH       | 0xdAC17F958D2ee523a2206206994597C13D831ec7       | 6        |
| ARBITRUM  | 0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9       | 6        |
| POLYGON   | 0xc2132D05D31c914a87C6611C10748AEb04B58e8F       | 6        |
| TRON      | TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t              | 6        |
| TON       | EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs | 6     |
| SOLANA    | Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB    | 6        |

**BSC decimals = 18 is a frequent gotcha — unlike all other networks.**

---

## GasFree TRON

GasFree is NOT a special wallet type — it's a relay protocol. Standard TRON wallets are created regardless of `mode`. The gasfree flow:

1. Sign a `PermitTransfer` EIP-712 message locally with the wallet's private key.
2. POST to the relayer's `/api/v1/gasfree/submit`.
3. Poll `/api/v1/gasfree/{id}` until `txnHash` appears (up to 60 s).

**EIP-712 domain:**
```json
{ "name": "GasFreeController", "version": "V1.0.0", "chainId": "728126428", "verifyingContract": "<GASFREE_VERIFYING_CONTRACT>" }
```

**Signing:** `@noble/curves/secp256k1` — sign raw digest, assemble r+s+v (no 0x prefix).

**Required env vars (without these, gasfree mode throws a clear error):**
- `TRON_GASFREE_PROVIDER` — relayer base URL
- `TRON_GASFREE_SERVICE_PROVIDER` — service-provider TRON address
- `TRON_GASFREE_VERIFYING_CONTRACT` — verifying-contract TRON address
- `TRON_GASFREE_API_KEY` / `TRON_GASFREE_API_SECRET` — optional HMAC auth

**Wallet registration:** `registerGasFreeWallet(address)` fetches `gasFreeAddress` from provider (called in `generateMerchantWallet` when `mode=gasfree`). If provider is not configured, returns `null` (non-fatal, wallet still created).

**GasFree contracts on TronScan (mainnet, both verified):**
- `TLXXgqNjVGJ2dmCmmVH3EcQfK85fk4644i` — GasFreeController
- `TWsrTKcFaEAFoEexZwFHj1rdmmxwDxU5Kf` — (second verified contract)
- Creator: `TUNSHddcGJafaUYfwH8qS2uMHfvumKwJK8`
