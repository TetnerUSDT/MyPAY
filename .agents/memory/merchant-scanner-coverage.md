---
name: Merchant scanner coverage and BSC specifics
description: How each network is scanned in pollAddressForPayment; BSC-specific bugs and fixes applied
---

## Networks covered in business-routes.ts

| Network | Scan function | Primary provider | decimals |
|---------|--------------|-----------------|---------|
| TRON/TRC20 | `scanTronIncoming` | TronScan public → TronGrid keyed | 6 |
| BSC/BEP20 | `bscScanIncoming` | **NodeReal (priority=1, free key embedded)** | **6 (hex)** |
| TON | `scanTonIncoming` | TonCenter v3 public → v3 keyed | 6 |
| ETH | `scanEvmIncoming("ETH", ...)` | publicnode eth_getLogs | 6 |
| ARBITRUM | `scanEvmIncoming("ARBITRUM", ...)` | publicnode eth_getLogs | 6 |
| POLYGON | `scanEvmIncoming("POLYGON", ...)` | publicnode eth_getLogs | 6 |
| SOLANA | `scanSolanaIncoming` | publicnode → Helius keyed | 6 |

## Critical BSC fixes (applied 2026-07-07)

### 1. BSC USDT has 6 decimals, NOT 18
`inbound.value` from `bscScanIncoming` is `log.data` from eth_getLogs — a hex string.
**Use `hexAmountToDecimal(value, 6)` everywhere for BSC, NOT `parseRawAmount(value, 18)`.**
USDT BEP-20: `0x55d398326f99059ff775485246999027b3197955` — 6 decimals.
BUSD: `0xe9e7cea3dedca5984780bafc599bd69add087d56` — 6 decimals too (BEP-20).

### 2. MySQL NOT EXISTS same-table bug in confirmPayment
MySQL throws "You can't specify target table for update in FROM clause" when UPDATE subquery references the same table. The original `NOT EXISTS (SELECT FROM merchant_payments)` inside `UPDATE merchant_payments` always fails silently (affectedRows=0, payment never confirmed).
**Fix: separate SELECT pre-check, then plain `UPDATE WHERE id=? AND status='pending'`.**

### 3. NodeReal is the only working free BSC eth_getLogs provider
- 1rpc.io: rate-limited (usage limit exceeded on free tier)
- publicnode.com: archive requests require personal token
- bsc-dataseed: "limit exceeded"
- NodeReal free key: `64a9df0874fb4a93b9d0a3849de012d3` — embedded in endpoint_template with auth_mode="none"
- Set priority=1, max_block_range=3000 in scanner_network_providers for BSC

### 4. BLOCK_COVERAGE
Set to 5760 blocks (~4.8 hours at 3s/block). With NodeReal max_block_range=3000, scans in 2 chunks. Transactions older than ~4.8 hours fall outside the window and won't be auto-detected — must be confirmed manually.

### 5. Scanner migrations behavior
`ON DUPLICATE KEY UPDATE` for `scanner_network_providers` updates `priority` and `max_block_range` but NOT `enabled` or `endpoint_override`. Scanner providers migration DOES update `auth_mode` and `endpoint_template`. NodeReal BSC config in migrations.ts must have `auth_mode: "none"`, `endpoint_template` with embedded key, and be listed first (priority=1) in seedNetworkConfigs.

## BSC_ACCEPTED_CONTRACTS
- USDT: `0x55d398326f99059ff775485246999027b3197955`
- BUSD: `0xe9e7cea3dedca5984780bafc599bd69add087d56`

## Amount parsing
- EVM `log.data` is 0x-prefixed hex → `hexAmountToDecimal(hex, decimals)` (BigInt-based, imported as `hexAmtToDecimal`)
- All other networks return decimal strings → `parseRawAmount(str, decimals)`

## Webhook delivery
`sendWebhook` uses `fetch()` which follows HTTP→HTTPS 301 redirects automatically. PHP shop webhook URL `http://api.mypay.casa/webhook.php` works via cloudflare redirect.

## Solana ATA (CRITICAL)
SPL USDT tokens held by Associated Token Account (ATA), not wallet. Use `getTokenAccountsByOwner` → ATA → scan ATA.

## TON v2 fallback (CRITICAL)
TonCenter v2 `getTransactions` returns nanotons (TON native), NOT Jetton USDT. Use v3 only.
