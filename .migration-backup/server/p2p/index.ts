import type { Express } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";
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
    // Always upsert defaults by code — ensures table is never empty and stays in sync
    for (const m of DEFAULT_PAYMENT_METHODS) {
      await db.execute(sql`
        INSERT INTO p2p_payment_methods (title, code, country, currency, status, sort_order)
        VALUES (${m.title}, ${m.code}, ${m.country}, ${m.currency}, 'active', 0)
        ON DUPLICATE KEY UPDATE title = VALUES(title), country = VALUES(country), currency = VALUES(currency)
      `);
    }
    console.log("[P2P] Payment methods synced");
  } catch (err) {
    console.error("[P2P] Failed to seed payment methods:", err);
  }
}

export function registerP2PRoutes(app: Express, requireApiKey: any) {
  registerAdsRoutes(app, requireApiKey);
  registerOrdersRoutes(app, requireApiKey);
  registerMiscRoutes(app, requireApiKey);
}
