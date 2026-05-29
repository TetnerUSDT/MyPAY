import type { Express } from "express";
import { db } from "./db";
import { sql, eq, and } from "drizzle-orm";
import {
  p2pAds, p2pOrders, p2pBalanceLocks, p2pOrderMessages,
  p2pPaymentMethods, p2pUserPaymentMethods, p2pAdPaymentMethods,
  p2pDisputes, p2pUserStats, p2pLogs,
  usersBalances,
} from "@shared/schema";
import { insertAndReturn } from "./mysql-helpers";

function snakeToCamel(obj: any): any {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(snakeToCamel);
  const r: any = {};
  for (const k of Object.keys(obj)) {
    const ck = k.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
    r[ck] = snakeToCamel(obj[k]);
  }
  return r;
}

async function logP2P(userId: number | null, orderId: number | null, action: string, data?: any) {
  try {
    await db.insert(p2pLogs).values({ userId, orderId, action, data: data ?? null });
  } catch { /* non-critical */ }
}

const DEFAULT_PAYMENT_METHODS = [
  { title: "Сбербанк",  code: "sberbank",  country: "RU", currency: "RUB" },
  { title: "Тинькофф",  code: "tinkoff",   country: "RU", currency: "RUB" },
  { title: "Альфа-Банк",code: "alfabank",  country: "RU", currency: "RUB" },
  { title: "ВТБ",       code: "vtb",        country: "RU", currency: "RUB" },
  { title: "QIWI",      code: "qiwi",       country: "RU", currency: "RUB" },
  { title: "ЮMoney",    code: "yoomoney",   country: "RU", currency: "RUB" },
  { title: "СБП",       code: "sbp",        country: "RU", currency: "RUB" },
  { title: "Raiffeisen",code: "raiffeisen", country: "RU", currency: "RUB" },
];

export async function initP2PPaymentMethods() {
  try {
    const existing = await db.select().from(p2pPaymentMethods).limit(1);
    if (existing.length > 0) return;
    for (const m of DEFAULT_PAYMENT_METHODS) {
      await db.insert(p2pPaymentMethods).values(m).onDuplicateKeyUpdate({ set: { title: m.title } });
    }
    console.log("[P2P] Default payment methods seeded");
  } catch (err) {
    console.error("[P2P] Failed to seed payment methods:", err);
  }
}

export function registerP2PRoutes(app: Express, requireApiKey: any) {

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
      const result = await insertAndReturn<any>(
        db.insert(p2pUserPaymentMethods).values({ userId, methodId, accountName, accountNumber, bankName }),
        "p2p_user_payment_methods"
      );
      res.json(result);
    } catch (err) {
      res.status(500).json({ message: "Server error" });
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

        // Filter by payment method if needed
        if (payment_method_id) {
          const pmId = parseInt(payment_method_id as string);
          ads = ads.filter((a: any) => a.paymentMethods.some((m: any) => m.id === pmId));
        }
      } else {
        ads = ads.map((a: any) => ({ ...a, paymentMethods: [] }));
      }

      res.json(ads);
    } catch (err) {
      console.error("[P2P] GET /ads error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/p2p/ads/:id", requireApiKey, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const rows = await db.execute(sql`
        SELECT a.*, b.title AS asset_title, b.currency AS asset_currency, b.network AS asset_network,
          u.id AS trader_id, u.name AS trader_name, u.img AS trader_img,
          COALESCE(s.total_orders, 0) AS total_orders,
          COALESCE(s.completed_orders, 0) AS completed_orders,
          COALESCE(s.successful_percent, 0) AS successful_percent,
          COALESCE(s.rating, 0) AS rating
        FROM p2p_ads a
        LEFT JOIN balances b ON b.id = a.asset_balance_id
        LEFT JOIN users u ON u.id = a.user_id
        LEFT JOIN p2p_user_stats s ON s.user_id = a.user_id
        WHERE a.id = ${id}
      `);
      const ad = (rows[0] as any[])[0];
      if (!ad) return res.status(404).json({ message: "Ad not found" });
      const pmRows = await db.execute(sql`
        SELECT pm.id, pm.title, pm.code FROM p2p_ad_payment_methods apm
        LEFT JOIN p2p_payment_methods pm ON pm.id = apm.method_id
        WHERE apm.ad_id = ${id}
      `);
      res.json({ ...snakeToCamel(ad), paymentMethods: (pmRows[0] as any[]) });
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/p2p/my-ads", requireApiKey, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const rows = await db.execute(sql`
        SELECT a.*, b.title AS asset_title, b.currency AS asset_currency
        FROM p2p_ads a
        LEFT JOIN balances b ON b.id = a.asset_balance_id
        WHERE a.user_id = ${userId}
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
      const { side, assetBalanceId, fiatBalanceId, price, minAmount, maxAmount,
              availableAmount, paymentTimeMinutes, terms, paymentMethodIds } = req.body;

      if (!side || !assetBalanceId || !price || !minAmount || !maxAmount || !availableAmount) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      if (!["buy", "sell"].includes(side)) {
        return res.status(400).json({ message: "side must be buy or sell" });
      }

      if (side === "sell") {
        const ub = await db.select().from(usersBalances)
          .where(and(eq(usersBalances.idUser, userId), eq(usersBalances.idBalance, parseInt(assetBalanceId))))
          .limit(1);
        if (!ub.length || parseFloat(ub[0].sum as string) < parseFloat(availableAmount)) {
          return res.status(400).json({ message: "Insufficient balance" });
        }
      }

      const ad = await insertAndReturn<any>(
        db.insert(p2pAds).values({
          userId, side,
          assetBalanceId: parseInt(assetBalanceId),
          fiatBalanceId: fiatBalanceId ? parseInt(fiatBalanceId) : null,
          price: price.toString(),
          minAmount: minAmount.toString(),
          maxAmount: maxAmount.toString(),
          availableAmount: availableAmount.toString(),
          paymentTimeMinutes: paymentTimeMinutes ?? 15,
          terms: terms ?? null,
        }),
        "p2p_ads"
      );

      if (Array.isArray(paymentMethodIds) && paymentMethodIds.length > 0) {
        for (const methodId of paymentMethodIds) {
          await db.insert(p2pAdPaymentMethods).values({ adId: ad.id, methodId }).onDuplicateKeyUpdate({ set: { methodId } });
        }
      }

      await logP2P(userId, null, "create_ad", { adId: ad.id, side });
      res.json(ad);
    } catch (err) {
      console.error("[P2P] POST /ads error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.patch("/api/p2p/ads/:id", requireApiKey, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const id = parseInt(req.params.id);
      const existing = await db.select().from(p2pAds)
        .where(and(eq(p2pAds.id, id), eq(p2pAds.userId, userId))).limit(1);
      if (!existing.length) return res.status(404).json({ message: "Ad not found" });

      const updates: any = { updatedAt: new Date() };
      const { status, price, minAmount, maxAmount, availableAmount, terms } = req.body;
      if (status !== undefined) updates.status = status;
      if (price !== undefined) updates.price = price.toString();
      if (minAmount !== undefined) updates.minAmount = minAmount.toString();
      if (maxAmount !== undefined) updates.maxAmount = maxAmount.toString();
      if (availableAmount !== undefined) updates.availableAmount = availableAmount.toString();
      if (terms !== undefined) updates.terms = terms;

      await db.update(p2pAds).set(updates).where(eq(p2pAds.id, id));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.delete("/api/p2p/ads/:id", requireApiKey, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const id = parseInt(req.params.id);
      await db.update(p2pAds)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(and(eq(p2pAds.id, id), eq(p2pAds.userId, userId)));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // ── Orders ───────────────────────────────────────────────────────────────────

  app.post("/api/p2p/orders", requireApiKey, async (req: any, res) => {
    const buyerId = req.user.id;
    const { adId, assetAmount, paymentMethodId } = req.body;
    if (!adId || !assetAmount) return res.status(400).json({ message: "adId and assetAmount are required" });

    try {
      const order = await db.transaction(async (tx) => {
        // Lock ad row
        const adRows = await tx.execute(sql`SELECT * FROM p2p_ads WHERE id = ${parseInt(adId)} AND status = 'active' FOR UPDATE`);
        const ad: any = (adRows[0] as any[])[0];
        if (!ad) throw new Error("Объявление не найдено или не активно");

        const sellerId: number = ad.user_id;
        if (sellerId === buyerId) throw new Error("Нельзя торговать с самим собой");

        const assetAmt = parseFloat(assetAmount);
        if (assetAmt <= 0) throw new Error("Некорректная сумма");
        if (assetAmt < parseFloat(ad.min_amount)) throw new Error(`Минимальная сумма: ${ad.min_amount}`);
        if (assetAmt > parseFloat(ad.max_amount)) throw new Error(`Максимальная сумма: ${ad.max_amount}`);
        if (assetAmt > parseFloat(ad.available_amount)) throw new Error("Недостаточно доступного объема");

        const price = parseFloat(ad.price);
        const fiatAmount = assetAmt * price;
        const minutes = ad.payment_time_minutes || 15;
        const deadline = new Date(Date.now() + minutes * 60 * 1000);
        const deadlineStr = deadline.toISOString().slice(0, 19).replace("T", " ");

        // Who provides the crypto (seller on sell-ads, buyer on buy-ads)
        const lockerUserId = ad.side === "sell" ? sellerId : buyerId;
        const lockerBalId  = ad.asset_balance_id;

        // Check locker balance
        const ubRows = await tx.execute(sql`
          SELECT * FROM users_balances WHERE id_user = ${lockerUserId} AND id_balance = ${lockerBalId} FOR UPDATE
        `);
        const ub: any = (ubRows[0] as any[])[0];
        if (!ub || parseFloat(ub.sum) < assetAmt) throw new Error("Недостаточно средств на балансе");

        // Create order
        const pmId = paymentMethodId ? parseInt(paymentMethodId) : null;
        await tx.execute(sql`
          INSERT INTO p2p_orders
            (ad_id, buyer_id, seller_id, asset_balance_id, fiat_balance_id, asset_amount,
             fiat_amount, price, payment_method_id, status, payment_deadline, created_at)
          VALUES
            (${ad.id}, ${buyerId}, ${sellerId}, ${lockerBalId},
             ${ad.fiat_balance_id ?? null}, ${assetAmt}, ${fiatAmount}, ${price},
             ${pmId}, 'waiting_payment', ${deadlineStr}, NOW())
        `);
        const oRows = await tx.execute(sql`SELECT * FROM p2p_orders WHERE id = LAST_INSERT_ID()`);
        const newOrder: any = (oRows[0] as any[])[0];

        // Lock balance
        await tx.execute(sql`
          INSERT INTO p2p_balance_locks
            (order_id, user_id, user_balance_id, balance_id, amount, status, created_at)
          VALUES (${newOrder.id}, ${lockerUserId}, ${ub.id}, ${lockerBalId}, ${assetAmt}, 'locked', NOW())
        `);

        // Decrease ad available amount
        await tx.execute(sql`
          UPDATE p2p_ads SET available_amount = available_amount - ${assetAmt}, updated_at = NOW()
          WHERE id = ${ad.id}
        `);

        // System chat message
        await tx.execute(sql`
          INSERT INTO p2p_order_messages (order_id, sender_id, message, type, created_at)
          VALUES (${newOrder.id}, ${buyerId}, 'Сделка открыта. Ожидается оплата.', 'system', NOW())
        `);

        // Init stats (ON DUPLICATE KEY UPDATE)
        await tx.execute(sql`
          INSERT INTO p2p_user_stats (user_id, total_orders) VALUES (${buyerId}, 1)
          ON DUPLICATE KEY UPDATE total_orders = total_orders + 1
        `);
        await tx.execute(sql`
          INSERT INTO p2p_user_stats (user_id, total_orders) VALUES (${sellerId}, 1)
          ON DUPLICATE KEY UPDATE total_orders = total_orders + 1
        `);

        return newOrder;
      });

      await logP2P(buyerId, order.id, "create_order", { adId, assetAmount });
      res.json(snakeToCamel(order));
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.get("/api/p2p/orders", requireApiKey, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const rows = await db.execute(sql`
        SELECT o.*,
          b.title AS asset_title, b.currency AS asset_currency,
          buyer.name AS buyer_name, buyer.img AS buyer_img,
          seller.name AS seller_name, seller.img AS seller_img,
          IF(o.buyer_id = ${userId}, 1, 0) AS is_current_user_buyer
        FROM p2p_orders o
        LEFT JOIN balances b     ON b.id = o.asset_balance_id
        LEFT JOIN users buyer    ON buyer.id = o.buyer_id
        LEFT JOIN users seller   ON seller.id = o.seller_id
        WHERE o.buyer_id = ${userId} OR o.seller_id = ${userId}
        ORDER BY o.created_at DESC
        LIMIT 50
      `);
      const result = (rows[0] as any[]).map((r: any) => ({
        ...snakeToCamel(r),
        isCurrentUserBuyer: r.is_current_user_buyer === 1,
        isCurrentUserSeller: r.is_current_user_buyer !== 1,
      }));
      res.json(result);
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/p2p/orders/:id", requireApiKey, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const id = parseInt(req.params.id);
      const rows = await db.execute(sql`
        SELECT o.*,
          b.title AS asset_title, b.currency AS asset_currency, b.network AS asset_network,
          buyer.name  AS buyer_name,  buyer.img  AS buyer_img,  buyer.tg_username  AS buyer_username,
          seller.name AS seller_name, seller.img AS seller_img, seller.tg_username AS seller_username,
          ad.payment_time_minutes, ad.terms AS ad_terms,
          pm.title AS payment_method_title, pm.code AS payment_method_code
        FROM p2p_orders o
        LEFT JOIN balances b              ON b.id = o.asset_balance_id
        LEFT JOIN users buyer             ON buyer.id = o.buyer_id
        LEFT JOIN users seller            ON seller.id = o.seller_id
        LEFT JOIN p2p_ads ad              ON ad.id = o.ad_id
        LEFT JOIN p2p_payment_methods pm  ON pm.id = o.payment_method_id
        WHERE o.id = ${id} AND (o.buyer_id = ${userId} OR o.seller_id = ${userId})
      `);
      const order: any = (rows[0] as any[])[0];
      if (!order) return res.status(404).json({ message: "Order not found" });

      // Seller payment requisites
      const spRows = await db.execute(sql`
        SELECT upm.*, pm.title AS method_title, pm.code AS method_code
        FROM p2p_user_payment_methods upm
        LEFT JOIN p2p_payment_methods pm ON pm.id = upm.method_id
        WHERE upm.user_id = ${order.seller_id} AND upm.status = 'active'
        LIMIT 5
      `);

      const result = snakeToCamel(order);
      result.sellerPaymentDetails = (spRows[0] as any[]).map(snakeToCamel);
      result.isCurrentUserBuyer  = order.buyer_id === userId;
      result.isCurrentUserSeller = order.seller_id === userId;
      res.json(result);
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/p2p/orders/:id/mark-paid", requireApiKey, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const id = parseInt(req.params.id);
      const oRows = await db.execute(sql`SELECT * FROM p2p_orders WHERE id = ${id}`);
      const order: any = (oRows[0] as any[])[0];
      if (!order) return res.status(404).json({ message: "Order not found" });
      if (order.buyer_id !== userId) return res.status(403).json({ message: "Только покупатель может подтвердить оплату" });
      if (order.status !== "waiting_payment") return res.status(400).json({ message: "Неверный статус сделки" });
      if (order.payment_deadline && new Date() > new Date(order.payment_deadline)) {
        return res.status(400).json({ message: "Время оплаты истекло" });
      }
      await db.execute(sql`UPDATE p2p_orders SET status = 'paid', paid_at = NOW(), updated_at = NOW() WHERE id = ${id}`);
      await db.execute(sql`INSERT INTO p2p_order_messages (order_id, sender_id, message, type, created_at) VALUES (${id}, ${userId}, 'Покупатель подтвердил оплату. Ожидается подтверждение продавца.', 'system', NOW())`);
      await logP2P(userId, id, "mark_paid");
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/p2p/orders/:id/release", requireApiKey, async (req: any, res) => {
    const userId = req.user.id;
    const id = parseInt(req.params.id);
    try {
      await db.transaction(async (tx) => {
        const oRows = await tx.execute(sql`SELECT * FROM p2p_orders WHERE id = ${id} FOR UPDATE`);
        const order: any = (oRows[0] as any[])[0];
        if (!order) throw new Error("Сделка не найдена");
        if (order.seller_id !== userId) throw new Error("Только продавец может отпустить средства");
        if (!["paid", "dispute"].includes(order.status)) throw new Error("Неверный статус сделки");

        const lRows = await tx.execute(sql`SELECT * FROM p2p_balance_locks WHERE order_id = ${id} FOR UPDATE`);
        const lock: any = (lRows[0] as any[])[0];
        if (!lock) throw new Error("Блокировка не найдена");

        const amount = parseFloat(lock.amount);
        const balanceId = lock.balance_id;
        const sellerId = order.seller_id;
        const buyerId  = order.buyer_id;

        // Deduct from seller
        await tx.execute(sql`
          UPDATE users_balances SET sum = sum - ${amount} WHERE id_user = ${sellerId} AND id_balance = ${balanceId}
        `);
        // Credit buyer (insert or add)
        await tx.execute(sql`
          INSERT INTO users_balances (id_user, id_balance, sum) VALUES (${buyerId}, ${balanceId}, ${amount})
          ON DUPLICATE KEY UPDATE sum = sum + ${amount}
        `);
        // Release lock
        await tx.execute(sql`UPDATE p2p_balance_locks SET status = 'released', updated_at = NOW() WHERE id = ${lock.id}`);
        // Complete order
        await tx.execute(sql`UPDATE p2p_orders SET status = 'released', released_at = NOW(), updated_at = NOW() WHERE id = ${id}`);
        // System message
        await tx.execute(sql`INSERT INTO p2p_order_messages (order_id, sender_id, message, type, created_at) VALUES (${id}, ${userId}, 'Продавец подтвердил оплату. Криптовалюта переведена покупателю.', 'system', NOW())`);
        // Update stats
        await tx.execute(sql`
          UPDATE p2p_user_stats
          SET completed_orders = completed_orders + 1,
              successful_percent = ROUND(completed_orders * 100.0 / NULLIF(total_orders, 0), 2),
              updated_at = NOW()
          WHERE user_id IN (${buyerId}, ${sellerId})
        `);
      });
      await logP2P(userId, id, "release");
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/p2p/orders/:id/cancel", requireApiKey, async (req: any, res) => {
    const userId = req.user.id;
    const id = parseInt(req.params.id);
    try {
      await db.transaction(async (tx) => {
        const oRows = await tx.execute(sql`SELECT * FROM p2p_orders WHERE id = ${id} FOR UPDATE`);
        const order: any = (oRows[0] as any[])[0];
        if (!order) throw new Error("Сделка не найдена");
        if (order.buyer_id !== userId && order.seller_id !== userId) throw new Error("Вы не участник этой сделки");
        if (order.status !== "waiting_payment") throw new Error("Отмена возможна только до подтверждения оплаты");
        if (order.buyer_id !== userId) throw new Error("Только покупатель может отменить сделку");

        const lRows = await tx.execute(sql`SELECT * FROM p2p_balance_locks WHERE order_id = ${id} FOR UPDATE`);
        const lock: any = (lRows[0] as any[])[0];
        if (lock) {
          await tx.execute(sql`UPDATE p2p_balance_locks SET status = 'cancelled', updated_at = NOW() WHERE id = ${lock.id}`);
        }
        // Restore available amount
        await tx.execute(sql`
          UPDATE p2p_ads SET available_amount = available_amount + ${parseFloat(order.asset_amount)}, updated_at = NOW()
          WHERE id = ${order.ad_id}
        `);
        // Cancel order
        await tx.execute(sql`UPDATE p2p_orders SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW() WHERE id = ${id}`);
        // System message
        await tx.execute(sql`INSERT INTO p2p_order_messages (order_id, sender_id, message, type, created_at) VALUES (${id}, ${userId}, 'Сделка отменена покупателем.', 'system', NOW())`);
        // Stats
        await tx.execute(sql`UPDATE p2p_user_stats SET cancelled_orders = cancelled_orders + 1, updated_at = NOW() WHERE user_id = ${userId}`);
      });
      await logP2P(userId, id, "cancel");
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/p2p/orders/:id/dispute", requireApiKey, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const id = parseInt(req.params.id);
      const { reason, description } = req.body;
      if (!reason) return res.status(400).json({ message: "reason is required" });

      const oRows = await db.execute(sql`SELECT * FROM p2p_orders WHERE id = ${id}`);
      const order: any = (oRows[0] as any[])[0];
      if (!order) return res.status(404).json({ message: "Order not found" });
      if (order.buyer_id !== userId && order.seller_id !== userId) return res.status(403).json({ message: "Не участник" });
      if (order.status !== "paid") return res.status(400).json({ message: "Спор можно открыть только после подтверждения оплаты" });

      await db.execute(sql`UPDATE p2p_orders SET status = 'dispute', updated_at = NOW() WHERE id = ${id}`);
      await db.execute(sql`UPDATE p2p_balance_locks SET status = 'disputed', updated_at = NOW() WHERE order_id = ${id}`);
      await db.insert(p2pDisputes).values({ orderId: id, openedBy: userId, reason, description: description ?? null });
      await db.execute(sql`INSERT INTO p2p_order_messages (order_id, sender_id, message, type, created_at) VALUES (${id}, ${userId}, 'Открыт спор. Ожидается решение модератора.', 'system', NOW())`);
      await db.execute(sql`UPDATE p2p_user_stats SET disputes_total = disputes_total + 1, updated_at = NOW() WHERE user_id IN (${order.buyer_id}, ${order.seller_id})`);
      await logP2P(userId, id, "dispute", { reason });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // ── Messages ─────────────────────────────────────────────────────────────────

  app.get("/api/p2p/orders/:id/messages", requireApiKey, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const id = parseInt(req.params.id);
      const oRows = await db.execute(sql`SELECT id FROM p2p_orders WHERE id = ${id} AND (buyer_id = ${userId} OR seller_id = ${userId})`);
      if (!(oRows[0] as any[]).length) return res.status(404).json({ message: "Order not found" });

      const rows = await db.execute(sql`
        SELECT m.*, u.name AS sender_name, u.img AS sender_img
        FROM p2p_order_messages m
        LEFT JOIN users u ON u.id = m.sender_id
        WHERE m.order_id = ${id}
        ORDER BY m.created_at ASC
      `);
      res.json((rows[0] as any[]).map(snakeToCamel));
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/p2p/orders/:id/messages", requireApiKey, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const id = parseInt(req.params.id);
      const { message, attachmentUrl } = req.body;
      if (!message && !attachmentUrl) return res.status(400).json({ message: "message or attachmentUrl required" });

      const oRows = await db.execute(sql`SELECT id FROM p2p_orders WHERE id = ${id} AND (buyer_id = ${userId} OR seller_id = ${userId})`);
      if (!(oRows[0] as any[]).length) return res.status(404).json({ message: "Order not found" });

      await db.insert(p2pOrderMessages).values({
        orderId: id, senderId: userId,
        message: message ?? null, attachmentUrl: attachmentUrl ?? null,
        type: "text",
      });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  });

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

  // ── Reviews ───────────────────────────────────────────────────────────────────

  app.post("/api/p2p/orders/:id/review", requireApiKey, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orderId = parseInt(req.params.id);
      const { rating, comment } = req.body;
      if (!rating || rating < 1 || rating > 5) return res.status(400).json({ message: "rating 1-5 required" });

      const oRows = await db.execute(sql`
        SELECT * FROM p2p_orders WHERE id = ${orderId} AND status = 'released'
        AND (buyer_id = ${userId} OR seller_id = ${userId})
      `);
      const order: any = (oRows[0] as any[])[0];
      if (!order) return res.status(404).json({ message: "Completed order not found" });

      // Determine who is being reviewed
      const reviewedId = order.buyer_id === userId ? order.seller_id : order.buyer_id;

      // Check not already reviewed
      const existing = await db.execute(sql`
        SELECT id FROM p2p_reviews WHERE order_id = ${orderId} AND reviewer_id = ${userId}
      `);
      if ((existing[0] as any[]).length > 0) {
        return res.status(400).json({ message: "Вы уже оставили отзыв" });
      }

      await db.execute(sql`
        INSERT INTO p2p_reviews (order_id, reviewer_id, reviewed_id, rating, comment, created_at)
        VALUES (${orderId}, ${userId}, ${reviewedId}, ${rating}, ${comment ?? null}, NOW())
      `);

      // Update stats rating
      const ratingRows = await db.execute(sql`
        SELECT AVG(rating) as avg_rating FROM p2p_reviews WHERE reviewed_id = ${reviewedId}
      `);
      const avgRating = (ratingRows[0] as any[])[0]?.avg_rating ?? 0;
      await db.execute(sql`
        INSERT INTO p2p_user_stats (user_id, rating) VALUES (${reviewedId}, ${avgRating})
        ON DUPLICATE KEY UPDATE rating = ${avgRating}, updated_at = NOW()
      `);

      await logP2P(userId, orderId, "review", { rating, reviewedId });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/p2p/orders/:id/reviews", requireApiKey, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orderId = parseInt(req.params.id);
      const rows = await db.execute(sql`
        SELECT r.*, u.name AS reviewer_name
        FROM p2p_reviews r LEFT JOIN users u ON u.id = r.reviewer_id
        WHERE r.order_id = ${orderId}
      `);
      // Check if current user already reviewed
      const myReview = (rows[0] as any[]).find((r: any) => r.reviewer_id === userId);
      res.json({ reviews: (rows[0] as any[]).map(snakeToCamel), myReview: !!myReview });
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // Fix orders list: include isCurrentUserBuyer
  // (Already handled in the GET /api/p2p/orders endpoint above via buyer_id/seller_id comparison in frontend)
  // Patch the orders list to include is_current_user_buyer field
  app.get("/api/p2p/orders-check", requireApiKey, async (req: any, res) => {
    res.json({ ok: true });
  });

  // ── Admin: Disputes ────────────────────────────────────────────────────────────

  app.get("/api/p2p/admin/disputes", requireApiKey, async (req: any, res) => {
    try {
      const { status } = req.query;
      const rows = await db.execute(sql`
        SELECT d.*, o.asset_amount, o.fiat_amount, o.asset_balance_id,
          b.currency AS asset_currency,
          buyer.name AS buyer_name, buyer.tg_username AS buyer_username,
          seller.name AS seller_name, seller.tg_username AS seller_username,
          opener.name AS opened_by_name
        FROM p2p_disputes d
        LEFT JOIN p2p_orders o ON o.id = d.order_id
        LEFT JOIN balances b ON b.id = o.asset_balance_id
        LEFT JOIN users buyer ON buyer.id = o.buyer_id
        LEFT JOIN users seller ON seller.id = o.seller_id
        LEFT JOIN users opener ON opener.id = d.opened_by
        WHERE (${status ? sql`d.status = ${status}` : sql`1=1`})
        ORDER BY d.created_at DESC
        LIMIT 100
      `);
      res.json((rows[0] as any[]).map(snakeToCamel));
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/p2p/admin/disputes/:id/resolve", requireApiKey, async (req: any, res) => {
    const disputeId = parseInt(req.params.id);
    const { winner, resolution } = req.body; // winner: 'buyer' | 'seller'
    if (!winner || !["buyer", "seller"].includes(winner)) {
      return res.status(400).json({ message: "winner must be buyer or seller" });
    }
    const adminId = req.user.id;

    try {
      await db.transaction(async (tx) => {
        const dRows = await tx.execute(sql`SELECT * FROM p2p_disputes WHERE id = ${disputeId} AND status = 'open' FOR UPDATE`);
        const dispute: any = (dRows[0] as any[])[0];
        if (!dispute) throw new Error("Спор не найден или уже решён");

        const oRows = await tx.execute(sql`SELECT * FROM p2p_orders WHERE id = ${dispute.order_id} FOR UPDATE`);
        const order: any = (oRows[0] as any[])[0];
        if (!order) throw new Error("Сделка не найдена");

        const lRows = await tx.execute(sql`SELECT * FROM p2p_balance_locks WHERE order_id = ${dispute.order_id} FOR UPDATE`);
        const lock: any = (lRows[0] as any[])[0];

        if (lock) {
          const amount = parseFloat(lock.amount);
          const balanceId = lock.balance_id;
          const sellerId = order.seller_id;
          const buyerId = order.buyer_id;

          if (winner === "buyer") {
            // Give funds to buyer
            await tx.execute(sql`UPDATE users_balances SET sum = sum - ${amount} WHERE id_user = ${sellerId} AND id_balance = ${balanceId}`);
            await tx.execute(sql`INSERT INTO users_balances (id_user, id_balance, sum) VALUES (${buyerId}, ${balanceId}, ${amount}) ON DUPLICATE KEY UPDATE sum = sum + ${amount}`);
          } else {
            // Keep funds with seller (just release the lock)
          }
          await tx.execute(sql`UPDATE p2p_balance_locks SET status = 'released', updated_at = NOW() WHERE id = ${lock.id}`);
        }

        const newOrderStatus = winner === "buyer" ? "released" : "refunded";
        const disputeStatus = winner === "buyer" ? "resolved_buyer" : "resolved_seller";
        await tx.execute(sql`UPDATE p2p_orders SET status = ${newOrderStatus}, updated_at = NOW() WHERE id = ${dispute.order_id}`);
        await tx.execute(sql`
          UPDATE p2p_disputes SET status = ${disputeStatus}, resolved_by = ${adminId},
            resolution = ${resolution ?? null}, updated_at = NOW()
          WHERE id = ${disputeId}
        `);
        await tx.execute(sql`
          INSERT INTO p2p_order_messages (order_id, sender_id, message, type, created_at)
          VALUES (${dispute.order_id}, ${adminId},
            ${`Спор решён. Победитель: ${winner === "buyer" ? "покупатель" : "продавец"}. ${resolution ?? ""}`},
            'system', NOW())
        `);
        // Update dispute stats
        await tx.execute(sql`UPDATE p2p_user_stats SET disputes_total = disputes_total + 1, updated_at = NOW() WHERE user_id IN (${order.buyer_id}, ${order.seller_id})`);
      });

      await logP2P(adminId, null, "admin_resolve_dispute", { disputeId, winner });
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });
}
