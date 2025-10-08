# Overview

SwiftX is a cryptocurrency exchange application that allows users to quickly convert cryptocurrencies to traditional currencies, specifically targeting Russian users for USDT to RUB exchanges. The application is built as a modern full-stack web application with a mobile-first design approach, featuring a React frontend with a sleek green-themed UI and an Express.js backend with PostgreSQL database integration.

# User Preferences

Preferred communication style: Simple, everyday language.

# Recent Changes

## PostgreSQL Driver Fix for Ubuntu/Production Servers (October 2025)
Fixed critical SSL/WebSocket connection issue when deploying to Ubuntu servers:
- **Problem**: Application used Neon serverless driver (`@neondatabase/serverless`) with WebSocket for localhost PostgreSQL, causing SSL certificate errors on production
- **Solution**: Implemented automatic database type detection in `server/db.ts`
  - **For Neon/Replit serverless**: Uses `@neondatabase/serverless` with WebSocket (detects by URL containing 'neon.tech', 'neon.database', or '.replit.dev')
  - **For localhost PostgreSQL**: Uses standard `pg` driver without SSL (for Ubuntu/production servers)
- **Dependencies**: Added `pg` package as additional dependency for localhost support
- **Configuration**: Updated `ecosystem.config.cjs` to use `tsx` for running TypeScript directly (avoids compilation issues)
- **Deployment**: Updated `DEPLOYMENT_INSTRUCTIONS.md` with troubleshooting section 15 detailing the fix
- **Impact**: Resolves "unable to verify the first certificate" error and 500 status on login for Ubuntu deployments

## Telegram Authentication Implementation (October 2025)
Implemented dual Telegram authentication strategy:
- **Telegram Mini App**: Automatic authentication using initData when accessed from Telegram App
- **Browser Access**: "Login with Telegram" widget for web browser users
- **Security**: Backend validates Telegram auth data using HMAC-SHA256 with bot token secret
- **Configuration**: Requires TELEGRAM_BOT_TOKEN and TELEGRAM_BOT_USERNAME environment secrets
- **Bot Setup**: Domain must be configured in BotFather using /setdomain command
- **Production Ready**: Test mode button removed, only Telegram authentication visible in UI

## Database Switching Support (October 2025)
Added flexible database backend configuration:
- **Multi-Database Support**: Runtime switching between PostgreSQL and MySQL databases
- **Configuration**: Use DB_TYPE environment variable ('postgres' or 'mysql', defaults to 'postgres')
- **Driver Integration**: Automatic selection of appropriate Drizzle ORM adapter based on DB_TYPE
- **Validation**: Startup validation ensures DB_TYPE is valid and DATABASE_URL is configured
- **Logging**: Database type displayed in startup logs for verification
- **Note**: Drizzle migrations remain PostgreSQL-only; MySQL requires manual schema setup

## Admin Panel Implementation (October 2025)
Implemented comprehensive admin panel with the following features:
- **Access Control**: Secret URL-based access using ADMIN_URL, ADMIN_LOGIN, ADMIN_PASSWORD environment secrets
- **Authentication**: Basic Auth with role-based permissions (super admin)
- **Management Pages**:
  - Balances: CRUD operations for fiat/crypto balances (separated system and user balances)
  - Exchanges: View and edit exchange orders, change statuses, add payment hashes
  - Cards (Countries): Manage countries with exchange settings (time, commission, linked balances)
  - Banks: Add banks linked to countries with custom settings
  - Exchange Rates: Manage currency exchange rates
  - Support: Real-time chat interface for responding to user support requests
  - Users: View user information and statistics
  - Wallets: Monitor wallet statuses with filtering by address, network (TON/TRC20/BEP20), operation type (topup/exchange/voucher/personal)

# System Architecture

## Frontend Architecture
The client is built with **React 18** using TypeScript and follows a component-based architecture. Key design decisions include:

- **Routing**: Uses Wouter for lightweight client-side routing, providing a simpler alternative to React Router
- **State Management**: Leverages TanStack Query (React Query) for server state management, eliminating the need for complex global state solutions
- **UI Framework**: Implements shadcn/ui components built on Radix UI primitives for accessible, customizable components
- **Styling**: Uses Tailwind CSS with a custom design system featuring CSS custom properties for theming
- **Mobile-First Design**: Optimized for mobile devices with bottom navigation and mobile-specific screen layouts

The application follows a page-based structure with screens for splash, country selection, exchange, top-up, selling, waiting, success, and support functionalities.

## Backend Architecture
The server uses **Express.js** with TypeScript in ESM mode, following a clean separation of concerns:

- **Storage Layer**: Implements an interface-based storage pattern with in-memory implementation for development and easy database migration
- **Route Handling**: Centralized route registration with proper error handling and request/response logging
- **Development Integration**: Vite integration for hot module replacement and development server proxy
- **API Design**: RESTful endpoints for transactions, exchange rates, and support chat functionality

## Data Storage Solutions
The application supports **PostgreSQL** (default) and **MySQL** databases with **Drizzle ORM** for type-safe database operations:

- **Database Flexibility**: Runtime switching via DB_TYPE environment variable (postgres/mysql)
- **Schema Design**: Well-structured tables for users, wallets, transactions, exchange rates, and support chats
- **Type Safety**: Drizzle-Zod integration provides runtime validation and TypeScript types from database schema
- **Migration Strategy**: Drizzle Kit handles PostgreSQL migrations; MySQL requires manual schema setup
- **Connection**: Supports Neon Database serverless PostgreSQL and MySQL connection pools

Key architectural decisions for data modeling:
- Decimal precision handling for cryptocurrency amounts (18 digits, 8 decimal places)
- UUID primary keys for security and scalability
- JSON fields for flexible message storage in support chats
- Proper foreign key relationships maintaining data integrity
- Referral system with unique codes (format: 1 uppercase letter A-Z + 9 digits) automatically generated on user creation

## Authentication and Authorization
The current implementation uses a simplified authentication model suitable for the prototype phase:
- Session-based approach with connect-pg-simple for PostgreSQL session storage
- User identification through username/password combination
- Ready for enhancement with proper JWT tokens or OAuth integration

## External Service Integrations
The architecture is designed to accommodate external services:
- **Exchange Rate APIs**: Modular design allows easy integration with real-time cryptocurrency exchange rate providers
- **Payment Processing**: Structure supports integration with payment gateways for card transactions
- **Blockchain Integration**: Transaction hash tracking prepared for blockchain network interactions
- **Notification Services**: Support chat system ready for real-time messaging integration

The monorepo structure with shared schemas enables consistent data types across frontend and backend, while the interface-based storage layer allows for easy swapping between different database implementations or adding caching layers.