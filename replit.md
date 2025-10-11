# Overview

SwiftX is a cryptocurrency exchange application designed for converting cryptocurrencies to traditional currencies, primarily targeting Russian users for USDT to RUB exchanges. It is a modern, mobile-first, full-stack web application featuring a React frontend and an Express.js backend with PostgreSQL/MySQL database integration. The project aims to provide a seamless and efficient exchange experience.

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
- **Pages**: Structured with screens for splash, country selection, exchange, top-up, selling, waiting, success, and support.

## Backend Architecture
The server uses Express.js with TypeScript in ESM mode, focusing on clean separation of concerns:
- **Storage Layer**: Interface-based pattern allowing flexible database implementations.
- **Route Handling**: Centralized routing with error handling and logging.
- **Development**: Vite integration for hot module replacement.
- **API Design**: RESTful endpoints for transactions, exchange rates, and support.

## Data Storage Solutions
The application supports PostgreSQL (default) and MySQL with Drizzle ORM for type-safe operations:
- **Database Flexibility**: Runtime switching via `DB_TYPE` environment variable.
- **Schema Design**: Well-structured tables for users, wallets, transactions, exchange rates, support chats, notifications, invoices, and a referral system.
- **Referral System**: Unique referral codes (1 uppercase letter + 9 digits) generated on user registration.
- **Type Safety**: Drizzle-Zod integration for runtime validation and TypeScript types.
- **Migration**: Drizzle Kit for PostgreSQL migrations; MySQL requires manual schema setup.
- **Connection**: Supports Neon Database serverless PostgreSQL and MySQL connection pools.
- **Data Modeling**: Emphasizes decimal precision for crypto amounts, UUID primary keys, JSON fields, and foreign key relationships.

## Authentication and Authorization
- **Authentication**: Dual strategy with Telegram Mini App `initData` for in-app access and "Login with Telegram" widget for browser users. Backend validates Telegram auth data using HMAC-SHA256.
- **Admin Panel**: Features access control via secret URL, basic authentication, and role-based permissions. Provides management for balances, exchanges, cards, banks, exchange rates, support, users, and wallets.
- **Telegram User Profile Integration**: Fetches and updates Telegram user data (username, avatar) via Bot API on login and webhook updates.

## UI/UX Decisions
- **Green-themed UI**: Consistent visual design with green gradients.
- **Interactive Customer Engagement**: Notification badges with unread counts, detailed notification pages with rich media, and invoice pages with countdown timers and payment options.
- **Referral System UI**: Dedicated loyalty program page with "Link" and "My Partners" tabs, copy-to-clipboard functionality, and Telegram share integration.

# External Dependencies

- **Database**: PostgreSQL, MySQL (via Drizzle ORM).
- **Telegram API**: For user authentication, fetching user profile data (avatars, usernames), and sharing features.
- **Payment Processing**: Integration points for blockchain payments (transaction hash tracking) and balance payments.
- **Exchange Rate APIs**: Modular design for integrating real-time cryptocurrency exchange rate providers.
- **Neon Database**: Serverless PostgreSQL driver for specific deployment environments.
- **`pg` package**: Standard PostgreSQL driver for local and production environments.