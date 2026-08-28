---
name: P2P Modular Architecture
description: p2p-routes.ts is a re-export shim; actual route code lives in server/p2p/ subdirectory
---

## Rule
`server/p2p-routes.ts` now only re-exports from `./p2p/index`. All new P2P routes must go into the appropriate file in `server/p2p/`.

## File Map
- `server/p2p/helpers.ts` — shared utilities: checkP2PBlock, snakeToCamel, logP2P, sendP2PNotification, updateLastSeen, recalculateSortPriority
- `server/p2p/routes-ads.ts` — payment methods, user payment methods, ads CRUD, bulk update, promotion
- `server/p2p/routes-orders.ts` — orders CRUD, mark-paid, release (escrow), cancel, dispute, messages, reviews
- `server/p2p/routes-misc.ts` — stats, user disputes, merchant profile, favorites, complaints, verify (KYC), dashboard, ping
- `server/p2p/index.ts` — registers all sub-routes, exports registerP2PRoutes + initP2PPaymentMethods

**Why:** p2p-routes.ts grew to ~1175 lines; split for maintainability.

**How to apply:** When adding a new P2P route, identify the correct file (ads/orders/misc), add there, NOT in p2p-routes.ts.
