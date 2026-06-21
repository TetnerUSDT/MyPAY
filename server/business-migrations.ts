import { db } from "./db";
import { sql } from "drizzle-orm";

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
          webhook_url VARCHAR(500) NULL,
          balance_usdt DECIMAL(18,8) NOT NULL DEFAULT 0,
          total_received DECIMAL(18,8) NOT NULL DEFAULT 0,
          total_paid_out DECIMAL(18,8) NOT NULL DEFAULT 0,
          admin_note TEXT NULL,
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
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
          address_type VARCHAR(20) NOT NULL DEFAULT 'permanent',
          expires_at TIMESTAMP NULL,
          confirmed_at TIMESTAMP NULL,
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (shop_id) REFERENCES merchant_shops(id) ON DELETE CASCADE
        )
      `);
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
          note TEXT NULL,
          processed_at TIMESTAMP NULL,
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (shop_id) REFERENCES merchant_shops(id) ON DELETE CASCADE
        )
      `);
    }

    if (!await tableExists("merchant_scanner_keys")) {
      await db.execute(sql`
        CREATE TABLE merchant_scanner_keys (
          id INT AUTO_INCREMENT PRIMARY KEY,
          provider VARCHAR(50) NOT NULL,
          api_key VARCHAR(255) NOT NULL,
          is_active TINYINT(1) NOT NULL DEFAULT 1,
          last_used_at TIMESTAMP NULL,
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
    }

    console.log("[Business] Migrations completed");
  } catch (err: any) {
    console.error("[Business] Migrations error:", err.message);
  }
}
