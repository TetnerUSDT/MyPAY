-- ============================================================
-- myPay Test Shop — Database
-- Requires: MySQL 8.0+
-- Usage:    mysql -u root -p < database.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS mypay_test
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;          -- MySQL 8 native collation

USE mypay_test;

-- ── Config ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS config (
  `key`   VARCHAR(100)  NOT NULL,
  `value` TEXT          NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO config (`key`, `value`) VALUES
  ('base_url',        'https://mypay.casa'),
  ('shop_key',        ''),
  ('default_network', 'TRON')
ON DUPLICATE KEY UPDATE `value` = `value`;

-- ── Users ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  email      VARCHAR(150) NOT NULL,
  avatar     VARCHAR(32)  NOT NULL DEFAULT '👤',   -- VARCHAR(32) для ZWJ-эмодзи
  created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO users (name, email, avatar) VALUES
  ('Алексей Иванов',  'alex@test.com',   '🧑'),
  ('Мария Петрова',   'maria@test.com',  '👩'),
  ('Дмитрий Сидоров', 'dmitry@test.com', '🧔'),
  ('Анна Козлова',    'anna@test.com',   '👱'),
  ('Сергей Попов',    'sergey@test.com', '👨')
ON DUPLICATE KEY UPDATE name = name;

-- ── Products ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id          INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(200)  NOT NULL,
  description VARCHAR(500)  NOT NULL DEFAULT '',
  price_usdt  DECIMAL(10,4) NOT NULL,
  emoji       VARCHAR(32)   NOT NULL DEFAULT '📦',  -- VARCHAR(32) для ZWJ-эмодзи
  category    VARCHAR(50)   NOT NULL DEFAULT 'digital'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO products (name, description, price_usdt, emoji, category) VALUES
  ('VIP Подписка',      'Доступ ко всем премиум функциям на 30 дней',  5.0000, '👑', 'subscription'),
  ('API Ключ Pro',      'Расширенный API ключ с лимитом 100k запросов', 10.0000, '🔑', 'digital'),
  ('Пакет токенов 100', '100 внутренних токенов платформы',              2.5000, '🪙', 'tokens'),
  ('Аналитика Premium', 'Расширенная аналитика и отчёты на 7 дней',      1.0000, '📊', 'subscription')
ON DUPLICATE KEY UPDATE name = name;

-- ── Orders ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id             INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  user_id        INT UNSIGNED  NOT NULL,
  product_id     INT UNSIGNED  NOT NULL,
  payment_mode   ENUM('permanent','temporary','invoice') NOT NULL,
  network        VARCHAR(20)   DEFAULT NULL,
  amount         DECIMAL(10,6) NOT NULL,
  status         ENUM('pending','confirmed','expired','failed') NOT NULL DEFAULT 'pending',
  payment_id     VARCHAR(100)  DEFAULT NULL,
  invoice_number VARCHAR(100)  DEFAULT NULL,
  wallet_address VARCHAR(300)  DEFAULT NULL,
  tx_hash        VARCHAR(200)  DEFAULT NULL,   -- 66 chars BSC/ETH, 64 TRON — запас есть
  api_response   JSON          DEFAULT NULL,
  created_at     TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_payment_id     (payment_id),
  INDEX idx_invoice_number (invoice_number),
  INDEX idx_user_id        (user_id),
  INDEX idx_status         (status),
  INDEX idx_created_at     (created_at)        -- для ORDER BY created_at DESC
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── Webhook log ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhook_log (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_type  VARCHAR(100) DEFAULT NULL,
  payload     JSON         NOT NULL,
  order_id    INT UNSIGNED DEFAULT NULL,
  received_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_order_id    (order_id),
  INDEX idx_event_type  (event_type),
  INDEX idx_received_at (received_at)          -- для ORDER BY received_at DESC
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── Payouts ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payouts (
  id                INT UNSIGNED   AUTO_INCREMENT PRIMARY KEY,
  external_order_id VARCHAR(200)   NOT NULL,
  payout_id         INT UNSIGNED   DEFAULT NULL,   -- ID из ответа API
  reference         VARCHAR(255)   DEFAULT NULL,   -- reference из ответа API
  network           VARCHAR(30)    NOT NULL,
  to_address        VARCHAR(300)   NOT NULL,
  amount            DECIMAL(18,6)  NOT NULL,
  currency          VARCHAR(20)    NOT NULL DEFAULT 'USDT',
  status            ENUM('pending','completed','failed') NOT NULL DEFAULT 'pending',
  tx_hash           VARCHAR(200)   DEFAULT NULL,
  api_response      JSON           DEFAULT NULL,
  created_at        TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_external_order_id (external_order_id),
  INDEX idx_payout_id   (payout_id),
  INDEX idx_status      (status),
  INDEX idx_created_at  (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
