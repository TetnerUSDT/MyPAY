import { type User, type InsertUser, type Wallet, type InsertWallet, type Transaction, type InsertTransaction, type ExchangeRate, type InsertExchangeRate, type SupportChat, type InsertSupportChat } from "@shared/schema";
import { randomUUID } from "crypto";

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

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private wallets: Map<number, Wallet>;
  private transactions: Map<string, Transaction>;
  private exchangeRates: Map<string, ExchangeRate>;
  private supportChats: Map<string, SupportChat>;
  private nextUserId: number = 1;
  private nextWalletId: number = 1;

  constructor() {
    this.users = new Map();
    this.wallets = new Map();
    this.transactions = new Map();
    this.exchangeRates = new Map();
    this.supportChats = new Map();

    // Initialize with some exchange rates
    this.initializeExchangeRates();
    
    // Initialize demo support chat
    this.initializeDemoChat();
  }

  private initializeExchangeRates() {
    const rates = [
      { fromCurrency: "USDT", toCurrency: "RUB", rate: "95.50" },
      { fromCurrency: "USDT", toCurrency: "TRY", rate: "27.80" },
      { fromCurrency: "BTC", toCurrency: "USDT", rate: "43500.00" },
      { fromCurrency: "ETH", toCurrency: "USDT", rate: "2650.00" },
    ];

    rates.forEach(rate => {
      const id = randomUUID();
      const exchangeRate: ExchangeRate = {
        id,
        ...rate,
        updatedAt: new Date(),
      };
      this.exchangeRates.set(`${rate.fromCurrency}_${rate.toCurrency}`, exchangeRate);
    });
  }

  private initializeDemoChat() {
    const demoChat: SupportChat = {
      id: "demo-chat-1",
      userId: null,
      transactionId: null,
      messages: [
        {
          sender: "Elena from support",
          message: "Hi there! How can I help?",
          timestamp: new Date()
        }
      ],
      status: "open",
      createdAt: new Date(),
    };
    
    this.supportChats.set("demo-chat-1", demoChat);
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByTgId(tgId: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.tgId === tgId,
    );
  }

  async getUserByApiKey(apiKey: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.apiKey === apiKey,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.nextUserId++;
    const user: User = { 
      ...insertUser, 
      id,
      google: insertUser.google ?? null,
      name: insertUser.name ?? null,
      apiKey: insertUser.apiKey ?? null,
      img: insertUser.img ?? null,
      status: insertUser.status ?? null,
      agreement: insertUser.agreement ?? 0,
      blocked: insertUser.blocked ?? false
    };
    this.users.set(id, user);
    return user;
  }

  async updateUserAgreement(id: number, agreement: number): Promise<User | undefined> {
    const user = this.users.get(id);
    if (user) {
      user.agreement = agreement;
      this.users.set(id, user);
    }
    return user;
  }

  async generateApiKey(userId: number): Promise<string | undefined> {
    const user = this.users.get(userId);
    if (user) {
      const apiKey = randomUUID();
      user.apiKey = apiKey;
      this.users.set(userId, user);
      return apiKey;
    }
    return undefined;
  }

  async getWallet(id: number): Promise<Wallet | undefined> {
    return this.wallets.get(id);
  }

  async getWalletsByUserId(userId: number): Promise<Wallet[]> {
    return Array.from(this.wallets.values()).filter(wallet => wallet.idUser === userId);
  }

  async createWallet(insertWallet: InsertWallet): Promise<Wallet> {
    const id = this.nextWalletId++;
    const wallet: Wallet = { 
      ...insertWallet, 
      id,
      status: insertWallet.status ?? null,
      reservationTime: insertWallet.reservationTime ?? null
    };
    this.wallets.set(id, wallet);
    return wallet;
  }

  async getTransaction(id: string): Promise<Transaction | undefined> {
    return this.transactions.get(id);
  }

  async getTransactionByOrderId(orderId: string): Promise<Transaction | undefined> {
    return Array.from(this.transactions.values()).find(tx => tx.orderId === orderId);
  }

  async getTransactionsByUserId(userId: number): Promise<Transaction[]> {
    return Array.from(this.transactions.values()).filter(tx => tx.userId === userId);
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const id = randomUUID();
    const orderId = Math.floor(100000000 + Math.random() * 900000000).toString();
    const transaction: Transaction = {
      ...insertTransaction,
      id,
      orderId,
      status: insertTransaction.status ?? "pending",
      userId: insertTransaction.userId ?? null,
      createdAt: new Date(),
      completedAt: null,
      txHash: null,
      fromAddress: null,
      toAddress: null,
      cardNumber: null,
    };
    this.transactions.set(id, transaction);
    return transaction;
  }

  async updateTransactionStatus(id: string, status: string, txHash?: string): Promise<Transaction | undefined> {
    const transaction = this.transactions.get(id);
    if (transaction) {
      transaction.status = status;
      if (txHash) transaction.txHash = txHash;
      if (status === "completed") transaction.completedAt = new Date();
      this.transactions.set(id, transaction);
    }
    return transaction;
  }

  async getExchangeRate(fromCurrency: string, toCurrency: string): Promise<ExchangeRate | undefined> {
    return this.exchangeRates.get(`${fromCurrency}_${toCurrency}`);
  }

  async createOrUpdateExchangeRate(insertRate: InsertExchangeRate): Promise<ExchangeRate> {
    const key = `${insertRate.fromCurrency}_${insertRate.toCurrency}`;
    const existing = this.exchangeRates.get(key);
    
    if (existing) {
      existing.rate = insertRate.rate;
      existing.updatedAt = new Date();
      this.exchangeRates.set(key, existing);
      return existing;
    } else {
      const id = randomUUID();
      const rate: ExchangeRate = {
        ...insertRate,
        id,
        updatedAt: new Date(),
      };
      this.exchangeRates.set(key, rate);
      return rate;
    }
  }

  async getSupportChat(id: string): Promise<SupportChat | undefined> {
    return this.supportChats.get(id);
  }

  async getSupportChatsByUserId(userId: number): Promise<SupportChat[]> {
    return Array.from(this.supportChats.values()).filter(chat => chat.userId === userId);
  }

  async createSupportChat(insertChat: InsertSupportChat): Promise<SupportChat> {
    const id = randomUUID();
    const chat: SupportChat = {
      ...insertChat,
      id,
      status: insertChat.status ?? "open",
      userId: insertChat.userId ?? null,
      transactionId: insertChat.transactionId ?? null,
      messages: (insertChat.messages ?? []) as { sender: string; message: string; timestamp: Date }[],
      createdAt: new Date(),
    };
    this.supportChats.set(id, chat);
    return chat;
  }

  async addMessageToChat(chatId: string, sender: string, message: string): Promise<SupportChat | undefined> {
    const chat = this.supportChats.get(chatId);
    if (chat) {
      const messages: { sender: string; message: string; timestamp: Date }[] = Array.isArray(chat.messages) ? [...chat.messages] : [];
      messages.push({ sender, message, timestamp: new Date() });
      chat.messages = messages;
      this.supportChats.set(chatId, chat);
    }
    return chat;
  }
}

export const storage = new MemStorage();
