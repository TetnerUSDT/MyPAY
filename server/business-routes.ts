import { Express, Request, Response } from "express";
import { db } from "./db";
import { sql, eq, desc, and } from "drizzle-orm";
import { merchantShops, merchantPayments, merchantPayoutRequests } from "@shared/schema";
import { randomBytes } from "crypto";

function generateApiKey(): string {
  return randomBytes(32).toString("hex");
}

function requireApiKey(req: Request, res: Response, next: Function) {
  const apiKey = req.headers["x-api-key"] as string;
  if (!apiKey) return res.status(401).json({ error: "Unauthorized" });
  (req as any).apiKey = apiKey;
  next();
}

async function getUserFromRequest(req: Request): Promise<any | null> {
  try {
    const apiKey = req.headers["x-api-key"] as string;
    if (!apiKey) return null;
    const rows = await db.execute(sql`SELECT * FROM users WHERE api_key = ${apiKey} LIMIT 1`);
    return (rows[0] as any[])[0] ?? null;
  } catch { return null; }
}

// ── Blockchain scanner helper ────────────────────────────────────────────────

const NETWORK_SCAN_URLS: Record<string, string> = {
  TRC20: "https://apilist.tronscanapi.com/api/transaction-info",
  BEP20: "https://api.bscscan.com/api",
  TON:   "https://toncenter.com/api/v2/getTransactions",
};

async function checkTxOnChain(network: string, txHash: string, toAddress: string, expectedAmount?: string): Promise<{ confirmed: boolean; amount?: string }> {
  try {
    if (network === "TRC20") {
      const url = `https://apilist.tronscanapi.com/api/transaction-info?hash=${txHash}`;
      const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
      const data = await r.json() as any;
      if (!data || !data.confirmed) return { confirmed: false };
      const transfers = data.trc20TransferInfo ?? [];
      const match = transfers.find((t: any) =>
        t.to_address?.toLowerCase() === toAddress.toLowerCase()
      );
      if (!match) return { confirmed: false };
      const amount = (parseInt(match.amount_str ?? "0") / 1e6).toFixed(6);
      return { confirmed: true, amount };
    }

    if (network === "BEP20") {
      const url = `https://api.bscscan.com/api?module=transaction&action=gettxreceiptstatus&txhash=${txHash}&apikey=YourApiKeyToken`;
      const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
      const data = await r.json() as any;
      if (data.result?.status === "1") {
        return { confirmed: true, amount: expectedAmount };
      }
      return { confirmed: false };
    }

    return { confirmed: false };
  } catch {
    return { confirmed: false };
  }
}

// ── Poll for payment on address ─────────────────────────────────────────────

async function pollAddressForPayment(paymentId: number, address: string, network: string, currency: string, expectedAmount?: string) {
  const deadline = Date.now() + 10 * 60 * 1000;
  const interval = 20000;

  const check = async () => {
    if (Date.now() > deadline) return;

    try {
      const rows = await db.execute(sql`SELECT status FROM merchant_payments WHERE id = ${paymentId} LIMIT 1`);
      const payment = (rows[0] as any[])[0];
      if (!payment || payment.status !== "pending") return;

      let found = false;
      let amount = expectedAmount;

      if (network === "TRC20") {
        const url = `https://apilist.tronscanapi.com/api/transfer/trc20?limit=5&start=0&toAddress=${address}&tokenName=USDT`;
        const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
        const data = await r.json() as any;
        const txs = data.data ?? [];
        if (txs.length > 0) {
          const tx = txs[0];
          const txAmount = (parseInt(tx.amount ?? "0") / 1e6).toFixed(6);
          await db.execute(sql`
            UPDATE merchant_payments
            SET status = 'confirmed', tx_hash = ${tx.transactionId}, amount_received = ${txAmount}, confirmed_at = NOW()
            WHERE id = ${paymentId} AND status = 'pending'
          `);
          await db.execute(sql`
            UPDATE merchant_shops SET balance_usdt = balance_usdt + ${parseFloat(txAmount)},
            total_received = total_received + ${parseFloat(txAmount)} WHERE id = (SELECT shop_id FROM merchant_payments WHERE id = ${paymentId})
          `);
          found = true;
        }
      }

      if (network === "BEP20") {
        const url = `https://api.bscscan.com/api?module=account&action=tokentx&address=${address}&contractaddress=0x55d398326f99059fF775485246999027B3197955&sort=desc&offset=5&page=1`;
        const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
        const data = await r.json() as any;
        const txs = data.result ?? [];
        if (txs.length > 0 && txs[0].to?.toLowerCase() === address.toLowerCase()) {
          const tx = txs[0];
          const txAmount = (parseInt(tx.value ?? "0") / 1e18).toFixed(6);
          await db.execute(sql`
            UPDATE merchant_payments
            SET status = 'confirmed', tx_hash = ${tx.hash}, amount_received = ${txAmount}, confirmed_at = NOW()
            WHERE id = ${paymentId} AND status = 'pending'
          `);
          await db.execute(sql`
            UPDATE merchant_shops SET balance_usdt = balance_usdt + ${parseFloat(txAmount)},
            total_received = total_received + ${parseFloat(txAmount)} WHERE id = (SELECT shop_id FROM merchant_payments WHERE id = ${paymentId})
          `);
          found = true;
        }
      }

      if (!found && Date.now() < deadline) {
        setTimeout(check, interval);
      }
    } catch {
      if (Date.now() < deadline) setTimeout(check, interval);
    }
  };

  setTimeout(check, interval);
}

// ── Route registration ────────────────────────────────────────────────────────

export function registerBusinessRoutes(app: Express) {

  // ── Cabinet API (requires user API key) ──────────────────────────────────

  // List my shops
  app.get("/api/business/shops", requireApiKey, async (req, res) => {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    try {
      const shops = await db.select().from(merchantShops).where(eq(merchantShops.userId, user.id)).orderBy(desc(merchantShops.createdAt));
      res.json(shops);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get single shop
  app.get("/api/business/shops/:id", requireApiKey, async (req, res) => {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    try {
      const [shop] = await db.select().from(merchantShops).where(and(eq(merchantShops.id, parseInt(req.params.id)), eq(merchantShops.userId, user.id))).limit(1);
      if (!shop) return res.status(404).json({ error: "Shop not found" });
      res.json(shop);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Create shop
  app.post("/api/business/shops", requireApiKey, async (req, res) => {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const { name, domain } = req.body;
    if (!name || !domain) return res.status(400).json({ error: "name and domain are required" });
    try {
      const apiKey = generateApiKey();
      const result = await db.insert(merchantShops).values({ userId: user.id, name, domain, apiKey, status: "pending" }) as any;
      const insertId = result[0]?.insertId;
      const [shop] = await db.select().from(merchantShops).where(eq(merchantShops.id, insertId)).limit(1);
      res.json(shop);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Update shop settings
  app.patch("/api/business/shops/:id", requireApiKey, async (req, res) => {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const { name, domain, webhookUrl, addressMode } = req.body;
    const shopId = parseInt(req.params.id);
    try {
      const [shop] = await db.select().from(merchantShops).where(and(eq(merchantShops.id, shopId), eq(merchantShops.userId, user.id))).limit(1);
      if (!shop) return res.status(404).json({ error: "Shop not found" });
      const updates: any = {};
      if (name) updates.name = name;
      if (domain) updates.domain = domain;
      if (webhookUrl !== undefined) updates.webhookUrl = webhookUrl;
      if (addressMode && ["permanent", "temporary"].includes(addressMode)) updates.addressMode = addressMode;
      await db.update(merchantShops).set(updates).where(eq(merchantShops.id, shopId));
      const [updated] = await db.select().from(merchantShops).where(eq(merchantShops.id, shopId)).limit(1);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Regenerate API key
  app.post("/api/business/shops/:id/regenerate-key", requireApiKey, async (req, res) => {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const shopId = parseInt(req.params.id);
    try {
      const [shop] = await db.select().from(merchantShops).where(and(eq(merchantShops.id, shopId), eq(merchantShops.userId, user.id))).limit(1);
      if (!shop) return res.status(404).json({ error: "Shop not found" });
      const newKey = generateApiKey();
      await db.update(merchantShops).set({ apiKey: newKey }).where(eq(merchantShops.id, shopId));
      res.json({ apiKey: newKey });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get shop payments history
  app.get("/api/business/shops/:id/payments", requireApiKey, async (req, res) => {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const shopId = parseInt(req.params.id);
    try {
      const [shop] = await db.select().from(merchantShops).where(and(eq(merchantShops.id, shopId), eq(merchantShops.userId, user.id))).limit(1);
      if (!shop) return res.status(404).json({ error: "Shop not found" });
      const payments = await db.select().from(merchantPayments).where(eq(merchantPayments.shopId, shopId)).orderBy(desc(merchantPayments.createdAt)).limit(100);
      res.json(payments);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get shop payout requests
  app.get("/api/business/shops/:id/payouts", requireApiKey, async (req, res) => {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const shopId = parseInt(req.params.id);
    try {
      const [shop] = await db.select().from(merchantShops).where(and(eq(merchantShops.id, shopId), eq(merchantShops.userId, user.id))).limit(1);
      if (!shop) return res.status(404).json({ error: "Shop not found" });
      const payouts = await db.select().from(merchantPayoutRequests).where(eq(merchantPayoutRequests.shopId, shopId)).orderBy(desc(merchantPayoutRequests.createdAt)).limit(100);
      res.json(payouts);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Create payout request
  app.post("/api/business/shops/:id/payouts", requireApiKey, async (req, res) => {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const shopId = parseInt(req.params.id);
    const { toAddress, network, currency, amount, note } = req.body;
    if (!toAddress || !network || !amount) return res.status(400).json({ error: "toAddress, network, amount are required" });
    try {
      const [shop] = await db.select().from(merchantShops).where(and(eq(merchantShops.id, shopId), eq(merchantShops.userId, user.id))).limit(1);
      if (!shop) return res.status(404).json({ error: "Shop not found" });
      if (shop.status !== "active") return res.status(403).json({ error: "Shop is not active" });
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) return res.status(400).json({ error: "Invalid amount" });
      if (parseFloat(shop.balanceUsdt) < amountNum) return res.status(400).json({ error: "Insufficient balance" });
      await db.transaction(async (tx) => {
        await tx.update(merchantShops).set({ balanceUsdt: sql`balance_usdt - ${amountNum}` }).where(eq(merchantShops.id, shopId));
        await tx.insert(merchantPayoutRequests).values({ shopId, toAddress, network, currency: currency || "USDT", amount: String(amountNum), note: note || null, status: "pending" });
      });
      res.json({ ok: true, message: "Payout request created" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Update payout status (merchant processes their own payouts)
  app.patch("/api/business/shops/:id/payouts/:payoutId", requireApiKey, async (req, res) => {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const shopId = parseInt(req.params.id);
    const payoutId = parseInt(req.params.payoutId);
    const { status, txHash } = req.body;
    if (!status || !["processing", "completed", "cancelled"].includes(status)) {
      return res.status(400).json({ error: "Invalid status. Use: processing, completed, cancelled" });
    }
    try {
      const [shop] = await db.select().from(merchantShops).where(and(eq(merchantShops.id, shopId), eq(merchantShops.userId, user.id))).limit(1);
      if (!shop) return res.status(404).json({ error: "Shop not found" });
      const [payout] = await db.select().from(merchantPayoutRequests).where(and(eq(merchantPayoutRequests.id, payoutId), eq(merchantPayoutRequests.shopId, shopId))).limit(1);
      if (!payout) return res.status(404).json({ error: "Payout not found" });

      const updates: any = { status };
      if (txHash) updates.txHash = txHash;
      if (status === "completed" || status === "cancelled") updates.processedAt = new Date();
      if (status === "completed") {
        await db.update(merchantShops).set({ totalPaidOut: sql`total_paid_out + ${parseFloat(payout.amount)}` }).where(eq(merchantShops.id, shopId));
      }
      if (status === "cancelled") {
        await db.update(merchantShops).set({ balanceUsdt: sql`balance_usdt + ${parseFloat(payout.amount)}` }).where(eq(merchantShops.id, shopId));
      }
      await db.update(merchantPayoutRequests).set(updates).where(eq(merchantPayoutRequests.id, payoutId));
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Public Merchant API (shop api_key in header x-shop-key) ──────────────

  async function getShopByKey(req: Request): Promise<any | null> {
    const key = req.headers["x-shop-key"] as string;
    if (!key) return null;
    try {
      const rows = await db.execute(sql`SELECT * FROM merchant_shops WHERE api_key = ${key} AND status = 'active' LIMIT 1`);
      return (rows[0] as any[])[0] ?? null;
    } catch { return null; }
  }

  // Generate/get address for payment
  app.post("/api/merchant/address", async (req, res) => {
    const shop = await getShopByKey(req);
    if (!shop) return res.status(401).json({ error: "Invalid shop API key or shop not active" });
    const { user_id, order_id, network, currency, amount } = req.body;
    if (!network) return res.status(400).json({ error: "network is required" });

    try {
      if (shop.address_mode === "permanent" && user_id) {
        const existing = await db.execute(sql`
          SELECT * FROM merchant_payments
          WHERE shop_id = ${shop.id} AND external_user_id = ${user_id} AND network = ${network} AND address_type = 'permanent'
          LIMIT 1
        `);
        const ex = (existing[0] as any[])[0];
        if (ex) {
          return res.json({ address: ex.wallet_address, network, type: "permanent", payment_id: ex.id });
        }
      }

      const walletRes = await fetch(`${process.env.WALLET_API_URL ?? "https://pay.swiftx.online/api/wallet/create"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": process.env.WALLET_API_KEY ?? "" },
        body: JSON.stringify({ network }),
      });
      const walletData = await walletRes.json() as any;
      const address = walletData.address;
      if (!address) return res.status(500).json({ error: "Failed to generate wallet address" });

      const isTemp = shop.address_mode === "temporary";
      const expiresAt = isTemp ? new Date(Date.now() + 30 * 60 * 1000) : null;

      const insertResult = await db.insert(merchantPayments).values({
        shopId: shop.id,
        orderId: order_id ?? null,
        externalUserId: user_id ?? null,
        walletAddress: address,
        network,
        currency: currency ?? "USDT",
        amount: amount ? String(amount) : null,
        status: "pending",
        addressType: isTemp ? "temporary" : "permanent",
        expiresAt: expiresAt ?? undefined,
      }) as any;
      const paymentId = insertResult[0]?.insertId;

      pollAddressForPayment(paymentId, address, network, currency ?? "USDT", amount ? String(amount) : undefined);

      return res.json({
        address,
        network,
        currency: currency ?? "USDT",
        type: isTemp ? "temporary" : "permanent",
        payment_id: paymentId,
        expires_at: expiresAt,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Trigger payment check (I paid button)
  app.post("/api/merchant/check-payment", async (req, res) => {
    const shop = await getShopByKey(req);
    if (!shop) return res.status(401).json({ error: "Invalid shop API key or shop not active" });
    const { payment_id } = req.body;
    if (!payment_id) return res.status(400).json({ error: "payment_id is required" });

    try {
      const rows = await db.execute(sql`SELECT * FROM merchant_payments WHERE id = ${payment_id} AND shop_id = ${shop.id} LIMIT 1`);
      const payment = (rows[0] as any[])[0];
      if (!payment) return res.status(404).json({ error: "Payment not found" });
      if (payment.status === "confirmed") return res.json({ status: "confirmed", tx_hash: payment.tx_hash, amount_received: payment.amount_received });

      pollAddressForPayment(payment.id, payment.wallet_address, payment.network, payment.currency, payment.amount);
      res.json({ status: payment.status, message: "Checking started" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get payment status
  app.get("/api/merchant/payment/:id", async (req, res) => {
    const shop = await getShopByKey(req);
    if (!shop) return res.status(401).json({ error: "Invalid shop API key or shop not active" });
    try {
      const rows = await db.execute(sql`SELECT * FROM merchant_payments WHERE id = ${req.params.id} AND shop_id = ${shop.id} LIMIT 1`);
      const payment = (rows[0] as any[])[0];
      if (!payment) return res.status(404).json({ error: "Payment not found" });
      res.json({ status: payment.status, tx_hash: payment.tx_hash, amount_received: payment.amount_received, confirmed_at: payment.confirmed_at });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Verify tx hash manually
  app.post("/api/merchant/verify-tx", async (req, res) => {
    const shop = await getShopByKey(req);
    if (!shop) return res.status(401).json({ error: "Invalid shop API key or shop not active" });
    const { payment_id, tx_hash } = req.body;
    if (!payment_id || !tx_hash) return res.status(400).json({ error: "payment_id and tx_hash are required" });
    try {
      const rows = await db.execute(sql`SELECT * FROM merchant_payments WHERE id = ${payment_id} AND shop_id = ${shop.id} LIMIT 1`);
      const payment = (rows[0] as any[])[0];
      if (!payment) return res.status(404).json({ error: "Payment not found" });
      const result = await checkTxOnChain(payment.network, tx_hash, payment.wallet_address, payment.amount);
      if (result.confirmed) {
        const amount = result.amount ?? payment.amount;
        await db.execute(sql`UPDATE merchant_payments SET status = 'confirmed', tx_hash = ${tx_hash}, amount_received = ${amount}, confirmed_at = NOW() WHERE id = ${payment_id} AND status = 'pending'`);
        await db.execute(sql`UPDATE merchant_shops SET balance_usdt = balance_usdt + ${parseFloat(amount ?? "0")}, total_received = total_received + ${parseFloat(amount ?? "0")} WHERE id = ${shop.id}`);
        return res.json({ confirmed: true, amount_received: amount });
      }
      res.json({ confirmed: false, message: "Transaction not confirmed on chain" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Admin API for Business module ─────────────────────────────────────────

  // List all shops (admin)
  app.get("/api/admin-business/shops", async (req, res) => {
    const adminKey = req.headers["x-admin-key"] as string;
    if (adminKey !== process.env.SUPER_ADMIN_KEY && adminKey !== process.env.ADMIN_URL) {
      const superUser = process.env.SUPER_ADMIN_USER;
      if (!superUser) return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      const rows = await db.execute(sql`
        SELECT s.*, u.name as user_name, u.tg_username, u.tg_id
        FROM merchant_shops s
        JOIN users u ON u.id = s.user_id
        ORDER BY s.created_at DESC
      `);
      res.json((rows[0] as any[]));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Approve / reject shop (admin)
  app.patch("/api/admin-business/shops/:id", async (req, res) => {
    const { status, adminNote } = req.body;
    if (!status || !["active", "rejected", "suspended"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    try {
      await db.update(merchantShops).set({ status, adminNote: adminNote ?? null }).where(eq(merchantShops.id, parseInt(req.params.id)));
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}
