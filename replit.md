# Overview

SwiftX is a cryptocurrency exchange application that allows users to quickly convert cryptocurrencies to traditional currencies, specifically targeting Russian users for USDT to RUB exchanges. The application is built as a modern full-stack web application with a mobile-first design approach, featuring a React frontend with a sleek green-themed UI and an Express.js backend with PostgreSQL database integration.

# User Preferences

Preferred communication style: Simple, everyday language.

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
The application uses **PostgreSQL** as the primary database with **Drizzle ORM** for type-safe database operations:

- **Schema Design**: Well-structured tables for users, wallets, transactions, exchange rates, and support chats
- **Type Safety**: Drizzle-Zod integration provides runtime validation and TypeScript types from database schema
- **Migration Strategy**: Drizzle Kit handles database migrations and schema changes
- **Connection**: Uses Neon Database serverless PostgreSQL for cloud deployment

Key architectural decisions for data modeling:
- Decimal precision handling for cryptocurrency amounts (18 digits, 8 decimal places)
- UUID primary keys for security and scalability
- JSON fields for flexible message storage in support chats
- Proper foreign key relationships maintaining data integrity

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