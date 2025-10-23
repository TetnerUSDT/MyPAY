# Overview

SwiftX is a cryptocurrency exchange application designed for converting cryptocurrencies to traditional currencies, primarily targeting Russian users for USDT to RUB exchanges. It is a modern, mobile-first, full-stack web application featuring a React frontend and an Express.js backend with MySQL database integration. The project aims to provide a seamless and efficient exchange experience.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The client is built with React 18 and TypeScript, utilizing a component-based architecture. Key aspects include:
- **Routing**: Wouter for lightweight client-side navigation.
- **State Management**: TanStack Query (React Query) for efficient server state management.
- **UI Framework**: shadcn/ui components built on Radix UI for accessibility and customization.
- **Styling**: Tailwind CSS with a custom design system and CSS custom properties for theming.
- **Design**: Mobile-first approach with optimized layouts and bottom navigation.
- **Pages**: Structured with screens for splash, service selection (with tabs: Banks, Cryptocurrency, Cash), exchange (supports both bank and crypto modes), top-up, selling, waiting, success, and support.
- **Service Selection**: Tabbed interface at /select-country displays three service categories. Bank tab shows country cards with flag icons, crypto tab displays available cryptocurrency exchange rates, cash tab shows coming-soon placeholder.

## Backend Architecture
The server uses Express.js with TypeScript in ESM mode, focusing on clean separation of concerns:
- **Storage Layer**: Interface-based pattern allowing flexible database implementations.
- **Route Handling**: Centralized routing with error handling and logging. Admin routes are separated into `admin-routes.ts` with path prefix `/{adminPath}/api/*`.
- **Development**: Vite integration for hot module replacement.
- **API Design**: RESTful endpoints for transactions, exchange rates, and support.
- **Telegram Webhook**: Public webhook endpoint at `/api/telegram/webhook` for Telegram updates. Webhook management (set/info/delete) available at `/{adminPath}/api/telegram/webhook/*` (admin only).
- **File Upload System**: Multer-based file upload with validation (JPEG/PNG/GIF/WebP, 5MB limit). Organized structure in `public/uploads/`:
  - `public/uploads/system/` - Bot reaction images (Telegram bot)
  - `public/uploads/users/` - User-uploaded content
  - `public/uploads/icons/` - Application icons and logos
  - `public/uploads/icons/cryptocurrency/` - Cryptocurrency network icons (ethereum, bnb, ton, tron, solana)
  - `public/uploads/balances/` - Balance icons named by database ID (e.g., `3.png` for balance id=3). Universal approach for displaying balance icons throughout the app using `getBalanceIcon(id)` helper from `client/src/lib/balanceIcons.ts`
  - `public/uploads/assets/` - Application static assets
  - `public/uploads/support/` - Support system assets (avatars, etc.)
  - All files accessible via `/uploads/*` URLs in frontend

## Data Storage Solutions
The application uses MySQL exclusively with Drizzle ORM for type-safe operations:
- **Database**: MySQL with connection pooling via `mysql2/promise` driver.
- **Schema Design**: Well-structured tables for users, wallets, transactions, exchange rates, support chats, notifications, invoices, and a referral system.
- **Service Categories System**: Exchange rates and cards organized by category enum ('bank', 'crypto', 'cash'). Category-aware API endpoints (/api/services/banks, /api/services/crypto, /api/services/cash) filter data by service type. Crypto mode supports direct cryptocurrency-to-cryptocurrency exchanges without requiring bank card selection.
- **Bot Commands System**: Database-driven command management with `botCommands`, `botCommandReactions`, `botMenus`, and `botMenuButtons` tables. Supports dynamic command text, images, inline buttons with links, and conditional execution.
- **Referral System**: Unique referral codes (1 uppercase letter + 9 digits) generated on user registration.
- **Type Safety**: Drizzle-Zod integration for runtime validation and TypeScript types.
- **Migration Tools**: Custom shell scripts (`./scripts/db-push.sh`, `./scripts/db-generate.sh`, `./scripts/db-studio.sh`) using `drizzle.mysql.config.ts` for MySQL-specific operations. See DATABASE.md for detailed guide.
- **MySQL Helpers**: Custom helper functions (`insertAndReturn`, `updateAndReturn`, `insertAndReturnTx`) in `server/mysql-helpers.ts` to handle MySQL's lack of native `RETURNING` clause support.
- **Data Modeling**: Emphasizes decimal precision for crypto amounts, auto-increment serial IDs, JSON fields, and foreign key relationships.

## Authentication and Authorization
- **Authentication**: Dual strategy with Telegram Mini App `initData` for in-app access and "Login with Telegram" widget for browser users. Backend validates Telegram auth data using HMAC-SHA256.
- **Admin Panel**: Features access control via secret URL, basic authentication, and role-based permissions. Provides management for balances, exchanges, cards, banks, exchange rates, support, users, and wallets.
- **Telegram User Profile Integration**: Fetches and updates Telegram user data (username, avatar) via Bot API on login and webhook updates.

## UI/UX Decisions
- **Green-themed UI**: Consistent visual design with green gradients.
- **Interactive Customer Engagement**: Notification badges with unread counts, detailed notification pages with rich media, and invoice pages with countdown timers and payment options.
- **Referral System UI**: Dedicated loyalty program page with "Link" and "My Partners" tabs, copy-to-clipboard functionality, and Telegram share integration.
- **Service Category Navigation**: Three-tab interface (Banks, Cryptocurrency, Cash) for organizing exchange services by type. Bank mode requires card selection for receiving fiat, crypto mode enables direct crypto-to-crypto exchanges without card requirements.

# External Dependencies

- **Database**: MySQL (via Drizzle ORM and mysql2 driver).
- **Telegram API**: For user authentication, fetching user profile data (avatars, usernames), and sharing features.
- **Payment Processing**: Integration points for blockchain payments (transaction hash tracking) and balance payments.
- **Exchange Rate APIs**: Modular design for integrating real-time cryptocurrency exchange rate providers.