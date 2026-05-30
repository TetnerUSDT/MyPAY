import type { Express } from "express";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { p2pPaymentMethods } from "@shared/schema";
import { registerAdsRoutes } from "./routes-ads";
import { registerOrdersRoutes } from "./routes-orders";
import { registerMiscRoutes } from "./routes-misc";

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
  registerAdsRoutes(app, requireApiKey);
  registerOrdersRoutes(app, requireApiKey);
  registerMiscRoutes(app, requireApiKey);
}
