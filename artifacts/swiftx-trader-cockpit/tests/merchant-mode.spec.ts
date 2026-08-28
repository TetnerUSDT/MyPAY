import { expect, test, type Page } from "@playwright/test";

const orders = [
  {
    id: 101,
    status: "paid",
    side: "sell",
    fiatAmount: "9500",
    assetAmount: "100",
    assetCurrency: "USDT",
    createdAt: "2026-08-28T10:00:00.000Z",
    isCurrentUserBuyer: false,
    buyerName: "Покупатель 101",
    sellerName: "Мерчант",
  },
  {
    id: 102,
    status: "waiting_payment",
    side: "sell",
    fiatAmount: "4750",
    assetAmount: "50",
    assetCurrency: "USDT",
    createdAt: "2026-08-28T10:01:00.000Z",
    isCurrentUserBuyer: false,
    buyerName: "Покупатель 102",
    sellerName: "Мерчант",
  },
  {
    id: 103,
    status: "dispute",
    side: "buy",
    fiatAmount: "1900",
    assetAmount: "20",
    assetCurrency: "USDT",
    createdAt: "2026-08-28T10:02:00.000Z",
    isCurrentUserBuyer: true,
    buyerName: "Трейдер",
    sellerName: "Продавец 103",
  },
];

const initialAds = [
  {
    id: 201,
    status: "active",
    side: "sell",
    price: "95.50",
    availableAmount: "100",
    minAmount: "1000",
    maxAmount: "9500",
    assetCurrency: "USDT",
    isPromoted: false,
  },
  {
    id: 202,
    status: "paused",
    side: "buy",
    price: "94.80",
    availableAmount: "80",
    minAmount: "500",
    maxAmount: "7500",
    assetCurrency: "USDT",
    isPromoted: false,
  },
];

type MutationLog = {
  status: Array<{ id: number; value: string }>;
  promote: number[];
  bulk: string[];
  create: Record<string, unknown>[];
  delete: number[];
};

async function mockMerchantApi(page: Page): Promise<MutationLog> {
  const ads = structuredClone(initialAds);
  const log: MutationLog = {
    status: [],
    promote: [],
    bulk: [],
    create: [],
    delete: [],
  };

  await page.addInitScript(() => {
    localStorage.setItem("userApiKey", "merchant-mode-browser-test");
    if (!sessionStorage.getItem("merchantModeTestInitialized")) {
      sessionStorage.removeItem("swiftxCockpitMode");
      sessionStorage.setItem("merchantModeTestInitialized", "true");
    }
  });

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });

    if (request.method() === "GET" && path === "/api/auth/me") {
      return json({ id: 42, name: "Тестовый мерчант", username: "merchant-test" });
    }
    if (request.method() === "GET" && path === "/api/p2p/dashboard") {
      return json({
        merchantLevel: "verified",
        rating: 4.98,
        successfulPercent: 99.4,
        totalOrders: 128,
        completedOrders: 126,
        avgReleaseTimeSeconds: 42,
        disputesTotal: 1,
      });
    }
    if (request.method() === "GET" && path === "/api/p2p/orders") {
      return json(orders);
    }
    if (request.method() === "GET" && path === "/api/p2p/my-ads") {
      return json(ads);
    }
    if (request.method() === "GET" && path === "/api/user/crypto-balances") {
      return json([{ id: 3, sum: "100", currency: "USDT", network: "TRC20" }]);
    }
    if (request.method() === "GET" && path === "/api/p2p/payment-methods") {
      return json([{ id: 1, title: "Сбербанк" }]);
    }
    if (request.method() === "GET" && path === "/api/p2p/user-payment-methods") {
      return json([{ methodId: 1 }]);
    }
    if (request.method() === "GET" && /^\/api\/p2p\/orders\/\d+$/.test(path)) {
      const id = Number(path.split("/").pop());
      return json(orders.find((order) => order.id === id) ?? orders[0]);
    }
    if (request.method() === "GET" && /^\/api\/p2p\/orders\/\d+\/messages$/.test(path)) {
      return json([]);
    }

    if (request.method() === "PATCH" && path === "/api/p2p/ads/bulk") {
      const body = request.postDataJSON() as { status: string };
      log.bulk.push(body.status);
      for (const ad of ads) ad.status = body.status;
      return json({ success: true });
    }
    if (request.method() === "PATCH" && /^\/api\/p2p\/ads\/\d+$/.test(path)) {
      const id = Number(path.split("/").pop());
      const body = request.postDataJSON() as { status: string };
      log.status.push({ id, value: body.status });
      const ad = ads.find((candidate) => candidate.id === id);
      if (ad) ad.status = body.status;
      return json(ad ?? { id, ...body });
    }
    if (request.method() === "POST" && /^\/api\/p2p\/ads\/\d+\/promote$/.test(path)) {
      const id = Number(path.split("/")[4]);
      log.promote.push(id);
      const ad = ads.find((candidate) => candidate.id === id);
      if (ad) ad.isPromoted = true;
      return json({ success: true });
    }
    if (request.method() === "POST" && path === "/api/p2p/ads") {
      const body = request.postDataJSON() as Record<string, unknown>;
      log.create.push(body);
      ads.push({
        id: 203,
        status: "active",
        side: String(body.side ?? "sell"),
        price: String(body.price ?? "0"),
        availableAmount: String(body.availableAmount ?? "0"),
        minAmount: String(body.minAmount ?? "0"),
        maxAmount: String(body.maxAmount ?? "0"),
        assetCurrency: "USDT",
        isPromoted: false,
      });
      return json({ success: true, id: 203 });
    }
    if (request.method() === "DELETE" && /^\/api\/p2p\/ads\/\d+$/.test(path)) {
      const id = Number(path.split("/").pop());
      log.delete.push(id);
      const index = ads.findIndex((candidate) => candidate.id === id);
      if (index >= 0) ads.splice(index, 1);
      return json({ success: true });
    }

    return route.fallback();
  });

  return log;
}

async function openMerchantMode(page: Page) {
  await page.goto("/trader-cockpit/");
  await expect(page.getByTestId("workspace-mode-trigger")).toContainText("Пользователь");
  await page.getByTestId("workspace-mode-trigger").click();
  await page.getByTestId("workspace-mode-merchant").click();
  await expect(page.getByRole("heading", { name: "Кабинет мерчанта" })).toBeVisible();
}

test.describe("merchant workspace", () => {
  test("switches modes without navigating and supports keyboard dismissal", async ({ page }) => {
    await mockMerchantApi(page);
    await openMerchantMode(page);

    expect(new URL(page.url()).pathname).toBe("/trader-cockpit/");
    await expect(page.getByTestId("workspace-mode-trigger")).toContainText("Мерчант");
    await expect(page.getByTestId("workspace-mode-trigger")).toBeFocused();

    await page.getByTestId("workspace-mode-trigger").click();
    await expect(page.getByTestId("workspace-mode-merchant")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("workspace-mode-merchant")).toBeHidden();
    await expect(page.getByTestId("workspace-mode-trigger")).toBeFocused();

    await page.getByTestId("workspace-mode-trigger").click();
    await page.locator("h1", { hasText: "P2P Exchange" }).click();
    await expect(page.getByTestId("workspace-mode-user")).toBeHidden();
    await expect(page.getByTestId("workspace-mode-trigger")).toBeFocused();
  });

  test("persists merchant mode after a reload in the same session", async ({ page }) => {
    await mockMerchantApi(page);
    await openMerchantMode(page);

    await page.reload();
    await expect(page.getByTestId("workspace-mode-trigger")).toContainText("Мерчант");
    await expect(page.getByRole("heading", { name: "Кабинет мерчанта" })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/trader-cockpit/");
  });

  test("keeps incoming and other active orders visible and opens their detail route", async ({ page }) => {
    await mockMerchantApi(page);
    await openMerchantMode(page);

    for (const order of orders) {
      await expect(page.getByRole("button", { name: new RegExp(`#${order.id}`) })).toBeVisible();
    }
    await page.getByRole("button", { name: /#103/ }).click();
    await expect(page).toHaveURL(/\/trader-cockpit\/order\/103$/);
    await expect(page.getByText("Ордер #103")).toBeVisible();
  });

  test("covers ad mutations, creation, and accessible close confirmation", async ({ page }) => {
    const log = await mockMerchantApi(page);
    await openMerchantMode(page);

    const firstAd = page.getByTestId("merchant-ad-201");
    await firstAd.getByTitle("Приостановить").click();
    await expect.poll(() => log.status).toEqual([{ id: 201, value: "paused" }]);
    await expect(firstAd.getByTitle("Активировать")).toBeVisible();

    await firstAd.getByTitle("Активировать").click();
    await expect.poll(() => log.status).toEqual([
      { id: 201, value: "paused" },
      { id: 201, value: "active" },
    ]);

    await page.getByTitle("Продвинуть в топ").first().click();
    await expect.poll(() => log.promote).toEqual([201]);
    await expect(firstAd.getByText("Продвинуто")).toBeVisible();

    await page.getByRole("button", { name: "ВЫКЛ ВСЕ" }).click();
    await expect.poll(() => log.bulk).toEqual(["paused"]);
    await page.getByRole("button", { name: "ВКЛ ВСЕ" }).click();
    await expect.poll(() => log.bulk).toEqual(["paused", "active"]);

    await page.getByRole("button", { name: "Создать объявление" }).first().click();
    await expect(page.getByRole("dialog", { name: /Создать объявление/ })).toBeVisible();
    await page.getByPlaceholder("Например, 95.50").fill("95.50");
    await page.getByPlaceholder("Доступно для сделок").fill("100");
    await page.getByPlaceholder("От").fill("10");
    await page.getByPlaceholder("До", { exact: true }).fill("100");
    await page.getByRole("button", { name: "Сбербанк" }).click();
    await page.getByRole("button", { name: "Разместить объявление" }).click();
    await expect.poll(() => log.create).toHaveLength(1);
    expect(log.create[0]).toMatchObject({
      side: "sell",
      price: 95.5,
      minAmount: 10,
      maxAmount: 100,
      availableAmount: 100,
      paymentMethodIds: [1],
    });
    await expect(page.getByRole("dialog", { name: /Создать объявление/ })).toBeHidden();

    const closeButton = page.getByTitle("Закрыть объявление").first();
    await closeButton.click();
    const confirmation = page.getByRole("alertdialog");
    await expect(confirmation).toBeVisible();
    await expect(confirmation.getByRole("button", { name: "Отмена" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(confirmation).toBeHidden();
    await expect(closeButton).toBeFocused();

    await closeButton.click();
    await confirmation.getByRole("button", { name: "Закрыть" }).click();
    await expect.poll(() => log.delete).toEqual([201]);
  });
});