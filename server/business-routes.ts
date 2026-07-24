import { Express, Request, Response } from "express";
import { leaseKey, recordKeyError, recordKeySuccess } from "./merchant-key-rotator";
import { getProviderChain, callWithFallback } from "./scanner/index";
import { getEvmTransfers, evmJsonRpc as evmJsonRpcAdapter, hexAmountToDecimal as hexAmtToDecimal } from "./scanner/adapters/evm";
import { getTronTransfers } from "./scanner/adapters/tron";
import { getTonTransfers } from "./scanner/adapters/ton";
import { getSolanaTransfers } from "./scanner/adapters/solana";
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
  "TRON":     "TRON",
  "BSC":      "BSC",
  "TON":      "TON",
  "POLYGON":  "POLYGON",
  "ETH":      "ETH",
  "ARBITRUM": "ARBITRUM",
  "SOLANA":   "SOLANA",
};

// Wallet API uses network-specific coin symbols (e.g. BSC USDT = "BSC-USD", not "USDT")
const WALLET_API_SYMBOL: Record<string, Record<string, string>> = {
  "BSC":      { "USDT": "BSC-USD", "BNB": "BNB" },
  "TRON":     { "USDT": "USDT", "TRX": "TRX", "USDC": "USDC" },
  "TON":      { "USDT": "USDT", "TON": "TON" },
  "POLYGON":  { "USDT": "USDT", "MATIC": "MATIC", "POL": "MATIC", "DAI": "DAI", "USDC": "USDC" },
  "ETH":      { "USDT": "USDT", "ETH": "ETH", "USDC": "USDC" },
  "ARBITRUM": { "USDT": "USDT", "ARB": "ARB", "USDC": "USDC" },
};

function resolveWalletSymbol(network: string, currency: string): string {
  const upper = currency.toUpperCase();
  return WALLET_API_SYMBOL[network]?.[upper] ?? upper;
}

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

async function releaseMerchantWalletForInvoice(invoiceId: number) {
  try {
    await db.execute(sql`
      UPDATE merchant_wallets mw
      JOIN merchant_invoices mi ON mi.wallet_id = mw.id
      SET mw.status = 'active', mw.order_id = NULL, mw.reserved_until = NULL, mw.external_user_id = NULL
      WHERE mi.id = ${invoiceId} AND mw.status = 'reserved'
    `);
  } catch { /* non-fatal */ }
}

async function findOrReserveMerchantWallet(
  shopId: number,
  network: string,
  mode: string,
  externalUserId?: string,
  orderId?: string,
  addressMode: string = "permanent",
  reserveMinutes: number = 30,
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
    const reservedUntil = new Date(Date.now() + reserveMinutes * 60 * 1000);

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

// ── BSC constants ─────────────────────────────────────────────────────────────

const BSC_USDT_CONTRACT = "0x55d398326f99059fF775485246999027B3197955";
// NOTE on BscScan API: V1 is deprecated (NOTOK), V2 via api.etherscan.io requires
// a paid Etherscan plan for BSC (chainid=56). Only public JSON-RPC eth_getLogs works free.
const BSC_ACCEPTED_CONTRACTS: Record<string, string> = {
  [BSC_USDT_CONTRACT.toLowerCase()]:             "USDT",
  "0xe9e7cea3dedca5984780bafc599bd69add087d56":  "BUSD",
};

// EVM network configs (used for tx confirmation checks only — scanning now via ProviderRegistry)
const EVM_NETWORKS: Record<string, { rpcs: string[]; usdtContract: string; decimals: number }> = {
  ETH: {
    rpcs: ["https://eth.llamarpc.com", "https://rpc.ankr.com/eth"],
    usdtContract: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    decimals: 6,
  },
  ARBITRUM: {
    rpcs: ["https://arb1.arbitrum.io/rpc", "https://rpc.ankr.com/arbitrum"],
    usdtContract: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    decimals: 6,
  },
  POLYGON: {
    rpcs: ["https://polygon-rpc.com", "https://rpc.ankr.com/polygon"],
    usdtContract: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    decimals: 6,
  },
};

const ERC20_TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

function hexAmountToDecimal(hexRaw: string, decimals: number): string {
  return hexAmtToDecimal(hexRaw, decimals);
}

async function evmRpc(rpcs: string[], method: string, params: any[]): Promise<any> {
  for (const rpc of rpcs) {
    try {
      const r = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(8000),
      });
      const data = await r.json() as any;
      if (data.result !== undefined && !data.error) return data.result;
    } catch { /* try next */ }
  }
  return null;
}

// BSC-specific for tx confirmation (uses provider chain)
async function bscRpc(method: string, params: any[]): Promise<any> {
  const chain = await getProviderChain("BSC");
  const active = chain.filter(c => c.enabled === 1);
  for (const cfg of active) {
    try {
      const { result } = await callWithFallback([cfg], async (p) => {
        return await evmJsonRpcAdapter(p, method, params);
      });
      if (result !== null) return result;
    } catch { /* try next */ }
  }
  return null;
}

const SOLANA_USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";

// Legacy stub for tx confirmation in checkTxOnChain
async function solanaRpc(method: string, params: any[]): Promise<any> {
  const chain = await getProviderChain("SOL");
  const { result } = await callWithFallback(chain, async (cfg) => {
    const { getSolanaRpcResult } = await import("./scanner/adapters/solana");
    return getSolanaRpcResult(cfg, method, params);
  });
  return result;
}

// ── Blockchain scanner functions (now driven by ProviderRegistry) ─────────────

/**
 * Scan BSC for recent incoming USDT or BUSD.
 * Uses ProviderRegistry to get ordered provider chain, tries each with fallback.
 * For providers with max_block_range (e.g. 1rpc.io = 49), makes parallel chunked requests.
 */
async function bscScanIncoming(address: string): Promise<{ hash: string; value: string; to: string; blockNumber?: number }[]> {
  const chain = await getProviderChain("BSC");
  const contractEntries = Object.entries(BSC_ACCEPTED_CONTRACTS);
  const BLOCK_COVERAGE = 5760; // ~4.8 hours at 3s/block — large enough to cover slow payers

  const { result, errors } = await callWithFallback(chain, async (cfg) => {
    const seen = new Set<string>();
    const results: { hash: string; value: string; to: string; blockNumber?: number }[] = [];
    let providerErrors = 0;

    for (const [contract, label] of contractEntries) {
      try {
        const transfers = await getEvmTransfers(cfg, address, contract, BLOCK_COVERAGE);
        for (const t of transfers) {
          if (!seen.has(t.txHash)) {
            seen.add(t.txHash);
            console.log(`[BSC] ${cfg.provider_code} ${label}: found ${transfers.length} transfer(s), tx=${t.txHash}`);
            results.push({ hash: t.txHash, value: t.amountRaw, to: address, blockNumber: t.blockNumber });
          }
        }
      } catch (err: any) {
        providerErrors++;
      }
    }

    // If every contract scan failed, this is a provider-level error — throw to try next provider
    if (providerErrors === contractEntries.length) {
      throw new Error(`${cfg.provider_code} failed for all contracts on BSC`);
    }

    return results;
  });

  if (result === null) {
    if (errors.length > 0) console.warn("[BSC] all providers failed:", errors.map(e => `${e.provider}: ${e.error}`).join("; "));
    return [];
  }
  if (result.length === 0) {
    const mins = Math.round(BLOCK_COVERAGE * 3 / 60);
    console.log(`[BSC] no USDT/BUSD to ${address} in last ~${mins} min`);
  }
  return result;
}

/**
 * Scan TRON address for incoming USDT.
 * Uses ProviderRegistry — TronScan (free) first, TronGrid (optional key) second.
 */
async function scanTronIncoming(address: string): Promise<{ txHash: string; amountRaw: string }[]> {
  const chain = await getProviderChain("TRON");
  const { result, errors } = await callWithFallback(chain, async (cfg) => {
    return await getTronTransfers(cfg, address);
  });
  if (result === null) {
    if (errors.length > 0) console.warn("[TRON] all providers failed:", errors.map(e => `${e.provider}: ${e.error}`).join("; "));
    return [];
  }
  return result;
}

/**
 * Scan TON address for incoming USDT Jetton.
 * Uses ProviderRegistry — TonCenter (optional key).
 */
async function scanTonIncoming(address: string): Promise<{ txHash: string; amountRaw: string }[]> {
  const chain = await getProviderChain("TON");
  const { result, errors } = await callWithFallback(chain, async (cfg) => {
    return await getTonTransfers(cfg, address);
  });
  if (result === null) {
    if (errors.length > 0) console.warn("[TON] all providers failed:", errors.map(e => `${e.provider}: ${e.error}`).join("; "));
    return [];
  }
  return result;
}

/**
 * Scan ETH/ARBITRUM/POLYGON address for incoming USDT.
 * Uses ProviderRegistry for the given network.
 */
async function scanEvmIncoming(network: string, address: string): Promise<{ txHash: string; amountRaw: string }[]> {
  const cfg = EVM_NETWORKS[network];
  if (!cfg) return [];

  const chain = await getProviderChain(network);
  if (chain.length === 0) {
    // Fallback to hardcoded RPCs if no provider config yet
    const paddedAddress = "0x000000000000000000000000" + address.slice(2).toLowerCase();
    const latestBlock = await evmRpc(cfg.rpcs, "eth_blockNumber", []);
    if (!latestBlock) return [];
    const fromBlock = "0x" + Math.max(0, parseInt(latestBlock, 16) - 2000).toString(16);
    const logs = await evmRpc(cfg.rpcs, "eth_getLogs", [{
      address: cfg.usdtContract,
      topics: [ERC20_TRANSFER_TOPIC, null, paddedAddress],
      fromBlock, toBlock: "latest",
    }]);
    if (!Array.isArray(logs)) return [];
    return logs.map((log: any) => ({ txHash: log.transactionHash, amountRaw: log.data }));
  }

  const { result, errors } = await callWithFallback(chain, async (p) => {
    return await getEvmTransfers(p, address, cfg.usdtContract, 2000);
  });
  if (result === null) {
    if (errors.length > 0) console.warn(`[${network}] all providers failed:`, errors.map(e => `${e.provider}: ${e.error}`).join("; "));
    return [];
  }
  return result.map(t => ({ txHash: t.txHash, amountRaw: t.amountRaw }));
}

/**
 * Scan Solana address for incoming USDT SPL.
 * Uses ProviderRegistry — PublicNode first, Solana mainnet second, Helius (keyed) third.
 */
async function scanSolanaIncoming(address: string): Promise<{ txHash: string; amountRaw: string }[]> {
  const chain = await getProviderChain("SOL");
  const { result, errors } = await callWithFallback(chain, async (cfg) => {
    return await getSolanaTransfers(cfg, address);
  });
  if (result === null) {
    if (errors.length > 0) console.warn("[SOL] all providers failed:", errors.map(e => `${e.provider}: ${e.error}`).join("; "));
    return [];
  }
  return result;
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
      const receipt = await bscRpc("eth_getTransactionReceipt", [txHash]);
      if (!receipt || receipt.status !== "0x1") return { confirmed: false };
      const paddedTo = "0x000000000000000000000000" + toAddress.slice(2).toLowerCase();
      const transferLog = (receipt.logs as any[]).find((log: any) =>
        log.address?.toLowerCase() === BSC_USDT_CONTRACT.toLowerCase() &&
        log.topics?.[2]?.toLowerCase() === paddedTo
      );
      if (!transferLog) return { confirmed: false };
      const amount = hexAmountToDecimal(transferLog.data, 18);
      return { confirmed: true, amount };
    }
    if (network === "TON") {
      // TonCenter v3: find the jetton transfer to toAddress, verify USDT mint + amount
      try {
        const r = await fetch(
          `https://toncenter.com/api/v3/jetton/transfers?direction=in&address=${encodeURIComponent(toAddress)}&limit=20`,
          { headers: { "Accept": "application/json" }, signal: AbortSignal.timeout(10000) }
        );
        if (!r.ok) return { confirmed: false };
        const data = await r.json() as any;
        const transfers = (data.jetton_transfers ?? []) as any[];
        const match = transfers.find((t: any) =>
          t.transaction_hash === txHash &&
          t.jetton_master?.toLowerCase() === TON_USDT_MASTER_ADDR.toLowerCase()
        );
        if (!match) return { confirmed: false };
        const amount = parseRawAmount(match.amount ?? "0", 6);
        return { confirmed: true, amount };
      } catch {}
      return { confirmed: false };
    }
    if (network === "ETH" || network === "ARBITRUM" || network === "POLYGON") {
      const cfg = EVM_NETWORKS[network];
      if (!cfg) return { confirmed: false };
      const receipt = await evmRpc(cfg.rpcs, "eth_getTransactionReceipt", [txHash]);
      if (!receipt || receipt.status !== "0x1") return { confirmed: false };
      const paddedTo = "0x000000000000000000000000" + toAddress.slice(2).toLowerCase();
      const transferLog = (receipt.logs as any[]).find((log: any) =>
        log.address?.toLowerCase() === cfg.usdtContract.toLowerCase() &&
        log.topics?.[0]?.toLowerCase() === ERC20_TRANSFER_TOPIC &&
        log.topics?.[2]?.toLowerCase() === paddedTo
      );
      if (!transferLog) return { confirmed: false };
      const amount = hexAmountToDecimal(transferLog.data, cfg.decimals);
      return { confirmed: true, amount };
    }
    if (network === "SOLANA") {
      // Solana: verify via token balance delta — confirms mint = USDT, recipient = toAddress, amount > 0
      try {
        const txData = await solanaRpc("getTransaction", [
          txHash,
          { encoding: "jsonParsed", commitment: "confirmed", maxSupportedTransactionVersion: 0 },
        ]);
        if (!txData || txData.meta?.err) return { confirmed: false };
        const preBals  = (txData.meta?.preTokenBalances  ?? []) as any[];
        const postBals = (txData.meta?.postTokenBalances ?? []) as any[];
        const pre  = preBals.find((b: any)  => b.mint === SOLANA_USDT_MINT && b.owner === toAddress);
        const post = postBals.find((b: any) => b.mint === SOLANA_USDT_MINT && b.owner === toAddress);
        if (!post) return { confirmed: false };
        const delta = BigInt(post.uiTokenAmount?.amount ?? "0") - BigInt(pre?.uiTokenAmount?.amount ?? "0");
        if (delta <= BigInt(0)) return { confirmed: false };
        const amount = parseRawAmount(delta.toString(), 6);
        return { confirmed: true, amount };
      } catch {}
      return { confirmed: false };
    }
    return { confirmed: false };
  } catch {
    return { confirmed: false };
  }
}

// ── Amount parsing helpers ─────────────────────────────────────────────────────

/**
 * Convert raw token amount (decimal or 0x-hex string) + decimals → human-readable string.
 * Uses BigInt to avoid Number precision loss on large values.
 */
function parseRawAmount(raw: string, decimals: number): string {
  try {
    const n = raw.startsWith("0x") || raw.startsWith("0X") ? BigInt(raw) : BigInt(raw);
    const divisor = BigInt(10 ** decimals);
    const integer = n / divisor;
    const fraction = (n % divisor).toString().padStart(decimals, "0");
    return `${integer}.${fraction}`;
  } catch {
    return "0.000000";
  }
}

/** Resolve the formatted amount for each scanner result based on network. */
function resolveAmount(network: string, amountRaw: string): string {
  // BSC USDT BEP-20 has 18 decimals (Binance-Peg); amountRaw is hex from eth_getLogs data field
  if (network === "BSC" || network === "BEP20") return hexAmountToDecimal(amountRaw, 18);
  if (network === "ETH" || network === "ARBITRUM" || network === "POLYGON") {
    return hexAmountToDecimal(amountRaw, EVM_NETWORKS[network]?.decimals ?? 6);
  }
  // TRON, TON, SOLANA — 6 decimals, decimal string
  return parseRawAmount(amountRaw, 6);
}

// ── Poll for payment on address ───────────────────────────────────────────────

async function pollAddressForPayment(
  paymentId: number, address: string, network: string, currency: string,
  expectedAmount?: string, deadlineMs?: number,
) {
  const deadline = deadlineMs ?? Date.now() + 3 * 60 * 60 * 1000;
  let interval = 10000;
  const maxInterval = 60000;

  const check = async () => {
    if (Date.now() > deadline) return;
    try {
      // Fetch full payment row — continue polling if pending OR partially_paid
      const rows = await db.execute(sql`
        SELECT id, status, amount, amount_received FROM merchant_payments WHERE id = ${paymentId} LIMIT 1
      `);
      const payment = (rows[0] as any[])[0];
      if (!payment || (payment.status !== "pending" && payment.status !== "partially_paid")) return;

      const required = parseFloat(expectedAmount ?? payment.amount ?? "0");
      const alreadyReceived = parseFloat(payment.amount_received ?? "0");

      let processed = false;

      // Process one incoming transaction for this payment.
      // Uses merchant_payment_txs for dedup so each tx is attributed to exactly one payment.
      // Partial payments accumulate until required amount is met.
      const processIncomingTx = async (txHash: string, txAmountStr: string) => {
        const txNum = parseFloat(txAmountStr);
        if (txNum <= 0) return;

        // Dedup: if this tx is already recorded in any payment, skip it
        const [dup] = await db.execute(sql`
          SELECT 1 FROM merchant_payment_txs WHERE tx_hash = ${txHash} LIMIT 1
        `);
        if ((dup as any[]).length > 0) return;

        const newTotal = alreadyReceived + txNum;
        const isFullyPaid = required <= 0 || newTotal >= required * 0.99;

        // Record this tx atomically — UNIQUE constraint on tx_hash prevents race conditions
        try {
          await db.execute(sql`
            INSERT INTO merchant_payment_txs (payment_id, tx_hash, amount) VALUES (${paymentId}, ${txHash}, ${txNum})
          `);
        } catch {
          // Another poller already inserted this tx — skip
          return;
        }

        if (isFullyPaid) {
          const [upd] = await db.execute(sql`
            UPDATE merchant_payments
            SET status = 'confirmed', tx_hash = ${txHash}, amount_received = ${newTotal}, confirmed_at = NOW()
            WHERE id = ${paymentId} AND status IN ('pending', 'partially_paid')
          `);
          if ((upd as any).affectedRows === 1) {
            processed = true;
            console.log(`[merchant] payment ${paymentId} confirmed: ${txHash} +${txNum} total=${newTotal}/${required} USDT (${network})`);
            const [shopRows] = await db.execute(sql`
              SELECT s.id, s.webhook_url, p.order_id as pay_order_id, p.external_user_id
              FROM merchant_payments p JOIN merchant_shops s ON s.id = p.shop_id
              WHERE p.id = ${paymentId}
            `);
            const shopRow = (shopRows as any[])[0];
            if (shopRow) {
              await db.execute(sql`
                UPDATE merchant_shops SET balance_usdt = balance_usdt + ${txNum}, total_received = total_received + ${txNum}
                WHERE id = ${shopRow.id}
              `);
              if (shopRow.webhook_url) {
                sendWebhook(shopRow.webhook_url, {
                  event_type: "payment.confirmed",
                  payment_id: paymentId,
                  order_id: shopRow.pay_order_id ?? null,
                  external_user_id: shopRow.external_user_id ?? null,
                  amount_required: required,
                  amount_received: newTotal,
                  currency,
                  network,
                  tx_hash: txHash,
                });
              }
            }
          }
        } else {
          // Partial payment — record amount, keep polling
          await db.execute(sql`
            UPDATE merchant_payments
            SET status = 'partially_paid', tx_hash = ${txHash}, amount_received = ${newTotal}
            WHERE id = ${paymentId} AND status IN ('pending', 'partially_paid')
          `);
          processed = true;
          console.log(`[merchant] payment ${paymentId} partial: ${txHash} +${txNum} total=${newTotal}/${required} USDT — still waiting for ${(required - newTotal).toFixed(8)}`);
          const [shopRows] = await db.execute(sql`
            SELECT s.id, s.webhook_url, p.order_id as pay_order_id, p.external_user_id
            FROM merchant_payments p JOIN merchant_shops s ON s.id = p.shop_id
            WHERE p.id = ${paymentId}
          `);
          const shopRow = (shopRows as any[])[0];
          if (shopRow) {
            await db.execute(sql`
              UPDATE merchant_shops SET balance_usdt = balance_usdt + ${txNum}, total_received = total_received + ${txNum}
              WHERE id = ${shopRow.id}
            `);
            if (shopRow.webhook_url) {
              sendWebhook(shopRow.webhook_url, {
                event_type: "payment.partial",
                payment_id: paymentId,
                order_id: shopRow.pay_order_id ?? null,
                external_user_id: shopRow.external_user_id ?? null,
                amount_required: required,
                amount_received: newTotal,
                amount_remaining: parseFloat((required - newTotal).toFixed(8)),
                currency,
                network,
                tx_hash: txHash,
              });
            }
          }
        }
      };

      if (network === "TRON" || network === "TRC20") {
        const transfers = await scanTronIncoming(address);
        for (const t of transfers) {
          await processIncomingTx(t.txHash, parseRawAmount(t.amountRaw, 6));
          if (processed) break;
        }
      } else if (network === "BSC" || network === "BEP20") {
        const txs = await bscScanIncoming(address);
        for (const tx of txs) {
          if (tx.to?.toLowerCase() === address.toLowerCase()) {
            await processIncomingTx(tx.hash, hexAmountToDecimal(tx.value ?? "0x0", 18));
            if (processed) break;
          }
        }
      } else if (network === "TON") {
        const transfers = await scanTonIncoming(address);
        for (const t of transfers) {
          await processIncomingTx(t.txHash, parseRawAmount(t.amountRaw, 6));
          if (processed) break;
        }
      } else if (network === "ETH" || network === "ARBITRUM" || network === "POLYGON") {
        const cfg = EVM_NETWORKS[network];
        if (cfg) {
          const txs = await scanEvmIncoming(network, address);
          for (const t of txs) {
            await processIncomingTx(t.txHash, hexAmountToDecimal(t.amountRaw, cfg.decimals));
            if (processed) break;
          }
        }
      } else if (network === "SOLANA") {
        const transfers = await scanSolanaIncoming(address);
        for (const t of transfers) {
          await processIncomingTx(t.txHash, parseRawAmount(t.amountRaw, 6));
          if (processed) break;
        }
      }

      // Continue polling: for partial payments keep going; for fully confirmed stop
      const [statusRow] = await db.execute(sql`SELECT status FROM merchant_payments WHERE id = ${paymentId} LIMIT 1`);
      const currentStatus = ((statusRow as any[])[0])?.status;
      if (currentStatus !== "confirmed" && Date.now() < deadline) {
        interval = Math.min(Math.round(interval * 1.5), maxInterval);
        setTimeout(check, interval);
      }
    } catch (err: any) {
      console.error(`[merchant] payment ${paymentId} poll error:`, err?.message ?? err);
      if (Date.now() < deadline) {
        interval = Math.min(interval * 2, maxInterval);
        setTimeout(check, interval);
      }
    }
  };

  setTimeout(check, interval);
}

// ── Permanent address receipt poller ─────────────────────────────────────────
// Fires payment.received webhook for every NEW incoming tx within the monitoring window.
// No amount matching — just "something arrived, here's the amount".

// In-memory guard: prevents duplicate pollers for the same wallet on repeated API calls
const activeWalletMonitors = new Set<number>();

// pollPermanentAddress — monitors a wallet for any incoming tx.
// No upfront payment record. On tx detection: creates merchant_payments (confirmed),
// credits shop balance, sends payment.received webhook.
// Used for both: permanent wallets and temporary monitoring-only mode (no fixed amount).
async function pollPermanentAddress(
  walletId: number, shopId: number, address: string, network: string, currency: string,
  deadlineMs: number, externalUserId?: string, orderRef?: string,
) {
  if (activeWalletMonitors.has(walletId)) {
    // Monitoring already active — monitoring_until was updated by caller, existing poller continues
    console.log(`[merchant] wallet ${walletId} monitoring extended (poller already active)`);
    return;
  }
  activeWalletMonitors.add(walletId);

  let interval = 10000;
  const maxInterval = 60000;

  const done = () => {
    activeWalletMonitors.delete(walletId);
  };

  const check = async () => {
    try {
      // Read current monitoring window from DB — also picks up extended deadlines
      // if the user called /api/merchant/address again for the same wallet
      const wRows = await db.execute(sql`
        SELECT monitoring_until FROM merchant_wallets WHERE id = ${walletId} LIMIT 1
      `);
      const wRow = (wRows[0] as any[])[0];
      if (!wRow || !wRow.monitoring_until) { done(); return; } // cleared externally

      const currentDeadline = new Date(wRow.monitoring_until).getTime();
      if (Date.now() > currentDeadline) {
        // Monitoring window expired — clear the flag and stop
        await db.execute(sql`
          UPDATE merchant_wallets SET monitoring_until = NULL
          WHERE id = ${walletId} AND monitoring_until IS NOT NULL
        `).catch(() => {});
        done();
        return;
      }

      const processReceived = async (txHash: string, txAmountStr: string) => {
        const txNum = parseFloat(txAmountStr);
        if (txNum <= 0) return;

        // Dedup: skip if this tx was already processed globally
        const [dup] = await db.execute(sql`
          SELECT 1 FROM merchant_payment_txs WHERE tx_hash = ${txHash} LIMIT 1
        `);
        if ((dup as any[]).length > 0) return;

        // Create a confirmed payment record at the moment of detection
        let paymentId: number;
        try {
          const ins = await db.execute(sql`
            INSERT INTO merchant_payments
              (shop_id, order_id, external_user_id, wallet_address, network, currency,
               amount, amount_received, status, payment_mode, address_type, tx_hash, confirmed_at)
            VALUES
              (${shopId}, ${orderRef ?? null}, ${externalUserId ?? null}, ${address}, ${network}, ${currency},
               ${txAmountStr}, ${txNum}, 'confirmed', 'permanent', 'permanent', ${txHash}, NOW())
          `) as any;
          paymentId = ins[0]?.insertId;
          if (!paymentId) return;
        } catch {
          return; // race condition — another poller created the payment
        }

        // Link tx to this payment (UNIQUE on tx_hash is the final race guard)
        try {
          await db.execute(sql`
            INSERT INTO merchant_payment_txs (payment_id, tx_hash, amount)
            VALUES (${paymentId}, ${txHash}, ${txNum})
          `);
        } catch {
          // Another poller grabbed this tx first — delete the orphan payment we just created
          await db.execute(sql`DELETE FROM merchant_payments WHERE id = ${paymentId}`).catch(() => {});
          return;
        }

        // Credit shop balance
        await db.execute(sql`
          UPDATE merchant_shops
          SET balance_usdt = balance_usdt + ${txNum}, total_received = total_received + ${txNum}
          WHERE id = ${shopId}
        `);

        // Send webhook
        const [shopRows] = await db.execute(sql`
          SELECT webhook_url FROM merchant_shops WHERE id = ${shopId} LIMIT 1
        `);
        const shopRow = (shopRows as any[])[0];
        if (shopRow?.webhook_url) {
          sendWebhook(shopRow.webhook_url, {
            event_type: "payment.received",
            payment_id: paymentId,
            order_id: orderRef ?? null,
            external_user_id: externalUserId ?? null,
            amount: txNum,
            currency,
            network,
            tx_hash: txHash,
          });
        }
        console.log(`[merchant] wallet ${walletId} tx ${txHash} +${txNum} ${currency} (${network}) → payment #${paymentId} [confirmed]`);
      };

      if (network === "TRON" || network === "TRC20") {
        const transfers = await scanTronIncoming(address);
        for (const t of transfers) await processReceived(t.txHash, parseRawAmount(t.amountRaw, 6));
      } else if (network === "BSC" || network === "BEP20") {
        const txs = await bscScanIncoming(address);
        for (const tx of txs) {
          if (tx.to?.toLowerCase() === address.toLowerCase())
            await processReceived(tx.hash, hexAmountToDecimal(tx.value ?? "0x0", 18));
        }
      } else if (network === "TON") {
        const transfers = await scanTonIncoming(address);
        for (const t of transfers) await processReceived(t.txHash, parseRawAmount(t.amountRaw, 6));
      } else if (network === "ETH" || network === "ARBITRUM" || network === "POLYGON") {
        const cfg = EVM_NETWORKS[network];
        if (cfg) {
          const txs = await scanEvmIncoming(network, address);
          for (const t of txs) await processReceived(t.txHash, hexAmountToDecimal(t.amountRaw, cfg.decimals));
        }
      } else if (network === "SOLANA") {
        const transfers = await scanSolanaIncoming(address);
        for (const t of transfers) await processReceived(t.txHash, parseRawAmount(t.amountRaw, 6));
      }

      interval = Math.min(Math.round(interval * 1.5), maxInterval);
      setTimeout(check, interval);
    } catch (err: any) {
      console.error(`[merchant] wallet ${walletId} poll error:`, err?.message ?? err);
      if (Date.now() < deadlineMs) {
        interval = Math.min(interval * 2, maxInterval);
        setTimeout(check, interval);
      } else {
        done();
      }
    }
  };

  setTimeout(check, interval);
}

// ── Invoice payment poller ────────────────────────────────────────────────────

// Helper type for scanner candidates inside pollInvoiceForPayment
type InvoiceTxCandidate = {
  txHash: string;
  amount: number;
  blockTimestampMs?: number; // for timestamp filtering
  blockNumber?: number;      // EVM: for approximate time filtering
};

async function pollInvoiceForPayment(
  invoiceId: number, address: string, network: string,
  currency: string, expectedAmount: string, shopId: number,
  webhookUrl: string | null, orderRef: string | null,
  deadlineMs?: number,
  invoiceCreatedAt?: Date,   // used to filter out pre-invoice txs
) {
  const deadline = deadlineMs ?? Date.now() + 30 * 60 * 1000;
  let interval = 10000;
  const maxInterval = 60000;
  // In-process fast-path seen set (prevents reprocessing in same session)
  const seenTxIds = new Set<string>();

  // Pre-seed from global merchant_payment_txs table — covers any tx already credited
  // to this invoice (on restart) or to ANY other invoice/payment on the same address.
  try {
    const [existingRows] = await db.execute(sql`
      SELECT tx_hash FROM merchant_payment_txs
      WHERE invoice_id = ${invoiceId}
    `);
    for (const row of (existingRows as any[])) {
      if (row.tx_hash) seenTxIds.add(String(row.tx_hash));
    }
  } catch { /* non-fatal — will re-check via global table on each cycle */ }

  // Cutoff: reject any tx confirmed more than 2 minutes before invoice was created.
  // Gives 2-min clock skew buffer; defence-in-depth alongside global dedup.
  const cutoffMs = invoiceCreatedAt
    ? invoiceCreatedAt.getTime() - 2 * 60 * 1000
    : 0;

  const check = async () => {
    if (Date.now() > deadline) {
      await db.execute(sql`UPDATE merchant_invoices SET status = 'expired' WHERE id = ${invoiceId} AND status IN ('pending', 'partially_paid')`);
      await releaseMerchantWalletForInvoice(invoiceId);
      return;
    }
    try {
      const [invRows] = await db.execute(sql`SELECT status, amount_received FROM merchant_invoices WHERE id = ${invoiceId} LIMIT 1`);
      const inv = (invRows as any[])[0];
      if (!inv || (inv.status !== "pending" && inv.status !== "partially_paid")) {
        // Invoice already finalised (confirmed/expired by another process) — ensure wallet is free
        await releaseMerchantWalletForInvoice(invoiceId);
        return;
      }

      const required = parseFloat(expectedAmount);

      // Collect all candidates from scanner (iterate ALL results, not just [0])
      const candidates: InvoiceTxCandidate[] = [];

      if (network === "TRON" || network === "TRC20") {
        const transfers = await scanTronIncoming(address);
        for (const t of transfers) {
          candidates.push({ txHash: t.txHash, amount: parseFloat(parseRawAmount(t.amountRaw, 6)), blockTimestampMs: t.blockTimestampMs });
        }
      } else if (network === "BSC" || network === "BEP20") {
        const txs = await bscScanIncoming(address);
        for (const tx of txs) {
          if (tx.to?.toLowerCase() === address.toLowerCase()) {
            candidates.push({ txHash: tx.hash, amount: parseFloat(hexAmountToDecimal(tx.value ?? "0x0", 18)), blockNumber: tx.blockNumber });
          }
        }
      } else if (network === "TON") {
        const transfers = await scanTonIncoming(address);
        for (const t of transfers) {
          candidates.push({ txHash: t.txHash, amount: parseFloat(parseRawAmount(t.amountRaw, 6)), blockTimestampMs: t.blockTimestampMs });
        }
      } else if (network === "ETH" || network === "ARBITRUM" || network === "POLYGON") {
        const cfg = EVM_NETWORKS[network];
        if (cfg) {
          const txs = await scanEvmIncoming(network, address);
          for (const t of txs) {
            candidates.push({ txHash: t.txHash, amount: parseFloat(hexAmountToDecimal(t.amountRaw, cfg.decimals)), blockNumber: t.blockNumber });
          }
        }
      } else if (network === "SOLANA") {
        const transfers = await scanSolanaIncoming(address);
        for (const t of transfers) {
          candidates.push({ txHash: t.txHash, amount: parseFloat(parseRawAmount(t.amountRaw, 6)), blockTimestampMs: t.blockTimestampMs });
        }
      }

      // Re-read current total from DB (may have been updated by a concurrent instance)
      const [freshRows] = await db.execute(sql`SELECT amount_received FROM merchant_invoices WHERE id = ${invoiceId} LIMIT 1`);
      let currentTotal = parseFloat((freshRows as any[])[0]?.amount_received ?? "0");

      let anyCredit = false;
      let lastCreditedHash: string | null = null;

      for (const c of candidates) {
        // Fast-path in-process dedup
        if (seenTxIds.has(c.txHash)) continue;

        // Timestamp filter: skip txs confirmed before invoice was created (with buffer)
        if (cutoffMs > 0 && c.blockTimestampMs !== undefined && c.blockTimestampMs < cutoffMs) {
          seenTxIds.add(c.txHash); // mark to avoid logging repeatedly
          continue;
        }

        // Global atomic dedup via UNIQUE tx_hash in merchant_payment_txs
        // If another invoice/payment already credited this tx, the INSERT will fail (duplicate key).
        try {
          await db.execute(sql`
            INSERT INTO merchant_payment_txs (payment_id, invoice_id, tx_hash, amount)
            VALUES (0, ${invoiceId}, ${c.txHash}, ${c.amount})
          `);
        } catch {
          // Already credited globally — mark seen and skip
          seenTxIds.add(c.txHash);
          continue;
        }

        seenTxIds.add(c.txHash);
        currentTotal += c.amount;
        anyCredit = true;
        lastCreditedHash = c.txHash;

        const currentTotalStr = currentTotal.toFixed(8);

        if (currentTotal >= required) {
          // Fully paid
          const [upd] = await db.execute(sql`
            UPDATE merchant_invoices
            SET status = 'confirmed', tx_hash = ${c.txHash}, amount_received = ${currentTotalStr}, confirmed_at = NOW()
            WHERE id = ${invoiceId} AND status IN ('pending', 'partially_paid')
          `);
          if ((upd as any).affectedRows > 0) {
            await db.execute(sql`
              UPDATE merchant_shops SET balance_usdt = balance_usdt + ${currentTotal},
              total_received = total_received + ${currentTotal}
              WHERE id = ${shopId}
            `);
            await releaseMerchantWalletForInvoice(invoiceId);
            if (webhookUrl) {
              const [invNumRows] = await db.execute(sql`SELECT invoice_number FROM merchant_invoices WHERE id = ${invoiceId} LIMIT 1`);
              sendWebhook(webhookUrl, {
                event_type: "invoice.confirmed",
                invoice_number: (invNumRows as any[])[0]?.invoice_number,
                order_ref: orderRef,
                amount_received: currentTotalStr,
                currency,
                network,
                tx_hash: c.txHash,
              });
            }
          }
          return; // Invoice done — stop polling
        } else {
          // Partial payment
          await db.execute(sql`
            UPDATE merchant_invoices
            SET status = 'partially_paid', tx_hash = ${c.txHash}, amount_received = ${currentTotalStr}
            WHERE id = ${invoiceId} AND status IN ('pending', 'partially_paid')
          `);
          console.log(`[merchant] invoice ${invoiceId} partial: ${c.txHash} +${c.amount} total=${currentTotalStr}/${required} remaining=${(required - currentTotal).toFixed(8)}`);
          if (webhookUrl) {
            const [invNumRows] = await db.execute(sql`SELECT invoice_number FROM merchant_invoices WHERE id = ${invoiceId} LIMIT 1`);
            sendWebhook(webhookUrl, {
              event_type: "invoice.partial",
              invoice_number: (invNumRows as any[])[0]?.invoice_number,
              order_ref: orderRef,
              amount_received: currentTotalStr,
              amount_remaining: parseFloat((required - currentTotal).toFixed(8)),
              currency,
              network,
              tx_hash: c.txHash,
            });
          }
        }
      }

      // Reschedule if still within deadline
      if (Date.now() < deadline) {
        interval = Math.min(Math.round(interval * (anyCredit ? 1 : 1.5)), maxInterval);
        setTimeout(check, interval);
      }
    } catch {
      if (Date.now() < deadline) {
        interval = Math.min(interval * 2, maxInterval);
        setTimeout(check, interval);
      }
    }
  };

  setTimeout(check, interval);
}

// ── Startup recovery — resume polling for any pending payments/invoices ────────
// Called once on server start; ensures restart doesn't drop active polls.

export async function recoverPendingPollers() {
  const PAYMENT_TTL  = 3 * 60 * 60 * 1000;  // 3 hours — same as pollAddressForPayment deadline
  const INVOICE_TTL  = 30 * 60 * 1000;       // 30 min — same as pollInvoiceForPayment deadline
  try {
    // Repair shops with broken invoice_minutes (0 or null → causes instant expiry)
    await db.execute(sql`
      UPDATE merchant_shops SET invoice_minutes = 60
      WHERE invoice_minutes IS NULL OR invoice_minutes < 1
    `);

    // Fix old invoices created before 2-phase expiry: clear expires_at for pending invoices
    // that have no wallet_address yet — the clock should only start after network selection.
    await db.execute(sql`
      UPDATE merchant_invoices
      SET expires_at = NULL
      WHERE status = 'pending' AND wallet_address IS NULL AND expires_at IS NOT NULL
    `);

    // Expire old pending/partially_paid invoices that have a wallet_address but expires_at already passed
    await db.execute(sql`
      UPDATE merchant_invoices SET status = 'expired'
      WHERE status IN ('pending', 'partially_paid') AND wallet_address IS NOT NULL
        AND expires_at IS NOT NULL AND expires_at < NOW()
    `);

    // Release wallets still reserved for confirmed/expired invoices (survives server restarts)
    await db.execute(sql`
      UPDATE merchant_wallets mw
      JOIN merchant_invoices mi ON mi.wallet_id = mw.id
      SET mw.status = 'active', mw.order_id = NULL, mw.reserved_until = NULL, mw.external_user_id = NULL
      WHERE mi.status IN ('confirmed', 'expired') AND mw.status = 'reserved'
    `);

    // Recover wallets under active monitoring (permanent or temporary mode B)
    const [walletMonRows] = await db.execute(sql`
      SELECT mw.id, mw.address, mw.network, mw.external_user_id, mw.order_id, mw.monitoring_until,
             ms.id AS shop_id
      FROM merchant_wallets mw
      JOIN merchant_shops ms ON ms.id = mw.shop_id
      WHERE mw.monitoring_until IS NOT NULL AND mw.monitoring_until > NOW()
    `);
    let rWallets = 0;
    for (const row of (walletMonRows as any[])) {
      const deadline = new Date(row.monitoring_until).getTime();
      if (Date.now() < deadline) {
        pollPermanentAddress(
          row.id, row.shop_id, row.address, row.network, "USDT",
          deadline, row.external_user_id ?? undefined, row.order_id ?? undefined,
        );
        rWallets++;
      }
    }
    if (rWallets > 0) {
      console.log(`[merchant] Startup recovery: resumed monitoring for ${rWallets} wallet(s)`);
    }

    // Recover pending payments still within their TTL window (temporary accumulative mode only)
    const [payRows] = await db.execute(sql`
      SELECT id, wallet_address, network, currency, amount, created_at
      FROM merchant_payments
      WHERE status = 'pending' AND (payment_mode IS NULL OR payment_mode = 'temporary')
    `);
    let rPayments = 0;
    for (const row of (payRows as any[])) {
      const deadline = new Date(row.created_at).getTime() + PAYMENT_TTL;
      if (Date.now() < deadline) {
        pollAddressForPayment(
          row.id, row.wallet_address, row.network, row.currency,
          row.amount ?? undefined, deadline,
        );
        rPayments++;
      } else {
        // Already expired (older than 3h) — mark it so it won't sit as phantom-pending
        await db.execute(sql`
          UPDATE merchant_payments SET status = 'expired'
          WHERE id = ${row.id} AND status = 'pending'
        `);
      }
    }

    // Recover pending/partially_paid invoices still within their time window
    // Only recover invoices where network has been chosen (wallet_address is set)
    const [invRows] = await db.execute(sql`
      SELECT i.id, i.wallet_address, i.network_chosen, i.currency, i.amount,
             i.shop_id, i.order_ref, i.created_at, i.expires_at, s.webhook_url
      FROM merchant_invoices i
      JOIN merchant_shops s ON s.id = i.shop_id
      WHERE i.status IN ('pending', 'partially_paid') AND i.expires_at > NOW()
        AND i.wallet_address IS NOT NULL AND i.network_chosen IS NOT NULL
    `);
    let rInvoices = 0;
    for (const row of (invRows as any[])) {
      // Use actual expires_at from DB as deadline (not hardcoded TTL)
      const deadline = row.expires_at ? new Date(row.expires_at).getTime() : Date.now() + INVOICE_TTL;
      if (Date.now() < deadline) {
        pollInvoiceForPayment(
          row.id, row.wallet_address, row.network_chosen, row.currency,
          row.amount, row.shop_id, row.webhook_url ?? null, row.order_ref ?? null, deadline,
          row.created_at ? new Date(row.created_at) : undefined,
        );
        rInvoices++;
      }
    }

    if (rPayments + rInvoices > 0) {
      console.log(`[merchant] Startup recovery: resumed polling for ${rPayments} payment(s), ${rInvoices} invoice(s)`);
    }
  } catch (e) {
    console.warn("[merchant] recoverPendingPollers failed:", e);
  }
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
    // Force HTTPS to avoid POST→GET downgrade on 301 redirect
    const url = webhookUrl.replace(/^http:\/\//i, "https://");
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
    console.log(`[Webhook] Delivered to ${url}: ${res.status}`);
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
      // Source 1: TronGrid API (more reliable than TronScan)
      try {
        const r = await fetch(`https://api.trongrid.io/v1/accounts/${address}`, {
          headers: { "Accept": "application/json" },
          signal: AbortSignal.timeout(10000),
        });
        console.log(`[Balance] TronGrid status: ${r.status}`);
        if (r.ok) {
          const data = await r.json() as any;
          const trc20: any[] = data.data?.[0]?.trc20 ?? [];
          // USDT TRC20 contract: TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t
          const usdt = trc20.find((t: any) => t["TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"]);
          if (usdt) {
            const raw = usdt["TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"];
            return parseFloat(raw) / 1e6;
          }
          return 0;
        }
      } catch (e) { console.log(`[Balance] TronGrid error: ${e}`); }

      // Source 2: TronScan fallback
      try {
        const r = await fetch(`https://apilist.tronscanapi.com/api/accountv2?address=${address}`, {
          signal: AbortSignal.timeout(10000),
        });
        if (r.ok) {
          const data = await r.json() as any;
          const tokens: any[] = data.trc20token_balances ?? [];
          const usdt = tokens.find((t: any) => t.tokenAbbr === "USDT" || t.tokenName === "Tether USD");
          if (usdt) return parseFloat(usdt.balance) / Math.pow(10, usdt.tokenDecimal ?? 6);
          return 0;
        }
      } catch (e) { console.log(`[Balance] TronScan error: ${e}`); }

      return null;
    }
    if (network === "BSC") {
      // USDT BEP20 contract (18 decimals)
      const contract = "0x55d398326f99059fF775485246999027B3197955";

      // Source 1: BSCScan API (may be rate-limited without API key)
      try {
        const url = `https://api.bscscan.com/api?module=account&action=tokenbalance&contractaddress=${contract}&address=${address}&tag=latest`;
        const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (r.ok) {
          const data = await r.json() as any;
          if (data.status === "1" && data.result) {
            console.log(`[Balance] BSCScan OK: raw=${data.result}`);
            return parseFloat(data.result) / 1e18;
          }
          console.log(`[Balance] BSCScan returned status=${data.status} message=${data.message}`);
        }
      } catch (e) { console.log(`[Balance] BSCScan error: ${e}`); }

      // Source 2: Direct BSC JSON-RPC eth_call (no API key needed)
      try {
        const BSC_RPC_URLS = [
          "https://bsc-dataseed1.binance.org/",
          "https://bsc-dataseed2.binance.org/",
          "https://bsc-dataseed1.defibit.io/",
        ];
        // balanceOf(address) selector = 0x70a08231
        const paddedAddr = address.toLowerCase().replace("0x", "").padStart(64, "0");
        const callData = "0x70a08231" + paddedAddr;
        for (const rpcUrl of BSC_RPC_URLS) {
          try {
            const r = await fetch(rpcUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ jsonrpc: "2.0", method: "eth_call", params: [{ to: contract, data: callData }, "latest"], id: 1 }),
              signal: AbortSignal.timeout(8000),
            });
            if (r.ok) {
              const data = await r.json() as any;
              const hex = data.result as string;
              if (hex && hex !== "0x" && hex !== "0x0") {
                const raw = BigInt(hex);
                const balance = Number(raw) / 1e18;
                console.log(`[Balance] BSC RPC ${rpcUrl} OK: raw=${hex} => ${balance}`);
                return balance;
              }
              // 0x or 0x0 = truly 0 balance
              console.log(`[Balance] BSC RPC ${rpcUrl} => 0 balance`);
              return 0;
            }
          } catch (e) { console.log(`[Balance] BSC RPC ${rpcUrl} error: ${e}`); }
        }
      } catch (e) { console.log(`[Balance] BSC RPC all failed: ${e}`); }

      return null; // All sources failed
    }
    if (network === "TON") {
      // Source 1: tonapi.io free public API
      try {
        const url = `https://tonapi.io/v2/accounts/${encodeURIComponent(address)}/jettons/${encodeURIComponent(TON_USDT_MASTER)}`;
        const r = await fetch(url, {
          headers: { "Accept": "application/json" },
          signal: AbortSignal.timeout(8000),
        });
        console.log(`[Balance] tonapi.io status: ${r.status}`);
        if (r.ok) {
          const data = await r.json() as any;
          console.log(`[Balance] tonapi.io data: ${JSON.stringify(data).slice(0, 200)}`);
          // balance is in base units (6 decimals for USDT on TON)
          const raw = data.balance ?? "0";
          return parseFloat(raw) / 1e6;
        }
      } catch (e) { console.log(`[Balance] tonapi.io error: ${e}`); }

      // Source 2: toncenter.com v3 API (free, no key needed)
      try {
        const url = `https://toncenter.com/api/v3/jetton/wallets?owner_address=${encodeURIComponent(address)}&jetton_address=${encodeURIComponent(TON_USDT_MASTER)}&limit=1`;
        const r = await fetch(url, {
          headers: { "Accept": "application/json" },
          signal: AbortSignal.timeout(8000),
        });
        console.log(`[Balance] toncenter.com status: ${r.status}`);
        if (r.ok) {
          const data = await r.json() as any;
          console.log(`[Balance] toncenter.com data: ${JSON.stringify(data).slice(0, 200)}`);
          const wallets: any[] = data.jetton_wallets ?? [];
          if (wallets.length > 0) return parseFloat(wallets[0].balance) / 1e6;
          return 0; // Has no USDT jetton wallet = 0 balance
        }
      } catch (e) { console.log(`[Balance] toncenter.com error: ${e}`); }

      return null; // Both sources failed — will try wallet API fallback
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

// Returns native gas token balance and minimum required for a transfer fee
async function checkNativeGasBalance(
  network: string, address: string
): Promise<{ balance: number; minRequired: number; currency: string }> {
  const GAS: Record<string, { min: number; currency: string }> = {
    BSC:      { min: 0.001,   currency: "BNB"  },
    TRON:     { min: 13,      currency: "TRX"  },
    TON:      { min: 0.05,    currency: "TON"  },
    ETH:      { min: 0.001,   currency: "ETH"  },
    ARBITRUM: { min: 0.0005,  currency: "ETH"  },
    POLYGON:  { min: 0.01,    currency: "MATIC"},
    SOLANA:   { min: 0.01,    currency: "SOL"  },
  };
  const req = GAS[network] ?? { min: 0.001, currency: "native" };
  let balance = 0;
  try {
    if (network === "BSC") {
      const BSC_RPCS = ["https://bsc-dataseed1.binance.org/", "https://bsc-dataseed2.binance.org/", "https://bsc-dataseed1.defibit.io/"];
      for (const rpc of BSC_RPCS) {
        try {
          const r = await fetch(rpc, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", method: "eth_getBalance", params: [address, "latest"], id: 1 }),
            signal: AbortSignal.timeout(8000),
          });
          const d = await r.json() as any;
          if (d.result !== undefined) { balance = Number(BigInt(d.result || "0x0")) / 1e18; break; }
        } catch { /* try next */ }
      }
    } else if (network === "TRON") {
      const r = await fetch(`https://api.trongrid.io/v1/accounts/${address}`, {
        headers: { "Accept": "application/json" }, signal: AbortSignal.timeout(8000),
      });
      const d = await r.json() as any;
      balance = Number(d.data?.[0]?.balance ?? 0) / 1_000_000;
    } else if (network === "TON") {
      const r = await fetch(`https://tonapi.io/v2/accounts/${encodeURIComponent(address)}`, {
        headers: { "Accept": "application/json" }, signal: AbortSignal.timeout(8000),
      });
      const d = await r.json() as any;
      balance = Number(d.balance ?? 0) / 1e9;
    } else if (["ETH", "ARBITRUM", "POLYGON"].includes(network)) {
      const rpcs = EVM_NETWORKS[network]?.rpcs ?? [];
      const result = await evmRpc(rpcs, "eth_getBalance", [address, "latest"]);
      if (result) balance = Number(BigInt(result)) / 1e18;
    }
  } catch (e) {
    console.warn(`[GasCheck] ${network}:${address}`, e);
  }
  return { balance, minRequired: req.min, currency: req.currency };
}

async function checkWalletBalanceViaApi(network: string, address: string): Promise<number | null> {
  try {
    const node = SUPPORTED_WALLET_NODES[network];
    if (!node) return null;
    const BALANCE_API_URL = WALLET_API_URL.replace("/wallet/create", "/wallet/balance");
    console.log(`[Balance] Wallet API POST: ${BALANCE_API_URL} node=${node}`);
    const r = await fetch(BALANCE_API_URL, {
      method: "POST",
      headers: { "Authorization": `Bearer ${WALLET_API_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ node, address }),
      signal: AbortSignal.timeout(15000),
    });
    console.log(`[Balance] Wallet API status: ${r.status}`);
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      console.log(`[Balance] Wallet API error body: ${text.slice(0, 200)}`);
      return null;
    }
    const data = await r.json() as any;
    console.log(`[Balance] Wallet API response: ${JSON.stringify(data).slice(0, 300)}`);
    // Handle various response shapes
    return data.data?.usdt
      ?? data.balance?.usdt
      ?? data.usdt
      ?? data.data?.balance
      ?? data.result?.usdt
      ?? null;
  } catch (e) {
    console.log(`[Balance] Wallet API exception: ${e}`);
    return null;
  }
}

// ── Route registration ────────────────────────────────────────────────────────

export function registerBusinessRoutes(app: Express) {

  // ── Cabinet API (requires user API key) ──────────────────────────────────

  // List my shops (includes walletBalanceSum = SUM of checked wallet balances)
  app.get("/api/business/shops", requireApiKey, async (req, res) => {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    try {
      const shops = await db.select().from(merchantShops).where(eq(merchantShops.userId, user.id)).orderBy(desc(merchantShops.createdAt));
      // Attach wallet balance sum for each shop
      const shopIds = shops.map(s => s.id);
      let walletSums: Record<number, string> = {};
      if (shopIds.length > 0) {
        const rows = await db.execute(
          sql`SELECT shop_id, COALESCE(SUM(CAST(balance_usdt AS DECIMAL(20,6))), 0) AS total FROM merchant_wallets WHERE shop_id IN (${sql.raw(shopIds.join(","))}) GROUP BY shop_id`
        );
        for (const row of (rows[0] as any[])) {
          walletSums[row.shop_id] = parseFloat(row.total).toFixed(6);
        }
      }
      const result = shops.map(s => ({ ...s, walletBalanceSum: walletSums[s.id] ?? "0.000000" }));
      res.json(result);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Get single shop (includes walletBalanceSum)
  app.get("/api/business/shops/:id", requireApiKey, async (req, res) => {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    try {
      const shopId = parseInt(req.params.id);
      const [shop] = await db.select().from(merchantShops).where(and(eq(merchantShops.id, shopId), eq(merchantShops.userId, user.id))).limit(1);
      if (!shop) return res.status(404).json({ error: "Shop not found" });
      const sumRows = await db.execute(sql`SELECT COALESCE(SUM(CAST(balance_usdt AS DECIMAL(20,6))), 0) AS total FROM merchant_wallets WHERE shop_id = ${shopId}`);
      const walletBalanceSum = parseFloat((sumRows[0] as any[])[0]?.total ?? 0).toFixed(6);
      res.json({ ...shop, walletBalanceSum });
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
      if (webhookUrl !== undefined) {
        // Always store webhook_url as HTTPS — no http:// allowed
        updates.webhookUrl = webhookUrl
          ? webhookUrl.replace(/^http:\/\//i, "https://")
          : webhookUrl;
      }
      if (req.body.permanentMonitorMinutes !== undefined) {
        const mins = parseInt(req.body.permanentMonitorMinutes);
        if (!isNaN(mins) && mins >= 1 && mins <= 1440) updates.permanentMonitorMinutes = mins;
      }
      if (req.body.temporaryMinutes !== undefined) {
        const mins = parseInt(req.body.temporaryMinutes);
        if (!isNaN(mins) && mins >= 1 && mins <= 1440) updates.temporaryMinutes = mins;
      }
      if (req.body.invoiceMinutes !== undefined) {
        const mins = parseInt(req.body.invoiceMinutes);
        if (!isNaN(mins) && mins >= 1 && mins <= 1440) updates.invoiceMinutes = mins;
      }
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
            body: JSON.stringify({ node, address_from: fromWallet.address, address_to: toAddress, amount: amountNum, symbol: resolveWalletSymbol(fromWallet.network, currency || "USDT") }),
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

      // Guard: completed/cancelled are terminal — cannot change again
      if (["completed", "cancelled"].includes((payout as any).status)) {
        return res.status(409).json({ error: `Payout already ${(payout as any).status}` });
      }

      const updates: any = { status };
      if (txHash) updates.txHash = txHash;
      if (status === "completed" || status === "cancelled") updates.processedAt = new Date();

      // Persist status to DB first
      await db.update(merchantPayoutRequests).set(updates).where(eq(merchantPayoutRequests.id, payoutId));

      if (status === "completed") {
        await db.update(merchantShops).set({ totalPaidOut: sql`total_paid_out + ${parseFloat(payout.amount)}` }).where(eq(merchantShops.id, shopId));
        // Send webhook for API-sourced payouts only
        if ((payout as any).source === "api" && shop.webhookUrl) {
          sendWebhook(shop.webhookUrl, {
            event_type: "payout.completed",
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
      // Refund balance only for manual payouts (API payouts never deducted balance)
      if (status === "cancelled") {
        if ((payout as any).source === "manual") {
          await db.update(merchantShops).set({ balanceUsdt: sql`balance_usdt + ${parseFloat(payout.amount)}` }).where(eq(merchantShops.id, shopId));
        }
        // Send payout.cancelled webhook for all sourced payouts
        if (shop.webhookUrl) {
          sendWebhook(shop.webhookUrl, {
            event_type: "payout.cancelled",
            payout_id: payoutId,
            external_order_id: (payout as any).externalOrderId,
            reference: (payout as any).reference,
            to_address: payout.toAddress,
            network: payout.network,
            amount: payout.amount,
            currency: payout.currency,
          });
        }
      }

      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Check native gas balance before semi-auto payout execution
  app.post("/api/business/shops/:id/payouts/:payoutId/check-gas", requireApiKey, async (req, res) => {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const shopId = parseInt(req.params.id);
    const payoutId = parseInt(req.params.payoutId);
    const { fromWalletId } = req.body;
    if (!fromWalletId) return res.status(400).json({ error: "fromWalletId required" });
    try {
      const [shop] = await db.select().from(merchantShops).where(and(eq(merchantShops.id, shopId), eq(merchantShops.userId, user.id))).limit(1);
      if (!shop) return res.status(404).json({ error: "Shop not found" });
      const [payout] = await db.select().from(merchantPayoutRequests).where(and(eq(merchantPayoutRequests.id, payoutId), eq(merchantPayoutRequests.shopId, shopId))).limit(1);
      if (!payout) return res.status(404).json({ error: "Payout not found" });
      const [wallet] = await db.select().from(merchantWallets).where(and(eq(merchantWallets.id, parseInt(fromWalletId)), eq(merchantWallets.shopId, shopId))).limit(1);
      if (!wallet) return res.status(404).json({ error: "Wallet not found" });

      const { balance, minRequired, currency } = await checkNativeGasBalance(wallet.network, wallet.address);
      res.json({
        hasEnoughGas: balance >= minRequired,
        currentGas: balance,
        gasNeeded: minRequired,
        gasCurrency: currency,
        walletAddress: wallet.address,
        shortfall: balance >= minRequired ? 0 : parseFloat((minRequired - balance).toFixed(8)),
      });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Semi-auto execute: call wallet transfer API on an existing pending payout
  app.post("/api/business/shops/:id/payouts/:payoutId/execute", requireApiKey, async (req, res) => {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const shopId = parseInt(req.params.id);
    const payoutId = parseInt(req.params.payoutId);
    const { fromWalletId } = req.body;
    if (!fromWalletId) return res.status(400).json({ error: "fromWalletId required" });
    try {
      const [shop] = await db.select().from(merchantShops).where(and(eq(merchantShops.id, shopId), eq(merchantShops.userId, user.id))).limit(1);
      if (!shop) return res.status(404).json({ error: "Shop not found" });
      const [payout] = await db.select().from(merchantPayoutRequests).where(and(eq(merchantPayoutRequests.id, payoutId), eq(merchantPayoutRequests.shopId, shopId))).limit(1);
      if (!payout) return res.status(404).json({ error: "Payout not found" });
      if (["completed", "cancelled"].includes((payout as any).status)) {
        return res.status(409).json({ error: `Payout already ${(payout as any).status}` });
      }
      const [wallet] = await db.select().from(merchantWallets).where(and(eq(merchantWallets.id, parseInt(fromWalletId)), eq(merchantWallets.shopId, shopId))).limit(1);
      if (!wallet) return res.status(404).json({ error: "Wallet not found" });

      const TRANSFER_URL = WALLET_API_URL.replace("/wallet/create", "/wallet/transfer");
      const node = SUPPORTED_WALLET_NODES[wallet.network] ?? wallet.network;
      const symbol = resolveWalletSymbol(wallet.network, payout.currency ?? "USDT");
      const transferBody: any = {
        node,
        address_from: wallet.address,
        address_to: payout.toAddress,
        amount: parseFloat(payout.amount),
        symbol,
      };
      if (wallet.mode && wallet.mode !== "standard") transferBody.mode = wallet.mode;

      console.log(`[Execute] Transfer payload: ${JSON.stringify(transferBody)}`);

      const r = await fetch(TRANSFER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${WALLET_API_TOKEN}` },
        body: JSON.stringify(transferBody),
        signal: AbortSignal.timeout(30000),
      });
      const rawText = await r.text();
      console.log(`[Execute] Transfer raw response (${r.status}): ${rawText.slice(0, 500)}`);
      let d: any;
      try {
        d = JSON.parse(rawText);
      } catch (parseErr) {
        return res.status(502).json({ error: "Wallet API вернул некорректный ответ", details: rawText.slice(0, 300) });
      }
      console.log(`[Execute] Transfer response (${r.status}): ${JSON.stringify(d)}`);

      // GasFree transfers return traceId instead of txid
      const txid = d.data?.txid ?? d.data?.traceId ?? null;
      if (!d.success || !txid) {
        return res.status(422).json({ error: d.error ?? d.message ?? "Transfer failed", details: d });
      }

      await db.update(merchantPayoutRequests).set({
        status: "completed" as any,
        txHash: txid,
        processedAt: new Date(),
      }).where(eq(merchantPayoutRequests.id, payoutId));
      await db.update(merchantShops).set({ totalPaidOut: sql`total_paid_out + ${parseFloat(payout.amount)}` }).where(eq(merchantShops.id, shopId));

      if (shop.webhookUrl) {
        sendWebhook(shop.webhookUrl, {
          event_type: "payout.completed",
          payout_id: payoutId,
          reference: (payout as any).reference,
          external_order_id: (payout as any).externalOrderId,
          to_address: payout.toAddress,
          network: payout.network,
          amount: payout.amount,
          currency: payout.currency,
          tx_hash: txid,
        });
      }

      res.json({ ok: true, txHash: txid });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── Merchant Wallets (cabinet) ────────────────────────────────────────────

  // List wallets for shop (with active invoice reservation info)
  app.get("/api/business/shops/:id/wallets", requireApiKey, async (req, res) => {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const shopId = parseInt(req.params.id);
    try {
      const [shop] = await db.select().from(merchantShops).where(and(eq(merchantShops.id, shopId), eq(merchantShops.userId, user.id))).limit(1);
      if (!shop) return res.status(404).json({ error: "Shop not found" });
      const wallets = await db.select().from(merchantWallets).where(eq(merchantWallets.shopId, shopId)).orderBy(desc(merchantWallets.createdAt)).limit(200);

      // Attach active invoice reservation info per wallet address
      // Uses UNIX_TIMESTAMP for timezone-safe UTC conversion (MySQL server is UTC+3)
      const invoiceRows = await db.execute(sql`
        SELECT wallet_address, invoice_number,
               UNIX_TIMESTAMP(expires_at) AS expires_at_unix,
               amount, currency
        FROM merchant_invoices
        WHERE shop_id = ${shopId}
          AND status IN ('pending', 'partially_paid')
          AND wallet_address IS NOT NULL
          AND expires_at > NOW()
        ORDER BY expires_at ASC
      `);
      const invoiceMap: Record<string, { invoiceReservedUntil: string; invoiceNumber: string; invoiceAmount: string; invoiceCurrency: string }> = {};
      for (const row of (invoiceRows[0] as any[])) {
        if (row.wallet_address && row.expires_at_unix && !invoiceMap[row.wallet_address]) {
          invoiceMap[row.wallet_address] = {
            invoiceReservedUntil: new Date(Number(row.expires_at_unix) * 1000).toISOString(),
            invoiceNumber: row.invoice_number,
            invoiceAmount: row.amount,
            invoiceCurrency: row.currency,
          };
        }
      }

      const result = wallets.map(w => ({
        ...w,
        ...(invoiceMap[w.address] ?? {}),
      }));
      res.json(result);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Start monitoring for a wallet (permanent address monitoring)
  app.post("/api/business/shops/:id/wallets/:walletId/start-monitoring", requireApiKey, async (req, res) => {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const shopId = parseInt(req.params.id);
    const walletId = parseInt(req.params.walletId);
    try {
      const [shop] = await db.select().from(merchantShops).where(and(eq(merchantShops.id, shopId), eq(merchantShops.userId, user.id))).limit(1);
      if (!shop) return res.status(404).json({ error: "Shop not found" });
      const [wallet] = await db.select().from(merchantWallets).where(and(eq(merchantWallets.id, walletId), eq(merchantWallets.shopId, shopId))).limit(1);
      if (!wallet) return res.status(404).json({ error: "Wallet not found" });
      const monitorMins = parseInt(String(shop.permanentMonitorMinutes ?? 20));
      const monitoringUntil = new Date(Date.now() + monitorMins * 60 * 1000);
      await db.update(merchantWallets).set({ monitoringUntil }).where(eq(merchantWallets.id, walletId));
      res.json({ ok: true, monitoring_until: monitoringUntil, minutes: monitorMins });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Exclude a wallet from the pool (active → excluded; permanent → detach user + excluded)
  app.post("/api/business/shops/:id/wallets/:walletId/exclude", requireApiKey, async (req, res) => {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const shopId = parseInt(req.params.id);
    const walletId = parseInt(req.params.walletId);
    try {
      const [shop] = await db.select().from(merchantShops).where(and(eq(merchantShops.id, shopId), eq(merchantShops.userId, user.id))).limit(1);
      if (!shop) return res.status(404).json({ error: "Shop not found" });
      const [wallet] = await db.select().from(merchantWallets).where(and(eq(merchantWallets.id, walletId), eq(merchantWallets.shopId, shopId))).limit(1);
      if (!wallet) return res.status(404).json({ error: "Wallet not found" });
      if (wallet.status === "reserved") {
        return res.status(400).json({ error: "Нельзя исключить зарезервированный кошелёк. Дождитесь истечения резервирования." });
      }
      if (wallet.status === "excluded") {
        return res.status(400).json({ error: "Кошелёк уже исключён" });
      }
      // For permanent: detach external user; for active: just mark excluded
      await db.execute(sql`
        UPDATE merchant_wallets
        SET status = 'excluded', external_user_id = NULL, order_id = NULL,
            reserved_until = NULL, monitoring_until = NULL
        WHERE id = ${walletId}
      `);
      res.json({ ok: true, message: "Кошелёк исключён из пула" });
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

  // Generate/get address for payment (or invoice URL in invoice mode).
  // payment_mode is specified per-request: "permanent" | "temporary" | "invoice"
  app.post("/api/merchant/address", async (req, res) => {
    const shop = await getShopByKey(req);
    if (!shop) return res.status(401).json({ error: "Invalid shop API key or shop not active" });
    const { user_id, order_id, network, mode, currency, amount, networks: networksOverride, payment_mode } = req.body;

    // Resolve payment_mode: per-request value takes priority, fall back to legacy shop setting
    const paymentMode: string = payment_mode ?? shop.address_mode ?? "temporary";

    // ── Invoice mode ─────────────────────────────────────────────────────────
    if (paymentMode === "invoice") {
      if (!amount) return res.status(400).json({ error: "amount is required for invoice mode" });
      const enabledNetworks: string[] = shop.enabled_networks ? JSON.parse(shop.enabled_networks) : [];
      const invoiceNetworks: string[] = networksOverride
        ? (Array.isArray(networksOverride) ? networksOverride : [networksOverride])
        : (network ? [network] : enabledNetworks);
      if (invoiceNetworks.length === 0) return res.status(400).json({ error: "No networks specified or enabled" });

      const invoiceNumber = generateInvoiceNumber();
      try {
        await db.insert(merchantInvoices).values({
          shopId: shop.id,
          invoiceNumber,
          orderRef: order_id ?? null,
          amount: String(amount),
          currency: currency ?? "USDT",
          networks: JSON.stringify(invoiceNetworks),
          status: "pending",
          expiresAt: null,
        });
        const appBase = process.env.APP_URL ?? `https://${process.env.REPLIT_DOMAINS?.split(",")[0] ?? "localhost:5000"}`;
        return res.json({
          type: "invoice",
          payment_mode: "invoice",
          invoice_number: invoiceNumber,
          invoice_url: `${appBase}/pay/${invoiceNumber}`,
          amount,
          currency: currency ?? "USDT",
          networks: invoiceNetworks,
          expires_at: null,
        });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    }

    // ── Wallet-based modes (permanent / temporary) ───────────────────────────
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
      const isTemp = paymentMode === "temporary";
      const tempMins = parseInt(String(shop.temporary_minutes ?? 30));
      const monitorMinutes = parseInt(String(shop.permanent_monitor_minutes ?? 20));

      const wallet = await findOrReserveMerchantWallet(
        shop.id, network, walletMode, user_id, order_id,
        isTemp ? "temporary" : "permanent",
        isTemp ? tempMins : monitorMinutes,
      );
      const address = walletMode === "gasfree" ? (wallet.gasfree_address || wallet.address) : wallet.address;

      // ── Permanent mode: monitor wallet, create payment only when tx arrives ──
      if (paymentMode === "permanent") {
        const monitorUntil = new Date(Date.now() + monitorMinutes * 60 * 1000);
        await db.execute(sql`
          UPDATE merchant_wallets SET monitoring_until = ${monitorUntil} WHERE id = ${wallet.id}
        `);
        pollPermanentAddress(
          wallet.id, shop.id, address, network, currency ?? "USDT",
          monitorUntil.getTime(), user_id ?? undefined, order_id ?? undefined,
        );
        return res.json({
          address,
          network,
          wallet_mode: walletMode,
          payment_mode: "permanent",
          currency: currency ?? "USDT",
          wallet_id: wallet.id,
          monitor_until: monitorUntil,
        });
      }

      // ── Temporary mode A: amount + order_id → accumulative payment ─────────
      if (amount && order_id) {
        const expiresAt = new Date(Date.now() + tempMins * 60 * 1000);
        const insertResult = await db.insert(merchantPayments).values({
          shopId: shop.id,
          orderId: order_id,
          externalUserId: user_id ?? null,
          walletAddress: address,
          network,
          currency: currency ?? "USDT",
          amount: String(amount),
          status: "pending",
          paymentMode: "temporary",
          addressType: "temporary",
          expiresAt,
        }) as any;
        const paymentId = insertResult[0]?.insertId;
        pollAddressForPayment(paymentId, address, network, currency ?? "USDT", String(amount));
        return res.json({
          address,
          network,
          wallet_mode: walletMode,
          payment_mode: "temporary",
          currency: currency ?? "USDT",
          payment_id: paymentId,
          expires_at: expiresAt,
        });
      }

      // ── Temporary mode B: monitoring only (no fixed amount/order) ──────────
      const monitorUntil = new Date(Date.now() + tempMins * 60 * 1000);
      await db.execute(sql`
        UPDATE merchant_wallets SET monitoring_until = ${monitorUntil} WHERE id = ${wallet.id}
      `);
      pollPermanentAddress(
        wallet.id, shop.id, address, network, currency ?? "USDT",
        monitorUntil.getTime(), user_id ?? undefined, order_id ?? undefined,
      );
      return res.json({
        address,
        network,
        wallet_mode: walletMode,
        payment_mode: "temporary",
        currency: currency ?? "USDT",
        wallet_id: wallet.id,
        monitor_until: monitorUntil,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Trigger payment check — synchronous: scans blockchain right now, returns final status
  app.post("/api/merchant/check-payment", async (req, res) => {
    const shop = await getShopByKey(req);
    if (!shop) return res.status(401).json({ error: "Invalid shop API key or shop not active" });
    const { payment_id } = req.body;
    if (!payment_id) return res.status(400).json({ error: "payment_id is required" });
    try {
      const rows = await db.execute(sql`SELECT * FROM merchant_payments WHERE id = ${payment_id} AND shop_id = ${shop.id} LIMIT 1`);
      const payment = (rows[0] as any[])[0];
      if (!payment) return res.status(404).json({ error: "Payment not found" });
      if (payment.status === "confirmed") {
        return res.json({ status: "confirmed", tx_hash: payment.tx_hash, amount_received: payment.amount_received, confirmed_at: payment.confirmed_at });
      }
      if (payment.status === "expired" || payment.status === "closed") {
        return res.json({ status: payment.status, tx_hash: payment.tx_hash ?? null, amount_received: payment.amount_received ?? null });
      }

      const net = payment.network;
      const paymentMode: string = payment.payment_mode ?? "temporary";

      // ── Permanent mode: scan for new txs, fire payment.received for each ──
      if (paymentMode === "permanent") {
        let scanned: Array<{ txHash: string; amountStr: string }> = [];
        try {
          if (net === "TRON" || net === "TRC20") {
            const transfers = await scanTronIncoming(payment.wallet_address);
            scanned = transfers.map((t: any) => ({ txHash: t.txHash, amountStr: parseRawAmount(t.amountRaw, 6) }));
          } else if (net === "BSC" || net === "BEP20") {
            const txs = await bscScanIncoming(payment.wallet_address);
            scanned = txs.filter((tx: any) => tx.to?.toLowerCase() === payment.wallet_address.toLowerCase())
              .map((tx: any) => ({ txHash: tx.hash, amountStr: hexAmountToDecimal(tx.value ?? "0x0", 18) }));
          } else if (net === "TON") {
            const transfers = await scanTonIncoming(payment.wallet_address);
            scanned = transfers.map((t: any) => ({ txHash: t.txHash, amountStr: parseRawAmount(t.amountRaw, 6) }));
          } else if (net === "ETH" || net === "ARBITRUM" || net === "POLYGON") {
            const cfg = EVM_NETWORKS[net];
            if (cfg) {
              const txs = await scanEvmIncoming(net, payment.wallet_address);
              scanned = txs.map((t: any) => ({ txHash: t.txHash, amountStr: hexAmountToDecimal(t.amountRaw, cfg.decimals) }));
            }
          } else if (net === "SOLANA") {
            const transfers = await scanSolanaIncoming(payment.wallet_address);
            scanned = transfers.map((t: any) => ({ txHash: t.txHash, amountStr: parseRawAmount(t.amountRaw, 6) }));
          }
        } catch { /* network error */ }

        let newTxCount = 0;
        for (const { txHash, amountStr } of scanned) {
          const txNum = parseFloat(amountStr);
          if (txNum <= 0) continue;
          const [dup] = await db.execute(sql`SELECT 1 FROM merchant_payment_txs WHERE tx_hash = ${txHash} LIMIT 1`);
          if ((dup as any[]).length > 0) continue;
          try {
            await db.execute(sql`INSERT INTO merchant_payment_txs (payment_id, tx_hash, amount) VALUES (${payment.id}, ${txHash}, ${txNum})`);
          } catch { continue; }
          await db.execute(sql`UPDATE merchant_payments SET amount_received = COALESCE(amount_received, 0) + ${txNum}, tx_hash = ${txHash} WHERE id = ${payment.id}`);
          await db.execute(sql`UPDATE merchant_shops SET balance_usdt = balance_usdt + ${txNum}, total_received = total_received + ${txNum} WHERE id = ${shop.id}`);
          if (shop.webhookUrl) {
            sendWebhook(shop.webhookUrl, {
              event_type: "payment.received",
              payment_id: payment.id,
              order_id: payment.order_id ?? null,
              external_user_id: payment.external_user_id ?? null,
              amount: txNum,
              currency: payment.currency,
              network: net,
              tx_hash: txHash,
            });
          }
          console.log(`[merchant] check-payment(permanent) ${payment.id} received: ${txHash} +${txNum} USDT`);
          newTxCount++;
        }
        const [updated] = await db.execute(sql`SELECT * FROM merchant_payments WHERE id = ${payment.id} LIMIT 1`);
        const upd = (updated as any[])[0];
        return res.json({ status: upd?.status ?? payment.status, new_tx_count: newTxCount, amount_received: upd?.amount_received ?? payment.amount_received });
      }

      // ── Temporary/invoice mode: accumulate until amount reached ─────────────
      let found = false;
      let txHash: string | null = null;
      let amountReceived: string | null = null;

      try {
        if (net === "TRON" || net === "TRC20") {
          const transfers = await scanTronIncoming(payment.wallet_address);
          if (transfers.length > 0) {
            txHash = transfers[0].txHash;
            amountReceived = parseRawAmount(transfers[0].amountRaw, 6);
            found = true;
          }
        } else if (net === "BSC" || net === "BEP20") {
          const txs = await bscScanIncoming(payment.wallet_address);
          const inbound = txs.find((tx: any) => tx.to?.toLowerCase() === payment.wallet_address.toLowerCase());
          if (inbound) {
            txHash = inbound.hash;
            amountReceived = hexAmountToDecimal(inbound.value ?? "0x0", 18);
            found = true;
          }
        } else if (net === "TON") {
          const transfers = await scanTonIncoming(payment.wallet_address);
          if (transfers.length > 0) {
            txHash = transfers[0].txHash;
            amountReceived = parseRawAmount(transfers[0].amountRaw, 6);
            found = true;
          }
        } else if (net === "ETH" || net === "ARBITRUM" || net === "POLYGON") {
          const cfg = EVM_NETWORKS[net];
          if (cfg) {
            const txs = await scanEvmIncoming(net, payment.wallet_address);
            if (txs.length > 0) {
              txHash = txs[0].txHash;
              amountReceived = hexAmountToDecimal(txs[0].amountRaw, cfg.decimals);
              found = true;
            }
          }
        } else if (net === "SOLANA") {
          const transfers = await scanSolanaIncoming(payment.wallet_address);
          if (transfers.length > 0) {
            txHash = transfers[0].txHash;
            amountReceived = parseRawAmount(transfers[0].amountRaw, 6);
            found = true;
          }
        }
      } catch { /* network error — return pending */ }

      if (found && txHash && amountReceived) {
        console.log(`[merchant] check-payment ${payment.id} found tx ${txHash} on-chain`);
        // Dedup via merchant_payment_txs (same as poller)
        const [dup2] = await db.execute(sql`SELECT 1 FROM merchant_payment_txs WHERE tx_hash = ${txHash} LIMIT 1`);
        if ((dup2 as any[]).length > 0) {
          console.log(`[merchant] check-payment ${payment.id} tx ${txHash} already used — polling for new tx`);
        } else {
          const required = parseFloat(payment.amount ?? "0");
          const alreadyReceived = parseFloat(payment.amount_received ?? "0");
          const txNum = parseFloat(amountReceived);
          const newTotal = alreadyReceived + txNum;
          const isFullyPaid = required <= 0 || newTotal >= required * 0.99;

          // Atomically record tx — UNIQUE constraint prevents race
          try {
            await db.execute(sql`INSERT INTO merchant_payment_txs (payment_id, tx_hash, amount) VALUES (${payment.id}, ${txHash}, ${txNum})`);
          } catch { /* already inserted by poller */ }

          if (isFullyPaid) {
            const [upd] = await db.execute(sql`
              UPDATE merchant_payments
              SET status = 'confirmed', tx_hash = ${txHash}, amount_received = ${newTotal}, confirmed_at = NOW()
              WHERE id = ${payment.id} AND status IN ('pending', 'partially_paid')
            `);
            if ((upd as any).affectedRows === 1) {
              console.log(`[merchant] check-payment ${payment.id} confirmed: ${txHash} +${txNum} total=${newTotal}/${required}`);
              await db.execute(sql`UPDATE merchant_shops SET balance_usdt = balance_usdt + ${txNum}, total_received = total_received + ${txNum} WHERE id = ${shop.id}`);
              if (shop.webhookUrl) {
                sendWebhook(shop.webhookUrl, {
                  event_type: "payment.confirmed",
                  payment_id: payment.id,
                  order_id: payment.order_id ?? null,
                  external_user_id: payment.external_user_id ?? null,
                  amount_required: required,
                  amount_received: newTotal,
                  currency: payment.currency,
                  network: net,
                  tx_hash: txHash,
                });
              }
              return res.json({ status: "confirmed", tx_hash: txHash, amount_received: newTotal, confirmed_at: new Date().toISOString() });
            }
          } else {
            await db.execute(sql`
              UPDATE merchant_payments
              SET status = 'partially_paid', tx_hash = ${txHash}, amount_received = ${newTotal}
              WHERE id = ${payment.id} AND status IN ('pending', 'partially_paid')
            `);
            console.log(`[merchant] check-payment ${payment.id} partial: ${txHash} +${txNum} total=${newTotal}/${required}`);
            await db.execute(sql`UPDATE merchant_shops SET balance_usdt = balance_usdt + ${txNum}, total_received = total_received + ${txNum} WHERE id = ${shop.id}`);
            if (shop.webhookUrl) {
              sendWebhook(shop.webhookUrl, {
                event_type: "payment.partial",
                payment_id: payment.id,
                order_id: payment.order_id ?? null,
                external_user_id: payment.external_user_id ?? null,
                amount_required: required,
                amount_received: newTotal,
                amount_remaining: parseFloat((required - newTotal).toFixed(8)),
                currency: payment.currency,
                network: net,
                tx_hash: txHash,
              });
            }
            pollAddressForPayment(payment.id, payment.wallet_address, payment.network, payment.currency, payment.amount);
            return res.json({ status: "partially_paid", tx_hash: txHash, amount_received: newTotal, amount_required: required, amount_remaining: parseFloat((required - newTotal).toFixed(8)) });
          }
        }
      }

      // Nothing confirmed yet — kick off background polling
      pollAddressForPayment(payment.id, payment.wallet_address, payment.network, payment.currency, payment.amount);
      res.json({ status: payment.status, tx_hash: payment.tx_hash ?? null, amount_received: payment.amount_received ?? null });
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
        const [vtUpd] = await db.execute(sql`UPDATE merchant_payments SET status = 'confirmed', tx_hash = ${tx_hash}, amount_received = ${amount}, confirmed_at = NOW() WHERE id = ${payment_id} AND status = 'pending'`);
        if ((vtUpd as any).affectedRows === 1) {
          await db.execute(sql`UPDATE merchant_shops SET balance_usdt = balance_usdt + ${parseFloat(amount ?? "0")}, total_received = total_received + ${parseFloat(amount ?? "0")} WHERE id = ${shop.id}`);
        }
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
        SELECT i.*,
          s.name AS shop_name, s.webhook_url,
          UNIX_TIMESTAMP(i.expires_at) AS expires_at_unix
        FROM merchant_invoices i
        JOIN merchant_shops s ON s.id = i.shop_id
        WHERE i.invoice_number = ${req.params.number}
        LIMIT 1
      `);
      const inv = (rows[0] as any[])[0];
      if (!inv) return res.status(404).json({ error: "Invoice not found" });

      // Auto-expire only after network is selected (wallet_address set = payment window started)
      // Use SQL NOW() to avoid JS timezone/parsing issues with MySQL DATETIME
      if ((inv.status === "pending" || inv.status === "partially_paid") && inv.wallet_address) {
        const [expRows] = await db.execute(sql`
          UPDATE merchant_invoices SET status = 'expired'
          WHERE id = ${inv.id} AND status IN ('pending', 'partially_paid')
            AND wallet_address IS NOT NULL AND expires_at IS NOT NULL AND expires_at < NOW()
        `);
        if ((expRows as any).affectedRows > 0) inv.status = "expired";
      }

      // Convert MySQL DATETIME to UTC ISO string via UNIX_TIMESTAMP to avoid timezone ambiguity
      const expiresAtIso = inv.expires_at_unix ? new Date(Number(inv.expires_at_unix) * 1000).toISOString() : null;

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
        expires_at: expiresAtIso,
        confirmed_at: inv.confirmed_at,
        tx_hash: inv.tx_hash,
        amount_received: inv.amount_received ?? null,
      });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Customer selects network → reserve wallet for invoice
  app.post("/api/merchant/invoice/:number/select-network", async (req, res) => {
    const { network } = req.body;
    if (!network) return res.status(400).json({ error: "network is required" });
    try {
      const rows = await db.execute(sql`
        SELECT i.*, s.webhook_url, s.enabled_networks, s.address_mode, s.invoice_minutes
        FROM merchant_invoices i
        JOIN merchant_shops s ON s.id = i.shop_id
        WHERE i.invoice_number = ${req.params.number}
        LIMIT 1
      `);
      const inv = (rows[0] as any[])[0];
      if (!inv) return res.status(404).json({ error: "Invoice not found" });
      if (inv.status !== "pending") return res.status(400).json({ error: `Invoice is ${inv.status}` });
      // Check expiry via SQL NOW() to avoid JS timezone issues
      if (inv.wallet_address) {
        const [expChk] = await db.execute(sql`
          UPDATE merchant_invoices SET status = 'expired'
          WHERE id = ${inv.id} AND status = 'pending'
            AND wallet_address IS NOT NULL AND expires_at IS NOT NULL AND expires_at < NOW()
        `);
        if ((expChk as any).affectedRows > 0) {
          return res.status(400).json({ error: "Invoice expired" });
        }
      }
      if (inv.wallet_address) {
        return res.json({ address: inv.wallet_address, network: inv.network_chosen, expires_at: inv.expires_at });
      }

      // Validate network against invoice allowed networks
      const allowedNets: string[] = inv.networks ? JSON.parse(inv.networks) : [];
      if (allowedNets.length > 0 && !allowedNets.includes(network)) {
        return res.status(400).json({ error: `Network ${network} not allowed for this invoice` });
      }

      // Normalize TRON_GF → TRON + gasfree mode
      const walletNetwork = network === "TRON_GF" ? "TRON" : network;
      const walletMode = network === "TRON_GF" ? "gasfree" : "standard";

      // Clamp invoice_minutes: minimum 1, fallback 60, prevents instant expiry when value is 0/null
      const rawMins = parseInt(String(inv.invoice_minutes));
      const invMinsNet = (isNaN(rawMins) || rawMins < 1) ? 60 : rawMins;

      const wallet = await findOrReserveMerchantWallet(inv.shop_id, walletNetwork, walletMode, undefined, inv.invoice_number, "temporary", invMinsNet);
      const address = (walletMode === "gasfree" ? wallet.gasfree_address : null) || wallet.address;

      // Use MySQL NOW() + INTERVAL to avoid timezone mismatch between Node.js (UTC) and MySQL server timezone
      await db.execute(sql`
        UPDATE merchant_invoices
        SET wallet_id = ${wallet.id}, wallet_address = ${address}, network_chosen = ${network},
            expires_at = NOW() + INTERVAL ${invMinsNet} MINUTE
        WHERE id = ${inv.id}
      `);

      // Read back expires_at via UNIX_TIMESTAMP for timezone-safe UTC conversion
      const [updRows] = await db.execute(sql`SELECT UNIX_TIMESTAMP(expires_at) AS expires_at_unix FROM merchant_invoices WHERE id = ${inv.id}`);
      const expiresAtUnix: number | null = (updRows as any[])[0]?.expires_at_unix ?? null;
      const expiresAtIso = expiresAtUnix ? new Date(Number(expiresAtUnix) * 1000).toISOString() : null;
      const deadlineMs = expiresAtUnix ? Number(expiresAtUnix) * 1000 : Date.now() + invMinsNet * 60 * 1000;

      // Start polling for this invoice payment (use walletNetwork for scanner, pass actual deadline and created_at for time-based filtering)
      pollInvoiceForPayment(inv.id, address, walletNetwork, inv.currency, inv.amount, inv.shop_id, inv.webhook_url, inv.order_ref, deadlineMs,
        inv.created_at ? new Date(inv.created_at) : new Date());

      return res.json({ address, network, expires_at: expiresAtIso });
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
      const reference = order_id ? `API-${order_id}` : generatePayoutRef();
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
      console.log(`[Balance] Checking ${wallet.network} for wallet #${walletId} addr=${wallet.address?.slice(0,10)}...`);
      let balance = await checkWalletBalanceOnChain(wallet.network, wallet.address);
      console.log(`[Balance] On-chain result: ${balance}`);
      if (balance === null) {
        balance = await checkWalletBalanceViaApi(wallet.network, wallet.address);
        console.log(`[Balance] Wallet API fallback result: ${balance}`);
      }

      // If all checks failed but network is known, save 0 rather than returning error
      if (balance === null && SUPPORTED_WALLET_NODES[wallet.network]) {
        console.log(`[Balance] Both checks failed, defaulting to 0 for known network ${wallet.network}`);
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

  // Resume any pending payments/invoices that were active before the last server restart
  setImmediate(() => recoverPendingPollers());
}
