import { db } from "../db";
import { sql } from "drizzle-orm";
import { p2pLogs } from "@workspace/db/schema";
import { telegramService } from "../telegram-service";

export async function checkP2PBlock(userId: number) {
  const rows = await db.execute(sql`SELECT p2p_blocked FROM p2p_user_stats WHERE user_id = ${userId}`);
  const stats: any = (rows[0] as any[])[0];
  if (stats?.p2p_blocked) throw new Error("Ваш P2P-аккаунт заблокирован. Обратитесь в поддержку.");
}

export function snakeToCamel(obj: any): any {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(snakeToCamel);
  const r: any = {};
  for (const k of Object.keys(obj)) {
    const ck = k.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
    r[ck] = snakeToCamel(obj[k]);
  }
  return r;
}

export async function logP2P(userId: number | null, orderId: number | null, action: string, data?: any) {
  try {
    await db.insert(p2pLogs).values({ userId, orderId, action, data: data ?? null });
  } catch { /* non-critical */ }
}

export async function sendP2PNotification(tgId: string, text: string) {
  try {
    await telegramService.sendMessage({ chatId: tgId, text, parseMode: "HTML" });
  } catch { /* non-critical */ }
}

export async function updateLastSeen(userId: number) {
  try {
    await db.execute(sql`
      INSERT INTO p2p_user_stats (user_id, last_seen) VALUES (${userId}, NOW())
      ON DUPLICATE KEY UPDATE last_seen = NOW()
    `);
  } catch { /* non-critical */ }
}

export async function recalculateSortPriority(userId: number) {
  try {
    await db.execute(sql`
      UPDATE p2p_ads a
      JOIN p2p_user_stats s ON s.user_id = a.user_id
      SET a.sort_priority = ROUND(
        COALESCE(s.rating, 0) * 30 +
        COALESCE(s.successful_percent, 0) * 0.3 +
        CASE
          WHEN s.avg_release_time_seconds > 0 AND s.avg_release_time_seconds < 300  THEN 20
          WHEN s.avg_release_time_seconds >= 300 AND s.avg_release_time_seconds < 900 THEN 10
          ELSE 0
        END +
        COALESCE(s.total_orders, 0) * 0.1 +
        CASE WHEN a.is_promoted = 1 AND (a.promoted_until IS NULL OR a.promoted_until > NOW()) THEN 50 ELSE 0 END
      )
      WHERE a.user_id = ${userId} AND a.status = 'active'
    `);
  } catch { /* non-critical */ }
}
