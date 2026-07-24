---
name: Payout local signing
description: Merchant payouts are executed locally using stored private keys, NOT via external wallet API transfer endpoint.
---

## Rule
Payouts MUST be signed and broadcast locally. Never call pay.swiftx.online `/wallet/transfer` or any external API for transfers.

**Why:** The wallet API (pay.swiftx.online) is only used to CREATE wallets and receive the private key. Once `merchant_wallets.private_key` is stored, all transfers are done directly via public blockchain node RPCs.

## How to apply
- Entry point: `server/blockchain-transfer.ts` → `localTransfer({ network, currency, privateKey, fromAddress, toAddress, amount })`
- Called from two places in `server/business-routes.ts`:
  1. Manual payout creation (fire-and-forget, async)
  2. Semi-auto execute route `POST /api/business/shops/:id/payouts/:payoutId/execute`
- Private key field: `merchant_wallets.private_key` (varchar 500, Drizzle ORM field: `wallet.privateKey`)

## Network SDK mapping
- BSC / ETH / ARBITRUM / POLYGON → ethers v6 (`ethers.Wallet` + `JsonRpcProvider`)
- TRON → tronweb (CJS, loaded via `createRequire`)
- TON → `@ton/ton` + `@ton/crypto` (TonClient, WalletContractV4, JettonMaster)
- SOLANA → `@solana/web3.js` + `@solana/spl-token`

## USDT contract addresses & decimals
- BSC: `0x55d398326f99059fF775485246999027B3197955` — **18 decimals** (unlike all others)
- ETH: `0xdAC17F958D2ee523a2206206994597C13D831ec7` — 6 decimals
- ARBITRUM: `0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9` — 6 decimals
- POLYGON: `0xc2132D05D31c914a87C6611C10748AEb04B58e8F` — 6 decimals
- TRON: `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t` — 6 decimals
- TON: `EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs` — 6 decimals
- SOLANA: `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB` — 6 decimals
