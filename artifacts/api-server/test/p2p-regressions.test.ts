import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import { sql } from "drizzle-orm";

type Db = typeof import("../src/db");
type Fixture = Awaited<ReturnType<typeof createFixture>>;

const telegramFetch = globalThis.fetch;
const originalTelegramFetch = telegramFetch;
globalThis.fetch = async (input, init) => {
  const url = typeof input === "string"
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;

  if (url.startsWith("https://api.telegram.org/")) {
    return new Response(JSON.stringify({ ok: true, result: {} }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  return originalTelegramFetch(input, init);
};

const { db, pool }: Db = await import("../src/db");
const { registerP2PRoutes } = await import("../src/p2p/index");
const { runP2PMigrations } = await import("../src/p2p-migrations");
const express = (await import("express")).default;

let server: Server;
let baseUrl: string;
const usersByApiKey = new Map<string, number>();

function rows<T = Record<string, unknown>>(result: any): T[] {
  return result[0] as T[];
}

async function query<T = Record<string, unknown>>(statement: ReturnType<typeof sql>): Promise<T[]> {
  return rows<T>(await db.execute(statement));
}

async function insertId(statement: ReturnType<typeof sql>): Promise<number> {
  const result = await db.execute(statement);
  return Number((result[0] as any).insertId);
}

function idList(ids: number[]) {
  return sql.join(ids.map((id) => sql`${id}`), sql`, `);
}

async function createFixture(side: "buy" | "sell") {
  const tag = randomUUID().replaceAll("-", "");
  const userIds: number[] = [];
  const balanceIds: number[] = [];
  const paymentMethodIds: number[] = [];
  const adIds: number[] = [];
  const orderIds: number[] = [];

  const platformRows = await query<{ value: string | null }>(sql`
    SELECT value FROM p2p_settings WHERE \`key\` = 'platform_user_id'
  `);
  const platformUserId = Number(platformRows[0]?.value) || null;
  const createUser = async (role: "seller" | "buyer") => {
    for (let attempt = 0; ; attempt += 1) {
      const key = `test-p2p-${role}-${tag}-${attempt}`;
      const id = await insertId(sql`
        INSERT INTO users (tg_id, api_key, name, status, blocked)
        VALUES (${key}, ${key}, ${`P2P test ${role}`}, 'active', 0)
      `);
      userIds.push(id);
      if (id !== platformUserId) return { id, key };
    }
  };
  const seller = await createUser("seller");
  const buyer = await createUser("buyer");
  const sellerId = seller.id;
  const buyerId = buyer.id;
  const sellerKey = seller.key;
  const buyerKey = buyer.key;
  usersByApiKey.set(sellerKey, sellerId);
  usersByApiKey.set(buyerKey, buyerId);

  const assetBalanceId = await insertId(sql`
    INSERT INTO balances (title, currency, network, type, status)
    VALUES (${`P2P test asset ${tag}`}, 'USDT', 'TRC20', 'crypto', 'active')
  `);
  balanceIds.push(assetBalanceId);

  // For sell ads, the available amount represents funds already frozen while
  // creating the ad. For buy ads, the seller starts with the full balance.
  await db.execute(sql`
    INSERT INTO users_balances (id_user, id_balance, sum, status)
    VALUES (${sellerId}, ${assetBalanceId}, ${side === "sell" ? 80 : 100}, 'active')
  `);
  await db.execute(sql`
    INSERT INTO users_balances (id_user, id_balance, sum, status)
    VALUES (${buyerId}, ${assetBalanceId}, 0, 'active')
  `);

  const selectedPaymentMethodId = await insertId(sql`
    INSERT INTO p2p_payment_methods (title, code, country, currency, status)
    VALUES ('P2P test selected', ${`selected-${tag}`}, 'RU', 'RUB', 'active')
  `);
  const unrelatedPaymentMethodId = await insertId(sql`
    INSERT INTO p2p_payment_methods (title, code, country, currency, status)
    VALUES ('P2P test unrelated', ${`unrelated-${tag}`}, 'RU', 'RUB', 'active')
  `);
  paymentMethodIds.push(selectedPaymentMethodId, unrelatedPaymentMethodId);

  await db.execute(sql`
    INSERT INTO p2p_user_payment_methods
      (user_id, method_id, account_name, account_number, bank_name, status)
    VALUES
      (${sellerId}, ${selectedPaymentMethodId}, 'Selected account', ${`selected-account-${tag}`}, 'Selected bank', 'active'),
      (${sellerId}, ${unrelatedPaymentMethodId}, 'Unrelated account', ${`unrelated-account-${tag}`}, 'Unrelated bank', 'active')
  `);

  const adOwnerId = side === "sell" ? sellerId : buyerId;
  const adId = await insertId(sql`
    INSERT INTO p2p_ads
      (user_id, side, asset_balance_id, price, min_amount, max_amount,
       available_amount, payment_time_minutes, status, balance_locked, created_at, updated_at)
    VALUES
      (${adOwnerId}, ${side}, ${assetBalanceId}, 2, 1, 20,
       20, 15, 'active', ${side === "sell" ? 1 : 0}, NOW(), NOW())
  `);
  adIds.push(adId);
  await db.execute(sql`
    INSERT INTO p2p_ad_payment_methods (ad_id, method_id)
    VALUES (${adId}, ${selectedPaymentMethodId})
  `);

  return {
    tag,
    sellerId,
    buyerId,
    sellerKey,
    buyerKey,
    assetBalanceId,
    selectedPaymentMethodId,
    unrelatedPaymentMethodId,
    adId,
    userIds,
    balanceIds,
    paymentMethodIds,
    adIds,
    orderIds,
  };
}

async function cleanupFixture(fixture: Fixture) {
  const users = idList(fixture.userIds);
  const balances = idList(fixture.balanceIds);
  const paymentMethods = idList(fixture.paymentMethodIds);
  const ads = idList(fixture.adIds);
  const orders = fixture.orderIds.length ? idList(fixture.orderIds) : sql`NULL`;

  await db.execute(sql`DELETE FROM p2p_logs WHERE user_id IN (${users})`);
  if (fixture.orderIds.length) {
    await db.execute(sql`DELETE FROM p2p_reviews WHERE order_id IN (${orders})`);
    await db.execute(sql`DELETE FROM p2p_disputes WHERE order_id IN (${orders})`);
    await db.execute(sql`DELETE FROM p2p_balance_locks WHERE order_id IN (${orders})`);
    await db.execute(sql`DELETE FROM p2p_order_messages WHERE order_id IN (${orders})`);
    await db.execute(sql`DELETE FROM p2p_orders WHERE id IN (${orders})`);
  }
  await db.execute(sql`DELETE FROM p2p_ad_payment_methods WHERE ad_id IN (${ads})`);
  await db.execute(sql`DELETE FROM p2p_ads WHERE id IN (${ads})`);
  await db.execute(sql`DELETE FROM p2p_user_payment_methods WHERE user_id IN (${users})`);
  await db.execute(sql`DELETE FROM p2p_user_stats WHERE user_id IN (${users})`);
  await db.execute(sql`DELETE FROM users_balances WHERE id_user IN (${users})`);
  await db.execute(sql`DELETE FROM users WHERE id IN (${users})`);
  await db.execute(sql`DELETE FROM p2p_payment_methods WHERE id IN (${paymentMethods})`);
  await db.execute(sql`DELETE FROM balances WHERE id IN (${balances})`);

  usersByApiKey.delete(fixture.sellerKey);
  usersByApiKey.delete(fixture.buyerKey);
}

async function request(
  path: string,
  apiKey: string,
  options: { method?: string; body?: Record<string, unknown> } = {},
) {
  const response = await originalTelegramFetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const body = await response.json();
  return { status: response.status, body };
}

async function balanceSum(userId: number, balanceId: number) {
  const result = await query<{ sum: string }>(sql`
    SELECT COALESCE(SUM(sum), 0) AS sum FROM users_balances
    WHERE id_user = ${userId} AND id_balance = ${balanceId}
  `);
  return Number(result[0]?.sum ?? 0);
}

before(async () => {
  await runP2PMigrations();

  const app = express();
  app.use(express.json());
  registerP2PRoutes(app, (req: any, res: any, next: any) => {
    const userId = usersByApiKey.get(req.headers["x-api-key"]);
    if (!userId) return res.status(401).json({ message: "Invalid test API key" });
    req.user = { id: userId };
    next();
  });

  await new Promise<void>((resolve) => {
    server = createServer(app).listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not start");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
  await pool.end();
});

test("takes a sell ad, locks only the seller, and releases the seller's escrow", async () => {
  const fixture = await createFixture("sell");
  try {
    const wrongMethod = await request(`/api/p2p/orders`, fixture.buyerKey, {
      method: "POST",
      body: { adId: fixture.adId, assetAmount: 10, paymentMethodId: fixture.unrelatedPaymentMethodId },
    });
    assert.equal(wrongMethod.status, 400);
    assert.match(wrongMethod.body.message, /доступный.*способ оплаты/i);

    const created = await request(`/api/p2p/orders`, fixture.buyerKey, {
      method: "POST",
      body: { adId: fixture.adId, assetAmount: 10, paymentMethodId: fixture.selectedPaymentMethodId },
    });
    assert.equal(created.status, 200);
    fixture.orderIds.push(created.body.id);
    assert.equal(created.body.buyerId, fixture.buyerId);
    assert.equal(created.body.sellerId, fixture.sellerId);

    const lock = await query<{ user_id: number; amount: string; status: string }>(sql`
      SELECT user_id, amount, status FROM p2p_balance_locks WHERE order_id = ${created.body.id}
    `);
    assert.deepEqual(lock, [{ user_id: fixture.sellerId, amount: "10.00000000", status: "locked" }]);
    assert.equal(await balanceSum(fixture.sellerId, fixture.assetBalanceId), 80);
    assert.equal(await balanceSum(fixture.buyerId, fixture.assetBalanceId), 0);

    const detail = await request(`/api/p2p/orders/${created.body.id}`, fixture.buyerKey);
    assert.equal(detail.status, 200);
    assert.deepEqual(
      detail.body.sellerPaymentDetails.map((method: any) => method.accountNumber),
      [`selected-account-${fixture.tag}`],
    );

    const markedPaid = await request(`/api/p2p/orders/${created.body.id}/mark-paid`, fixture.buyerKey, {
      method: "POST",
    });
    assert.equal(markedPaid.status, 200);
    const released = await request(`/api/p2p/orders/${created.body.id}/release`, fixture.sellerKey, {
      method: "POST",
    });
    assert.equal(released.status, 200, JSON.stringify(released.body));

    const releasedLock = await query<{ user_id: number; status: string }>(sql`
      SELECT user_id, status FROM p2p_balance_locks WHERE order_id = ${created.body.id}
    `);
    assert.deepEqual(releasedLock, [{ user_id: fixture.sellerId, status: "released" }]);
    assert.equal(await balanceSum(fixture.sellerId, fixture.assetBalanceId), 80);
    assert.equal(await balanceSum(fixture.buyerId, fixture.assetBalanceId), 9.98);
  } finally {
    await cleanupFixture(fixture);
  }
});

test("takes a buy ad and locks and releases the taker's seller balance", async () => {
  const fixture = await createFixture("buy");
  try {
    const created = await request(`/api/p2p/orders`, fixture.sellerKey, {
      method: "POST",
      body: { adId: fixture.adId, assetAmount: 10, paymentMethodId: fixture.selectedPaymentMethodId },
    });
    assert.equal(created.status, 200);
    fixture.orderIds.push(created.body.id);
    assert.equal(created.body.buyerId, fixture.buyerId);
    assert.equal(created.body.sellerId, fixture.sellerId);

    const lock = await query<{ user_id: number; status: string }>(sql`
      SELECT user_id, status FROM p2p_balance_locks WHERE order_id = ${created.body.id}
    `);
    assert.deepEqual(lock, [{ user_id: fixture.sellerId, status: "locked" }]);
    assert.equal(await balanceSum(fixture.sellerId, fixture.assetBalanceId), 90);
    assert.equal(await balanceSum(fixture.buyerId, fixture.assetBalanceId), 0);

    assert.equal(
      (await request(`/api/p2p/orders/${created.body.id}/mark-paid`, fixture.buyerKey, { method: "POST" })).status,
      200,
    );
    const released = await request(`/api/p2p/orders/${created.body.id}/release`, fixture.sellerKey, { method: "POST" });
    assert.equal(released.status, 200, JSON.stringify(released.body));

    const releasedLock = await query<{ user_id: number; status: string }>(sql`
      SELECT user_id, status FROM p2p_balance_locks WHERE order_id = ${created.body.id}
    `);
    assert.deepEqual(releasedLock, [{ user_id: fixture.sellerId, status: "released" }]);
    assert.equal(await balanceSum(fixture.sellerId, fixture.assetBalanceId), 90);
    assert.equal(await balanceSum(fixture.buyerId, fixture.assetBalanceId), 9.98);
  } finally {
    await cleanupFixture(fixture);
  }
});

test("refunds a cancelled sell ad only once when deletion is repeated", async () => {
  const fixture = await createFixture("sell");
  try {
    const firstDeletion = await request(`/api/p2p/ads/${fixture.adId}`, fixture.sellerKey, { method: "DELETE" });
    assert.equal(firstDeletion.status, 200, JSON.stringify(firstDeletion.body));
    assert.equal(await balanceSum(fixture.sellerId, fixture.assetBalanceId), 100);

    assert.equal((await request(`/api/p2p/ads/${fixture.adId}`, fixture.sellerKey, { method: "DELETE" })).status, 200);
    assert.equal(await balanceSum(fixture.sellerId, fixture.assetBalanceId), 100);

    const ad = await query<{ status: string; balance_locked: number; available_amount: string }>(sql`
      SELECT status, balance_locked, available_amount FROM p2p_ads WHERE id = ${fixture.adId}
    `);
    assert.deepEqual(ad, [{ status: "cancelled", balance_locked: 0, available_amount: "0.00000000" }]);
  } finally {
    await cleanupFixture(fixture);
  }
});