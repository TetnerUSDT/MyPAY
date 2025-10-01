import { type User, type InsertUser, type Wallet, type InsertWallet, type Transaction, type InsertTransaction, type ExchangeRate, type InsertExchangeRate, type SupportChat, type InsertSupportChat, type Card, users, wallets, transactions, exchangeRates, supportChats, cards, balances, userCards } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, and, sql } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByTgId(tgId: string): Promise<User | undefined>;
  getUserByApiKey(apiKey: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserAgreement(id: number, agreement: number): Promise<User | undefined>;
  generateApiKey(userId: number): Promise<string | undefined>;

  // Wallet methods
  getWallet(id: number): Promise<Wallet | undefined>;
  getWalletsByUserId(userId: number): Promise<Wallet[]>;
  createWallet(wallet: InsertWallet): Promise<Wallet>;

  // Transaction methods
  getTransaction(id: string): Promise<Transaction | undefined>;
  getTransactionByOrderId(orderId: string): Promise<Transaction | undefined>;
  getTransactionsByUserId(userId: number): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransactionStatus(id: string, status: string, txHash?: string): Promise<Transaction | undefined>;

  // Exchange rate methods
  getExchangeRate(fromCurrency: string, toCurrency: string): Promise<ExchangeRate | undefined>;
  createOrUpdateExchangeRate(rate: InsertExchangeRate): Promise<ExchangeRate>;

  // Support chat methods
  getSupportChat(id: string): Promise<SupportChat | undefined>;
  getSupportChatsByUserId(userId: number): Promise<SupportChat[]>;
  createSupportChat(chat: InsertSupportChat): Promise<SupportChat>;
  addMessageToChat(chatId: string, sender: string, message: string): Promise<SupportChat | undefined>;

  // Card methods
  getActiveCards(): Promise<Card[]>;
  getCard(id: number): Promise<Card | undefined>;

  // Balance methods
  getBalance(id: number): Promise<any | undefined>;
  getBalancesByIds(ids: string): Promise<any[]>;
  getPaymentBalance(): Promise<any | undefined>; // USDT.BEP20

  // Exchange rate methods by balance IDs
  getExchangeRateByBalances(fromBalanceId: number, toBalanceId: number): Promise<any | undefined>;

  // User cards methods
  getUserCardsByUserId(userId: number): Promise<any[]>;
  createUserCard(card: any): Promise<any>;
  deleteUserCard(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  private static initialized = false;

  constructor() {
    // Initialization happens via static initialize() method
  }

  static async initialize() {
    if (this.initialized) return;
    
    const instance = storage;
    await instance.initializeBalances();
    await instance.initializeExchangeRates();
    await instance.initializeDemoChat();
    await instance.initializeCards();
    
    this.initialized = true;
  }

  private async initializeBalances() {
    try {
      const existingBalances = await db.select().from(balances).limit(1);
      if (existingBalances.length > 0) return;

      const defaultBalances = [
        { id: 1, title: "Российский рубль", network: null, currency: "RUB", type: "fiat", status: "1" },
        { id: 2, title: "Турецкая лира", network: null, currency: "TRY", type: "fiat", status: "1" },
        { id: 3, title: "USDT TRC20", network: "TRC20", currency: "USDT", type: "crypto", status: "1" },
        { id: 4, title: "USDT BEP20", network: "BEP20", currency: "USDT", type: "crypto", status: "1" },
      ];

      for (const balance of defaultBalances) {
        await db.insert(balances).values(balance as any).onConflictDoNothing();
      }
    } catch (error) {
      console.log('Balances initialization skipped (table may not exist yet)');
    }
  }

  private async initializeExchangeRates() {
    try {
      // Check if rates already exist
      const existingRates = await db.select().from(exchangeRates).limit(1);
      if (existingRates.length > 0) return;

      const rates = [
        { fromBalanceId: 4, toBalanceId: 1, fromCurrency: "USDT", toCurrency: "RUB", rate: "95.50" },
        { fromBalanceId: 4, toBalanceId: 2, fromCurrency: "USDT", toCurrency: "TRY", rate: "27.80" },
        { fromBalanceId: 3, toBalanceId: 1, fromCurrency: "USDT", toCurrency: "RUB", rate: "95.50" },
        { fromBalanceId: 3, toBalanceId: 2, fromCurrency: "USDT", toCurrency: "TRY", rate: "27.80" },
      ];

      for (const rate of rates) {
        await db.insert(exchangeRates).values({
          id: randomUUID(),
          ...rate,
          updatedAt: new Date(),
        }).onConflictDoNothing();
      }
    } catch (error) {
      console.log('Exchange rates initialization skipped (table may not exist yet)');
    }
  }

  private async initializeDemoChat() {
    try {
      // Check if demo chat already exists
      const existingChat = await db.select().from(supportChats).where(eq(supportChats.id, "demo-chat-1")).limit(1);
      if (existingChat.length > 0) return;

      await db.insert(supportChats).values({
        id: "demo-chat-1",
        userId: null,
        transactionId: null,
        status: "open",
        messages: [
          {
            sender: "Elena from support",
            message: "Hi there! How can I help?",
            timestamp: new Date(),
          },
        ] as any,
        createdAt: new Date(),
      }).onConflictDoNothing();
    } catch (error) {
      console.log('Demo chat initialization skipped (table may not exist yet)');
    }
  }

  private async initializeCards() {
    try {
      // Check if cards already exist
      const existingCards = await db.select().from(cards).limit(1);
      if (existingCards.length > 0) return;

      const defaultCards = [
        {
          title: "Россия (RU)",
          country: "Любой банк в России",
          lang: "ru",
          timeExchange: 15,
          commission: "1.5",
          idBalance: "1",
          status: "1",
        },
        {
          title: "Турция (TR)",
          country: "Любой банк в Турции",
          lang: "tr",
          timeExchange: 15,
          commission: "4.5",
          idBalance: "1",
          status: "1",
        },
      ];

      for (const card of defaultCards) {
        await db.insert(cards).values(card).onConflictDoNothing();
      }
    } catch (error) {
      console.log('Cards initialization skipped (table may not exist yet)');
    }
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByTgId(tgId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.tgId, tgId));
    return user || undefined;
  }

  async getUserByApiKey(apiKey: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.apiKey, apiKey));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        ...insertUser,
        agreement: insertUser.agreement ?? 0,
        blocked: insertUser.blocked ?? false,
        apiKey: insertUser.apiKey ?? null,
      })
      .returning();
    return user;
  }

  async updateUserAgreement(id: number, agreement: number): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ agreement })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async generateApiKey(userId: number): Promise<string | undefined> {
    const apiKey = randomUUID();
    const [user] = await db
      .update(users)
      .set({ apiKey })
      .where(eq(users.id, userId))
      .returning();
    return user?.apiKey || undefined;
  }

  // Wallet methods
  async getWallet(id: number): Promise<Wallet | undefined> {
    const [wallet] = await db.select().from(wallets).where(eq(wallets.id, id));
    return wallet || undefined;
  }

  async getWalletsByUserId(userId: number): Promise<Wallet[]> {
    return await db.select().from(wallets).where(eq(wallets.idUser, userId));
  }

  async createWallet(insertWallet: InsertWallet): Promise<Wallet> {
    const [wallet] = await db
      .insert(wallets)
      .values(insertWallet)
      .returning();
    return wallet;
  }

  // Transaction methods
  async getTransaction(id: string): Promise<Transaction | undefined> {
    const [transaction] = await db.select().from(transactions).where(eq(transactions.id, id));
    return transaction || undefined;
  }

  async getTransactionByOrderId(orderId: string): Promise<Transaction | undefined> {
    const [transaction] = await db.select().from(transactions).where(eq(transactions.orderId, orderId));
    return transaction || undefined;
  }

  async getTransactionsByUserId(userId: number): Promise<Transaction[]> {
    return await db.select().from(transactions).where(eq(transactions.userId, userId));
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const [transaction] = await db
      .insert(transactions)
      .values({
        ...insertTransaction,
        orderId: `order_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
      })
      .returning();
    return transaction;
  }

  async updateTransactionStatus(id: string, status: string, txHash?: string): Promise<Transaction | undefined> {
    const updateData: any = { status };
    if (txHash) updateData.txHash = txHash;

    const [transaction] = await db
      .update(transactions)
      .set(updateData)
      .where(eq(transactions.id, id))
      .returning();
    return transaction || undefined;
  }

  // Exchange rate methods
  async getExchangeRate(fromCurrency: string, toCurrency: string): Promise<ExchangeRate | undefined> {
    const [rate] = await db
      .select()
      .from(exchangeRates)
      .where(and(
        eq(exchangeRates.fromCurrency, fromCurrency),
        eq(exchangeRates.toCurrency, toCurrency)
      ));
    return rate || undefined;
  }

  async createOrUpdateExchangeRate(insertRate: InsertExchangeRate): Promise<ExchangeRate> {
    const [rate] = await db
      .insert(exchangeRates)
      .values({
        ...insertRate,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [exchangeRates.fromCurrency, exchangeRates.toCurrency],
        set: {
          rate: insertRate.rate,
          updatedAt: new Date(),
        },
      })
      .returning();
    return rate;
  }

  // Support chat methods
  async getSupportChat(id: string): Promise<SupportChat | undefined> {
    const [chat] = await db.select().from(supportChats).where(eq(supportChats.id, id));
    return chat || undefined;
  }

  async getSupportChatsByUserId(userId: number): Promise<SupportChat[]> {
    return await db.select().from(supportChats).where(eq(supportChats.userId, userId));
  }

  async createSupportChat(insertChat: InsertSupportChat): Promise<SupportChat> {
    const [chat] = await db
      .insert(supportChats)
      .values({
        ...insertChat,
      })
      .returning();
    return chat;
  }

  async addMessageToChat(chatId: string, sender: string, message: string): Promise<SupportChat | undefined> {
    const chat = await this.getSupportChat(chatId);
    if (!chat) return undefined;

    const messages: { sender: string; message: string; timestamp: Date }[] = Array.isArray(chat.messages) ? [...chat.messages] : [];
    messages.push({ sender, message, timestamp: new Date() });

    const [updatedChat] = await db
      .update(supportChats)
      .set({ messages })
      .where(eq(supportChats.id, chatId))
      .returning();
    return updatedChat || undefined;
  }

  // Card methods
  async getActiveCards(): Promise<Card[]> {
    return await db.select().from(cards).where(eq(cards.status, "1"));
  }

  async getCard(id: number): Promise<Card | undefined> {
    const [card] = await db.select().from(cards).where(eq(cards.id, id));
    return card || undefined;
  }

  // Balance methods
  async getBalance(id: number): Promise<any | undefined> {
    const [balance] = await db.select().from(balances).where(eq(balances.id, id));
    return balance || undefined;
  }

  async getBalancesByIds(ids: string): Promise<any[]> {
    if (!ids) return [];
    const idArray = ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
    if (idArray.length === 0) return [];
    return await db.select().from(balances).where(sql`${balances.id} = ANY(${idArray})`);
  }

  async getPaymentBalance(): Promise<any | undefined> {
    // USDT.BEP20 is id=4
    const [balance] = await db.select().from(balances).where(eq(balances.id, 4));
    return balance || undefined;
  }

  // Exchange rate methods by balance IDs
  async getExchangeRateByBalances(fromBalanceId: number, toBalanceId: number): Promise<any | undefined> {
    const [rate] = await db.select().from(exchangeRates).where(
      and(
        eq(exchangeRates.fromBalanceId, fromBalanceId),
        eq(exchangeRates.toBalanceId, toBalanceId)
      )
    );
    return rate || undefined;
  }

  // User cards methods
  async getUserCardsByUserId(userId: number): Promise<any[]> {
    return await db.select().from(userCards).where(eq(userCards.idUser, userId));
  }

  async createUserCard(card: any): Promise<any> {
    const [newCard] = await db.insert(userCards).values(card).returning();
    return newCard;
  }

  async deleteUserCard(id: string): Promise<void> {
    await db.delete(userCards).where(eq(userCards.id, id));
  }
}

export const storage = new DatabaseStorage();