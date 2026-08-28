# Overview

SwiftX / MyPay — двойной продукт: **SwiftX** — криптовалютный обменник (USDT→RUB), **MyPay** — B2B-платёжный модуль для приёма криптовалюты на сайтах. Технологический стек: React 18 + TypeScript (фронтенд), Express.js ESM (бэкенд), MySQL + Drizzle ORM.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Routing**: Wouter (lightweight client-side)
- **State Management**: TanStack Query v5 для серверного стейта
- **UI Framework**: shadcn/ui (Radix UI), Tailwind CSS, кастомный дизайн-токен
- **Design**: Mobile-first; responsive breakpoints для `lg`/`xl` десктопа
- **Animation**: GSAP (installed) — сплит-кнопка в PayoutCard, модалка в BusinessPage
- **Pages**:
  - `/` — Splash/Auth (Telegram Mini App или Login with Telegram widget)
  - `/home` — Главная (баланс, действия)
  - `/select-country` — Выбор сервиса (Banks / Cryptocurrency / Cash)
  - `/exchange`, `/top-up`, `/selling`, `/waiting`, `/success` — Обменный флоу
  - `/business` — MyPay кабинет мерчанта
  - `/pay/:invoiceNumber` — Публичная страница инвойса для клиентов

## Backend Architecture
- **Express.js ESM** + `tsx` (dev runner)
- **Route groups**:
  - `/api/*` — публичные (auth, exchange, notifications, Telegram webhook)
  - `/api/business/*` — кабинет мерчанта (требует `x-api-key` юзера)
  - `/api/merchant/*` — публичный API магазина (требует `x-shop-key`)
  - `/{adminPath}/api/*` — Admin panel (secret URL + basic auth)
- **Telegram Webhook**: `/api/telegram/webhook` (public); управление `/#{adminPath}/api/telegram/webhook/*`
- **File Upload (Multer)**: JPEG/PNG/GIF/WebP, 5MB. Структура `public/uploads/`:
  - `system/` — Bot reaction images
  - `users/` — User content
  - `icons/`, `icons/cryptocurrency/` — Network icons
  - `balances/` — Balance icons (ID-named, напр. `3.png`); хелпер `getBalanceIcon(id)` в `client/src/lib/balanceIcons.ts`
  - `assets/`, `support/` — Static / support assets

## Data Storage
- **MySQL** (Drizzle ORM + `mysql2/promise`)
- **Migration tools**: `./scripts/db-push.sh`, `./scripts/db-generate.sh`, `./scripts/db-studio.sh` → `drizzle.mysql.config.ts`. See `DATABASE.md`.
- **MySQL helpers**: `insertAndReturn`, `updateAndReturn`, `insertAndReturnTx` в `server/mysql-helpers.ts`
- **Key tables**: `users`, `wallets`, `transactions`, `exchangeRates`, `supportChats`, `notifications`, `invoices`, referral system, P2P system, Business system (см. ниже)

## Authentication
- **Telegram Mini App**: `initData` HMAC-SHA256 validation
- **Browser**: Login with Telegram widget
- **Admin Panel**: secret URL + basic auth + role check (`requireSuperAdmin`)

---

# Business / MyPay Merchant Module

## Core entities
| Table | Назначение |
|-------|-----------|
| `merchant_shops` | Магазины с API-ключами, статусами, настройками |
| `merchant_payments` | Входящие платежи (все режимы) |
| `merchant_payout_requests` | Заявки на выплату |
| `merchant_wallets` | Пул кошельков магазина |
| `merchant_invoices` | Инвойсы (hosted payment page) |

## Shop lifecycle
`pending` (новый) → `active` / `rejected` / `suspended` (admin-управление через `/{adminPath}/api/business/shops/:id`)  
Публичный merchant API (`x-shop-key`) принимает только `active` магазины.

## Payment modes (per-request, поле `payment_mode` в запросе)
| Режим | Поведение |
|-------|-----------|
| `permanent` | Стабильный адрес, привязанный к `external_user_id`; мониторится `permanentMonitorMinutes` мин |
| `temporary` | Временно зарезервированный адрес (`temporaryMinutes` мин); **два варианта** — см. ниже |
| `invoice` | Создаёт инвойс + страницу `/pay/:invoiceNumber`; клиент выбирает сеть, адрес резервируется под инвойс TTL |

Режим указывается **в каждом запросе отдельно** (legacy `shop.address_mode` используется только как fallback).

### Temporary — два варианта работы

**Вариант A — с конкретной суммой (`amount` + `order_id` переданы)**
- Создаётся запись `merchant_payments` со статусом `pending` и `expires_at = now + temporaryMinutes`.
- Сканер (`pollAddressForPayment`) ждёт поступления точной суммы на адрес в течение TTL.
- При подтверждении: статус → `confirmed`, баланс магазина пополняется, отправляется вебхук `payment.received`.
- При истечении TTL: статус → `expired`.
- Ответ содержит `payment_id` и `expires_at`.

**Вариант B — мониторинг без суммы (`amount` / `order_id` не переданы)**
- Запись платежа не создаётся заранее.
- Кошелёк мониторится `temporaryMinutes` мин через `pollPermanentAddress` — тот же механизм, что у `permanent`, но ограничен по времени.
- При обнаружении любой входящей транзакции: автоматически создаётся `merchant_payments` (статус `confirmed`), баланс пополняется, вебхук отправляется.
- Ответ содержит `wallet_id` и `monitor_until`.

> **Итого**: режим `temporary` с `amount`+`order_id` — это «платёж на точную сумму с таймаутом»; без них — «временное окно мониторинга без привязки к сумме».

## Wallet pool
- Кошельки pre-generated через Wallet API (`POST /api/business/shops/:id/wallets/generate`)
- Статусы: `active` → `reserved` (temporary/invoice) → `permanent` (привязан к юзеру)
- Истёкшие резервирования авто-освобождаются при следующем запросе адреса

## Payout flow
1. **Создание**: `POST /api/business/shops/:id/payouts` (или через UI)
2. **Manual**: мерчант ставит `processing` / `completed` / `cancelled` + TX hash вручную
3. **Semi-auto**: GSAP split-button UI → `POST /api/business/shops/:id/payouts/:id/check-gas` → `POST .../execute` (вызывает Wallet Transfer API)

## API routes summary
**Cabinet** (auth: `x-api-key` = user API key):
- `GET/POST /api/business/shops`
- `GET/PATCH /api/business/shops/:id`
- `GET /api/business/shops/:id/payments`
- `GET/POST /api/business/shops/:id/payouts`
- `PATCH /api/business/shops/:id/payouts/:id`
- `POST /api/business/shops/:id/payouts/:id/check-gas`
- `POST /api/business/shops/:id/payouts/:id/execute`
- `GET/POST /api/business/shops/:id/wallets`
- `POST /api/business/shops/:id/wallets/generate`
- `POST /api/business/shops/:id/wallets/:id/check-balance`
- `POST /api/business/shops/:id/wallets/:id/start-monitoring`

**Merchant public** (auth: `x-shop-key`):
- `POST /api/merchant/address` — выдать адрес/инвойс
- `POST /api/merchant/check-payment` — проверить статус
- `GET /api/merchant/payment/:id`
- `POST /api/merchant/verify-tx`
- `POST /api/merchant/payout`
- `GET /api/merchant/invoice/:number`
- `POST /api/merchant/invoice/:number/select-network`

## Frontend components (business.tsx)
- `BusinessPage` — список магазинов + premium animated modal для "Подключить магазин"
- `ShopCard` — карточка магазина в сетке (3 col lg, 2 col md, 1 col mobile)
- `ShopDetail` — детальная страница магазина с табами
- Tabs: `overview` | `payments` | `payouts` | `wallets` | `settings`
- `PayoutCard` — карточка выплаты с GSAP split-button (В ручную / Полуавтомат)
- `WalletsTab`, `PaymentsTab`, `PayoutsTab` — адаптивные гриды (3 col lg, 4 col xl)
- `SettingsTab` — 2-column desktop layout
- `ApiDocs` — интерактивная API-документация с code blocks
- `CreateShopForm` — форма создания магазина (внутри premium модалки)

## GSAP usage
- `PayoutCard` — animated split CTA: одна пилюля → две кнопки (`В ручную` / `Полуавтомат`)
- `BusinessPage` modal — slide-up open/scale-out close animation

---

# Supported Cryptocurrency Networks

| Network | API Node | Currencies |
|---------|----------|------------|
| BEP20 | BSC | USDT |
| TRC20 | TRON | USDT |
| TON | TON | USDT |
| Polygon | POLYGON | DAI, POL |

Exchange rates for DAI and POL are auto-initialized on startup. Supported pairs:
- USDT (BEP20/TRC20/TON) ↔ DAI (Polygon)
- USDT (BEP20/TRC20/TON) ↔ POL (Polygon)
- POL ↔ DAI exchanges not yet configured

# External Dependencies

- **Database**: MySQL via Drizzle ORM + mysql2
- **Telegram API**: Auth, user profile (avatar/username), sharing
- **Wallet API**: `https://pay.swiftx.online/api/wallet/create` — generate/transfer wallets. Env: `WALLET_API_URL`, `WALLET_API_KEY`. Networks: BSC, TRON, TON, POLYGON
- **Blockchain RPCs**: Direct on-chain balance checks for BNB/TRX/TON/ETH/MATIC (gas precheck before semi-auto payout)
- **P2P System**: Peer-to-peer crypto trading with escrow, disputes, merchants, ads, orders (see `server/p2p/`)
- **Scanner**: Blockchain transaction scanner (`server/scanner/`)
