import type { Express } from "express";
import { db } from "../db";
import { sql, eq } from "drizzle-orm";
import { p2pUserStats } from "@workspace/db/schema";
import { kycUpload } from "../upload-config";
import { snakeToCamel, logP2P, updateLastSeen } from "./helpers";

export function registerMiscRoutes(app: Express, requireApiKey: any) {

  // ── Stats ─────────────────────────────────────────────────────────────────────

  app.get("/api/p2p/stats/:userId", requireApiKey, async (req, res) => {
    try {
      const uid = parseInt(req.params.userId);
      const stats = await db.select().from(p2pUserStats).where(eq(p2pUserStats.userId, uid)).limit(1);
      res.json(stats[0] ?? { userId: uid, totalOrders: 0, completedOrders: 0, successfulPercent: "0", rating: "0" });
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // ── User Disputes ─────────────────────────────────────────────────────────────

  app.get("/api/p2p/disputes", requireApiKey, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const rows = await db.execute(sql`
        SELECT d.*,
          o.asset_amount, o.fiat_amount,
          b.currency AS asset_currency,
          buyer.name AS buyer_name, seller.name AS seller_name,
          opener.name AS opened_by_name
        FROM p2p_disputes d
        LEFT JOIN p2p_orders o ON o.id = d.order_id
        LEFT JOIN balances b ON b.id = o.asset_balance_id
        LEFT JOIN users buyer ON buyer.id = o.buyer_id
        LEFT JOIN users seller ON seller.id = o.seller_id
        LEFT JOIN users opener ON opener.id = d.opened_by
        WHERE o.buyer_id = ${userId} OR o.seller_id = ${userId}
        ORDER BY d.created_at DESC
        LIMIT 50
      `);
      res.json((rows[0] as any[]).map(snakeToCamel));
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/p2p/disputes/:id", requireApiKey, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const id = parseInt(req.params.id);
      const rows = await db.execute(sql`
        SELECT d.*,
          o.asset_amount, o.fiat_amount, o.buyer_id, o.seller_id,
          b.currency AS asset_currency,
          buyer.name AS buyer_name, seller.name AS seller_name,
          opener.name AS opened_by_name,
          mod.name AS moderator_name
        FROM p2p_disputes d
        LEFT JOIN p2p_orders o ON o.id = d.order_id
        LEFT JOIN balances b ON b.id = o.asset_balance_id
        LEFT JOIN users buyer ON buyer.id = o.buyer_id
        LEFT JOIN users seller ON seller.id = o.seller_id
        LEFT JOIN users opener ON opener.id = d.opened_by
        LEFT JOIN users mod ON mod.id = d.moderator_id
        WHERE d.id = ${id} AND (o.buyer_id = ${userId} OR o.seller_id = ${userId})
      `);
      const dispute = (rows[0] as any[])[0];
      if (!dispute) return res.status(404).json({ message: "Dispute not found" });
      res.json(snakeToCamel(dispute));
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // ── Merchant Profile ───────────────────────────────────────────────────────────

  app.get("/api/p2p/user/:id", requireApiKey, async (req: any, res) => {
    try {
      const targetId = parseInt(req.params.id);
      const userRows = await db.execute(sql`
        SELECT u.id, u.name, u.img, u.tg_username,
          u.created_at AS registered_at,
          COALESCE(s.total_orders, 0) AS total_orders,
          COALESCE(s.completed_orders, 0) AS completed_orders,
          COALESCE(s.cancelled_orders, 0) AS cancelled_orders,
          COALESCE(s.disputes_total, 0) AS disputes_total,
          COALESCE(s.successful_percent, 0) AS successful_percent,
          COALESCE(s.rating, 0) AS rating,
          COALESCE(s.avg_release_time_seconds, 0) AS avg_release_time_seconds,
          COALESCE(s.is_merchant, 0) AS is_merchant,
          COALESCE(s.merchant_level, 'none') AS merchant_level
        FROM users u
        LEFT JOIN p2p_user_stats s ON s.user_id = u.id
        WHERE u.id = ${targetId}
      `);
      const user = (userRows[0] as any[])[0];
      if (!user) return res.status(404).json({ message: "User not found" });

      const reviewRows = await db.execute(sql`
        SELECT r.rating, r.comment, r.created_at, u.name AS from_name, u.img AS from_img
        FROM p2p_reviews r LEFT JOIN users u ON u.id = r.from_user_id
        WHERE r.to_user_id = ${targetId}
        ORDER BY r.created_at DESC LIMIT 10
      `);
      const adsRows = await db.execute(sql`SELECT COUNT(*) AS cnt FROM p2p_ads WHERE user_id = ${targetId} AND status = 'active'`);
      const result = snakeToCamel(user);
      result.reviews = (reviewRows[0] as any[]).map(snakeToCamel);
      result.activeAdsCount = (adsRows[0] as any[])[0]?.cnt ?? 0;
      const reviews = reviewRows[0] as any[];
      result.positiveReviews = reviews.filter((r: any) => r.rating >= 4).length;
      result.negativeReviews = reviews.filter((r: any) => r.rating <= 2).length;
      res.json(result);
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // ── Favorites ─────────────────────────────────────────────────────────────────

  app.get("/api/p2p/favorites", requireApiKey, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const rows = await db.execute(sql`
        SELECT f.id, f.merchant_id, u.name AS merchant_name, u.img AS merchant_img, u.tg_username AS merchant_username,
          s.rating, s.successful_percent, s.total_orders, s.merchant_level, s.last_seen
        FROM p2p_favorites f
        JOIN users u ON u.id = f.merchant_id
        LEFT JOIN p2p_user_stats s ON s.user_id = f.merchant_id
        WHERE f.user_id = ${userId}
        ORDER BY f.created_at DESC
      `);
      res.json((rows[0] as any[]).map(snakeToCamel));
    } catch (err) { res.status(500).json({ message: "Server error" }); }
  });

  app.post("/api/p2p/favorites/:merchantId", requireApiKey, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const merchantId = parseInt(req.params.merchantId);
      if (userId === merchantId) return res.status(400).json({ message: "Нельзя добавить себя" });
      await db.execute(sql`INSERT IGNORE INTO p2p_favorites (user_id, merchant_id) VALUES (${userId}, ${merchantId})`);
      await db.execute(sql`INSERT INTO p2p_user_stats (user_id, followers_count) VALUES (${merchantId}, 1) ON DUPLICATE KEY UPDATE followers_count = followers_count + 1`);
      res.json({ success: true });
    } catch (err) { res.status(500).json({ message: "Server error" }); }
  });

  app.delete("/api/p2p/favorites/:merchantId", requireApiKey, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const merchantId = parseInt(req.params.merchantId);
      await db.execute(sql`DELETE FROM p2p_favorites WHERE user_id = ${userId} AND merchant_id = ${merchantId}`);
      await db.execute(sql`UPDATE p2p_user_stats SET followers_count = GREATEST(0, followers_count - 1) WHERE user_id = ${merchantId}`);
      res.json({ success: true });
    } catch (err) { res.status(500).json({ message: "Server error" }); }
  });

  // ── Complaints ───────────────────────────────────────────────────────────────

  app.post("/api/p2p/complaints", requireApiKey, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { toUserId, orderId, category, description } = req.body;
      if (!toUserId || !category) return res.status(400).json({ message: "toUserId and category are required" });
      if (userId === parseInt(toUserId)) return res.status(400).json({ message: "Нельзя пожаловаться на себя" });
      await db.execute(sql`INSERT INTO p2p_complaints (from_user_id, to_user_id, order_id, category, description) VALUES (${userId}, ${parseInt(toUserId)}, ${orderId ?? null}, ${category}, ${description ?? null})`);
      await logP2P(userId, orderId ?? null, "complaint", { toUserId, category });
      res.json({ success: true });
    } catch (err) { res.status(500).json({ message: "Server error" }); }
  });

  // ── Verification requests ─────────────────────────────────────────────────────

  app.get("/api/p2p/verify", requireApiKey, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const rows = await db.execute(sql`SELECT * FROM p2p_verification_requests WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 10`);
      res.json({ requests: (rows[0] as any[]).map(snakeToCamel) });
    } catch (err) { res.status(500).json({ message: "Server error" }); }
  });

  app.post("/api/p2p/verify", requireApiKey, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { requestedLevel, note } = req.body;
      if (!requestedLevel || !["basic","verified","pro"].includes(requestedLevel)) {
        return res.status(400).json({ message: "Invalid level" });
      }
      const existing = await db.execute(sql`SELECT id FROM p2p_verification_requests WHERE user_id = ${userId} AND requested_level = ${requestedLevel} AND status = 'pending'`);
      if ((existing[0] as any[]).length > 0) return res.status(400).json({ message: "У вас уже есть активная заявка на этот уровень" });
      const statsRows = await db.execute(sql`SELECT merchant_level FROM p2p_user_stats WHERE user_id = ${userId}`);
      const stats: any = (statsRows[0] as any[])[0];
      const currentLevel = stats?.merchant_level || "none";
      await db.execute(sql`INSERT INTO p2p_verification_requests (user_id, requested_level, current_level, note) VALUES (${userId}, ${requestedLevel}, ${currentLevel}, ${note ?? null})`);
      res.json({ success: true });
    } catch (err) { res.status(500).json({ message: "Server error" }); }
  });

  // ── KYC Document Upload (T004) ────────────────────────────────────────────────

  app.post("/api/p2p/verify/upload", requireApiKey,
    kycUpload.fields([
      { name: "doc_front", maxCount: 1 },
      { name: "doc_back",  maxCount: 1 },
      { name: "selfie",    maxCount: 1 },
    ]),
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const files = req.files as Record<string, Express.Multer.File[]> | undefined;
        if (!files || !Object.keys(files).length) {
          return res.status(400).json({ message: "Файлы не загружены" });
        }

        const urls: Record<string, string> = {};
        if (files.doc_front?.[0])  urls.doc_front_url = `/uploads/kyc/${files.doc_front[0].filename}`;
        if (files.doc_back?.[0])   urls.doc_back_url  = `/uploads/kyc/${files.doc_back[0].filename}`;
        if (files.selfie?.[0])     urls.selfie_url    = `/uploads/kyc/${files.selfie[0].filename}`;

        const vrRows = await db.execute(sql`SELECT id FROM p2p_verification_requests WHERE user_id = ${userId} AND status = 'pending' ORDER BY created_at DESC LIMIT 1`);
        const vr: any = (vrRows[0] as any[])[0];
        if (!vr) return res.status(400).json({ message: "Сначала подайте заявку на верификацию" });

        if (urls.doc_front_url) await db.execute(sql`UPDATE p2p_verification_requests SET doc_front_url = ${urls.doc_front_url} WHERE id = ${vr.id}`);
        if (urls.doc_back_url)  await db.execute(sql`UPDATE p2p_verification_requests SET doc_back_url  = ${urls.doc_back_url}  WHERE id = ${vr.id}`);
        if (urls.selfie_url)    await db.execute(sql`UPDATE p2p_verification_requests SET selfie_url    = ${urls.selfie_url}    WHERE id = ${vr.id}`);

        res.json({ success: true, urls });
      } catch (err: any) {
        res.status(500).json({ message: err.message || "Server error" });
      }
    }
  );

  // ── Merchant dashboard stats ───────────────────────────────────────────────────

  app.get("/api/p2p/dashboard", requireApiKey, async (req: any, res) => {
    try {
      const userId = req.user.id;
      await updateLastSeen(userId);
      const statsRows = await db.execute(sql`
        SELECT s.*,
          (SELECT COUNT(*) FROM p2p_reviews r WHERE r.to_user_id = ${userId} AND r.rating >= 4) AS positive_reviews,
          (SELECT COUNT(*) FROM p2p_reviews r WHERE r.to_user_id = ${userId} AND r.rating <= 2) AS negative_reviews,
          (SELECT COUNT(*) FROM p2p_reviews r WHERE r.to_user_id = ${userId}) AS reviews_count
        FROM p2p_user_stats s WHERE s.user_id = ${userId}
      `);
      const stats: any = (statsRows[0] as any[])[0];
      if (!stats) return res.json({ totalOrders: 0, completedOrders: 0, successfulPercent: "0", rating: "0", disputesTotal: 0, merchantLevel: "none" });
      res.json(snakeToCamel(stats));
    } catch (err) { res.status(500).json({ message: "Server error" }); }
  });

  // ── Online ping ───────────────────────────────────────────────────────────────

  app.post("/api/p2p/ping", requireApiKey, async (req: any, res) => {
    try {
      await updateLastSeen(req.user.id);
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ message: "Server error" }); }
  });
}
