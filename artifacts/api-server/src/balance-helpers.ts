import { sql } from "drizzle-orm";

type SqlExecutor = {
  execute: (query: ReturnType<typeof sql>) => Promise<any>;
};

/**
 * Adjust one user's balance without assuming the legacy uniqueness index exists.
 *
 * When duplicate rows are present, only the oldest row is changed. The total
 * across all rows therefore changes by exactly `amount`, and the migration can
 * consolidate the remaining rows later without losing the adjustment.
 */
export async function adjustUserBalance(
  executor: SqlExecutor,
  userId: number,
  balanceId: number,
  amount: number,
): Promise<void> {
  const existingRows = await executor.execute(sql`
    SELECT id
    FROM users_balances
    WHERE id_user = ${userId} AND id_balance = ${balanceId}
    ORDER BY id ASC
    LIMIT 1
    FOR UPDATE
  `);
  const existing = (existingRows[0] as any[])[0];

  if (existing) {
    await executor.execute(sql`
      UPDATE users_balances
      SET sum = COALESCE(sum, 0) + ${amount}
      WHERE id = ${existing.id}
    `);
    return;
  }

  await executor.execute(sql`
    INSERT INTO users_balances (id_user, id_balance, sum, status)
    VALUES (${userId}, ${balanceId}, ${amount}, 'active')
  `);
}