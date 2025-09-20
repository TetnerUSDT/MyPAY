import { type User, type InsertUser, type Wallet, type InsertWallet, type Transaction, type InsertTransaction, type ExchangeRate, type InsertExchangeRate, type SupportChat, type InsertSupportChat } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Wallet methods
  getWallet(id: string): Promise<Wallet | undefined>;
  getWalletsByUserId(userId: string): Promise<Wallet[]>;
  createWallet(wallet: InsertWallet): Promise<Wallet>;
  updateWalletBalance(id: string, balance: string): Promise<Wallet | undefined>;

  // Transaction methods
  getTransaction(id: string): Promise<Transaction | undefined>;
  getTransactionByOrderId(orderId: string): Promise<Transaction | undefined>;
  getTransactionsByUserId(userId: string): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransactionStatus(id: string, status: string, txHash?: string): Promise<Transaction | undefined>;

  // Exchange rate methods
  getExchangeRate(fromCurrency: string, toCurrency: string): Promise<ExchangeRate | undefined>;
  createOrUpdateExchangeRate(rate: InsertExchangeRate): Promise<ExchangeRate>;

  // Support chat methods
  getSupportChat(id: string): Promise<SupportChat | undefined>;
  getSupportChatsByUserId(userId: string): Promise<SupportChat[]>;
  createSupportChat(chat: InsertSupportChat): Promise<SupportChat>;
  addMessageToChat(chatId: string, sender: string, message: string): Promise<SupportChat | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private wallets: Map<string, Wallet>;
  private transactions: Map<string, Transaction>;
  private exchangeRates: Map<string, ExchangeRate>;
  private supportChats: Map<string, SupportChat>;

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

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getWallet(id: string): Promise<Wallet | undefined> {
    return this.wallets.get(id);
  }

  async getWalletsByUserId(userId: string): Promise<Wallet[]> {
    return Array.from(this.wallets.values()).filter(wallet => wallet.userId === userId);
  }

  async createWallet(insertWallet: InsertWallet): Promise<Wallet> {
    const id = randomUUID();
    const wallet: Wallet = { 
      ...insertWallet, 
      id,
      userId: insertWallet.userId ?? null,
      balance: insertWallet.balance ?? "0"
    };
    this.wallets.set(id, wallet);
    return wallet;
  }

  async updateWalletBalance(id: string, balance: string): Promise<Wallet | undefined> {
    const wallet = this.wallets.get(id);
    if (wallet) {
      wallet.balance = balance;
      this.wallets.set(id, wallet);
    }
    return wallet;
  }

  async getTransaction(id: string): Promise<Transaction | undefined> {
    return this.transactions.get(id);
  }

  async getTransactionByOrderId(orderId: string): Promise<Transaction | undefined> {
    return Array.from(this.transactions.values()).find(tx => tx.orderId === orderId);
  }

  async getTransactionsByUserId(userId: string): Promise<Transaction[]> {
    return Array.from(this.transactions.values()).filter(tx => tx.userId === userId);
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const id = randomUUID();
    const transaction: Transaction = {
      ...insertTransaction,
      id,
      status: insertTransaction.status ?? "pending",
      userId: insertTransaction.userId ?? null,
      createdAt: new Date(),
      completedAt: null,
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

  async getSupportChatsByUserId(userId: string): Promise<SupportChat[]> {
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
      messages: Array.isArray(insertChat.messages) ? insertChat.messages : [],
      createdAt: new Date(),
    };
    this.supportChats.set(id, chat);
    return chat;
  }

  async addMessageToChat(chatId: string, sender: string, message: string): Promise<SupportChat | undefined> {
    const chat = this.supportChats.get(chatId);
    if (chat) {
      const messages = chat.messages || [];
      messages.push({ sender, message, timestamp: new Date() });
      chat.messages = messages;
      this.supportChats.set(chatId, chat);
    }
    return chat;
  }
}

export const storage = new MemStorage();
