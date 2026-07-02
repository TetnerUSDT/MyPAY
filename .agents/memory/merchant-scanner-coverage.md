---
name: Merchant scanner coverage
description: All 7 blockchain networks wired for incoming USDT payment detection in business-routes.ts
---

## Networks covered in business-routes.ts

| Network | Scan function | Primary | Fallback (keyed) | decimals |
|---------|--------------|---------|-----------------|---------|
| TRON/TRC20 | `scanTronIncoming` | TronScan public | TronGrid (`TGRID-API-Key` header), leaseKey("TRON") | 6 |
| BSC/BEP20 | `bscScanIncoming` | public BSC RPC (eth_getLogs) | BscScan API key (optional env `BSCSCAN_API_KEY`) | 18 |
| TON | `scanTonIncoming` | TonCenter v3 public (free) | TonCenter v2 (`X-API-Key` header), leaseKey("TON") | 6 |
| ETH | `scanEvmIncoming("ETH", ...)` | public RPC eth_getLogs (last 2000 blocks) | — (no keyed fallback) | 6 |
| ARBITRUM | `scanEvmIncoming("ARBITRUM", ...)` | public RPC eth_getLogs | — | 6 |
| POLYGON | `scanEvmIncoming("POLYGON", ...)` | public RPC eth_getLogs | — | 6 |
| SOLANA | `scanSolanaIncoming` | public Solana RPC | Helius RPC, leaseKey("SOLANA") | 6 |

## Key details

- `EVM amountRaw` is a **hex string** (from `log.data` in eth_getLogs). Always parse with `parseInt(x, 16)`, NOT `BigInt(x)`.
- TRON/TON/Solana `amountRaw` are decimal strings → `parseInt(x)`.
- BSC uses `1e18` decimals (token has 18 decimal places despite being USDT).
- `scanEvmIncoming` builds padded address as `0x000...000<address_lower>` for topic[2] filter.
- SOLANA_USDT_MINT = `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB`
- TON_USDT_MASTER_ADDR = `EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs`
- ERC20_TRANSFER_TOPIC = `0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef`

## Where scanners are called

All 3 polling/check points share the same network dispatch logic:
1. `pollAddressForPayment` — background 20s interval poller for payment rows
2. `pollInvoiceForPayment` — background 20s interval poller for invoice rows  
3. `check-payment` POST endpoint — synchronous on-demand scan

`checkTxOnChain` also handles TON/ETH/ARB/POLYGON/SOLANA for manual tx verification.

## Admin UI (business.tsx)

`PROVIDERS` array has 6 entries: TronGrid, TronScan, TonCenter, BscScan, Etherscan, Helius.
Each has a `note` field shown as an info box in the tab.

**Why:** EVM networks use only public RPCs (no key needed), so Etherscan/BscScan keys are optional fallbacks.
TON and Solana use keyed fallbacks for higher rate limits.

**How to apply:** When adding new networks, add scan function + wire into all 3 dispatch points + add to PROVIDERS.
