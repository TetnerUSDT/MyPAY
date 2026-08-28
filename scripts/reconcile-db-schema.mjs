import { createRequire } from "node:module";

const requireFromDbWorkspace = createRequire(
  new URL("../lib/db/package.json", import.meta.url),
);
const mysql = requireFromDbWorkspace("mysql2/promise");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for schema reconciliation");
}

const connection = await mysql.createConnection(process.env.DATABASE_URL);

async function columnExists(table, column) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS count
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?`,
    [table, column],
  );
  return Number(rows[0]?.count ?? 0) > 0;
}

async function tableExists(table) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS count
       FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?`,
    [table],
  );
  return Number(rows[0]?.count ?? 0) > 0;
}

async function indexExists(table, index) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS count
       FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND INDEX_NAME = ?`,
    [table, index],
  );
  return Number(rows[0]?.count ?? 0) > 0;
}

async function reconcileRenamedColumn(table, oldColumn, newColumn, definition) {
  const oldExists = await columnExists(table, oldColumn);
  const newExists = await columnExists(table, newColumn);

  if (oldExists && !newExists) {
    await connection.query(
      `ALTER TABLE \`${table}\` CHANGE COLUMN \`${oldColumn}\` \`${newColumn}\` ${definition}`,
    );
    console.log(`[schema] Renamed ${table}.${oldColumn} to ${newColumn}`);
    return;
  }

  if (oldExists && newExists) {
    await connection.query(
      `UPDATE \`${table}\`
          SET \`${newColumn}\` = COALESCE(\`${newColumn}\`, \`${oldColumn}\`)`,
    );
    await connection.query(`ALTER TABLE \`${table}\` DROP COLUMN \`${oldColumn}\``);
    console.log(`[schema] Merged legacy ${table}.${oldColumn} into ${newColumn}`);
  }
}

async function ensureColumn(table, column, definition) {
  if (!await columnExists(table, column)) {
    await connection.query(
      `ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`,
    );
    console.log(`[schema] Added ${table}.${column}`);
  }
}

async function reconcileIndexName(table, oldIndex, newIndex) {
  if (
    await indexExists(table, oldIndex)
    && !await indexExists(table, newIndex)
  ) {
    await connection.query(
      `ALTER TABLE \`${table}\` RENAME INDEX \`${oldIndex}\` TO \`${newIndex}\``,
    );
    console.log(`[schema] Renamed index ${table}.${oldIndex} to ${newIndex}`);
  }
}

async function reconcileUniqueIndex(table, columns, expectedIndex) {
  if (await indexExists(table, expectedIndex)) return;

  const [indexRows] = await connection.query(
    `SELECT INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX
       FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND NON_UNIQUE = 0
        AND INDEX_NAME <> 'PRIMARY'
      ORDER BY INDEX_NAME, SEQ_IN_INDEX`,
    [table],
  );
  const indexes = new Map();
  for (const row of indexRows) {
    const indexColumns = indexes.get(row.INDEX_NAME) ?? [];
    indexColumns.push(row.COLUMN_NAME);
    indexes.set(row.INDEX_NAME, indexColumns);
  }
  const legacyIndex = [...indexes.entries()].find(([, indexColumns]) =>
    indexColumns.length === columns.length
    && indexColumns.every((column, index) => column === columns[index])
  );

  if (legacyIndex) {
    await reconcileIndexName(table, legacyIndex[0], expectedIndex);
    return;
  }

  const quotedColumns = columns.map((column) => `\`${column}\``).join(", ");
  const nonNullClause = columns.map((column) => `\`${column}\` IS NOT NULL`).join(" AND ");
  const [duplicates] = await connection.query(
    `SELECT ${quotedColumns}, COUNT(*) AS count
       FROM \`${table}\`
      WHERE ${nonNullClause}
      GROUP BY ${quotedColumns}
     HAVING COUNT(*) > 1
      LIMIT 1`,
  );
  if (duplicates.length > 0) {
    throw new Error(
      `Cannot create ${expectedIndex}: duplicate ${table} rows exist for ${columns.join(", ")}`,
    );
  }

  await connection.query(
    `ALTER TABLE \`${table}\` ADD CONSTRAINT \`${expectedIndex}\` UNIQUE (${quotedColumns})`,
  );
  console.log(`[schema] Added unique index ${expectedIndex}`);
}

async function reconcilePaymentMethodDuplicates() {
  const [groups] = await connection.query(
    `SELECT code, MIN(id) AS canonical_id, COUNT(*) AS count
       FROM p2p_payment_methods
      GROUP BY code
     HAVING COUNT(*) > 1`,
  );

  for (const group of groups) {
    const canonicalId = Number(group.canonical_id);
    const [duplicateRows] = await connection.query(
      `SELECT id
         FROM p2p_payment_methods
        WHERE code = ?
          AND id <> ?`,
      [group.code, canonicalId],
    );
    const duplicateIds = duplicateRows.map((row) => Number(row.id));
    if (duplicateIds.length === 0) continue;

    await connection.beginTransaction();
    try {
      await connection.query(
        `INSERT IGNORE INTO p2p_ad_payment_methods (ad_id, method_id)
         SELECT ad_id, ?
           FROM p2p_ad_payment_methods
          WHERE method_id IN (?)`,
        [canonicalId, duplicateIds],
      );
      await connection.query(
        `DELETE FROM p2p_ad_payment_methods WHERE method_id IN (?)`,
        [duplicateIds],
      );
      await connection.query(
        `UPDATE p2p_user_payment_methods SET method_id = ? WHERE method_id IN (?)`,
        [canonicalId, duplicateIds],
      );
      await connection.query(
        `UPDATE p2p_orders SET payment_method_id = ? WHERE payment_method_id IN (?)`,
        [canonicalId, duplicateIds],
      );
      await connection.query(
        `DELETE FROM p2p_payment_methods WHERE id IN (?)`,
        [duplicateIds],
      );
      await connection.commit();
      console.log(
        `[schema] Consolidated ${duplicateIds.length} duplicate payment methods for ${group.code}`,
      );
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  }
}

try {
  if (!await tableExists("balances")) {
    console.log("[schema] Empty database detected");
    process.exitCode = 42;
  } else {
  await reconcileRenamedColumn("p2p_disputes", "resolved_by", "moderator_id", "INT NULL");
  await reconcileRenamedColumn("p2p_disputes", "resolution", "resolution_comment", "TEXT NULL");
  await reconcileRenamedColumn("p2p_reviews", "reviewer_id", "from_user_id", "INT NOT NULL");
  await reconcileRenamedColumn("p2p_reviews", "reviewed_id", "to_user_id", "INT NOT NULL");
  await ensureColumn(
    "p2p_user_stats",
    "merchant_level",
    "VARCHAR(20) NULL DEFAULT 'none'",
  );
  await reconcilePaymentMethodDuplicates();
  const uniqueIndexes = [
    ["users", ["tg_id"], "users_tg_id_unique"],
    ["users", ["api_key"], "users_api_key_unique"],
    ["users", ["code_ref"], "users_code_ref_unique"],
    ["users_balances", ["account_number"], "users_balances_account_number_unique"],
    ["exchanges", ["number_order"], "exchanges_number_order_unique"],
    ["admins", ["username"], "admins_username_unique"],
    ["invoices", ["order_number"], "invoices_order_number_unique"],
    ["vouchers", ["code"], "vouchers_code_unique"],
    ["bot_commands", ["command"], "bot_commands_command_unique"],
    ["p2p_payment_methods", ["code"], "p2p_payment_methods_code_unique"],
    ["p2p_balance_locks", ["order_id"], "p2p_balance_locks_order_id_unique"],
    ["p2p_user_stats", ["user_id"], "p2p_user_stats_user_id_unique"],
    ["merchant_shops", ["api_key"], "merchant_shops_api_key_unique"],
    ["merchant_invoices", ["invoice_number"], "merchant_invoices_invoice_number_unique"],
  ];
  for (const [table, columns, expectedIndex] of uniqueIndexes) {
    await reconcileUniqueIndex(table, columns, expectedIndex);
  }
  }
} finally {
  await connection.end();
}