import { sql } from "drizzle-orm";
import { mysqlTable, text, varchar, decimal, timestamp, json, int, boolean, mysqlEnum } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Define enums
export const balanceTypeEnum = mysqlEnum('balance_type', ['fiat', 'crypto', 'token', 'voucher']);
export const exchangeStatusEnum = mysqlEnum('exchange_status', ['wait', 'wait-paid', 'paid', 'complete', 'canceled', 'dispute']);
export const supportTicketStatusEnum = mysqlEnum('support_ticket_status', ['wait-user', 'wait-support', 'closed']);
export const messageSenderEnum = mysqlEnum('message_sender', ['user', 'support']);

export const balances = mysqlTable("balances", {
  id: int("id").primaryKey().autoincrement(),
  title: varchar("title", { length: 255 }).notNull(),
  network: varchar("network", { length: 50 }),
  currency: varchar("currency", { length: 10 }).notNull(),
  rate: decimal("rate", { precision: 18, scale: 8 }),
  type: balanceTypeEnum.notNull().default("fiat"),
  status: varchar("status", { length: 50 }),
});

export const users = mysqlTable("users", {
  id: int("id").primaryKey().autoincrement(),
  tgId: varchar("tg_id", { length: 255 }).notNull().unique(),
  google: varchar("google", { length: 255 }),
  apiKey: varchar("api_key", { length: 255 }).unique(),
  name: varchar("name", { length: 255 }),
  img: varchar("img", { length: 255 }),
  status: varchar("status", { length: 50 }),
  agreement: int("agreement").default(0), // 0 not agree, 1 agree with rules
  blocked: boolean("blocked").default(false),
  defaultFiatBalanceId: int("default_fiat_balance_id"),
  idRef: int("id_ref"),
  codeRef: varchar("code_ref", { length: 20 }).unique(),
});

export const usersBalances = mysqlTable("users_balances", {
  id: int("id").primaryKey().autoincrement(),
  idBalance: int("id_balance").notNull().references(() => balances.id, { onDelete: "cascade" }),
  idUser: int("id_user").notNull().references(() => users.id, { onDelete: "cascade" }),
  sum: decimal("sum", { precision: 18, scale: 8 }).default("0.0"),
  status: varchar("status", { length: 50 }),
});

export const wallets = mysqlTable("wallets", {
  id: int("id").primaryKey().autoincrement(),
  idUser: int("id_user").references(() => users.id, { onDelete: "cascade" }),
  network: varchar("network", { length: 50 }).notNull(),
  address: varchar("address", { length: 255 }).notNull(),
  privateKey: varchar("private_key", { length: 500 }),
  reservationTime: timestamp("reservation_time"),
  reserved: varchar("reserved", { length: 50 }), // exchange, topup, voucher, personal, etc.
  status: varchar("status", { length: 50 }),
});

export const cards = mysqlTable("cards", {
  id: int("id").primaryKey().autoincrement(),
  title: varchar("title", { length: 255 }).notNull(),
  country: varchar("country", { length: 50 }).notNull(),
  lang: varchar("lang", { length: 255 }),
  timeExchange: int("time_exchange").notNull(),
  commission: decimal("commission", { precision: 5, scale: 2 }).notNull(),
  idBalance: varchar("id_balance", { length: 255 }), // Can store multiple balance IDs separated by comma
  status: varchar("status", { length: 50 }).default("1"), // "0" = hidden, "1" = visible
});

export const banks = mysqlTable("banks", {
  id: int("id").primaryKey().autoincrement(),
  cardId: int("card_id").notNull().references(() => cards.id, { onDelete: "cascade" }),
  bankName: varchar("bank_name", { length: 255 }).notNull(),
  timeExchange: int("time_exchange"),
  commission: decimal("commission", { precision: 5, scale: 2 }),
  status: varchar("status", { length: 50 }).default("1"),
});

export const userCards = mysqlTable("user_cards", {
  id: int("id").primaryKey().autoincrement(),
  idCard: int("id_card").notNull().references(() => cards.id, { onDelete: "cascade" }),
  idUser: int("id_user").notNull().references(() => users.id, { onDelete: "cascade" }),
  idBank: int("id_bank").references(() => banks.id, { onDelete: "set null" }),
  name: varchar("name", { length: 100 }),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  phone: varchar("phone", { length: 20 }),
  country: varchar("country", { length: 50 }).notNull(),
  numberCard: varchar("number_card", { length: 50 }).notNull(),
  status: varchar("status", { length: 50 }),
});

export const exchanges = mysqlTable("exchanges", {
  id: int("id").primaryKey().autoincrement(),
  numberOrder: varchar("number_order", { length: 50 }).notNull().unique(),
  idUser: int("id_user").notNull().references(() => users.id, { onDelete: "cascade" }),
  walletId: int("wallet_id").references(() => wallets.id, { onDelete: "set null" }),
  idBalanceFrom: int("id_balance_from").references(() => balances.id, { onDelete: "set null" }),
  idBalanceTo: int("id_balance_to").references(() => balances.id, { onDelete: "set null" }),
  idCard: int("id_card").references(() => userCards.id, { onDelete: "set null" }),
  manualCardNumber: varchar("manual_card_number", { length: 50 }),
  fromCurrency: varchar("from_currency", { length: 10 }).notNull(),
  toCurrency: varchar("to_currency", { length: 10 }).notNull(),
  amountFrom: decimal("amount_from", { precision: 18, scale: 8 }).notNull(),
  amountTo: decimal("amount_to", { precision: 18, scale: 8 }).notNull(),
  rate: decimal("rate", { precision: 18, scale: 8 }).notNull(),
  commission: decimal("commission", { precision: 18, scale: 8 }).default("0.0"),
  timestamp: timestamp("timestamp").default(sql`CURRENT_TIMESTAMP`),
  status: exchangeStatusEnum.notNull().default("wait"),
  cancelReason: text("cancel_reason"),
  paymentHash: text("payment_hash"),
});

export const stats = mysqlTable("stats", {
  id: int("id").primaryKey().autoincrement(),
  statType: varchar("stat_type", { length: 100 }).notNull(),
  idExchange: int("id_exchange").notNull().references(() => exchanges.id, { onDelete: "cascade" }),
  sum: decimal("sum", { precision: 18, scale: 8 }),
  timestamp: timestamp("timestamp").default(sql`CURRENT_TIMESTAMP`),
  idUser: int("id_user").references(() => users.id, { onDelete: "cascade" }),
});

// Keep legacy transactions table for compatibility
export const transactions = mysqlTable("transactions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  orderId: text("order_id").notNull().unique(),
  userId: int("user_id").references(() => users.id),
  fromCurrency: text("from_currency").notNull(),
  toCurrency: text("to_currency").notNull(),
  fromAmount: decimal("from_amount", { precision: 18, scale: 8 }).notNull(),
  toAmount: decimal("to_amount", { precision: 18, scale: 8 }).notNull(),
  fromAddress: text("from_address"),
  toAddress: text("to_address"),
  cardNumber: text("card_number"),
  status: text("status").notNull().default("pending"), // pending, processing, completed, failed
  txHash: text("tx_hash"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  completedAt: timestamp("completed_at"),
});

export const exchangeRates = mysqlTable("exchange_rates", {
  id: varchar("id", { length: 36 }).primaryKey(),
  fromBalanceId: int("from_balance_id").notNull().references(() => balances.id),
  toBalanceId: int("to_balance_id").notNull().references(() => balances.id),
  fromCurrency: text("from_currency").notNull(),
  toCurrency: text("to_currency").notNull(),
  rate: decimal("rate", { precision: 18, scale: 8 }).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

export const supportChats = mysqlTable("support_chats", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: int("user_id").references(() => users.id),
  transactionId: varchar("transaction_id", { length: 36 }).references(() => transactions.id),
  messages: json("messages").$type<{ sender: string; message: string; timestamp: Date }[]>(),
  status: text("status").notNull().default("open"), // open, closed
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const supportTickets = mysqlTable("support_tickets", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  exchangeId: int("exchange_id").notNull().references(() => exchanges.id, { onDelete: "cascade" }),
  status: supportTicketStatusEnum.notNull().default("wait-support"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

export const supportMessages = mysqlTable("support_messages", {
  id: int("id").primaryKey().autoincrement(),
  ticketId: int("ticket_id").notNull().references(() => supportTickets.id, { onDelete: "cascade" }),
  sender: messageSenderEnum.notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const admins = mysqlTable("admins", {
  id: int("id").primaryKey().autoincrement(),
  username: varchar("username", { length: 100 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }),
  permissions: json("permissions").$type<string[]>(),
  status: varchar("status", { length: 50 }).default("active"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
});

export const insertBalanceSchema = createInsertSchema(balances).omit({
  id: true,
});

export const insertUsersBalancesSchema = createInsertSchema(usersBalances).omit({
  id: true,
});

export const insertWalletSchema = createInsertSchema(wallets).omit({
  id: true,
});

export const insertCardSchema = createInsertSchema(cards).omit({
  id: true,
});

export const insertBankSchema = createInsertSchema(banks).omit({
  id: true,
});

export const insertUserCardSchema = createInsertSchema(userCards).omit({
  id: true,
});

export const insertExchangeSchema = createInsertSchema(exchanges).omit({
  id: true,
});

export const insertStatSchema = createInsertSchema(stats).omit({
  id: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  orderId: true,
  createdAt: true,
  completedAt: true,
}).partial({
  userId: true,
});

export const insertExchangeRateSchema = createInsertSchema(exchangeRates).omit({
  id: true,
  updatedAt: true,
  fromCurrency: true,
  toCurrency: true,
});

export const insertSupportChatSchema = createInsertSchema(supportChats).omit({
  id: true,
  createdAt: true,
});

export const insertSupportTicketSchema = createInsertSchema(supportTickets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSupportMessageSchema = createInsertSchema(supportMessages).omit({
  id: true,
  createdAt: true,
});

export const insertAdminSchema = createInsertSchema(admins).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertBalance = z.infer<typeof insertBalanceSchema>;
export type Balance = typeof balances.$inferSelect;
export type InsertUsersBalances = z.infer<typeof insertUsersBalancesSchema>;
export type UsersBalances = typeof usersBalances.$inferSelect;
export type InsertWallet = z.infer<typeof insertWalletSchema>;
export type Wallet = typeof wallets.$inferSelect;
export type InsertCard = z.infer<typeof insertCardSchema>;
export type Card = typeof cards.$inferSelect;
export type InsertBank = z.infer<typeof insertBankSchema>;
export type Bank = typeof banks.$inferSelect;
export type InsertUserCard = z.infer<typeof insertUserCardSchema>;
export type UserCard = typeof userCards.$inferSelect;
export type InsertExchange = z.infer<typeof insertExchangeSchema>;
export type Exchange = typeof exchanges.$inferSelect;
export type InsertStat = z.infer<typeof insertStatSchema>;
export type Stat = typeof stats.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;
export type InsertExchangeRate = z.infer<typeof insertExchangeRateSchema>;
export type ExchangeRate = typeof exchangeRates.$inferSelect;
export type InsertSupportChat = z.infer<typeof insertSupportChatSchema>;
export type SupportChat = typeof supportChats.$inferSelect;
export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;
export type SupportTicket = typeof supportTickets.$inferSelect;
export type InsertSupportMessage = z.infer<typeof insertSupportMessageSchema>;
export type SupportMessage = typeof supportMessages.$inferSelect;
export type InsertAdmin = z.infer<typeof insertAdminSchema>;
export type Admin = typeof admins.$inferSelect;
