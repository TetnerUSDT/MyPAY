import { sql } from "drizzle-orm";
import { mysqlTable, text, varchar, decimal, timestamp, json, int, boolean, mysqlEnum, uniqueIndex, foreignKey } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Define enums
export const balanceTypeEnum = mysqlEnum('balance_type', ['fiat', 'crypto', 'token', 'voucher']);
export const balanceStatusEnum = mysqlEnum('balance_status', ['active', 'frozen', 'hidden']);
export const exchangeStatusEnum = mysqlEnum('status', ['wait', 'wait-paid', 'paid', 'complete', 'canceled', 'dispute']);
export const supportTicketStatusEnum = mysqlEnum('support_status', ['wait-user', 'wait-support', 'closed']);
export const messageSenderEnum = mysqlEnum('message_sender', ['user', 'support']);
export const exchangeCategoryEnum = mysqlEnum('exchange_category', ['bank', 'crypto', 'cash']);
export const qrStyleEnum = mysqlEnum('qr_style', ['square', 'dots', 'rounded', 'extra-rounded', 'classy', 'classy-rounded']);
export const voucherStatusEnum = mysqlEnum('voucher_status', ['active', 'activated', 'expired']);
export const voucherSecurityTypeEnum = mysqlEnum('voucher_security_type', ['none', 'word', 'pin']);

export const balances = mysqlTable("balances", {
  id: int("id").primaryKey().autoincrement(),
  title: varchar("title", { length: 255 }).notNull(),
  network: varchar("network", { length: 50 }),
  currency: varchar("currency", { length: 10 }).notNull(),
  rate: decimal("rate", { precision: 18, scale: 8 }),
  balanceType: varchar("type", { length: 50 }).notNull().default("fiat"),
  status: varchar("status", { length: 50 }).notNull().default("active"),
  targetBalanceId: int("target_balance_id"),
  pattern: text("pattern"),
  qrColor: json("qr_color").$type<{ type: 'single', color: string } | { type: 'gradient', colors: [string, string] }>(),
  qrStyle: qrStyleEnum.default('rounded'),
});

export const users = mysqlTable("users", {
  id: int("id").primaryKey().autoincrement(),
  tgId: varchar("tg_id", { length: 255 }).notNull().unique(),
  tgUsername: varchar("tg_username", { length: 255 }),
  google: varchar("google", { length: 255 }),
  apiKey: varchar("api_key", { length: 255 }).unique(),
  name: varchar("name", { length: 255 }),
  img: varchar("img", { length: 255 }),
  status: varchar("status", { length: 50 }),
  agreement: int("agreement").default(0),
  blocked: boolean("blocked").default(false),
  defaultFiatBalanceId: int("default_fiat_balance_id").references(() => balances.id, { onDelete: "set null" }),
  idRef: int("id_ref"),
  codeRef: varchar("code_ref", { length: 20 }).unique(),
  trust: int("trust").default(0),
  phone: varchar("phone", { length: 20 }),
}, (table) => ({
  selfReference: foreignKey({
    columns: [table.idRef],
    foreignColumns: [table.id],
  }).onDelete("set null"),
}));

export const usersBalances = mysqlTable("users_balances", {
  id: int("id").primaryKey().autoincrement(),
  idBalance: int("id_balance").notNull().references(() => balances.id, { onDelete: "cascade" }),
  idUser: int("id_user").notNull().references(() => users.id, { onDelete: "cascade" }),
  sum: decimal("sum", { precision: 18, scale: 8 }).default("0.0"),
  status: varchar("status", { length: 50 }),
  accountNumber: varchar("account_number", { length: 20 }).unique(),
}, (table) => ({
  userBalanceUnique: uniqueIndex("user_balance_unique").on(table.idUser, table.idBalance)
}));

export const wallets = mysqlTable("wallets", {
  id: int("id").primaryKey().autoincrement(),
  idUser: int("id_user").references(() => users.id, { onDelete: "cascade" }),
  network: varchar("network", { length: 50 }).notNull(),
  address: varchar("address", { length: 255 }).notNull(),
  privateKey: varchar("private_key", { length: 500 }),
  reservationTime: timestamp("reservation_time"),
  reserved: varchar("reserved", { length: 50 }),
  status: varchar("status", { length: 50 }),
});

export const cards = mysqlTable("cards", {
  id: int("id").primaryKey().autoincrement(),
  title: varchar("title", { length: 255 }).notNull(),
  country: varchar("country", { length: 50 }).notNull(),
  lang: varchar("lang", { length: 255 }),
  timeExchange: int("time_exchange").notNull(),
  commission: decimal("commission", { precision: 5, scale: 2 }).notNull(),
  idBalance: varchar("id_balance", { length: 255 }),
  status: varchar("status", { length: 50 }).default("1"),
  category: mysqlEnum("category", ['bank', 'crypto', 'cash']).notNull().default("bank"),
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
  numberCard: varchar("number_card", { length: 50 }),
  accountNumber: varchar("account_number", { length: 20 }),
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
  tempBalance: decimal("temp_balance", { precision: 18, scale: 8 }).default("0.0"),
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

export const transactions = mysqlTable("transactions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  orderId: text("order_id").notNull(),
  userId: int("user_id").references(() => users.id),
  fromCurrency: text("from_currency").notNull(),
  toCurrency: text("to_currency").notNull(),
  fromAmount: decimal("from_amount", { precision: 18, scale: 8 }).notNull(),
  toAmount: decimal("to_amount", { precision: 18, scale: 8 }).notNull(),
  fromAddress: text("from_address"),
  toAddress: text("to_address"),
  cardNumber: text("card_number"),
  status: text("status").notNull().default("pending"),
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
  category: mysqlEnum("category", ['bank', 'crypto', 'cash']).notNull().default("bank"),
});

export const supportChats = mysqlTable("support_chats", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: int("user_id").references(() => users.id),
  transactionId: varchar("transaction_id", { length: 36 }).references(() => transactions.id),
  messages: json("messages").$type<{ sender: string; message: string; timestamp: Date }[]>(),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const supportTickets = mysqlTable("support_tickets", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  exchangeId: int("exchange_id").notNull().references(() => exchanges.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 50 }).notNull().default("wait-support"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

export const supportMessages = mysqlTable("support_messages", {
  id: int("id").primaryKey().autoincrement(),
  ticketId: int("ticket_id").notNull().references(() => supportTickets.id, { onDelete: "cascade" }),
  sender: varchar("sender", { length: 20 }).notNull(),
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

export const invoices = mysqlTable("invoices", {
  id: int("id").primaryKey().autoincrement(),
  orderNumber: varchar("order_number", { length: 50 }).notNull().unique(),
  userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  walletId: int("wallet_id").references(() => wallets.id, { onDelete: "set null" }),
  balanceId: int("balance_id").references(() => balances.id, { onDelete: "set null" }),
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
  currency: varchar("currency", { length: 10 }).notNull(),
  network: varchar("network", { length: 50 }),
  description: text("description"),
  paymentMethod: varchar("payment_method", { length: 20 }),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  expiresAt: timestamp("expires_at"),
  paidAt: timestamp("paid_at"),
  paymentHash: text("payment_hash"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const notifications = mysqlTable("notifications", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 20 }).notNull().default("info"),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  imageUrl: varchar("image_url", { length: 500 }),
  videoUrl: varchar("video_url", { length: 500 }),
  linkUrl: varchar("link_url", { length: 500 }),
  linkText: varchar("link_text", { length: 100 }),
  redirectTo: varchar("redirect_to", { length: 255 }),
  invoiceId: int("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
  exchangeId: int("exchange_id").references(() => exchanges.id, { onDelete: "set null" }),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const notificationReads = mysqlTable("notification_reads", {
  id: int("id").primaryKey().autoincrement(),
  notificationId: int("notification_id").notNull().references(() => notifications.id, { onDelete: "cascade" }),
  userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  readAt: timestamp("read_at").default(sql`CURRENT_TIMESTAMP`),
});

export const vouchers = mysqlTable("vouchers", {
  id: int("id").primaryKey().autoincrement(),
  code: varchar("code", { length: 15 }).notNull().unique(),
  userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  balanceId: int("balance_id").notNull().references(() => balances.id, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
  currency: varchar("currency", { length: 10 }).notNull(),
  network: varchar("network", { length: 50 }),
  securityType: mysqlEnum("security_type", ['none', 'word', 'pin']).notNull().default("none"),
  securityValue: varchar("security_value", { length: 255 }),
  status: mysqlEnum("status", ['active', 'activated', 'expired']).notNull().default("active"),
  activatedBy: int("activated_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  activatedAt: timestamp("activated_at"),
});

// Telegram Bot tables
export const botCommands = mysqlTable("bot_commands", {
  id: int("id").primaryKey().autoincrement(),
  command: varchar("command", { length: 100 }).notNull().unique(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
});

export const botCommandFiles = mysqlTable("bot_command_files", {
  id: int("id").primaryKey().autoincrement(),
  commandId: int("command_id").notNull().references(() => botCommands.id, { onDelete: "cascade" }),
  fileType: varchar("file_type", { length: 50 }).notNull(),
  fileUrl: varchar("file_url", { length: 500 }).notNull(),
  fileName: varchar("file_name", { length: 255 }),
  fileSize: int("file_size"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const botCommandReactions = mysqlTable("bot_command_reactions", {
  id: int("id").primaryKey().autoincrement(),
  commandId: int("command_id").notNull().references(() => botCommands.id, { onDelete: "cascade" }),
  reactionType: varchar("reaction_type", { length: 50 }).notNull(),
  textContent: text("text_content"),
  imageUrl: varchar("image_url", { length: 500 }),
  linkUrl: varchar("link_url", { length: 500 }),
  linkText: varchar("link_text", { length: 100 }),
  endpointUrl: varchar("endpoint_url", { length: 500 }),
  endpointMethod: varchar("endpoint_method", { length: 10 }),
  endpointAuth: json("endpoint_auth").$type<{ type: string; token?: string; apiKey?: string }>(),
  endpointParams: json("endpoint_params").$type<Record<string, any>>(),
  formatTemplate: text("format_template"),
  conditions: json("conditions").$type<Array<{ field: string; operator: string; value: any; action: string }>>(),
  priority: int("priority").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const botMenus = mysqlTable("bot_menus", {
  id: int("id").primaryKey().autoincrement(),
  parentMenuId: int("parent_menu_id").references((): any => botMenus.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  keyboardType: varchar("keyboard_type", { length: 20 }).notNull().default("reply"),
  rows: int("rows").default(1),
  columns: int("columns").default(1),
  isRoot: boolean("is_root").default(false),
  autoBackButton: boolean("auto_back_button").default(true),
  backButtonText: varchar("back_button_text", { length: 100 }).default("◀️ Назад"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const botMenuButtons = mysqlTable("bot_menu_buttons", {
  id: int("id").primaryKey().autoincrement(),
  menuId: int("menu_id").notNull().references(() => botMenus.id, { onDelete: "cascade" }),
  text: varchar("text", { length: 255 }).notNull(),
  rowIndex: int("row_index").notNull().default(0),
  columnIndex: int("column_index").notNull().default(0),
  actionType: varchar("action_type", { length: 50 }).notNull(),
  actionValue: text("action_value"),
  submenuId: int("submenu_id").references(() => botMenus.id, { onDelete: "set null" }),
  commandId: int("command_id").references(() => botCommands.id, { onDelete: "set null" }),
  url: varchar("url", { length: 500 }),
  fileUrl: varchar("file_url", { length: 500 }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertBalanceSchema = createInsertSchema(balances).omit({ id: true });
export const insertUsersBalancesSchema = createInsertSchema(usersBalances).omit({ id: true });
export const insertWalletSchema = createInsertSchema(wallets).omit({ id: true });
export const insertCardSchema = createInsertSchema(cards).omit({ id: true });
export const insertBankSchema = createInsertSchema(banks).omit({ id: true });
export const insertUserCardSchema = createInsertSchema(userCards).omit({ id: true });
export const insertExchangeSchema = createInsertSchema(exchanges).omit({ id: true });
export const insertStatSchema = createInsertSchema(stats).omit({ id: true });
export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true, orderId: true, createdAt: true, completedAt: true }).partial({ userId: true });
export const insertExchangeRateSchema = createInsertSchema(exchangeRates).omit({ id: true, updatedAt: true, fromCurrency: true, toCurrency: true });
export const insertSupportChatSchema = createInsertSchema(supportChats).omit({ id: true, createdAt: true });
export const insertSupportTicketSchema = createInsertSchema(supportTickets).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSupportMessageSchema = createInsertSchema(supportMessages).omit({ id: true, createdAt: true });
export const insertAdminSchema = createInsertSchema(admins).omit({ id: true, createdAt: true });
export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true, createdAt: true, paidAt: true });
export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export const insertNotificationReadSchema = createInsertSchema(notificationReads).omit({ id: true, readAt: true });
export const insertVoucherSchema = createInsertSchema(vouchers).omit({ id: true, createdAt: true, activatedAt: true, activatedBy: true });
export const insertBotCommandSchema = createInsertSchema(botCommands).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBotCommandFileSchema = createInsertSchema(botCommandFiles).omit({ id: true, createdAt: true });
export const insertBotCommandReactionSchema = createInsertSchema(botCommandReactions).omit({ id: true, createdAt: true });
export const insertBotMenuSchema = createInsertSchema(botMenus).omit({ id: true, createdAt: true });
export const insertBotMenuButtonSchema = createInsertSchema(botMenuButtons).omit({ id: true, createdAt: true });

// ─── P2P Module ───────────────────────────────────────────────────────────────

export const p2pPaymentMethods = mysqlTable("p2p_payment_methods", {
  id: int("id").primaryKey().autoincrement(),
  title: varchar("title", { length: 100 }).notNull(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  country: varchar("country", { length: 10 }),
  currency: varchar("currency", { length: 10 }),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const p2pAds = mysqlTable("p2p_ads", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  side: varchar("side", { length: 10 }).notNull(),
  assetBalanceId: int("asset_balance_id").notNull().references(() => balances.id),
  fiatBalanceId: int("fiat_balance_id").references(() => balances.id),
  price: decimal("price", { precision: 18, scale: 8 }).notNull(),
  minAmount: decimal("min_amount", { precision: 18, scale: 8 }).notNull(),
  maxAmount: decimal("max_amount", { precision: 18, scale: 8 }).notNull(),
  availableAmount: decimal("available_amount", { precision: 18, scale: 8 }).notNull(),
  paymentTimeMinutes: int("payment_time_minutes").default(15),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  terms: text("terms"),
  autoReply: text("auto_reply"),
  sortPriority: int("sort_priority").default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at"),
});

export const p2pUserPaymentMethods = mysqlTable("p2p_user_payment_methods", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  methodId: int("method_id").notNull().references(() => p2pPaymentMethods.id),
  accountName: varchar("account_name", { length: 255 }),
  accountNumber: varchar("account_number", { length: 255 }),
  bankName: varchar("bank_name", { length: 255 }),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const p2pAdPaymentMethods = mysqlTable("p2p_ad_payment_methods", {
  id: int("id").primaryKey().autoincrement(),
  adId: int("ad_id").notNull().references(() => p2pAds.id, { onDelete: "cascade" }),
  methodId: int("method_id").notNull().references(() => p2pPaymentMethods.id),
});

export const p2pOrders = mysqlTable("p2p_orders", {
  id: int("id").primaryKey().autoincrement(),
  adId: int("ad_id").notNull().references(() => p2pAds.id),
  buyerId: int("buyer_id").notNull().references(() => users.id),
  sellerId: int("seller_id").notNull().references(() => users.id),
  assetBalanceId: int("asset_balance_id").notNull().references(() => balances.id),
  fiatBalanceId: int("fiat_balance_id").references(() => balances.id),
  assetAmount: decimal("asset_amount", { precision: 18, scale: 8 }).notNull(),
  fiatAmount: decimal("fiat_amount", { precision: 18, scale: 8 }).notNull(),
  price: decimal("price", { precision: 18, scale: 8 }).notNull(),
  paymentMethodId: int("payment_method_id").references(() => p2pPaymentMethods.id),
  status: varchar("status", { length: 30 }).notNull().default("created"),
  paymentDeadline: timestamp("payment_deadline"),
  paidAt: timestamp("paid_at"),
  releasedAt: timestamp("released_at"),
  cancelledAt: timestamp("cancelled_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at"),
});

export const p2pBalanceLocks = mysqlTable("p2p_balance_locks", {
  id: int("id").primaryKey().autoincrement(),
  orderId: int("order_id").notNull().references(() => p2pOrders.id).unique(),
  userId: int("user_id").notNull().references(() => users.id),
  userBalanceId: int("user_balance_id").notNull().references(() => usersBalances.id),
  balanceId: int("balance_id").notNull().references(() => balances.id),
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("locked"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at"),
});

export const p2pOrderMessages = mysqlTable("p2p_order_messages", {
  id: int("id").primaryKey().autoincrement(),
  orderId: int("order_id").notNull().references(() => p2pOrders.id, { onDelete: "cascade" }),
  senderId: int("sender_id").notNull().references(() => users.id),
  message: text("message"),
  attachmentUrl: varchar("attachment_url", { length: 500 }),
  type: varchar("type", { length: 20 }).notNull().default("text"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const p2pDisputes = mysqlTable("p2p_disputes", {
  id: int("id").primaryKey().autoincrement(),
  orderId: int("order_id").notNull().references(() => p2pOrders.id),
  openedBy: int("opened_by").notNull().references(() => users.id),
  reason: varchar("reason", { length: 255 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 30 }).notNull().default("open"),
  moderatorId: int("moderator_id").references(() => users.id),
  resolutionComment: text("resolution_comment"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  resolvedAt: timestamp("resolved_at"),
});

export const p2pReviews = mysqlTable("p2p_reviews", {
  id: int("id").primaryKey().autoincrement(),
  orderId: int("order_id").notNull().references(() => p2pOrders.id),
  fromUserId: int("from_user_id").notNull().references(() => users.id),
  toUserId: int("to_user_id").notNull().references(() => users.id),
  rating: int("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const p2pUserStats = mysqlTable("p2p_user_stats", {
  userId: int("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  totalOrders: int("total_orders").default(0),
  completedOrders: int("completed_orders").default(0),
  cancelledOrders: int("cancelled_orders").default(0),
  disputesTotal: int("disputes_total").default(0),
  successfulPercent: decimal("successful_percent", { precision: 5, scale: 2 }).default("0"),
  rating: decimal("rating", { precision: 3, scale: 2 }).default("0"),
  avgReleaseTimeSeconds: int("avg_release_time_seconds").default(0),
  isMerchant: int("is_merchant").default(0),
  merchantLevel: varchar("merchant_level", { length: 20 }).default("none"),
  updatedAt: timestamp("updated_at"),
});

export const p2pLogs = mysqlTable("p2p_logs", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").references(() => users.id),
  orderId: int("order_id").references(() => p2pOrders.id),
  action: varchar("action", { length: 100 }).notNull(),
  data: json("data"),
  ip: varchar("ip", { length: 100 }),
  userAgent: varchar("user_agent", { length: 500 }),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// ─── Business / Merchant Module ───────────────────────────────────────────────

export const merchantShops = mysqlTable("merchant_shops", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  domain: varchar("domain", { length: 255 }).notNull(),
  apiKey: varchar("api_key", { length: 64 }).notNull().unique(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  addressMode: varchar("address_mode", { length: 20 }).notNull().default("permanent"),
  permanentMonitorMinutes: int("permanent_monitor_minutes").notNull().default(20),
  temporaryMinutes: int("temporary_minutes").notNull().default(30),
  invoiceMinutes: int("invoice_minutes").notNull().default(60),
  enabledNetworks: text("enabled_networks"),
  webhookUrl: varchar("webhook_url", { length: 500 }),
  balanceUsdt: decimal("balance_usdt", { precision: 18, scale: 8 }).notNull().default("0"),
  totalReceived: decimal("total_received", { precision: 18, scale: 8 }).notNull().default("0"),
  totalPaidOut: decimal("total_paid_out", { precision: 18, scale: 8 }).notNull().default("0"),
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
});

export const merchantPayments = mysqlTable("merchant_payments", {
  id: int("id").primaryKey().autoincrement(),
  shopId: int("shop_id").notNull().references(() => merchantShops.id, { onDelete: "cascade" }),
  orderId: varchar("order_id", { length: 255 }),
  externalUserId: varchar("external_user_id", { length: 255 }),
  walletAddress: varchar("wallet_address", { length: 255 }),
  network: varchar("network", { length: 50 }).notNull(),
  currency: varchar("currency", { length: 20 }).notNull().default("USDT"),
  amount: decimal("amount", { precision: 18, scale: 8 }),
  amountReceived: decimal("amount_received", { precision: 18, scale: 8 }),
  txHash: varchar("tx_hash", { length: 255 }),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  paymentMode: varchar("payment_mode", { length: 20 }).notNull().default("temporary"),
  addressType: varchar("address_type", { length: 20 }).notNull().default("permanent"),
  expiresAt: timestamp("expires_at"),
  confirmedAt: timestamp("confirmed_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const merchantPayoutRequests = mysqlTable("merchant_payout_requests", {
  id: int("id").primaryKey().autoincrement(),
  shopId: int("shop_id").notNull().references(() => merchantShops.id, { onDelete: "cascade" }),
  toAddress: varchar("to_address", { length: 255 }).notNull(),
  network: varchar("network", { length: 50 }).notNull(),
  currency: varchar("currency", { length: 20 }).notNull().default("USDT"),
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
  txHash: varchar("tx_hash", { length: 255 }),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  source: varchar("source", { length: 20 }).notNull().default("manual"),
  externalOrderId: varchar("external_order_id", { length: 255 }),
  fromWalletId: int("from_wallet_id"),
  reference: varchar("reference", { length: 255 }),
  note: text("note"),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const merchantScannerKeys = mysqlTable("merchant_scanner_keys", {
  id: int("id").primaryKey().autoincrement(),
  provider: varchar("provider", { length: 50 }).notNull(),
  networks: text("networks"),
  apiKey: varchar("api_key", { length: 500 }).notNull(),
  label: varchar("label", { length: 255 }),
  monthlyLimit: int("monthly_limit").notNull().default(0),
  usageThisMonth: int("usage_this_month").notNull().default(0),
  resetMonth: varchar("reset_month", { length: 7 }),
  isActive: boolean("is_active").notNull().default(true),
  errorCount: int("error_count").notNull().default(0),
  lastUsedAt: timestamp("last_used_at"),
  lastErrorAt: timestamp("last_error_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const merchantWallets = mysqlTable("merchant_wallets", {
  id: int("id").primaryKey().autoincrement(),
  shopId: int("shop_id").notNull().references(() => merchantShops.id, { onDelete: "cascade" }),
  address: varchar("address", { length: 255 }).notNull(),
  privateKey: varchar("private_key", { length: 500 }),
  network: varchar("network", { length: 50 }).notNull(),
  mode: varchar("mode", { length: 20 }).notNull().default("standard"),
  gasfreeAddress: varchar("gasfree_address", { length: 255 }),
  externalUserId: varchar("external_user_id", { length: 255 }),
  orderId: varchar("order_id", { length: 255 }),
  reservedUntil: timestamp("reserved_until"),
  monitoringUntil: timestamp("monitoring_until"),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  balanceUsdt: decimal("balance_usdt", { precision: 18, scale: 8 }),
  balanceUpdatedAt: timestamp("balance_updated_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const merchantInvoices = mysqlTable("merchant_invoices", {
  id: int("id").primaryKey().autoincrement(),
  shopId: int("shop_id").notNull().references(() => merchantShops.id, { onDelete: "cascade" }),
  invoiceNumber: varchar("invoice_number", { length: 64 }).notNull().unique(),
  orderRef: varchar("order_ref", { length: 255 }),
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
  currency: varchar("currency", { length: 20 }).notNull().default("USDT"),
  networks: text("networks"),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  walletId: int("wallet_id"),
  walletAddress: varchar("wallet_address", { length: 255 }),
  networkChosen: varchar("network_chosen", { length: 50 }),
  txHash: varchar("tx_hash", { length: 255 }),
  amountReceived: decimal("amount_received", { precision: 18, scale: 8 }),
  expiresAt: timestamp("expires_at"),
  confirmedAt: timestamp("confirmed_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const insertMerchantShopSchema = createInsertSchema(merchantShops).omit({ id: true, apiKey: true, createdAt: true, updatedAt: true });
export const insertMerchantPaymentSchema = createInsertSchema(merchantPayments).omit({ id: true, createdAt: true });
export const insertMerchantPayoutSchema = createInsertSchema(merchantPayoutRequests).omit({ id: true, createdAt: true });
export const insertMerchantWalletSchema = createInsertSchema(merchantWallets).omit({ id: true, createdAt: true });
export const insertMerchantInvoiceSchema = createInsertSchema(merchantInvoices).omit({ id: true, createdAt: true });

export type MerchantShop = typeof merchantShops.$inferSelect;
export type InsertMerchantShop = z.infer<typeof insertMerchantShopSchema>;
export type MerchantPayment = typeof merchantPayments.$inferSelect;
export type InsertMerchantPayment = z.infer<typeof insertMerchantPaymentSchema>;
export type MerchantPayoutRequest = typeof merchantPayoutRequests.$inferSelect;
export type InsertMerchantPayout = z.infer<typeof insertMerchantPayoutSchema>;
export type MerchantInvoice = typeof merchantInvoices.$inferSelect;
export type InsertMerchantInvoice = z.infer<typeof insertMerchantInvoiceSchema>;
export type MerchantWallet = typeof merchantWallets.$inferSelect;
export type InsertMerchantWallet = z.infer<typeof insertMerchantWalletSchema>;

export const insertP2PAdSchema = createInsertSchema(p2pAds).omit({ id: true, createdAt: true, updatedAt: true });
export const insertP2POrderSchema = createInsertSchema(p2pOrders).omit({ id: true, createdAt: true, updatedAt: true });
export const insertP2PMessageSchema = createInsertSchema(p2pOrderMessages).omit({ id: true, createdAt: true });
export const insertP2PPaymentMethodSchema = createInsertSchema(p2pPaymentMethods).omit({ id: true, createdAt: true });
export const insertP2PUserPaymentMethodSchema = createInsertSchema(p2pUserPaymentMethods).omit({ id: true, createdAt: true });

export type P2PAd = typeof p2pAds.$inferSelect;
export type InsertP2PAd = z.infer<typeof insertP2PAdSchema>;
export type P2POrder = typeof p2pOrders.$inferSelect;
export type InsertP2POrder = z.infer<typeof insertP2POrderSchema>;
export type P2POrderMessage = typeof p2pOrderMessages.$inferSelect;
export type P2PPaymentMethod = typeof p2pPaymentMethods.$inferSelect;
export type P2PUserPaymentMethod = typeof p2pUserPaymentMethods.$inferSelect;
export type P2PUserStats = typeof p2pUserStats.$inferSelect;
export type P2PDispute = typeof p2pDisputes.$inferSelect;

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
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotificationRead = z.infer<typeof insertNotificationReadSchema>;
export type NotificationRead = typeof notificationReads.$inferSelect;
export type InsertVoucher = z.infer<typeof insertVoucherSchema>;
export type Voucher = typeof vouchers.$inferSelect;
export type InsertBotCommand = z.infer<typeof insertBotCommandSchema>;
export type BotCommand = typeof botCommands.$inferSelect;
export type InsertBotCommandFile = z.infer<typeof insertBotCommandFileSchema>;
export type BotCommandFile = typeof botCommandFiles.$inferSelect;
export type InsertBotCommandReaction = z.infer<typeof insertBotCommandReactionSchema>;
export type BotCommandReaction = typeof botCommandReactions.$inferSelect;
export type InsertBotMenu = z.infer<typeof insertBotMenuSchema>;
export type BotMenu = typeof botMenus.$inferSelect;
export type InsertBotMenuButton = z.infer<typeof insertBotMenuButtonSchema>;
export type BotMenuButton = typeof botMenuButtons.$inferSelect;
