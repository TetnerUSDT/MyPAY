---
name: Merchant scanner coverage
description: All 7 blockchain networks wired for incoming USDT payment detection in business-routes.ts, post-audit fixes applied
---

## Networks covered in business-routes.ts

| Network | Scan function | Primary | Fallback (keyed) | decimals |
|---------|--------------|---------|-----------------|---------|
| TRON/TRC20 | `scanTronIncoming` | TronScan public | TronGrid (`TGRID-API-Key` header), leaseKey("TRON") | 6 |
| BSC/BEP20 | `bscScanIncoming` | 1rpc.io/bnb eth_getLogs (14 parallel calls: 7 chunks × 2 contracts) | bsc-dataseed fallback for eth_blockNumber | 18 |
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

### BSC scanner: only 1rpc.io works for eth_getLogs (CRITICAL)
Tested 2026-07-02. All other free BSC RPCs fail eth_getLogs:
- ankr.com: requires API key
- bsc.publicnode.com: requires personal token for archive requests
- bsc-dataseed.binance.org: "limit exceeded"
- meowrpc: eth_getLogs not supported
- drpc.org/bscrpc.com/llamarpc: unresponsive
- 1rpc.io/bnb: WORKS but max 49-block range per call

BscScan V1 API: deprecated — always returns NOTOK regardless of address.
BscScan V2 (api.etherscan.io/v2?chainid=56): requires paid Etherscan plan for BSC.
BSCSCAN_API_KEY env var is unused — remove it if present.

Fix: 14 parallel eth_getLogs calls (7 chunks × 49 blocks × 2 contracts: USDT+BUSD).
Covers last 343 blocks ≈ 17 min. BSC uses standard ERC20 Transfer topic[0] = OK to filter.
USDT: 0x55d398326f99059fF775485246999027B3197955 (18 dec)
BUSD: 0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56 (18 dec)

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

## Resilience features implemented

### Startup recovery (persistence polling)
`recoverPendingPollers()` is called via `setImmediate()` at the end of `registerBusinessRoutes`.
Queries `merchant_payments WHERE status='pending'` and `merchant_invoices WHERE status='pending' AND expires_at > NOW() AND wallet_address IS NOT NULL`.
Resumes polling with the original deadline (`created_at + TTL`), or expires overdue rows.
Invoice query uses `network_chosen` (not `network`) and JOINs `merchant_shops` for `webhook_url`.

### Exponential backoff
Both pollers start at 10s, multiply by 1.5 on no-find (max 60s), double on network error (max 60s).
Replaces fixed 20s interval — reduces load during quiet periods, stays responsive at start.

### Permanent address phantom-match prevention
Before creating a new payment on a permanent address, all existing `pending` payments for that
`wallet_address` are expired. Prevents old on-chain txs matching a brand-new payment session.

### Strict verify-tx validation
- **TON**: TonCenter v3 `/jetton/transfers` → match by `transaction_hash` + `jetton_master` = USDT master
- **Solana**: `getTransaction` → `postTokenBalances - preTokenBalances` delta for `owner = toAddress` and `mint = USDT_MINT`
- **BSC/EVM checkTxOnChain**: `hexAmountToDecimal(log.data, decimals)` — BigInt precision, no more `parseInt/1e18`
