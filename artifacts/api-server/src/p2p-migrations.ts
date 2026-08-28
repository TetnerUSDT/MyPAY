import { db } from "./db";
import { sql } from "drizzle-orm";
import { promises as fs } from "fs";
import path from "node:path";
import { publicUploadsDir } from "./paths";

async function columnExists(table: string, column: string): Promise<boolean> {
  try {
    const rows = await db.execute(sql`
      SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ${table} AND COLUMN_NAME = ${column}
    `);
    return parseInt((rows[0] as any[])[0]?.cnt ?? "0") > 0;
  } catch { return false; }
}

async function tableExists(table: string): Promise<boolean> {
  try {
    const rows = await db.execute(sql`
      SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ${table}
    `);
    return parseInt((rows[0] as any[])[0]?.cnt ?? "0") > 0;
  } catch { return false; }
}

async function indexExists(table: string, indexName: string): Promise<boolean> {
  try {
    const rows = await db.execute(sql`
      SELECT COUNT(*) AS cnt
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ${table}
        AND INDEX_NAME = ${indexName}
        AND NON_UNIQUE = 0
    `);
    return parseInt((rows[0] as any[])[0]?.cnt ?? "0") > 0;
  } catch { return false; }
}

async function consolidateDuplicateUserBalances(): Promise<void> {
  const duplicateRows = await db.execute(sql`
    SELECT id_user, id_balance
    FROM users_balances
    GROUP BY id_user, id_balance
    HAVING COUNT(*) > 1
  `);

  for (const duplicate of duplicateRows[0] as any[]) {
    await db.transaction(async (tx) => {
      // Lock every row before calculating the total. This keeps the merge
      // atomic and ensures a concurrent adjustment cannot be discarded.
      const balanceRows = await tx.execute(sql`
        SELECT id, account_number
        FROM users_balances
        WHERE id_user = ${duplicate.id_user} AND id_balance = ${duplicate.id_balance}
        ORDER BY id ASC
        FOR UPDATE
      `);
      const rows = balanceRows[0] as any[];
      if (rows.length < 2) return;

      const canonical = rows[0];
      const totalRows = await tx.execute(sql`
        SELECT COALESCE(SUM(COALESCE(sum, 0)), 0) AS total_sum
        FROM users_balances
        WHERE id_user = ${duplicate.id_user} AND id_balance = ${duplicate.id_balance}
      `);
      const total = (totalRows[0] as any[])[0]?.total_sum ?? "0";
      const accountNumber = canonical.account_number
        ?? rows.find((row) => row.account_number)?.account_number
        ?? null;

      const duplicateIds = rows.slice(1).map((row) => row.id);
      if (await tableExists("p2p_balance_locks")) {
        await tx.execute(sql`
          UPDATE p2p_balance_locks
          SET user_balance_id = ${canonical.id}
          WHERE user_balance_id IN (${sql.join(duplicateIds.map((id: number) => sql`${id}`), sql`, `)})
        `);
      }
      await tx.execute(sql`
        DELETE FROM users_balances
        WHERE id IN (${sql.join(duplicateIds.map((id: number) => sql`${id}`), sql`, `)})
      `);

      await tx.execute(sql`
        UPDATE users_balances
        SET sum = ${total}, account_number = ${accountNumber}
        WHERE id = ${canonical.id}
      `);
    });
  }
}

export async function runP2PMigrations() {
  try {
    // Legacy databases may contain multiple rows for a user/asset because
    // their schema predates the ORM's unique index. Merge before adding it.
    if (await tableExists("users_balances")) {
      await consolidateDuplicateUserBalances();
      if (!await indexExists("users_balances", "user_balance_unique")) {
        await db.execute(sql`
          ALTER TABLE users_balances
          ADD UNIQUE INDEX user_balance_unique (id_user, id_balance)
        `);
      }
    }

    // ── p2p_settings ────────────────────────────────────────────────────────────
    if (!await tableExists("p2p_settings")) {
      await db.execute(sql`
        CREATE TABLE p2p_settings (
          id INT AUTO_INCREMENT PRIMARY KEY,
          \`key\` VARCHAR(100) NOT NULL UNIQUE,
          value TEXT NULL,
          description TEXT NULL,
          updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP
        )
      `);
    }
    const defaults: [string, string, string][] = [
      ["commission_percent",       "0.2",  "Комиссия платформы (%)"],
      ["platform_user_id",         "",     "ID пользователя для зачисления комиссии (пусто = отключено)"],
      ["max_disputes_before_block","5",    "Споров до авто-ограничения аккаунта"],
      ["promotion_cost",           "0",    "Стоимость продвижения объявления"],
      ["promotion_duration_hours", "24",   "Длительность продвижения (часов)"],
      ["auto_expire_minutes",      "15",   "Таймаут истечения сделки (минут)"],
      ["min_orders_for_verified",  "50",   "Минимум сделок для уровня verified"],
      ["min_orders_for_pro",       "500",  "Минимум сделок для уровня pro"],
    ];
    for (const [key, value, description] of defaults) {
      await db.execute(sql`
        INSERT INTO p2p_settings (\`key\`, value, description)
        VALUES (${key}, ${value}, ${description})
        ON DUPLICATE KEY UPDATE description = VALUES(description)
      `);
    }

    // ── p2p_user_stats — новые колонки ──────────────────────────────────────────
    if (!await columnExists("p2p_user_stats", "p2p_blocked")) {
      await db.execute(sql`ALTER TABLE p2p_user_stats ADD COLUMN p2p_blocked TINYINT DEFAULT 0`);
    }
    if (!await columnExists("p2p_user_stats", "block_reason")) {
      await db.execute(sql`ALTER TABLE p2p_user_stats ADD COLUMN block_reason VARCHAR(500) NULL`);
    }
    if (!await columnExists("p2p_user_stats", "avg_release_time_seconds")) {
      await db.execute(sql`ALTER TABLE p2p_user_stats ADD COLUMN avg_release_time_seconds INT NOT NULL DEFAULT 0`);
    }

    // ── p2p_verification_requests — KYC-документы ──────────────────────────────
    if (!await columnExists("p2p_verification_requests", "doc_front_url")) {
      await db.execute(sql`ALTER TABLE p2p_verification_requests ADD COLUMN doc_front_url VARCHAR(500) NULL`);
    }
    if (!await columnExists("p2p_verification_requests", "doc_back_url")) {
      await db.execute(sql`ALTER TABLE p2p_verification_requests ADD COLUMN doc_back_url VARCHAR(500) NULL`);
    }
    if (!await columnExists("p2p_verification_requests", "selfie_url")) {
      await db.execute(sql`ALTER TABLE p2p_verification_requests ADD COLUMN selfie_url VARCHAR(500) NULL`);
    }

    // ── p2p_ads — market price + auto_reply columns ─────────────────────────────
    if (!await columnExists("p2p_ads", "price_type")) {
      await db.execute(sql`ALTER TABLE p2p_ads ADD COLUMN price_type ENUM('fixed','market') DEFAULT 'fixed'`);
    }
    if (!await columnExists("p2p_ads", "price_offset")) {
      await db.execute(sql`ALTER TABLE p2p_ads ADD COLUMN price_offset DECIMAL(5,2) DEFAULT 0`);
    }
    if (!await columnExists("p2p_ads", "auto_reply")) {
      await db.execute(sql`ALTER TABLE p2p_ads ADD COLUMN auto_reply TEXT NULL`);
    }
    if (!await columnExists("p2p_ads", "balance_locked")) {
      await db.execute(sql`ALTER TABLE p2p_ads ADD COLUMN balance_locked TINYINT(1) NOT NULL DEFAULT 0`);
    }

    // ── p2p_payment_methods — ensure status column exists ───────────────────────
    if (!await columnExists("p2p_payment_methods", "status")) {
      await db.execute(sql`ALTER TABLE p2p_payment_methods ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active'`);
    }
    if (!await columnExists("p2p_payment_methods", "sort_order")) {
      await db.execute(sql`ALTER TABLE p2p_payment_methods ADD COLUMN sort_order INT DEFAULT 0`);
    }

    // ── p2p_user_payment_methods — ensure table + columns exist ─────────────────
    if (!await tableExists("p2p_user_payment_methods")) {
      await db.execute(sql`
        CREATE TABLE p2p_user_payment_methods (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          method_id INT NOT NULL,
          account_name VARCHAR(255) NULL,
          account_number VARCHAR(255) NULL,
          bank_name VARCHAR(255) NULL,
          details JSON NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'active',
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
    }
    if (!await columnExists("p2p_user_payment_methods", "status")) {
      await db.execute(sql`ALTER TABLE p2p_user_payment_methods ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active'`);
    }
    if (!await columnExists("p2p_user_payment_methods", "details")) {
      await db.execute(sql`ALTER TABLE p2p_user_payment_methods ADD COLUMN details JSON NULL`);
    }

    // ── KYC upload dir ──────────────────────────────────────────────────────────
    await fs.mkdir(path.join(publicUploadsDir, "kyc"), { recursive: true });

    console.log("[P2P] Migrations completed");
  } catch (err: any) {
    console.error("[P2P] Migrations error:", err.message);
  }
}

// ── Settings cache (refreshed every 5 minutes) ────────────────────────────────
let settingsCache: Record<string, string> = {};
let cacheTime = 0;

export async function getP2PSetting(key: string, fallback = ""): Promise<string> {
  if (Date.now() - cacheTime > 5 * 60 * 1000) {
    try {
      const rows = await db.execute(sql`SELECT \`key\`, value FROM p2p_settings`);
      settingsCache = {};
      for (const r of rows[0] as any[]) {
        settingsCache[r.key] = r.value ?? "";
      }
      cacheTime = Date.now();
    } catch { /* use fallback */ }
  }
  return settingsCache[key] ?? fallback;
}

export function invalidateSettingsCache() {
  cacheTime = 0;
}
