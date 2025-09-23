import { type User, type InsertUser, type Wallet, type InsertWallet, type Transaction, type InsertTransaction, type ExchangeRate, type InsertExchangeRate, type SupportChat, type InsertSupportChat, users, wallets, transactions, exchangeRates, supportChats } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

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
}

export class DatabaseStorage implements IStorage {
  constructor() {
    // Initialize with some exchange rates if not exist
    this.initializeExchangeRates();
    
    // Initialize demo support chat if not exist
    this.initializeDemoChat();
  }

  private async initializeExchangeRates() {
    try {
      // Check if rates already exist
      const existingRates = await db.select().from(exchangeRates).limit(1);
      if (existingRates.length > 0) return;

      const rates = [
        { fromCurrency: "USDT", toCurrency: "RUB", rate: "95.50" },
        { fromCurrency: "USDT", toCurrency: "TRY", rate: "27.80" },
        { fromCurrency: "BTC", toCurrency: "USDT", rate: "43500.00" },
        { fromCurrency: "ETH", toCurrency: "USDT", rate: "2650.00" },
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
        ],
        createdAt: new Date(),
      }).onConflictDoNothing();
    } catch (error) {
      console.log('Demo chat initialization skipped (table may not exist yet)');
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
        status: insertTransaction.status ?? "pending",
        createdAt: new Date(),
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
        status: insertChat.status ?? "open",
        messages: insertChat.messages ?? [],
        createdAt: new Date(),
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
}

export const storage = new DatabaseStorage();