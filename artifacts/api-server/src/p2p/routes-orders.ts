import type { Express } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { p2pDisputes, p2pOrderMessages } from "@workspace/db/schema";
import { getP2PSetting } from "../p2p-migrations";
import { adjustUserBalance } from "../balance-helpers";
import { checkP2PBlock, snakeToCamel, logP2P, sendP2PNotification, updateLastSeen, recalculateSortPriority } from "./helpers";

export function registerOrdersRoutes(app: Express, requireApiKey: any) {

  // ── Orders ───────────────────────────────────────────────────────────────────

  app.post("/api/p2p/orders", requireApiKey, async (req: any, res) => {
    const takerId = req.user.id;
    const { adId, assetAmount, paymentMethodId } = req.body;
    if (!adId || !assetAmount) return res.status(400).json({ message: "adId and assetAmount are required" });

    try {
      await checkP2PBlock(takerId);
      const order = await db.transaction(async (tx) => {
        const adRows = await tx.execute(sql`SELECT * FROM p2p_ads WHERE id = ${parseInt(adId)} AND status = 'active' FOR UPDATE`);
        const ad: any = (adRows[0] as any[])[0];
        if (!ad) throw new Error("Объявление не найдено или не активно");

        const adOwnerId: number = ad.user_id;
        if (adOwnerId === takerId) throw new Error("Нельзя торговать с самим собой");
        const buyerId = ad.side === "sell" ? takerId : adOwnerId;
        const sellerId = ad.side === "sell" ? adOwnerId : takerId;

        const rStatsRows = await tx.execute(sql`SELECT disputes_total, total_orders FROM p2p_user_stats WHERE user_id = ${takerId}`);
        const rStats: any = (rStatsRows[0] as any[])[0];
        if (rStats && (rStats.disputes_total || 0) >= 5) {
          throw new Error("Ваш аккаунт временно ограничен из-за большого количества споров");
        }

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

        const pmId = paymentMethodId ? parseInt(paymentMethodId) : null;
        const adMethodRows = await tx.execute(sql`
          SELECT method_id FROM p2p_ad_payment_methods WHERE ad_id = ${ad.id}
        `);
        const adMethodIds = (adMethodRows[0] as any[]).map((row: any) => row.method_id);
        if (adMethodIds.length > 0 && (!pmId || !adMethodIds.includes(pmId))) {
          throw new Error("Выберите доступный для объявления способ оплаты");
        }
        if (pmId) {
          const sellerMethodRows = await tx.execute(sql`
            SELECT id FROM p2p_user_payment_methods
            WHERE user_id = ${sellerId} AND method_id = ${pmId} AND status = 'active'
            LIMIT 1
          `);
          if ((sellerMethodRows[0] as any[]).length === 0) {
            throw new Error("У продавца нет активных реквизитов для выбранного способа оплаты");
          }
        }

        const lockerUserId = sellerId;
        const lockerBalId  = ad.asset_balance_id;

        // Для sell-объявлений с заморозкой баланс уже списан при создании объявления.
        // Для buy-объявлений (и sell без заморозки) — проверяем и списываем сейчас.
        const balancePreLocked = ad.side === "sell" && ad.balance_locked;

        let ubId: number;
        if (balancePreLocked) {
          // Находим строку баланса без списания
          const ubRows = await tx.execute(sql`
            SELECT id
            FROM users_balances
            WHERE id_user = ${lockerUserId} AND id_balance = ${lockerBalId}
            ORDER BY id ASC
            LIMIT 1
          `);
          const ub: any = (ubRows[0] as any[])[0];
          if (!ub) throw new Error("Баланс продавца не найден");
          ubId = ub.id;
        } else {
          const ubRows = await tx.execute(sql`
            SELECT id
            FROM users_balances
            WHERE id_user = ${lockerUserId} AND id_balance = ${lockerBalId}
            ORDER BY id ASC
            FOR UPDATE
          `);
          const ub: any = (ubRows[0] as any[])[0];
          const totalRows = await tx.execute(sql`
            SELECT COALESCE(SUM(COALESCE(sum, 0)), 0) AS total_sum
            FROM users_balances
            WHERE id_user = ${lockerUserId} AND id_balance = ${lockerBalId}
          `);
          const total = (totalRows[0] as any[])[0]?.total_sum ?? "0";
          if (!ub || parseFloat(total) < assetAmt) throw new Error("Недостаточно средств на балансе");
          ubId = ub.id;
          // Списываем только если баланс не был предзаморожен
          await adjustUserBalance(tx, lockerUserId, lockerBalId, -assetAmt);
        }

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

        await tx.execute(sql`
          INSERT INTO p2p_balance_locks
            (order_id, user_id, user_balance_id, balance_id, amount, status, created_at)
          VALUES (${newOrder.id}, ${lockerUserId}, ${ubId}, ${lockerBalId}, ${assetAmt}, 'locked', NOW())
        `);
        await tx.execute(sql`UPDATE p2p_ads SET available_amount = available_amount - ${assetAmt}, updated_at = NOW() WHERE id = ${ad.id}`);
        await tx.execute(sql`INSERT INTO p2p_order_messages (order_id, sender_id, message, type, created_at) VALUES (${newOrder.id}, ${takerId}, 'Сделка открыта. Ожидается оплата.', 'system', NOW())`);
        await tx.execute(sql`INSERT INTO p2p_user_stats (user_id, total_orders) VALUES (${buyerId}, 1) ON DUPLICATE KEY UPDATE total_orders = total_orders + 1`);
        await tx.execute(sql`INSERT INTO p2p_user_stats (user_id, total_orders) VALUES (${sellerId}, 1) ON DUPLICATE KEY UPDATE total_orders = total_orders + 1`);

        return newOrder;
      });

      await logP2P(takerId, order.id, "create_order", { adId, assetAmount });
      await updateLastSeen(takerId);
      try {
        const counterpartyId = order.buyer_id === takerId ? order.seller_id : order.buyer_id;
        const sTgRows = await db.execute(sql`SELECT tg_id FROM users WHERE id = ${counterpartyId}`);
        const sTg: any = (sTgRows[0] as any[])[0];
        if (sTg?.tg_id) {
          await sendP2PNotification(sTg.tg_id, `🔔 <b>Новая сделка #${order.id}</b>\nОбъём: <b>${parseFloat(order.asset_amount)} USDT</b> за <b>${parseFloat(order.fiat_amount).toFixed(2)} ₽</b>`);
        }
      } catch { /* non-critical */ }
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

      const spRows = await db.execute(sql`
        SELECT upm.*, pm.title AS method_title, pm.code AS method_code
        FROM p2p_user_payment_methods upm
        LEFT JOIN p2p_payment_methods pm ON pm.id = upm.method_id
         WHERE upm.user_id = ${order.seller_id}
           AND upm.method_id = ${order.payment_method_id}
           AND upm.status = 'active'
         LIMIT 1
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
      await updateLastSeen(userId);
      try {
        const sTgRows = await db.execute(sql`SELECT tg_id FROM users WHERE id = ${order.seller_id}`);
        const sTg: any = (sTgRows[0] as any[])[0];
        if (sTg?.tg_id) {
          await sendP2PNotification(sTg.tg_id, `💳 <b>Оплата подтверждена по сделке #${id}</b>\nПокупатель отметил оплату. Проверьте поступление и подтвердите.`);
        }
      } catch { /* non-critical */ }
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
        const commissionPct = parseFloat(await getP2PSetting("commission_percent", "0.2")) / 100;
        const platformUserIdStr = await getP2PSetting("platform_user_id", "");
        const platformUserId = platformUserIdStr ? parseInt(platformUserIdStr) : null;
        const commission = parseFloat((amount * commissionPct).toFixed(8));
        const buyerAmount = parseFloat((amount - commission).toFixed(8));

        await adjustUserBalance(tx, buyerId, balanceId, buyerAmount);
        if (platformUserId && commission > 0) {
          await adjustUserBalance(tx, platformUserId, balanceId, commission);
        }
        await tx.execute(sql`UPDATE p2p_balance_locks SET status = 'released', updated_at = NOW() WHERE id = ${lock.id}`);
        await tx.execute(sql`UPDATE p2p_orders SET status = 'released', released_at = NOW(), updated_at = NOW() WHERE id = ${id}`);
        await tx.execute(sql`INSERT INTO p2p_order_messages (order_id, sender_id, message, type, created_at) VALUES (${id}, ${userId}, 'Продавец подтвердил оплату. Криптовалюта переведена покупателю.', 'system', NOW())`);

        const releaseSeconds = Math.max(0, Math.floor((Date.now() - new Date(order.created_at).getTime()) / 1000));
        await tx.execute(sql`
          UPDATE p2p_user_stats
          SET completed_orders = completed_orders + 1,
              successful_percent = ROUND((completed_orders + 1) * 100.0 / NULLIF(total_orders, 0), 2),
              avg_release_time_seconds = CASE WHEN avg_release_time_seconds = 0 THEN ${releaseSeconds} ELSE ROUND((avg_release_time_seconds + ${releaseSeconds}) / 2) END,
              updated_at = NOW()
          WHERE user_id = ${sellerId}
        `);
        await tx.execute(sql`UPDATE p2p_user_stats SET completed_orders = completed_orders + 1, successful_percent = ROUND((completed_orders + 1) * 100.0 / NULLIF(total_orders, 0), 2), updated_at = NOW() WHERE user_id = ${buyerId}`);
      });
      await logP2P(userId, id, "release");
      await updateLastSeen(userId);
      await recalculateSortPriority(userId);
      try {
        const bTgRows = await db.execute(sql`SELECT o.buyer_id, u.tg_id FROM p2p_orders o JOIN users u ON u.id = o.buyer_id WHERE o.id = ${id}`);
        const bInfo: any = (bTgRows[0] as any[])[0];
        if (bInfo?.tg_id) {
          await sendP2PNotification(bInfo.tg_id, `✅ <b>Сделка #${id} завершена!</b>\nПродавец подтвердил получение оплаты. Средства зачислены на ваш счёт.`);
          await recalculateSortPriority(bInfo.buyer_id);
        }
      } catch { /* non-critical */ }
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

        // Проверяем, был ли баланс предзаморожен на уровне объявления
        const adRow = await tx.execute(sql`SELECT balance_locked FROM p2p_ads WHERE id = ${order.ad_id}`);
        const adBalanceLocked = (adRow[0] as any[])[0]?.balance_locked;

        const lRows = await tx.execute(sql`SELECT * FROM p2p_balance_locks WHERE order_id = ${id} FOR UPDATE`);
        const lock: any = (lRows[0] as any[])[0];
        if (lock) {
          await tx.execute(sql`UPDATE p2p_balance_locks SET status = 'cancelled', updated_at = NOW() WHERE id = ${lock.id}`);
          // Если баланс предзаморожен на уровне объявления — НЕ возвращаем на баланс;
          // средства остаются в пуле объявления (available_amount восстанавливается ниже).
          // Если freeze на уровне ордера — возвращаем на баланс.
          if (!adBalanceLocked) {
            await adjustUserBalance(tx, lock.user_id, lock.balance_id, parseFloat(lock.amount));
          }
        }
        await tx.execute(sql`UPDATE p2p_ads SET available_amount = available_amount + ${parseFloat(order.asset_amount)}, updated_at = NOW() WHERE id = ${order.ad_id}`);
        await tx.execute(sql`UPDATE p2p_orders SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW() WHERE id = ${id}`);
        await tx.execute(sql`INSERT INTO p2p_order_messages (order_id, sender_id, message, type, created_at) VALUES (${id}, ${userId}, 'Сделка отменена покупателем.', 'system', NOW())`);
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
      await updateLastSeen(userId);
      try {
        const otherId = order.buyer_id === userId ? order.seller_id : order.buyer_id;
        const otherRows = await db.execute(sql`SELECT tg_id FROM users WHERE id = ${otherId}`);
        const other: any = (otherRows[0] as any[])[0];
        if (other?.tg_id) {
          await sendP2PNotification(other.tg_id, `⚠️ <b>Открыт спор по сделке #${id}</b>\nОжидается решение модератора. Средства в безопасности.`);
        }
      } catch { /* non-critical */ }
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

  // ── Reviews ───────────────────────────────────────────────────────────────────

  app.post("/api/p2p/orders/:id/review", requireApiKey, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orderId = parseInt(req.params.id);
      const { rating, comment } = req.body;
      if (!rating || rating < 1 || rating > 5) return res.status(400).json({ message: "rating 1-5 required" });

      const oRows = await db.execute(sql`SELECT * FROM p2p_orders WHERE id = ${orderId} AND status = 'released' AND (buyer_id = ${userId} OR seller_id = ${userId})`);
      const order: any = (oRows[0] as any[])[0];
      if (!order) return res.status(404).json({ message: "Completed order not found" });

      const toUserId = order.buyer_id === userId ? order.seller_id : order.buyer_id;
      const existing = await db.execute(sql`SELECT id FROM p2p_reviews WHERE order_id = ${orderId} AND from_user_id = ${userId}`);
      if ((existing[0] as any[]).length > 0) return res.status(400).json({ message: "Вы уже оставили отзыв" });

      await db.execute(sql`INSERT INTO p2p_reviews (order_id, from_user_id, to_user_id, rating, comment, created_at) VALUES (${orderId}, ${userId}, ${toUserId}, ${rating}, ${comment ?? null}, NOW())`);

      const ratingRows = await db.execute(sql`SELECT AVG(rating) as avg_rating FROM p2p_reviews WHERE to_user_id = ${toUserId}`);
      const avgRating = (ratingRows[0] as any[])[0]?.avg_rating ?? 0;
      await db.execute(sql`INSERT INTO p2p_user_stats (user_id, rating) VALUES (${toUserId}, ${avgRating}) ON DUPLICATE KEY UPDATE rating = ${avgRating}, updated_at = NOW()`);

      await logP2P(userId, orderId, "review", { rating, toUserId });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/p2p/orders/:id/reviews", requireApiKey, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orderId = parseInt(req.params.id);
      const rows = await db.execute(sql`SELECT r.*, u.name AS from_user_name FROM p2p_reviews r LEFT JOIN users u ON u.id = r.from_user_id WHERE r.order_id = ${orderId}`);
      const myReview = (rows[0] as any[]).find((r: any) => r.from_user_id === userId);
      res.json({ reviews: (rows[0] as any[]).map(snakeToCamel), myReview: !!myReview });
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  });
}
