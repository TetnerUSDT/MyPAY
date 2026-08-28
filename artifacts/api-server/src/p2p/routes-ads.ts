import type { Express } from "express";
import { db } from "../db";
import { sql, eq, and } from "drizzle-orm";
import {
  p2pPaymentMethods, p2pUserPaymentMethods, p2pAdPaymentMethods, p2pAds,
} from "@workspace/db/schema";
import { insertAndReturn } from "../mysql-helpers";
import { checkP2PBlock, snakeToCamel, logP2P, updateLastSeen, recalculateSortPriority } from "./helpers";
import { getP2PSetting } from "../p2p-migrations";

export function registerAdsRoutes(app: Express, requireApiKey: any) {

  // ── Payment Methods ──────────────────────────────────────────────────────────

  app.get("/api/p2p/payment-methods", requireApiKey, async (_req, res) => {
    try {
      const methods = await db.select().from(p2pPaymentMethods)
        .where(eq(p2pPaymentMethods.status, "active"));
      res.json(methods);
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // ── User Payment Methods ──────────────────────────────────────────────────────

  app.get("/api/p2p/user-payment-methods", requireApiKey, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const rows = await db.execute(sql`
        SELECT upm.*, pm.title as method_title, pm.code as method_code
        FROM p2p_user_payment_methods upm
        LEFT JOIN p2p_payment_methods pm ON pm.id = upm.method_id
        WHERE upm.user_id = ${userId} AND upm.status = 'active'
        ORDER BY upm.id DESC
      `);
      res.json((rows[0] as any[]).map(snakeToCamel));
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/p2p/user-payment-methods", requireApiKey, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { methodId, accountName, accountNumber, bankName } = req.body;
      if (!methodId) return res.status(400).json({ message: "methodId is required" });
      const insertResult = await db.execute(sql`
        INSERT INTO p2p_user_payment_methods (user_id, method_id, account_name, account_number, bank_name, status)
        VALUES (${userId}, ${methodId}, ${accountName ?? null}, ${accountNumber ?? null}, ${bankName ?? null}, 'active')
      `);
      const insertId = (insertResult[0] as any).insertId;
      const rows = await db.execute(sql`
        SELECT upm.*, pm.title AS method_title, pm.code AS method_code
        FROM p2p_user_payment_methods upm
        LEFT JOIN p2p_payment_methods pm ON pm.id = upm.method_id
        WHERE upm.id = ${insertId}
      `);
      res.json((rows[0] as any[])[0]);
    } catch (err: any) {
      console.error("[POST user-payment-methods]", err?.message, err?.sqlMessage);
      res.status(500).json({ message: err?.message || "Server error" });
    }
  });

  app.patch("/api/p2p/user-payment-methods/:id", requireApiKey, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const id = parseInt(req.params.id);
      const { accountName, accountNumber, bankName } = req.body;
      await db.update(p2pUserPaymentMethods)
        .set({ accountName, accountNumber, bankName })
        .where(and(eq(p2pUserPaymentMethods.id, id), eq(p2pUserPaymentMethods.userId, userId)));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.delete("/api/p2p/user-payment-methods/:id", requireApiKey, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const id = parseInt(req.params.id);
      await db.update(p2pUserPaymentMethods)
        .set({ status: "hidden" })
        .where(and(eq(p2pUserPaymentMethods.id, id), eq(p2pUserPaymentMethods.userId, userId)));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // ── Ads ──────────────────────────────────────────────────────────────────────

  app.get("/api/p2p/ads", requireApiKey, async (req: any, res) => {
    try {
      const { side, asset_balance_id, payment_method_id, amount } = req.query;

      const rows = await db.execute(sql`
        SELECT
          a.*,
          b.title  AS asset_title,
          b.currency AS asset_currency,
          b.network AS asset_network,
          u.id     AS trader_id,
          u.name   AS trader_name,
          u.img    AS trader_img,
          u.tg_username AS trader_username,
          COALESCE(s.total_orders, 0)       AS total_orders,
          COALESCE(s.completed_orders, 0)   AS completed_orders,
          COALESCE(s.successful_percent, 0) AS successful_percent,
          COALESCE(s.rating, 0)             AS rating,
          COALESCE(s.is_merchant, 0)        AS is_merchant
        FROM p2p_ads a
        LEFT JOIN balances    b ON b.id = a.asset_balance_id
        LEFT JOIN users       u ON u.id = a.user_id
        LEFT JOIN p2p_user_stats s ON s.user_id = a.user_id
        WHERE a.status = 'active'
          AND (${side ? sql`a.side = ${side}` : sql`1=1`})
          AND (${asset_balance_id ? sql`a.asset_balance_id = ${parseInt(asset_balance_id as string)}` : sql`1=1`})
          AND (${amount ? sql`a.min_amount <= ${parseFloat(amount as string)} AND a.max_amount >= ${parseFloat(amount as string)}` : sql`1=1`})
        ORDER BY a.sort_priority DESC, CAST(a.price AS DECIMAL(18,8)) ASC
        LIMIT 100
      `);

      let ads = (rows[0] as any[]).map(snakeToCamel);

      // T009: Recalculate price for market-type ads
      const marketAds = ads.filter((a: any) => a.priceType === "market");
      if (marketAds.length > 0) {
        try {
          const rateRows = await db.execute(sql`
            SELECT rate FROM exchange_rates
            WHERE (currency_from LIKE '%USDT%' OR currency_from = 'USDT')
              AND (currency_to = 'RUB' OR currency_to LIKE 'RUB%')
              AND is_active = 1
            ORDER BY updated_at DESC LIMIT 1
          `);
          const marketRate = parseFloat((rateRows[0] as any[])[0]?.rate ?? "0");
          if (marketRate > 0) {
            ads = ads.map((a: any) => {
              if (a.priceType !== "market") return a;
              const offset = parseFloat(a.priceOffset ?? "0");
              const effectivePrice = parseFloat((marketRate * (1 + offset / 100)).toFixed(4));
              return { ...a, price: effectivePrice, effectivePrice, marketRate };
            });
          }
        } catch { /* fallback to stored price */ }
      }

      // Attach payment methods to each ad
      if (ads.length > 0) {
        const adIds = ads.map((a: any) => a.id);
        const pmRows = await db.execute(sql`
          SELECT apm.ad_id, pm.id, pm.title, pm.code
          FROM p2p_ad_payment_methods apm
          LEFT JOIN p2p_payment_methods pm ON pm.id = apm.method_id
          WHERE apm.ad_id IN (${sql.join(adIds.map((id: number) => sql`${id}`), sql`, `)})
        `);
        const pmMap: Record<number, any[]> = {};
        for (const pm of (pmRows[0] as any[])) {
          if (!pmMap[pm.ad_id]) pmMap[pm.ad_id] = [];
          pmMap[pm.ad_id].push({ id: pm.id, title: pm.title, code: pm.code });
        }
        ads = ads.map((a: any) => ({ ...a, paymentMethods: pmMap[a.id] ?? [] }));
      }

      // Filter by payment method if requested
      if (payment_method_id) {
        const pmId = parseInt(payment_method_id as string);
        ads = ads.filter((a: any) => a.paymentMethods?.some((pm: any) => pm.id === pmId));
      }

      res.json(ads);
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/p2p/ads/:id", requireApiKey, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const rows = await db.execute(sql`
        SELECT a.*,
          b.title AS asset_title, b.currency AS asset_currency, b.network AS asset_network,
          u.id AS trader_id, u.name AS trader_name, u.img AS trader_img, u.tg_username AS trader_username,
          COALESCE(s.total_orders, 0) AS total_orders,
          COALESCE(s.completed_orders, 0) AS completed_orders,
          COALESCE(s.successful_percent, 0) AS successful_percent,
          COALESCE(s.rating, 0) AS rating,
          COALESCE(s.is_merchant, 0) AS is_merchant
        FROM p2p_ads a
        LEFT JOIN balances b ON b.id = a.asset_balance_id
        LEFT JOIN users u ON u.id = a.user_id
        LEFT JOIN p2p_user_stats s ON s.user_id = a.user_id
        WHERE a.id = ${id}
      `);
      const ad = (rows[0] as any[])[0];
      if (!ad) return res.status(404).json({ message: "Ad not found" });

      const pmRows = await db.execute(sql`
        SELECT apm.ad_id, pm.id, pm.title, pm.code
        FROM p2p_ad_payment_methods apm
        LEFT JOIN p2p_payment_methods pm ON pm.id = apm.method_id
        WHERE apm.ad_id = ${id}
      `);
      const result = snakeToCamel(ad);
      result.paymentMethods = (pmRows[0] as any[]).map((pm: any) => ({ id: pm.id, title: pm.title, code: pm.code }));
      res.json(result);
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/p2p/my-ads", requireApiKey, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const rows = await db.execute(sql`
        SELECT a.*,
          b.title AS asset_title, b.currency AS asset_currency, b.network AS asset_network
        FROM p2p_ads a
        LEFT JOIN balances b ON b.id = a.asset_balance_id
        WHERE a.user_id = ${userId} AND a.status != 'cancelled'
        ORDER BY a.created_at DESC
      `);
      res.json((rows[0] as any[]).map(snakeToCamel));
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/p2p/ads", requireApiKey, async (req: any, res) => {
    try {
      const userId = req.user.id;
      await checkP2PBlock(userId);
      const { side, assetBalanceId, fiatBalanceId, price, minAmount, maxAmount,
              availableAmount, paymentTimeMinutes, terms, paymentMethodIds } = req.body;

      if (!side || !assetBalanceId || !price || !minAmount || !maxAmount || !availableAmount) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      if (!["buy", "sell"].includes(side)) {
        return res.status(400).json({ message: "side must be buy or sell" });
      }

      // ── T010: Для продажи проверяем наличие реквизитов по выбранным методам ──
      if (side === "sell" && paymentMethodIds?.length) {
        const reqRows = await db.execute(sql`
          SELECT DISTINCT method_id FROM p2p_user_payment_methods
          WHERE user_id = ${userId} AND status = 'active'
        `);
        const savedMethodIds = new Set((reqRows[0] as any[]).map((r: any) => r.method_id));

        if (savedMethodIds.size === 0) {
          throw new Error("Для размещения объявления о продаже сначала добавьте банковские реквизиты в разделе «Реквизиты»");
        }

        const missingMethods = (paymentMethodIds as number[]).filter(id => !savedMethodIds.has(id));
        if (missingMethods.length > 0) {
          throw new Error("У вас нет сохранённых реквизитов для некоторых выбранных методов оплаты");
        }
      }

      // ── Для sell-объявления: проверяем баланс и сразу замораживаем средства ──
      const balId = parseInt(assetBalanceId);
      const avail = parseFloat(availableAmount);

      if (side === "sell") {
        const ubCheck = await db.execute(sql`
          SELECT id, sum FROM users_balances WHERE id_user = ${userId} AND id_balance = ${balId}
        `);
        const ub: any = (ubCheck[0] as any[])[0];
        if (!ub || parseFloat(ub.sum) < avail) {
          throw new Error(`Недостаточно средств на балансе. Доступно: ${ub ? parseFloat(ub.sum).toFixed(4) : 0}`);
        }
      }

      const adRows = await db.execute(sql`
        INSERT INTO p2p_ads
          (user_id, side, asset_balance_id, fiat_balance_id, price, min_amount, max_amount,
           available_amount, payment_time_minutes, terms, status, created_at, updated_at)
        VALUES
          (${userId}, ${side}, ${balId}, ${fiatBalanceId ? parseInt(fiatBalanceId) : null},
           ${parseFloat(price)}, ${parseFloat(minAmount)}, ${parseFloat(maxAmount)},
           ${avail}, ${paymentTimeMinutes ?? 15}, ${terms ?? null},
           'active', NOW(), NOW())
      `);
      const adId = (adRows[0] as any).insertId;

      // ── Заморозить баланс продавца сразу при создании объявления ──────────────
      if (side === "sell") {
        await db.execute(sql`
          UPDATE users_balances SET sum = sum - ${avail}
          WHERE id_user = ${userId} AND id_balance = ${balId}
        `);
        await db.execute(sql`UPDATE p2p_ads SET balance_locked = 1 WHERE id = ${adId}`);
      }

      if (paymentMethodIds?.length) {
        for (const pmId of paymentMethodIds) {
          await db.insert(p2pAdPaymentMethods).values({ adId, methodId: parseInt(pmId) })
            .onDuplicateKeyUpdate({ set: { adId } });
        }
      }

      await recalculateSortPriority(userId);
      await logP2P(userId, null, "create_ad", { adId, side, price, balanceLocked: side === "sell" });
      await updateLastSeen(userId);

      const newAd = await db.execute(sql`SELECT * FROM p2p_ads WHERE id = ${adId}`);
      res.status(201).json(snakeToCamel((newAd[0] as any[])[0]));
    } catch (err: any) {
      console.error("[P2P] POST /ads error:", err);
      res.status(400).json({ message: err.message || "Server error" });
    }
  });

  // ── Bulk ads update (MUST be before /:id to avoid Express capturing "bulk" as id)
  app.patch("/api/p2p/ads/bulk", requireApiKey, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { status, priceMultiplier } = req.body;
      if (status) {
        if (!["active","paused"].includes(status)) return res.status(400).json({ message: "Invalid status" });
        await db.execute(sql`UPDATE p2p_ads SET status = ${status}, updated_at = NOW() WHERE user_id = ${userId} AND status NOT IN ('cancelled','completed')`);
      }
      if (priceMultiplier) {
        const mult = parseFloat(priceMultiplier);
        if (isNaN(mult) || mult <= 0 || mult > 2) return res.status(400).json({ message: "Invalid multiplier" });
        await db.execute(sql`UPDATE p2p_ads SET price = ROUND(price * ${mult}, 4), updated_at = NOW() WHERE user_id = ${userId} AND status = 'active'`);
      }
      res.json({ success: true });
    } catch (err) { res.status(500).json({ message: "Server error" }); }
  });

  app.patch("/api/p2p/ads/:id", requireApiKey, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const id = parseInt(req.params.id);
      const { price, minAmount, maxAmount, availableAmount, status, terms, paymentTimeMinutes, paymentMethodIds } = req.body;

      const adCheck = await db.execute(sql`SELECT user_id FROM p2p_ads WHERE id = ${id}`);
      const adOwner = (adCheck[0] as any[])[0];
      if (!adOwner || adOwner.user_id !== userId) return res.status(403).json({ message: "Forbidden" });

      await db.execute(sql`
        UPDATE p2p_ads SET
          ${price          !== undefined ? sql`price = ${parseFloat(price)},`            : sql``}
          ${minAmount      !== undefined ? sql`min_amount = ${parseFloat(minAmount)},`   : sql``}
          ${maxAmount      !== undefined ? sql`max_amount = ${parseFloat(maxAmount)},`   : sql``}
          ${availableAmount !== undefined ? sql`available_amount = ${parseFloat(availableAmount)},` : sql``}
          ${status         !== undefined ? sql`status = ${status},`                      : sql``}
          ${terms          !== undefined ? sql`terms = ${terms},`                        : sql``}
          ${paymentTimeMinutes !== undefined ? sql`payment_time_minutes = ${paymentTimeMinutes},` : sql``}
          updated_at = NOW()
        WHERE id = ${id} AND user_id = ${userId}
      `);

      if (paymentMethodIds !== undefined) {
        await db.delete(p2pAdPaymentMethods).where(eq(p2pAdPaymentMethods.adId, id));
        for (const pmId of paymentMethodIds) {
          await db.insert(p2pAdPaymentMethods).values({ adId: id, methodId: parseInt(pmId) })
            .onDuplicateKeyUpdate({ set: { adId: id } });
        }
      }

      await recalculateSortPriority(userId);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.delete("/api/p2p/ads/:id", requireApiKey, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const id = parseInt(req.params.id);

      // Если это sell-объявление с заморозкой — вернуть остаток на баланс
      const adRows = await db.execute(sql`
        SELECT side, balance_locked, available_amount, asset_balance_id
        FROM p2p_ads WHERE id = ${id} AND user_id = ${userId}
      `);
      const ad: any = (adRows[0] as any[])[0];
      if (!ad) return res.status(404).json({ message: "Объявление не найдено" });

      if (ad.side === "sell" && ad.balance_locked) {
        const remaining = parseFloat(ad.available_amount);
        if (remaining > 0) {
          await db.execute(sql`
            INSERT INTO users_balances (id_user, id_balance, sum)
            VALUES (${userId}, ${ad.asset_balance_id}, ${remaining})
            ON DUPLICATE KEY UPDATE sum = sum + ${remaining}
          `);
        }
      }

      await db.execute(sql`UPDATE p2p_ads SET status = 'cancelled', updated_at = NOW() WHERE id = ${id} AND user_id = ${userId}`);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // ── Ad promotion ──────────────────────────────────────────────────────────────

  app.post("/api/p2p/ads/:id/promote", requireApiKey, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const id = parseInt(req.params.id);
      const adRows = await db.execute(sql`SELECT * FROM p2p_ads WHERE id = ${id} AND user_id = ${userId}`);
      const ad: any = (adRows[0] as any[])[0];
      if (!ad) return res.status(404).json({ message: "Объявление не найдено" });
      const promotedUntil = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 19).replace("T", " ");
      await db.execute(sql`UPDATE p2p_ads SET is_promoted = 1, promoted_until = ${promotedUntil}, updated_at = NOW() WHERE id = ${id}`);
      await recalculateSortPriority(userId);
      await logP2P(userId, null, "promote_ad", { adId: id });
      res.json({ success: true });
    } catch (err) { res.status(500).json({ message: "Server error" }); }
  });
}
