import { db } from "../db";
import { sql } from "drizzle-orm";

export interface LeasedKey {
  keyId: number;
  apiKey: string;
  provider: string;
  label: string | null;
}

/**
 * Lease the next available API key for a specific provider + network combination.
 * Falls back to any key for that provider if no network-specific ones exist.
 * Round-robin by oldest last_used_at.
 */
export async function leaseKeyForProvider(providerCode: string, network: string): Promise<LeasedKey | null> {
  const currentMonth = new Date().toISOString().slice(0, 7);
  try {
    const rows = await db.execute(sql`
      SELECT id, api_key, provider, networks, label, monthly_limit, usage_this_month, reset_month
      FROM merchant_scanner_keys
      WHERE is_active = 1 AND provider = ${providerCode}
      ORDER BY COALESCE(last_used_at, '1970-01-01 00:00:00') ASC
    `);
    const keys = rows[0] as any[];
    if (!keys?.length) return null;

    for (const key of keys) {
      let networks: string[] = [];
      try {
        networks = typeof key.networks === "string"
          ? JSON.parse(key.networks)
          : (Array.isArray(key.networks) ? key.networks : []);
      } catch { continue; }

      if (networks.length > 0 && !networks.includes(network)) continue;

      const needsReset = key.reset_month !== currentMonth;
      const usage = needsReset ? 0 : parseInt(key.usage_this_month ?? "0");
      const limit = parseInt(key.monthly_limit ?? "0");
      if (limit > 0 && usage >= limit) continue;

      await db.execute(sql`
        UPDATE merchant_scanner_keys
        SET last_used_at = NOW(),
            usage_this_month = ${usage + 1},
            reset_month = ${currentMonth}
        WHERE id = ${key.id}
      `);

      return { keyId: key.id, apiKey: key.api_key, provider: key.provider, label: key.label ?? null };
    }
    return null;
  } catch (err: any) {
    console.warn("[KeyLease] leaseKeyForProvider error:", err.message);
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
    await db.execute(sql`UPDATE merchant_scanner_keys SET error_count = 0 WHERE id = ${keyId}`);
  } catch {}
}
