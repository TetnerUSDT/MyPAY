---
name: Merchant scanner coverage
description: All 7 blockchain networks wired for incoming USDT payment detection in business-routes.ts, post-audit fixes applied
---

## Networks covered in business-routes.ts

| Network | Scan function | Primary | Fallback (keyed) | decimals |
|---------|--------------|---------|-----------------|---------|
| TRON/TRC20 | `scanTronIncoming` | TronScan public | TronGrid (`TGRID-API-Key` header), leaseKey("TRON") | 6 |
| BSC/BEP20 | `bscScanIncoming` | BscScan API (optional env BSCSCAN_API_KEY) | eth_getLogs via public BSC RPC (always works) | 18 |
| TON | `scanTonIncoming` | TonCenter v3 public (free) | TonCenter v3 with X-API-Key header, leaseKey("TON") | 6 |
| ETH | `scanEvmIncoming("ETH", ...)` | public RPC eth_getLogs (last 2000 blocks) | — | 6 |
| ARBITRUM | `scanEvmIncoming("ARBITRUM", ...)` | public RPC eth_getLogs | — | 6 |
| POLYGON | `scanEvmIncoming("POLYGON", ...)` | public RPC eth_getLogs | — | 6 |
| SOLANA | `scanSolanaIncoming` | public Solana RPC | Helius RPC, leaseKey("SOLANA") | 6 |

## Critical lessons learned (post-audit)

### Solana ATA (CRITICAL)
SPL USDT tokens are held by an Associated Token Account (ATA), NOT the wallet address.
Fix: call `getTokenAccountsByOwner(wallet, {mint: USDT_MINT})` → get ATA pubkey → scan ATA address.
Detection uses `preTokenBalances`/`postTokenBalances` delta (not `info.destination === wallet`).

### TON v2 fallback (CRITICAL)  
TonCenter v2 `getTransactions` returns `in_msg.value` in **nanotons** (native TON), NOT Jetton USDT.
Fix: fallback uses the same TonCenter v3 endpoint with `X-API-Key` header for keyed rate limit tier.
**NEVER use TonCenter v2 getTransactions to scan Jetton transfers.**

### BSC requires no API key
BSC can always be scanned via eth_getLogs on public RPC (no BSCSCAN_API_KEY needed).
Note: BSC Binance-Pegged USDT has NON-STANDARD Transfer topic — do NOT filter by topic[0], only by contract address + topic[2] (to-address). 18 decimals.

### Amount parsing precision
- EVM `log.data` is 0x-prefixed hex → use `hexAmountToDecimal(hex, decimals)` (BigInt-based)
- All other networks return decimal strings → use `parseRawAmount(str, decimals)` (BigInt-based)
- **NEVER use `parseInt(hex, 16) / 10**decimals`** — loses precision for amounts > 2^53 raw units

### Duplicate txHash protection
All 3 confirm UPDATE queries include `AND NOT EXISTS (SELECT 1 FROM ... WHERE tx_hash = ? AND status = 'confirmed')`.
The atomic `WHERE status='pending'` alone is insufficient for multi-poller race conditions.

## Where scanners are called

All 3 polling/check points:
1. `pollAddressForPayment` — background 20s interval poller for payment rows (10 min deadline)
2. `pollInvoiceForPayment` — background 20s interval poller for invoice rows (30 min deadline)
3. `check-payment` POST endpoint — synchronous on-demand scan

`checkTxOnChain` handles manual tx hash verification for all 7 networks.

## Known remaining limitations (for future work)
- No time-based tx filtering: on permanent addresses, old txs could re-trigger for new orders
- setTimeout-based polling is lost on server restart (no persistence for pending payments)
- No exponential backoff / retry on scanner network errors
