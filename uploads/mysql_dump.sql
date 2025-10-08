-- MySQL Database Dump for SwiftX P2P Exchange
-- Generated: 2025-10-08
-- Database: swiftx_db

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for balances
-- ----------------------------
DROP TABLE IF EXISTS `balances`;
CREATE TABLE `balances` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `network` varchar(50) DEFAULT NULL,
  `currency` varchar(10) NOT NULL,
  `rate` decimal(18,8) DEFAULT NULL,
  `type` enum('fiat','crypto','token','voucher') NOT NULL DEFAULT 'fiat',
  `status` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Records of balances
-- ----------------------------
INSERT INTO `balances` VALUES (1, 'Российский рубль', NULL, 'RUB', NULL, 'fiat', '1');
INSERT INTO `balances` VALUES (2, 'Турецкая лира', NULL, 'TRY', NULL, 'fiat', '1');
INSERT INTO `balances` VALUES (3, 'USDT TRC20', 'TRC20', 'USDT', NULL, 'crypto', '1');
INSERT INTO `balances` VALUES (4, 'USDT BEP20', 'BEP20', 'USDT', NULL, 'crypto', '1');

-- ----------------------------
-- Table structure for users
-- ----------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tg_id` varchar(255) NOT NULL,
  `google` varchar(255) DEFAULT NULL,
  `api_key` varchar(255) DEFAULT NULL,
  `name` varchar(255) DEFAULT NULL,
  `img` varchar(255) DEFAULT NULL,
  `status` varchar(50) DEFAULT NULL,
  `agreement` int DEFAULT '0',
  `blocked` tinyint DEFAULT '0',
  `default_fiat_balance_id` int DEFAULT NULL,
  `id_ref` int DEFAULT NULL,
  `code_ref` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `tg_id` (`tg_id`),
  UNIQUE KEY `api_key` (`api_key`),
  UNIQUE KEY `code_ref` (`code_ref`),
  KEY `default_fiat_balance_id` (`default_fiat_balance_id`),
  KEY `id_ref` (`id_ref`),
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`default_fiat_balance_id`) REFERENCES `balances` (`id`) ON DELETE SET NULL,
  CONSTRAINT `users_ibfk_2` FOREIGN KEY (`id_ref`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for users_balances
-- ----------------------------
DROP TABLE IF EXISTS `users_balances`;
CREATE TABLE `users_balances` (
  `id` int NOT NULL AUTO_INCREMENT,
  `id_balance` int NOT NULL,
  `id_user` int NOT NULL,
  `sum` decimal(18,8) DEFAULT '0.0',
  `status` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `id_balance` (`id_balance`),
  KEY `id_user` (`id_user`),
  CONSTRAINT `users_balances_ibfk_1` FOREIGN KEY (`id_balance`) REFERENCES `balances` (`id`) ON DELETE CASCADE,
  CONSTRAINT `users_balances_ibfk_2` FOREIGN KEY (`id_user`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for wallets
-- ----------------------------
DROP TABLE IF EXISTS `wallets`;
CREATE TABLE `wallets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `id_user` int DEFAULT NULL,
  `network` varchar(50) NOT NULL,
  `address` varchar(255) NOT NULL,
  `private_key` varchar(500) DEFAULT NULL,
  `reservation_time` timestamp NULL DEFAULT NULL,
  `reserved` varchar(50) DEFAULT NULL,
  `status` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `id_user` (`id_user`),
  CONSTRAINT `wallets_ibfk_1` FOREIGN KEY (`id_user`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for cards
-- ----------------------------
DROP TABLE IF EXISTS `cards`;
CREATE TABLE `cards` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `country` varchar(50) NOT NULL,
  `lang` varchar(255) DEFAULT NULL,
  `time_exchange` int NOT NULL,
  `commission` decimal(5,2) NOT NULL,
  `id_balance` varchar(255) DEFAULT NULL,
  `status` varchar(50) DEFAULT '1',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for banks
-- ----------------------------
DROP TABLE IF EXISTS `banks`;
CREATE TABLE `banks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `card_id` int NOT NULL,
  `bank_name` varchar(255) NOT NULL,
  `time_exchange` int DEFAULT NULL,
  `commission` decimal(5,2) DEFAULT NULL,
  `status` varchar(50) DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `card_id` (`card_id`),
  CONSTRAINT `banks_ibfk_1` FOREIGN KEY (`card_id`) REFERENCES `cards` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for user_cards
-- ----------------------------
DROP TABLE IF EXISTS `user_cards`;
CREATE TABLE `user_cards` (
  `id` int NOT NULL AUTO_INCREMENT,
  `id_card` int NOT NULL,
  `id_user` int NOT NULL,
  `id_bank` int DEFAULT NULL,
  `name` varchar(100) DEFAULT NULL,
  `first_name` varchar(100) DEFAULT NULL,
  `last_name` varchar(100) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `country` varchar(50) NOT NULL,
  `number_card` varchar(50) NOT NULL,
  `status` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `id_card` (`id_card`),
  KEY `id_user` (`id_user`),
  KEY `id_bank` (`id_bank`),
  CONSTRAINT `user_cards_ibfk_1` FOREIGN KEY (`id_card`) REFERENCES `cards` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_cards_ibfk_2` FOREIGN KEY (`id_user`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_cards_ibfk_3` FOREIGN KEY (`id_bank`) REFERENCES `banks` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for exchanges
-- ----------------------------
DROP TABLE IF EXISTS `exchanges`;
CREATE TABLE `exchanges` (
  `id` int NOT NULL AUTO_INCREMENT,
  `number_order` varchar(50) NOT NULL,
  `id_user` int NOT NULL,
  `wallet_id` int DEFAULT NULL,
  `id_balance_from` int DEFAULT NULL,
  `id_balance_to` int DEFAULT NULL,
  `id_card` int DEFAULT NULL,
  `manual_card_number` varchar(50) DEFAULT NULL,
  `from_currency` varchar(10) NOT NULL,
  `to_currency` varchar(10) NOT NULL,
  `amount_from` decimal(18,8) NOT NULL,
  `amount_to` decimal(18,8) NOT NULL,
  `rate` decimal(18,8) NOT NULL,
  `commission` decimal(18,8) DEFAULT '0.0',
  `timestamp` timestamp DEFAULT CURRENT_TIMESTAMP,
  `status` enum('wait','wait-paid','paid','complete','canceled','dispute') NOT NULL DEFAULT 'wait',
  `cancel_reason` text,
  `payment_hash` text,
  PRIMARY KEY (`id`),
  UNIQUE KEY `number_order` (`number_order`),
  KEY `id_user` (`id_user`),
  KEY `wallet_id` (`wallet_id`),
  KEY `id_balance_from` (`id_balance_from`),
  KEY `id_balance_to` (`id_balance_to`),
  KEY `id_card` (`id_card`),
  CONSTRAINT `exchanges_ibfk_1` FOREIGN KEY (`id_user`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `exchanges_ibfk_2` FOREIGN KEY (`wallet_id`) REFERENCES `wallets` (`id`) ON DELETE SET NULL,
  CONSTRAINT `exchanges_ibfk_3` FOREIGN KEY (`id_balance_from`) REFERENCES `balances` (`id`) ON DELETE SET NULL,
  CONSTRAINT `exchanges_ibfk_4` FOREIGN KEY (`id_balance_to`) REFERENCES `balances` (`id`) ON DELETE SET NULL,
  CONSTRAINT `exchanges_ibfk_5` FOREIGN KEY (`id_card`) REFERENCES `user_cards` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for stats
-- ----------------------------
DROP TABLE IF EXISTS `stats`;
CREATE TABLE `stats` (
  `id` int NOT NULL AUTO_INCREMENT,
  `stat_type` varchar(100) NOT NULL,
  `id_exchange` int NOT NULL,
  `sum` decimal(18,8) DEFAULT NULL,
  `timestamp` timestamp DEFAULT CURRENT_TIMESTAMP,
  `id_user` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `id_exchange` (`id_exchange`),
  KEY `id_user` (`id_user`),
  CONSTRAINT `stats_ibfk_1` FOREIGN KEY (`id_exchange`) REFERENCES `exchanges` (`id`) ON DELETE CASCADE,
  CONSTRAINT `stats_ibfk_2` FOREIGN KEY (`id_user`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for transactions
-- ----------------------------
DROP TABLE IF EXISTS `transactions`;
CREATE TABLE `transactions` (
  `id` varchar(36) NOT NULL,
  `order_id` text NOT NULL,
  `user_id` int DEFAULT NULL,
  `from_currency` text NOT NULL,
  `to_currency` text NOT NULL,
  `from_amount` decimal(18,8) NOT NULL,
  `to_amount` decimal(18,8) NOT NULL,
  `from_address` text,
  `to_address` text,
  `card_number` text,
  `status` text NOT NULL DEFAULT ('pending'),
  `tx_hash` text,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `completed_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `transactions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for exchange_rates
-- ----------------------------
DROP TABLE IF EXISTS `exchange_rates`;
CREATE TABLE `exchange_rates` (
  `id` varchar(36) NOT NULL,
  `from_balance_id` int NOT NULL,
  `to_balance_id` int NOT NULL,
  `from_currency` text NOT NULL,
  `to_currency` text NOT NULL,
  `rate` decimal(18,8) NOT NULL,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `from_balance_id` (`from_balance_id`),
  KEY `to_balance_id` (`to_balance_id`),
  CONSTRAINT `exchange_rates_ibfk_1` FOREIGN KEY (`from_balance_id`) REFERENCES `balances` (`id`),
  CONSTRAINT `exchange_rates_ibfk_2` FOREIGN KEY (`to_balance_id`) REFERENCES `balances` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Records of exchange_rates
-- ----------------------------
INSERT INTO `exchange_rates` VALUES ('76c82fd7-38a5-41e2-a95c-6b0b0751f725', 4, 1, 'USDT', 'RUB', 81.50000000, '2025-10-08 07:53:01');
INSERT INTO `exchange_rates` VALUES ('e82b895e-bd18-4182-ad4f-8af5fb16e6c5', 3, 1, 'USDT', 'RUB', 81.21000000, '2025-10-08 07:29:30');

-- ----------------------------
-- Table structure for support_chats
-- ----------------------------
DROP TABLE IF EXISTS `support_chats`;
CREATE TABLE `support_chats` (
  `id` varchar(36) NOT NULL,
  `user_id` int DEFAULT NULL,
  `transaction_id` varchar(36) DEFAULT NULL,
  `messages` json DEFAULT NULL,
  `status` text NOT NULL DEFAULT ('open'),
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `transaction_id` (`transaction_id`),
  CONSTRAINT `support_chats_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `support_chats_ibfk_2` FOREIGN KEY (`transaction_id`) REFERENCES `transactions` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for support_tickets
-- ----------------------------
DROP TABLE IF EXISTS `support_tickets`;
CREATE TABLE `support_tickets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `exchange_id` int NOT NULL,
  `status` enum('wait-user','wait-support','closed') NOT NULL DEFAULT 'wait-support',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `exchange_id` (`exchange_id`),
  CONSTRAINT `support_tickets_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `support_tickets_ibfk_2` FOREIGN KEY (`exchange_id`) REFERENCES `exchanges` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for support_messages
-- ----------------------------
DROP TABLE IF EXISTS `support_messages`;
CREATE TABLE `support_messages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ticket_id` int NOT NULL,
  `sender` enum('user','support') NOT NULL,
  `message` text NOT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ticket_id` (`ticket_id`),
  CONSTRAINT `support_messages_ibfk_1` FOREIGN KEY (`ticket_id`) REFERENCES `support_tickets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for admins
-- ----------------------------
DROP TABLE IF EXISTS `admins`;
CREATE TABLE `admins` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `permissions` json DEFAULT NULL,
  `status` varchar(50) DEFAULT 'active',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
