import { db } from "./db";
import { sql } from "drizzle-orm";

export interface LeasedKey {
  keyId: number;
  apiKey: string;
  provider: string;
}

/**
 * Lease the next available API key for a given network.
 * Round-robin: picks the key with the oldest last_used_at.
 * Skips keys that have hit their monthly_limit (0 = unlimited).
 * Auto-resets usage_this_month when the calendar month rolls over.
 * Returns null if no eligible keys exist.
 */
export async function leaseKey(network: string): Promise<LeasedKey | null> {
  const currentMonth = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
  try {
    const rows = await db.execute(sql`
      SELECT id, api_key, provider, networks, monthly_limit, usage_this_month, reset_month
      FROM merchant_scanner_keys
      WHERE is_active = 1
      ORDER BY COALESCE(last_used_at, '1970-01-01 00:00:00') ASC
    `);
    const keys = rows[0] as any[];
    if (!keys?.length) return null;

    for (const key of keys) {
      // Check if key covers the requested network
      let networks: string[] = [];
      try {
        networks = typeof key.networks === "string"
          ? JSON.parse(key.networks)
          : (Array.isArray(key.networks) ? key.networks : []);
      } catch { continue; }
      if (!networks.includes(network)) continue;

      // Auto-reset usage if month changed
      const needsReset = key.reset_month !== currentMonth;
      const usage = needsReset ? 0 : parseInt(key.usage_this_month ?? "0");
      const limit = parseInt(key.monthly_limit ?? "0");

      // Skip exhausted keys
      if (limit > 0 && usage >= limit) continue;

      // Atomically lease: increment usage + stamp last_used_at
      await db.execute(sql`
        UPDATE merchant_scanner_keys
        SET last_used_at = NOW(),
            usage_this_month = ${usage + 1},
            reset_month = ${currentMonth}
        WHERE id = ${key.id}
      `);

      return { keyId: key.id, apiKey: key.api_key, provider: key.provider };
    }
    return null;
  } catch (err: any) {
    console.warn("[KeyRotator] leaseKey error:", err.message);
    return null;
  }
}

export async function recordKeyError(keyId: number): Promise<void> {
  try {
    await db.execute(sql`
      UPDATE merchant_scanner_keys
      SET error_count = error_count + 1, last_error_at = NOW()
      WHERE id = ${keyId}
    `);
  } catch {}
}

export async function recordKeySuccess(keyId: number): Promise<void> {
  try {
    await db.execute(sql`
      UPDATE merchant_scanner_keys SET error_count = 0 WHERE id = ${keyId}
    `);
  } catch {}
}
