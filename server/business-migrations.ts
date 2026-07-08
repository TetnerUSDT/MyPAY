import { db } from "./db";
import { sql } from "drizzle-orm";
import { runScannerProviderMigrations } from "./scanner/migrations";

async function tableExists(table: string): Promise<boolean> {
  try {
    const rows = await db.execute(sql`
      SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ${table}
    `);
    return parseInt((rows[0] as any[])[0]?.cnt ?? "0") > 0;
  } catch { return false; }
}

async function columnExists(table: string, column: string): Promise<boolean> {
  try {
    const rows = await db.execute(sql`
      SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ${table} AND COLUMN_NAME = ${column}
    `);
    return parseInt((rows[0] as any[])[0]?.cnt ?? "0") > 0;
  } catch { return false; }
}

export async function runBusinessMigrations() {
  try {
    if (!await tableExists("merchant_shops")) {
      await db.execute(sql`
        CREATE TABLE merchant_shops (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          name VARCHAR(255) NOT NULL,
          domain VARCHAR(255) NOT NULL,
          api_key VARCHAR(64) NOT NULL UNIQUE,
          status VARCHAR(20) NOT NULL DEFAULT 'pending',
          address_mode VARCHAR(20) NOT NULL DEFAULT 'permanent',
          enabled_networks TEXT NULL,
          webhook_url VARCHAR(500) NULL,
          balance_usdt DECIMAL(18,8) NOT NULL DEFAULT 0,
          total_received DECIMAL(18,8) NOT NULL DEFAULT 0,
          total_paid_out DECIMAL(18,8) NOT NULL DEFAULT 0,
          admin_note TEXT NULL,
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
    } else {
      if (!await columnExists("merchant_shops", "enabled_networks")) {
        await db.execute(sql`ALTER TABLE merchant_shops ADD COLUMN enabled_networks TEXT NULL AFTER address_mode`);
      }
      if (!await columnExists("merchant_shops", "permanent_monitor_minutes")) {
        await db.execute(sql`ALTER TABLE merchant_shops ADD COLUMN permanent_monitor_minutes INT NOT NULL DEFAULT 20 AFTER address_mode`);
      }
      if (!await columnExists("merchant_shops", "temporary_minutes")) {
        await db.execute(sql`ALTER TABLE merchant_shops ADD COLUMN temporary_minutes INT NOT NULL DEFAULT 30 AFTER permanent_monitor_minutes`);
      }
      if (!await columnExists("merchant_shops", "invoice_minutes")) {
        await db.execute(sql`ALTER TABLE merchant_shops ADD COLUMN invoice_minutes INT NOT NULL DEFAULT 60 AFTER temporary_minutes`);
      }
    }

    if (!await tableExists("merchant_payments")) {
      await db.execute(sql`
        CREATE TABLE merchant_payments (
          id INT AUTO_INCREMENT PRIMARY KEY,
          shop_id INT NOT NULL,
          order_id VARCHAR(255) NULL,
          external_user_id VARCHAR(255) NULL,
          wallet_address VARCHAR(255) NULL,
          network VARCHAR(50) NOT NULL,
          currency VARCHAR(20) NOT NULL DEFAULT 'USDT',
          amount DECIMAL(18,8) NULL,
          amount_received DECIMAL(18,8) NULL,
          tx_hash VARCHAR(255) NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'pending',
          payment_mode VARCHAR(20) NOT NULL DEFAULT 'temporary',
          address_type VARCHAR(20) NOT NULL DEFAULT 'permanent',
          expires_at TIMESTAMP NULL,
          confirmed_at TIMESTAMP NULL,
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (shop_id) REFERENCES merchant_shops(id) ON DELETE CASCADE
        )
      `);
    } else {
      if (!await columnExists("merchant_payments", "payment_mode")) {
        await db.execute(sql`ALTER TABLE merchant_payments ADD COLUMN payment_mode VARCHAR(20) NOT NULL DEFAULT 'temporary' AFTER status`);
        // Backfill from address_type: permanent address_type → permanent payment_mode
        await db.execute(sql`UPDATE merchant_payments SET payment_mode = 'permanent' WHERE address_type = 'permanent'`);
      }
    }

    if (!await tableExists("merchant_payout_requests")) {
      await db.execute(sql`
        CREATE TABLE merchant_payout_requests (
          id INT AUTO_INCREMENT PRIMARY KEY,
          shop_id INT NOT NULL,
          to_address VARCHAR(255) NOT NULL,
          network VARCHAR(50) NOT NULL,
          currency VARCHAR(20) NOT NULL DEFAULT 'USDT',
          amount DECIMAL(18,8) NOT NULL,
          tx_hash VARCHAR(255) NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'pending',
          source VARCHAR(20) NOT NULL DEFAULT 'manual',
          external_order_id VARCHAR(255) NULL,
          from_wallet_id INT NULL,
          reference VARCHAR(255) NULL,
          note TEXT NULL,
          processed_at TIMESTAMP NULL,
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (shop_id) REFERENCES merchant_shops(id) ON DELETE CASCADE
        )
      `);
    } else {
      if (!await columnExists("merchant_payout_requests", "source")) {
        await db.execute(sql`ALTER TABLE merchant_payout_requests ADD COLUMN source VARCHAR(20) NOT NULL DEFAULT 'manual' AFTER status`);
      }
      if (!await columnExists("merchant_payout_requests", "external_order_id")) {
        await db.execute(sql`ALTER TABLE merchant_payout_requests ADD COLUMN external_order_id VARCHAR(255) NULL AFTER source`);
      }
      if (!await columnExists("merchant_payout_requests", "from_wallet_id")) {
        await db.execute(sql`ALTER TABLE merchant_payout_requests ADD COLUMN from_wallet_id INT NULL AFTER external_order_id`);
      }
      if (!await columnExists("merchant_payout_requests", "reference")) {
        await db.execute(sql`ALTER TABLE merchant_payout_requests ADD COLUMN reference VARCHAR(255) NULL AFTER from_wallet_id`);
      }
    }

    if (!await tableExists("merchant_scanner_keys")) {
      await db.execute(sql`
        CREATE TABLE merchant_scanner_keys (
          id INT AUTO_INCREMENT PRIMARY KEY,
          provider VARCHAR(50) NOT NULL,
          networks TEXT NULL,
          api_key VARCHAR(500) NOT NULL,
          label VARCHAR(255) NULL,
          monthly_limit INT NOT NULL DEFAULT 0,
          usage_this_month INT NOT NULL DEFAULT 0,
          reset_month VARCHAR(7) NULL,
          is_active TINYINT(1) NOT NULL DEFAULT 1,
          error_count INT NOT NULL DEFAULT 0,
          last_used_at TIMESTAMP NULL,
          last_error_at TIMESTAMP NULL,
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } else {
      if (!await columnExists("merchant_scanner_keys", "networks")) {
        await db.execute(sql`ALTER TABLE merchant_scanner_keys ADD COLUMN networks TEXT NULL AFTER provider`);
      }
      if (!await columnExists("merchant_scanner_keys", "label")) {
        await db.execute(sql`ALTER TABLE merchant_scanner_keys ADD COLUMN label VARCHAR(255) NULL AFTER api_key`);
      }
      if (!await columnExists("merchant_scanner_keys", "monthly_limit")) {
        await db.execute(sql`ALTER TABLE merchant_scanner_keys ADD COLUMN monthly_limit INT NOT NULL DEFAULT 0 AFTER label`);
      }
      if (!await columnExists("merchant_scanner_keys", "usage_this_month")) {
        await db.execute(sql`ALTER TABLE merchant_scanner_keys ADD COLUMN usage_this_month INT NOT NULL DEFAULT 0 AFTER monthly_limit`);
      }
      if (!await columnExists("merchant_scanner_keys", "reset_month")) {
        await db.execute(sql`ALTER TABLE merchant_scanner_keys ADD COLUMN reset_month VARCHAR(7) NULL AFTER usage_this_month`);
      }
      if (!await columnExists("merchant_scanner_keys", "error_count")) {
        await db.execute(sql`ALTER TABLE merchant_scanner_keys ADD COLUMN error_count INT NOT NULL DEFAULT 0 AFTER is_active`);
      }
      if (!await columnExists("merchant_scanner_keys", "last_error_at")) {
        await db.execute(sql`ALTER TABLE merchant_scanner_keys ADD COLUMN last_error_at TIMESTAMP NULL AFTER error_count`);
      }
      if (!await columnExists("merchant_scanner_keys", "api_key") || true) {
        // Extend api_key column to 500 chars if needed (ignore error if already done)
        try {
          await db.execute(sql`ALTER TABLE merchant_scanner_keys MODIFY COLUMN api_key VARCHAR(500) NOT NULL`);
        } catch {}
      }
    }

    if (!await tableExists("merchant_wallets")) {
      await db.execute(sql`
        CREATE TABLE merchant_wallets (
          id INT AUTO_INCREMENT PRIMARY KEY,
          shop_id INT NOT NULL,
          address VARCHAR(255) NOT NULL,
          private_key VARCHAR(500) NULL,
          network VARCHAR(50) NOT NULL,
          mode VARCHAR(20) NOT NULL DEFAULT 'standard',
          gasfree_address VARCHAR(255) NULL,
          external_user_id VARCHAR(255) NULL,
          order_id VARCHAR(255) NULL,
          reserved_until TIMESTAMP NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'active',
          balance_usdt DECIMAL(18,8) NULL,
          balance_updated_at TIMESTAMP NULL,
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (shop_id) REFERENCES merchant_shops(id) ON DELETE CASCADE
        )
      `);
    } else {
      if (!await columnExists("merchant_wallets", "balance_usdt")) {
        await db.execute(sql`ALTER TABLE merchant_wallets ADD COLUMN balance_usdt DECIMAL(18,8) NULL AFTER status`);
      }
      if (!await columnExists("merchant_wallets", "balance_updated_at")) {
        await db.execute(sql`ALTER TABLE merchant_wallets ADD COLUMN balance_updated_at TIMESTAMP NULL AFTER balance_usdt`);
      }
      if (!await columnExists("merchant_wallets", "monitoring_until")) {
        await db.execute(sql`ALTER TABLE merchant_wallets ADD COLUMN monitoring_until TIMESTAMP NULL AFTER reserved_until`);
      }
    }

    if (!await tableExists("merchant_invoices")) {
      await db.execute(sql`
        CREATE TABLE merchant_invoices (
          id INT AUTO_INCREMENT PRIMARY KEY,
          shop_id INT NOT NULL,
          invoice_number VARCHAR(64) NOT NULL UNIQUE,
          order_ref VARCHAR(255) NULL,
          amount DECIMAL(18,8) NOT NULL,
          currency VARCHAR(20) NOT NULL DEFAULT 'USDT',
          networks TEXT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'pending',
          wallet_id INT NULL,
          wallet_address VARCHAR(255) NULL,
          network_chosen VARCHAR(50) NULL,
          tx_hash VARCHAR(255) NULL,
          amount_received DECIMAL(18,8) NULL,
          expires_at TIMESTAMP NULL,
          confirmed_at TIMESTAMP NULL,
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (shop_id) REFERENCES merchant_shops(id) ON DELETE CASCADE
        )
      `);
    }

    // Table tracking individual transactions per payment (for partial payment accumulation)
    if (!await tableExists("merchant_payment_txs")) {
      await db.execute(sql`
        CREATE TABLE merchant_payment_txs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          payment_id INT NOT NULL,
          tx_hash VARCHAR(255) NOT NULL UNIQUE,
          amount DECIMAL(18,8) NOT NULL,
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_mpt_payment (payment_id),
          INDEX idx_mpt_tx (tx_hash)
        )
      `);
    }

    // Add invoice_id column to merchant_payment_txs for global cross-invoice dedup
    if (!await columnExists("merchant_payment_txs", "invoice_id")) {
      await db.execute(sql`ALTER TABLE merchant_payment_txs ADD COLUMN invoice_id INT NULL AFTER payment_id`);
      await db.execute(sql`ALTER TABLE merchant_payment_txs ADD INDEX idx_mpt_invoice (invoice_id)`);
    }

    await runScannerProviderMigrations();

    console.log("[Business] Migrations completed");
  } catch (err: any) {
    console.error("[Business] Migrations error:", err.message);
  }
}
