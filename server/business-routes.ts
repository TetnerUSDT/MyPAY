import { Express, Request, Response } from "express";
import { db } from "./db";
import { sql, eq, desc, and } from "drizzle-orm";
import { merchantShops, merchantPayments, merchantPayoutRequests, merchantWallets, merchantInvoices } from "@shared/schema";
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

// ── Wallet pool helpers ───────────────────────────────────────────────────────

const WALLET_API_URL = process.env.WALLET_API_URL ?? "https://pay.swiftx.online/api/wallet/create";
const WALLET_API_TOKEN = process.env.WALLET_API_KEY ?? "";

// Networks supported by the external wallet API
const SUPPORTED_WALLET_NODES: Record<string, string> = {
  "TRON":    "TRON",
  "BSC":     "BSC",
  "TON":     "TON",
  "POLYGON": "POLYGON",
};

async function generateMerchantWallet(shopId: number, network: string, mode: string = "standard"): Promise<any> {
  const node = SUPPORTED_WALLET_NODES[network];
  if (!node) throw new Error(`Network ${network} is not supported by the wallet API. Supported: ${Object.keys(SUPPORTED_WALLET_NODES).join(", ")}`);

  const body: any = { node };
  if (mode === "gasfree") body.mode = "gasfree";

  const walletRes = await fetch(WALLET_API_URL, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": `Bearer ${WALLET_API_TOKEN}`,
    },
    body: JSON.stringify(body),
  });

  if (!walletRes.ok) {
    const errText = await walletRes.text();
    throw new Error(`Wallet API error ${walletRes.status}: ${errText}`);
  }

  const walletData = await walletRes.json() as any;
  if (!walletData.address) throw new Error(`Wallet API did not return an address. Response: ${JSON.stringify(walletData)}`);

  const result = await db.insert(merchantWallets).values({
    shopId,
    address: walletData.address,
    privateKey: walletData.private_key ?? null,
    network,
    mode,
    gasfreeAddress: walletData.gasfree_address ?? null,
    status: "active",
  }) as any;

  const insertId = result[0]?.insertId;
  const [wallet] = await db.select().from(merchantWallets).where(eq(merchantWallets.id, insertId)).limit(1);
  return wallet;
}

async function releaseExpiredMerchantWallets(shopId: number) {
  await db.execute(sql`
    UPDATE merchant_wallets
    SET external_user_id = NULL, order_id = NULL, reserved_until = NULL, status = 'active'
    WHERE shop_id = ${shopId} AND status = 'reserved' AND reserved_until < NOW()
  `);
}

async function findOrReserveMerchantWallet(
  shopId: number,
  network: string,
  mode: string,
  externalUserId?: string,
  orderId?: string,
  addressMode: string = "permanent",
): Promise<any> {
  await releaseExpiredMerchantWallets(shopId);

  if (addressMode === "permanent" && externalUserId) {
    const existingRows = await db.execute(sql`
      SELECT * FROM merchant_wallets
      WHERE shop_id = ${shopId} AND network = ${network} AND mode = ${mode}
        AND external_user_id = ${externalUserId} AND status = 'permanent'
      LIMIT 1
    `);
    const existing = (existingRows[0] as any[])[0];
    if (existing) return existing;

    const poolRows = await db.execute(sql`
      SELECT * FROM merchant_wallets
      WHERE shop_id = ${shopId} AND network = ${network} AND mode = ${mode}
        AND status = 'active' AND external_user_id IS NULL
      LIMIT 1
    `);
    const poolWallet = (poolRows[0] as any[])[0];
    if (poolWallet) {
      await db.execute(sql`
        UPDATE merchant_wallets SET external_user_id = ${externalUserId}, status = 'permanent'
        WHERE id = ${poolWallet.id}
      `);
      return { ...poolWallet, external_user_id: externalUserId, status: "permanent" };
    }

    const newWallet = await generateMerchantWallet(shopId, network, mode);
    await db.execute(sql`
      UPDATE merchant_wallets SET external_user_id = ${externalUserId}, status = 'permanent'
      WHERE id = ${newWallet.id}
    `);
    return { ...newWallet, external_user_id: externalUserId, status: "permanent" };
  } else {
    const poolRows = await db.execute(sql`
      SELECT * FROM merchant_wallets
      WHERE shop_id = ${shopId} AND network = ${network} AND mode = ${mode}
        AND status = 'active' AND external_user_id IS NULL AND order_id IS NULL
      LIMIT 1
    `);
    const poolWallet = (poolRows[0] as any[])[0];
    const reservedUntil = new Date(Date.now() + 30 * 60 * 1000);

    if (poolWallet) {
      await db.execute(sql`
        UPDATE merchant_wallets
        SET order_id = ${orderId ?? null}, external_user_id = ${externalUserId ?? null},
            reserved_until = ${reservedUntil}, status = 'reserved'
        WHERE id = ${poolWallet.id}
      `);
      return { ...poolWallet, order_id: orderId, reserved_until: reservedUntil, status: "reserved" };
    }

    const newWallet = await generateMerchantWallet(shopId, network, mode);
    await db.execute(sql`
      UPDATE merchant_wallets
      SET order_id = ${orderId ?? null}, external_user_id = ${externalUserId ?? null},
          reserved_until = ${reservedUntil}, status = 'reserved'
      WHERE id = ${newWallet.id}
    `);
    return { ...newWallet, order_id: orderId, reserved_until: reservedUntil, status: "reserved" };
  }
}

// ── Blockchain scanner helper ─────────────────────────────────────────────────

async function checkTxOnChain(network: string, txHash: string, toAddress: string, expectedAmount?: string): Promise<{ confirmed: boolean; amount?: string }> {
  try {
    if (network === "TRON" || network === "TRC20") {
      const url = `https://apilist.tronscanapi.com/api/transaction-info?hash=${txHash}`;
      const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
      const data = await r.json() as any;
      if (!data || !data.confirmed) return { confirmed: false };
      const transfers = data.trc20TransferInfo ?? [];
      const match = transfers.find((t: any) => t.to_address?.toLowerCase() === toAddress.toLowerCase());
      if (!match) return { confirmed: false };
      const amount = (parseInt(match.amount_str ?? "0") / 1e6).toFixed(6);
      return { confirmed: true, amount };
    }
    if (network === "BSC" || network === "BEP20") {
      const url = `https://api.bscscan.com/api?module=transaction&action=gettxreceiptstatus&txhash=${txHash}&apikey=YourApiKeyToken`;
      const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
      const data = await r.json() as any;
      if (data.result?.status === "1") return { confirmed: true, amount: expectedAmount };
      return { confirmed: false };
    }
    return { confirmed: false };
  } catch {
    return { confirmed: false };
  }
}

// ── Poll for payment on address ───────────────────────────────────────────────

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

      if (network === "TRON" || network === "TRC20") {
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
            total_received = total_received + ${parseFloat(txAmount)}
            WHERE id = (SELECT shop_id FROM merchant_payments WHERE id = ${paymentId})
          `);
          found = true;
        }
      }

      if (network === "BSC" || network === "BEP20") {
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
            total_received = total_received + ${parseFloat(txAmount)}
            WHERE id = (SELECT shop_id FROM merchant_payments WHERE id = ${paymentId})
          `);
          found = true;
        }
      }

      if (!found && Date.now() < deadline) setTimeout(check, interval);
    } catch {
      if (Date.now() < deadline) setTimeout(check, interval);
    }
  };

  setTimeout(check, interval);
}

// ── Invoice payment poller ────────────────────────────────────────────────────

async function pollInvoiceForPayment(
  invoiceId: number, address: string, network: string,
  currency: string, expectedAmount: string, shopId: number,
  webhookUrl: string | null, orderRef: string | null,
) {
  const deadline = Date.now() + 30 * 60 * 1000;
  const interval = 20000;

  const check = async () => {
    if (Date.now() > deadline) {
      await db.execute(sql`UPDATE merchant_invoices SET status = 'expired' WHERE id = ${invoiceId} AND status = 'pending'`);
      return;
    }
    try {
      const rows = await db.execute(sql`SELECT status FROM merchant_invoices WHERE id = ${invoiceId} LIMIT 1`);
      const inv = (rows[0] as any[])[0];
      if (!inv || inv.status !== "pending") return;

      let found = false;
      let txHash: string | null = null;
      let amountReceived: string | null = null;

      if (network === "TRON") {
        const url = `https://apilist.tronscanapi.com/api/transfer/trc20?limit=5&start=0&toAddress=${address}&tokenName=USDT`;
        const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
        const data = await r.json() as any;
        const txs: any[] = data.data ?? [];
        if (txs.length > 0) {
          txHash = txs[0].transactionId;
          amountReceived = (parseInt(txs[0].amount ?? "0") / 1e6).toFixed(6);
          found = true;
        }
      } else if (network === "BSC") {
        const url = `https://api.bscscan.com/api?module=account&action=tokentx&address=${address}&contractaddress=0x55d398326f99059fF775485246999027B3197955&sort=desc&offset=5&page=1`;
        const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
        const data = await r.json() as any;
        const txs: any[] = data.result ?? [];
        if (txs.length > 0 && txs[0].to?.toLowerCase() === address.toLowerCase()) {
          txHash = txs[0].hash;
          amountReceived = (parseInt(txs[0].value ?? "0") / 1e18).toFixed(6);
          found = true;
        }
      }

      if (found && txHash) {
        await db.execute(sql`
          UPDATE merchant_invoices
          SET status = 'confirmed', tx_hash = ${txHash}, amount_received = ${amountReceived}, confirmed_at = NOW()
          WHERE id = ${invoiceId} AND status = 'pending'
        `);
        await db.execute(sql`
          UPDATE merchant_shops SET balance_usdt = balance_usdt + ${parseFloat(amountReceived ?? "0")},
          total_received = total_received + ${parseFloat(amountReceived ?? "0")}
          WHERE id = ${shopId}
        `);
        if (webhookUrl) {
          sendWebhook(webhookUrl, {
            event: "invoice.confirmed",
            invoice_number: (await db.execute(sql`SELECT invoice_number FROM merchant_invoices WHERE id = ${invoiceId} LIMIT 1`) as any)[0]?.[0]?.invoice_number,
            order_ref: orderRef,
            amount_received: amountReceived,
            currency,
            network,
            tx_hash: txHash,
          });
        }
      } else if (!found && Date.now() < deadline) {
        setTimeout(check, interval);
      }
    } catch {
      if (Date.now() < deadline) setTimeout(check, interval);
    }
  };

  setTimeout(check, interval);
}

// ── Invoice number generator ──────────────────────────────────────────────────

function generateInvoiceNumber(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = randomBytes(3).toString("hex").toUpperCase();
  return `INV-${ts}-${rand}`;
}

function generatePayoutRef(): string {
  return `MyPay-${randomBytes(4).toString("hex").toUpperCase()}`;
}

// ── Webhook sender ────────────────────────────────────────────────────────────

async function sendWebhook(webhookUrl: string, payload: object): Promise<void> {
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
  } catch (e) {
    console.warn("[Webhook] Failed to deliver:", e);
  }
}

// ── Wallet balance on-chain check ─────────────────────────────────────────────

// TON USDT jetton master address
const TON_USDT_MASTER = "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs";

async function checkWalletBalanceOnChain(network: string, address: string): Promise<number | null> {
  try {
    if (network === "TRON") {
      const url = `https://apilist.tronscanapi.com/api/accountv2?address=${address}`;
      const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!r.ok) return null;
      const data = await r.json() as any;
      const tokens: any[] = data.trc20token_balances ?? [];
      const usdt = tokens.find((t: any) => t.tokenAbbr === "USDT" || t.tokenName === "Tether USD");
      if (usdt) return parseFloat(usdt.balance) / Math.pow(10, usdt.tokenDecimal ?? 6);
      return 0;
    }
    if (network === "BSC") {
      // USDT BEP20 contract
      const contract = "0x55d398326f99059fF775485246999027B3197955";
      const url = `https://api.bscscan.com/api?module=account&action=tokenbalance&contractaddress=${contract}&address=${address}&tag=latest`;
      const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!r.ok) return null;
      const data = await r.json() as any;
      if (data.status === "1" && data.result) return parseFloat(data.result) / 1e18;
      // BSCScan returned error — not a fatal failure, return null to try fallback
      return null;
    }
    if (network === "TON") {
      // Use tonapi.io free public API to get jetton balance
      const url = `https://tonapi.io/v2/accounts/${encodeURIComponent(address)}/jettons/${TON_USDT_MASTER}`;
      const r = await fetch(url, {
        headers: { "Accept": "application/json" },
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) return null;
      const data = await r.json() as any;
      // balance is in nano-units (6 decimals for USDT on TON)
      const raw = data.balance ?? data.jetton?.balance ?? "0";
      return parseFloat(raw) / 1e6;
    }
    if (network === "POLYGON") {
      // USDT (or DAI) on Polygon — check via polygonscan
      const usdtContract = "0xc2132D05D31c914a87C6611C10748AEb04B58e8F"; // USDT on Polygon
      const url = `https://api.polygonscan.com/api?module=account&action=tokenbalance&contractaddress=${usdtContract}&address=${address}&tag=latest`;
      const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!r.ok) return null;
      const data = await r.json() as any;
      if (data.status === "1" && data.result) return parseFloat(data.result) / 1e6;
      return null;
    }
    return null;
  } catch {
    return null;
  }
}

async function checkWalletBalanceViaApi(network: string, address: string): Promise<number | null> {
  try {
    const node = SUPPORTED_WALLET_NODES[network];
    if (!node) return null;
    const BALANCE_API_URL = WALLET_API_URL.replace("/wallet/create", "/wallet/balance");
    const r = await fetch(`${BALANCE_API_URL}?node=${node}&address=${address}`, {
      headers: { "Authorization": `Bearer ${WALLET_API_TOKEN}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return null;
    const data = await r.json() as any;
    // Handle various response shapes
    return data.data?.usdt
      ?? data.balance?.usdt
      ?? data.usdt
      ?? data.data?.balance
      ?? data.result?.usdt
      ?? null;
  } catch {
    return null;
  }
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
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Get single shop
  app.get("/api/business/shops/:id", requireApiKey, async (req, res) => {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    try {
      const [shop] = await db.select().from(merchantShops).where(and(eq(merchantShops.id, parseInt(req.params.id)), eq(merchantShops.userId, user.id))).limit(1);
      if (!shop) return res.status(404).json({ error: "Shop not found" });
      res.json(shop);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
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
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Update shop settings
  app.patch("/api/business/shops/:id", requireApiKey, async (req, res) => {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const { name, domain, webhookUrl, addressMode, enabledNetworks } = req.body;
    const shopId = parseInt(req.params.id);
    try {
      const [shop] = await db.select().from(merchantShops).where(and(eq(merchantShops.id, shopId), eq(merchantShops.userId, user.id))).limit(1);
      if (!shop) return res.status(404).json({ error: "Shop not found" });
      const updates: any = {};
      if (name) updates.name = name;
      if (domain) updates.domain = domain;
      if (webhookUrl !== undefined) updates.webhookUrl = webhookUrl;
      if (addressMode && ["permanent", "temporary", "invoice"].includes(addressMode)) updates.addressMode = addressMode;
      if (enabledNetworks !== undefined) {
        updates.enabledNetworks = Array.isArray(enabledNetworks) ? JSON.stringify(enabledNetworks) : enabledNetworks;
      }
      await db.update(merchantShops).set(updates).where(eq(merchantShops.id, shopId));
      const [updated] = await db.select().from(merchantShops).where(eq(merchantShops.id, shopId)).limit(1);
      res.json(updated);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
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
    } catch (err: any) { res.status(500).json({ error: err.message }); }
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
    } catch (err: any) { res.status(500).json({ error: err.message }); }
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
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Create payout request (manual from cabinet)
  app.post("/api/business/shops/:id/payouts", requireApiKey, async (req, res) => {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const shopId = parseInt(req.params.id);
    const { toAddress, network, currency, amount, note, fromWalletId } = req.body;
    if (!toAddress || !network || !amount) return res.status(400).json({ error: "toAddress, network, amount are required" });
    try {
      const [shop] = await db.select().from(merchantShops).where(and(eq(merchantShops.id, shopId), eq(merchantShops.userId, user.id))).limit(1);
      if (!shop) return res.status(404).json({ error: "Shop not found" });
      if (shop.status !== "active") return res.status(403).json({ error: "Shop is not active" });
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) return res.status(400).json({ error: "Invalid amount" });
      if (parseFloat(shop.balanceUsdt) < amountNum) return res.status(400).json({ error: "Insufficient balance" });

      // Validate fromWallet belongs to shop if provided
      let resolvedFromWalletId: number | null = fromWalletId ? parseInt(fromWalletId) : null;
      if (resolvedFromWalletId) {
        const wRows = await db.execute(sql`SELECT id FROM merchant_wallets WHERE id = ${resolvedFromWalletId} AND shop_id = ${shopId} LIMIT 1`);
        if (!(wRows[0] as any[])[0]) resolvedFromWalletId = null;
      }

      const reference = generatePayoutRef();
      await db.transaction(async (tx) => {
        await tx.update(merchantShops).set({ balanceUsdt: sql`balance_usdt - ${amountNum}` }).where(eq(merchantShops.id, shopId));
        await tx.insert(merchantPayoutRequests).values({
          shopId,
          toAddress,
          network,
          currency: currency || "USDT",
          amount: String(amountNum),
          note: note || null,
          status: "pending",
          source: "manual",
          fromWalletId: resolvedFromWalletId,
          reference,
        });
      });

      // If fromWalletId specified, attempt blockchain transfer via wallet API
      if (resolvedFromWalletId) {
        const wRows = await db.execute(sql`SELECT address, network, mode FROM merchant_wallets WHERE id = ${resolvedFromWalletId} LIMIT 1`);
        const fromWallet = (wRows[0] as any[])[0];
        if (fromWallet) {
          const TRANSFER_URL = WALLET_API_URL.replace("/wallet/create", "/wallet/transfer");
          const node = SUPPORTED_WALLET_NODES[fromWallet.network] ?? fromWallet.network;
          fetch(TRANSFER_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${WALLET_API_TOKEN}` },
            body: JSON.stringify({ node, address_from: fromWallet.address, address_to: toAddress, amount: amountNum, symbol: "USDT" }),
            signal: AbortSignal.timeout(30000),
          }).then(async (r) => {
            const d = await r.json() as any;
            if (d.success && d.data?.txid) {
              await db.execute(sql`UPDATE merchant_payout_requests SET status = 'completed', tx_hash = ${d.data.txid}, processed_at = NOW() WHERE reference = ${reference}`);
              await db.execute(sql`UPDATE merchant_shops SET total_paid_out = total_paid_out + ${amountNum} WHERE id = ${shopId}`);
            }
          }).catch(() => {});
        }
      }

      res.json({ ok: true, message: "Payout request created", reference });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Update payout status
  app.patch("/api/business/shops/:id/payouts/:payoutId", requireApiKey, async (req, res) => {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const shopId = parseInt(req.params.id);
    const payoutId = parseInt(req.params.payoutId);
    const { status, txHash } = req.body;
    if (!status || !["processing", "completed", "cancelled"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
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
        // Send webhook for API-sourced payouts
        if ((payout as any).source === "api" && shop.webhookUrl) {
          sendWebhook(shop.webhookUrl, {
            event: "payout.completed",
            payout_id: payoutId,
            external_order_id: (payout as any).externalOrderId,
            reference: (payout as any).reference,
            to_address: payout.toAddress,
            network: payout.network,
            amount: payout.amount,
            currency: payout.currency,
            tx_hash: txHash ?? payout.txHash,
          });
        }
      }
      if (status === "cancelled") {
        await db.update(merchantShops).set({ balanceUsdt: sql`balance_usdt + ${parseFloat(payout.amount)}` }).where(eq(merchantShops.id, shopId));
      }
      await db.update(merchantPayoutRequests).set(updates).where(eq(merchantPayoutRequests.id, payoutId));
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── Merchant Wallets (cabinet) ────────────────────────────────────────────

  // List wallets for shop
  app.get("/api/business/shops/:id/wallets", requireApiKey, async (req, res) => {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const shopId = parseInt(req.params.id);
    try {
      const [shop] = await db.select().from(merchantShops).where(and(eq(merchantShops.id, shopId), eq(merchantShops.userId, user.id))).limit(1);
      if (!shop) return res.status(404).json({ error: "Shop not found" });
      const wallets = await db.select().from(merchantWallets).where(eq(merchantWallets.shopId, shopId)).orderBy(desc(merchantWallets.createdAt)).limit(200);
      res.json(wallets);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Pre-generate a wallet for the pool
  app.post("/api/business/shops/:id/wallets/generate", requireApiKey, async (req, res) => {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const shopId = parseInt(req.params.id);
    const { network, mode } = req.body;
    if (!network) return res.status(400).json({ error: "network is required" });
    try {
      const [shop] = await db.select().from(merchantShops).where(and(eq(merchantShops.id, shopId), eq(merchantShops.userId, user.id))).limit(1);
      if (!shop) return res.status(404).json({ error: "Shop not found" });
      if (shop.status !== "active") return res.status(403).json({ error: "Shop must be active to generate wallets" });

      const enabledNetworks: string[] = shop.enabledNetworks ? JSON.parse(shop.enabledNetworks) : [];
      const netKey = (network === "TRON" && mode === "gasfree") ? "TRON_GF" : network;
      if (enabledNetworks.length > 0 && !enabledNetworks.includes(netKey)) {
        return res.status(400).json({ error: `Network ${netKey} is not enabled for this shop` });
      }

      const wallet = await generateMerchantWallet(shopId, network, mode ?? "standard");
      res.json(wallet);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
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

  // Generate/get address for payment (or invoice URL in invoice mode)
  app.post("/api/merchant/address", async (req, res) => {
    const shop = await getShopByKey(req);
    if (!shop) return res.status(401).json({ error: "Invalid shop API key or shop not active" });
    const { user_id, order_id, network, mode, currency, amount, networks: networksOverride } = req.body;

    // ── Invoice mode ─────────────────────────────────────────────────────────
    if (shop.address_mode === "invoice") {
      if (!amount) return res.status(400).json({ error: "amount is required for invoice mode" });
      const enabledNetworks: string[] = shop.enabled_networks ? JSON.parse(shop.enabled_networks) : [];
      const invoiceNetworks: string[] = networksOverride
        ? (Array.isArray(networksOverride) ? networksOverride : [networksOverride])
        : (network ? [network] : enabledNetworks);
      if (invoiceNetworks.length === 0) return res.status(400).json({ error: "No networks specified or enabled" });

      const invoiceNumber = generateInvoiceNumber();
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
      try {
        await db.insert(merchantInvoices).values({
          shopId: shop.id,
          invoiceNumber,
          orderRef: order_id ?? null,
          amount: String(amount),
          currency: currency ?? "USDT",
          networks: JSON.stringify(invoiceNetworks),
          status: "pending",
          expiresAt,
        });
        const appBase = process.env.APP_URL ?? `https://${process.env.REPLIT_DOMAINS?.split(",")[0] ?? "localhost:5000"}`;
        return res.json({
          type: "invoice",
          invoice_number: invoiceNumber,
          invoice_url: `${appBase}/pay/${invoiceNumber}`,
          amount,
          currency: currency ?? "USDT",
          networks: invoiceNetworks,
          expires_at: expiresAt,
        });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    }

    // ── Standard address mode ────────────────────────────────────────────────
    if (!network) return res.status(400).json({ error: "network is required" });

    // Validate against enabled networks
    const enabledNetworks: string[] = shop.enabled_networks ? JSON.parse(shop.enabled_networks) : [];
    if (enabledNetworks.length > 0) {
      const netKey = (network === "TRON" && mode === "gasfree") ? "TRON_GF" : network;
      if (!enabledNetworks.includes(netKey)) {
        return res.status(400).json({ error: `Network ${netKey} is not enabled for this shop` });
      }
    }

    try {
      const walletMode = mode === "gasfree" ? "gasfree" : "standard";
      const wallet = await findOrReserveMerchantWallet(shop.id, network, walletMode, user_id, order_id, shop.address_mode);

      const address = walletMode === "gasfree" ? (wallet.gasfree_address || wallet.address) : wallet.address;
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
        mode: walletMode,
        currency: currency ?? "USDT",
        type: isTemp ? "temporary" : "permanent",
        payment_id: paymentId,
        expires_at: expiresAt,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Trigger payment check
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
    } catch (err: any) { res.status(500).json({ error: err.message }); }
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
    } catch (err: any) { res.status(500).json({ error: err.message }); }
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
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── Public Invoice endpoints ─────────────────────────────────────────────

  // Get invoice details (public — used by /pay/:invoiceNumber page)
  app.get("/api/merchant/invoice/:number", async (req, res) => {
    try {
      const rows = await db.execute(sql`
        SELECT i.*, s.name AS shop_name, s.webhook_url
        FROM merchant_invoices i
        JOIN merchant_shops s ON s.id = i.shop_id
        WHERE i.invoice_number = ${req.params.number}
        LIMIT 1
      `);
      const inv = (rows[0] as any[])[0];
      if (!inv) return res.status(404).json({ error: "Invoice not found" });

      // Auto-expire
      if (inv.status === "pending" && inv.expires_at && new Date(inv.expires_at) < new Date()) {
        await db.execute(sql`UPDATE merchant_invoices SET status = 'expired' WHERE id = ${inv.id}`);
        inv.status = "expired";
      }

      return res.json({
        invoice_number: inv.invoice_number,
        shop_name: inv.shop_name,
        order_ref: inv.order_ref,
        amount: inv.amount,
        currency: inv.currency,
        networks: inv.networks ? JSON.parse(inv.networks) : [],
        status: inv.status,
        wallet_address: inv.wallet_address,
        network_chosen: inv.network_chosen,
        expires_at: inv.expires_at,
        confirmed_at: inv.confirmed_at,
        tx_hash: inv.tx_hash,
      });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Customer selects network → reserve wallet for invoice
  app.post("/api/merchant/invoice/:number/select-network", async (req, res) => {
    const { network } = req.body;
    if (!network) return res.status(400).json({ error: "network is required" });
    try {
      const rows = await db.execute(sql`
        SELECT i.*, s.webhook_url, s.enabled_networks, s.address_mode
        FROM merchant_invoices i
        JOIN merchant_shops s ON s.id = i.shop_id
        WHERE i.invoice_number = ${req.params.number}
        LIMIT 1
      `);
      const inv = (rows[0] as any[])[0];
      if (!inv) return res.status(404).json({ error: "Invoice not found" });
      if (inv.status !== "pending") return res.status(400).json({ error: `Invoice is ${inv.status}` });
      if (inv.expires_at && new Date(inv.expires_at) < new Date()) {
        await db.execute(sql`UPDATE merchant_invoices SET status = 'expired' WHERE id = ${inv.id}`);
        return res.status(400).json({ error: "Invoice expired" });
      }
      if (inv.wallet_address) {
        return res.json({ address: inv.wallet_address, network: inv.network_chosen, expires_at: inv.expires_at });
      }

      // Validate network against invoice allowed networks
      const allowedNets: string[] = inv.networks ? JSON.parse(inv.networks) : [];
      if (allowedNets.length > 0 && !allowedNets.includes(network)) {
        return res.status(400).json({ error: `Network ${network} not allowed for this invoice` });
      }

      const wallet = await findOrReserveMerchantWallet(inv.shop_id, network, "standard", undefined, inv.invoice_number, "temporary");
      const address = wallet.gasfree_address || wallet.address;
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

      await db.execute(sql`
        UPDATE merchant_invoices
        SET wallet_id = ${wallet.id}, wallet_address = ${address}, network_chosen = ${network}, expires_at = ${expiresAt}
        WHERE id = ${inv.id}
      `);

      // Start polling for this invoice payment
      pollInvoiceForPayment(inv.id, address, network, inv.currency, inv.amount, inv.shop_id, inv.webhook_url, inv.order_ref);

      return res.json({ address, network, expires_at: expiresAt });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── Public API Payout (for merchant projects, not cabinet) ────────────────

  app.post("/api/merchant/payout", async (req, res) => {
    const shop = await getShopByKey(req);
    if (!shop) return res.status(401).json({ error: "Invalid shop API key or shop not active" });
    const { to_address, network, currency, amount, order_id } = req.body;
    if (!to_address || !network || !amount) return res.status(400).json({ error: "to_address, network, amount required" });
    if (shop.status !== "active") return res.status(403).json({ error: "Shop not active" });

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) return res.status(400).json({ error: "Invalid amount" });

    try {
      const shopRows = await db.execute(sql`SELECT balance_usdt FROM merchant_shops WHERE id = ${shop.id} FOR UPDATE`);
      const balance = parseFloat((shopRows[0] as any[])[0]?.balance_usdt ?? "0");
      if (balance < amountNum) return res.status(400).json({ error: "Insufficient balance" });

      const reference = order_id ? `API-${order_id}` : generatePayoutRef();
      await db.execute(sql`UPDATE merchant_shops SET balance_usdt = balance_usdt - ${amountNum} WHERE id = ${shop.id}`);
      const result = await db.execute(sql`
        INSERT INTO merchant_payout_requests
          (shop_id, to_address, network, currency, amount, status, source, external_order_id, reference)
        VALUES
          (${shop.id}, ${to_address}, ${network}, ${currency ?? "USDT"}, ${amountNum}, 'pending', 'api', ${order_id ?? null}, ${reference})
      `) as any;

      return res.json({ ok: true, payout_id: result[0]?.insertId, reference });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── Wallet balance check (cabinet) ────────────────────────────────────────

  app.post("/api/business/shops/:id/wallets/:wid/check-balance", requireApiKey, async (req, res) => {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const shopId = parseInt(req.params.id);
    const walletId = parseInt(req.params.wid);
    try {
      const [shop] = await db.select().from(merchantShops).where(and(eq(merchantShops.id, shopId), eq(merchantShops.userId, user.id))).limit(1);
      if (!shop) return res.status(404).json({ error: "Shop not found" });

      const rows = await db.execute(sql`SELECT * FROM merchant_wallets WHERE id = ${walletId} AND shop_id = ${shopId} LIMIT 1`);
      const wallet = (rows[0] as any[])[0];
      if (!wallet) return res.status(404).json({ error: "Wallet not found" });

      // Try on-chain check first, fall back to wallet API
      let balance = await checkWalletBalanceOnChain(wallet.network, wallet.address);
      if (balance === null) {
        balance = await checkWalletBalanceViaApi(wallet.network, wallet.address);
      }

      // If all checks failed but network is known, save 0 rather than returning error
      if (balance === null && SUPPORTED_WALLET_NODES[wallet.network]) {
        balance = 0;
      }

      if (balance !== null) {
        await db.execute(sql`
          UPDATE merchant_wallets SET balance_usdt = ${balance}, balance_updated_at = NOW()
          WHERE id = ${walletId}
        `);
        return res.json({ balance_usdt: balance, updated_at: new Date() });
      }

      return res.status(503).json({ error: "Balance check unavailable for this network" });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── Admin API for Business module ─────────────────────────────────────────

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
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.patch("/api/admin-business/shops/:id", async (req, res) => {
    const { status, adminNote } = req.body;
    if (!status || !["active", "rejected", "suspended", "pending"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    try {
      await db.update(merchantShops).set({ status, adminNote: adminNote ?? null }).where(eq(merchantShops.id, parseInt(req.params.id)));
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
}
