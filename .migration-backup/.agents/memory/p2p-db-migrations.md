---
name: P2P DB Migrations
description: How P2P schema changes are applied; MySQL quirks and added columns
---

## Rule
MySQL (version in use) does NOT support `ALTER TABLE ADD COLUMN IF NOT EXISTS`. Always use INFORMATION_SCHEMA checks via the `columnExists(table, col)` helper in `server/p2p-migrations.ts`.

## Columns Added (via runP2PMigrations)
- `p2p_user_stats`: p2p_blocked, block_reason
- `p2p_verification_requests`: doc_front_url, doc_back_url, selfie_url
- `p2p_ads`: price_type ENUM('fixed','market'), price_offset DECIMAL(5,2), auto_reply TEXT
- `p2p_settings` table: key/value store for platform settings

## Settings Keys
commission_percent, platform_user_id, max_disputes_before_block, promotion_cost, promotion_duration_hours, auto_expire_minutes, min_orders_for_verified, min_orders_for_pro

**Why:** Drizzle-kit push is not used for P2P tables; migrations run at server startup via runP2PMigrations() called from server/routes.ts.

**How to apply:** Add new columns inside runP2PMigrations() using the columnExists/tableExists helpers before `mkdir public/uploads/kyc` line.
