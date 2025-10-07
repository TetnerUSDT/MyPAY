--
-- MySQL database dump
-- Converted from PostgreSQL schema for SwiftX
--

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- --------------------------------------------------------
-- Table structure for `admins`
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `admins` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `permissions` json DEFAULT NULL,
  `status` varchar(50) DEFAULT 'active',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `admins_username_unique` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `balances`
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `balances` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `network` varchar(50) DEFAULT NULL,
  `currency` varchar(10) NOT NULL,
  `rate` decimal(18,8) DEFAULT NULL,
  `type` varchar(20) NOT NULL DEFAULT 'fiat',
  `status` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `banks`
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `banks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `id_card` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `time` int DEFAULT NULL,
  `commission` decimal(5,2) DEFAULT NULL,
  `status` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `banks_id_card_cards_id_fk` (`id_card`),
  CONSTRAINT `banks_id_card_cards_id_fk` FOREIGN KEY (`id_card`) REFERENCES `cards` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `cards`
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `cards` (
  `id` int NOT NULL AUTO_INCREMENT,
  `id_balance` int DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `flag` varchar(10) DEFAULT NULL,
  `time` int DEFAULT NULL,
  `commission` decimal(5,2) DEFAULT NULL,
  `status` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `cards_id_balance_balances_id_fk` (`id_balance`),
  CONSTRAINT `cards_id_balance_balances_id_fk` FOREIGN KEY (`id_balance`) REFERENCES `balances` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `exchanges`
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `exchanges` (
  `id` int NOT NULL AUTO_INCREMENT,
  `id_user` int DEFAULT NULL,
  `id_balance` int DEFAULT NULL,
  `id_bank` int DEFAULT NULL,
  `id_wallet` int DEFAULT NULL,
  `sum` decimal(18,8) DEFAULT NULL,
  `hash` varchar(255) DEFAULT NULL,
  `status` varchar(20) DEFAULT 'wait',
  `time` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `exchanges_id_user_users_id_fk` (`id_user`),
  KEY `exchanges_id_balance_balances_id_fk` (`id_balance`),
  KEY `exchanges_id_bank_banks_id_fk` (`id_bank`),
  KEY `exchanges_id_wallet_wallets_id_fk` (`id_wallet`),
  CONSTRAINT `exchanges_id_user_users_id_fk` FOREIGN KEY (`id_user`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `exchanges_id_balance_balances_id_fk` FOREIGN KEY (`id_balance`) REFERENCES `balances` (`id`) ON DELETE SET NULL,
  CONSTRAINT `exchanges_id_bank_banks_id_fk` FOREIGN KEY (`id_bank`) REFERENCES `banks` (`id`) ON DELETE SET NULL,
  CONSTRAINT `exchanges_id_wallet_wallets_id_fk` FOREIGN KEY (`id_wallet`) REFERENCES `wallets` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `rates`
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `rates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `from_currency` varchar(10) NOT NULL,
  `to_currency` varchar(10) NOT NULL,
  `rate` decimal(18,8) NOT NULL,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `rates_from_currency_to_currency_unique` (`from_currency`, `to_currency`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `session`
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `session` (
  `sid` varchar(255) NOT NULL,
  `sess` json NOT NULL,
  `expire` datetime NOT NULL,
  PRIMARY KEY (`sid`),
  KEY `IDX_session_expire` (`expire`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `support_messages`
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `support_messages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `id_support_ticket` int NOT NULL,
  `sender` varchar(20) NOT NULL,
  `text` text NOT NULL,
  `time` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `support_messages_id_support_ticket_support_tickets_id_fk` (`id_support_ticket`),
  CONSTRAINT `support_messages_id_support_ticket_support_tickets_id_fk` FOREIGN KEY (`id_support_ticket`) REFERENCES `support_tickets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `support_tickets`
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `support_tickets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `id_user` int NOT NULL,
  `status` varchar(20) DEFAULT 'wait-support',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `support_tickets_id_user_users_id_fk` (`id_user`),
  CONSTRAINT `support_tickets_id_user_users_id_fk` FOREIGN KEY (`id_user`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `transactions`
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `transactions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `id_user` int DEFAULT NULL,
  `id_balance` int DEFAULT NULL,
  `sum` decimal(18,8) DEFAULT NULL,
  `type` varchar(50) DEFAULT NULL,
  `hash` varchar(255) DEFAULT NULL,
  `status` varchar(50) DEFAULT NULL,
  `time` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `transactions_id_user_users_id_fk` (`id_user`),
  KEY `transactions_id_balance_balances_id_fk` (`id_balance`),
  CONSTRAINT `transactions_id_user_users_id_fk` FOREIGN KEY (`id_user`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `transactions_id_balance_balances_id_fk` FOREIGN KEY (`id_balance`) REFERENCES `balances` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `users`
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tg_id` varchar(50) NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `image` varchar(500) DEFAULT NULL,
  `referral_code` varchar(20) DEFAULT NULL,
  `referred_by` int DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_tg_id_unique` (`tg_id`),
  UNIQUE KEY `users_referral_code_unique` (`referral_code`),
  KEY `users_referred_by_users_id_fk` (`referred_by`),
  CONSTRAINT `users_referred_by_users_id_fk` FOREIGN KEY (`referred_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `users_balances`
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `users_balances` (
  `id` int NOT NULL AUTO_INCREMENT,
  `id_balance` int NOT NULL,
  `id_user` int NOT NULL,
  `sum` decimal(18,8) DEFAULT 0.00000000,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_balances_id_balance_id_user_unique` (`id_balance`, `id_user`),
  KEY `users_balances_id_user_users_id_fk` (`id_user`),
  CONSTRAINT `users_balances_id_balance_balances_id_fk` FOREIGN KEY (`id_balance`) REFERENCES `balances` (`id`) ON DELETE CASCADE,
  CONSTRAINT `users_balances_id_user_users_id_fk` FOREIGN KEY (`id_user`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `wallets`
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `wallets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `id_user` int DEFAULT NULL,
  `network` varchar(50) NOT NULL,
  `address` varchar(255) NOT NULL,
  `private_key` varchar(500) DEFAULT NULL,
  `reservation_time` datetime DEFAULT NULL,
  `reserved` varchar(50) DEFAULT NULL,
  `status` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `wallets_id_user_users_id_fk` (`id_user`),
  CONSTRAINT `wallets_id_user_users_id_fk` FOREIGN KEY (`id_user`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- --------------------------------------------------------
-- Notes:
-- --------------------------------------------------------
-- 
-- ENUM types from PostgreSQL have been converted to VARCHAR:
--   - balance_type: 'fiat', 'crypto', 'token', 'voucher' -> varchar(20)
--   - exchange_status: 'wait', 'wait-paid', 'paid', 'complete', 'canceled', 'dispute' -> varchar(20)
--   - message_sender: 'user', 'support' -> varchar(20)
--   - support_ticket_status: 'wait-user', 'wait-support', 'closed' -> varchar(20)
--
-- PostgreSQL SERIAL type converted to MySQL AUTO_INCREMENT
-- PostgreSQL NUMERIC converted to MySQL DECIMAL
-- PostgreSQL JSONB converted to MySQL JSON
-- PostgreSQL timestamp without time zone converted to MySQL DATETIME
--
-- To restore this dump:
-- mysql -u username -p database_name < mysql_dump.sql
