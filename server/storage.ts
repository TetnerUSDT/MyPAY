import { type User, type InsertUser, type Wallet, type InsertWallet, type Transaction, type InsertTransaction, type ExchangeRate, type InsertExchangeRate, type SupportChat, type InsertSupportChat, type SupportTicket, type InsertSupportTicket, type SupportMessage, type InsertSupportMessage, type Card, type Bank, type InsertBank, users, wallets, transactions, exchangeRates, supportChats, supportTickets, supportMessages, cards, banks, balances, userCards, exchanges, usersBalances } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, and, sql, inArray } from "drizzle-orm";
import { insertAndReturn, updateAndReturn, insertAndReturnTx } from "./mysql-helpers";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByTgId(tgId: string): Promise<User | undefined>;
  getUserByApiKey(apiKey: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined>;
  updateUserAgreement(id: number, agreement: number): Promise<User | undefined>;
  generateApiKey(userId: number): Promise<string | undefined>;

  // Wallet methods
  getWallet(id: number): Promise<Wallet | undefined>;
  getWalletsByUserId(userId: number): Promise<Wallet[]>;
  createWallet(wallet: InsertWallet): Promise<Wallet>;
  findAvailableWallet(network: string): Promise<Wallet | undefined>;
  reserveWallet(walletId: number, hours: number, reservationType?: string, userId?: number): Promise<Wallet | undefined>;
  releaseExpiredWallets(): Promise<number>;
  findOrReserveWalletForOperation(userId: number, network: string, operation: string): Promise<Wallet | undefined>;

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

  // Bank methods
  getBanksByCardId(cardId: number): Promise<Bank[]>;
  getBank(id: number): Promise<Bank | undefined>;
  createBank(bank: InsertBank): Promise<Bank>;

  // Balance methods
  getBalance(id: number): Promise<any | undefined>;
  getBalanceById(id: number): Promise<any | undefined>;
  getBalancesByIds(ids: string): Promise<any[]>;
  getPaymentBalance(): Promise<any | undefined>; // USDT.BEP20

  // Exchange rate methods by balance IDs
  getExchangeRateByBalances(fromBalanceId: number, toBalanceId: number): Promise<any | undefined>;

  // User cards methods
  getUserCardsByUserId(userId: number): Promise<any[]>;
  createUserCard(card: any): Promise<any>;
  deleteUserCard(id: string): Promise<void>;

  // Fiat balance methods
  getFiatBalances(): Promise<any[]>;
  getCryptoBalances(): Promise<any[]>;
  getUserCryptoBalances(userId: number): Promise<any[]>;
  getUserBalance(userId: number, balanceId: number): Promise<any>;
  updateUserDefaultBalance(userId: number, balanceId: number): Promise<User | undefined>;

  // Exchange methods
  createExchange(exchange: any): Promise<any>;
  getExchange(id: number): Promise<any | undefined>;
  getExchangeByOrderNumber(orderNumber: string): Promise<any | undefined>;
  updateExchangeStatus(id: number, status: string): Promise<any | undefined>;
  getExchangeHistory(userId: number, limit: number, offset: number): Promise<any[]>;

  // Support ticket methods
  createSupportTicket(ticket: InsertSupportTicket, initialMessage: string): Promise<SupportTicket>;
  getUserOpenTicket(userId: number): Promise<any | undefined>;
  getTicketMessages(ticketId: number): Promise<SupportMessage[]>;
  addTicketMessage(message: InsertSupportMessage): Promise<SupportMessage>;
  updateTicketStatus(ticketId: number, status: 'wait-user' | 'wait-support' | 'closed'): Promise<SupportTicket | undefined>;

  // Notification methods
  getUserNotifications(userId: number): Promise<any[]>;
  getUnreadNotificationsCount(userId: number): Promise<number>;
  createNotification(notification: any): Promise<any>;
  markNotificationAsRead(id: number): Promise<any | undefined>;
  markAllNotificationsAsRead(userId: number): Promise<void>;
  deleteNotification(id: number): Promise<void>;

  // Invoice methods
  getInvoice(id: number): Promise<any | undefined>;
  getInvoiceByOrderNumber(orderNumber: string): Promise<any | undefined>;
  getUserInvoices(userId: number): Promise<any[]>;
  getAllInvoices(): Promise<any[]>;
  createInvoice(invoice: any): Promise<any>;
  updateInvoiceStatus(id: number, status: string, paidAt?: Date, paymentHash?: string): Promise<any | undefined>;
  getExpiredInvoices(): Promise<any[]>;
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
    await instance.initializeBanks();
    
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

  private async initializeBanks() {
    try {
      // Check if banks already exist
      const existingBanks = await db.select().from(banks).limit(1);
      if (existingBanks.length > 0) return;

      // 12 Russian banks for cards.id=1 (Россия)
      const russianBanks = [
        { cardId: 1, bankName: "Ozon Банк", timeExchange: null, commission: null, status: "1" },
        { cardId: 1, bankName: "ПАО Сбербанк", timeExchange: null, commission: null, status: "1" },
        { cardId: 1, bankName: "ПАО «Совкомбанк»", timeExchange: null, commission: null, status: "1" },
        { cardId: 1, bankName: "АО «Газпромбанк»", timeExchange: null, commission: null, status: "1" },
        { cardId: 1, bankName: "АО «ОТП Банк»", timeExchange: null, commission: null, status: "1" },
        { cardId: 1, bankName: "АО «Альфа-Банк»", timeExchange: null, commission: null, status: "1" },
        { cardId: 1, bankName: "АО «Банк Уралсиб»", timeExchange: null, commission: null, status: "1" },
        { cardId: 1, bankName: "ПАО «Промсвязьбанк»", timeExchange: null, commission: null, status: "1" },
        { cardId: 1, bankName: "АО «Яндекс Банк»", timeExchange: null, commission: null, status: "1" },
        { cardId: 1, bankName: "АО «Коммерческий банк Юнистрим»", timeExchange: null, commission: null, status: "1" },
        { cardId: 1, bankName: "АО «Т-Банк»", timeExchange: null, commission: null, status: "1" },
        { cardId: 1, bankName: "АО «Акционерный банк «Россия»", timeExchange: null, commission: null, status: "1" },
      ];

      for (const bank of russianBanks) {
        await db.insert(banks).values(bank).onConflictDoNothing();
      }
    } catch (error) {
      console.log('Banks initialization skipped (table may not exist yet)');
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

  private generateReferralCode(): string {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const randomLetter = letters.charAt(Math.floor(Math.random() * letters.length));
    const randomDigits = Math.floor(100000000 + Math.random() * 900000000).toString();
    return randomLetter + randomDigits;
  }

  private async generateUniqueReferralCode(): Promise<string> {
    let code = this.generateReferralCode();
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const [existing] = await db.select().from(users).where(eq(users.codeRef, code)).limit(1);
      if (!existing) {
        return code;
      }
      code = this.generateReferralCode();
      attempts++;
    }

    throw new Error('Failed to generate unique referral code after maximum attempts');
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const codeRef = await this.generateUniqueReferralCode();
    
    const user = await insertAndReturn<User>(
      db.insert(users).values({
        ...insertUser,
        agreement: insertUser.agreement ?? 0,
        blocked: insertUser.blocked ?? false,
        apiKey: insertUser.apiKey ?? null,
        codeRef,
      }),
      'users'
    );
    return user;
  }

  async updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined> {
    const user = await updateAndReturn<User>(
      db.update(users).set(data).where(eq(users.id, id)),
      'users',
      'id = ?',
      [id]
    );
    return user || undefined;
  }

  async updateUserAgreement(id: number, agreement: number): Promise<User | undefined> {
    const user = await updateAndReturn<User>(
      db.update(users).set({ agreement }).where(eq(users.id, id)),
      'users',
      'id = ?',
      [id]
    );
    return user || undefined;
  }

  async generateApiKey(userId: number): Promise<string | undefined> {
    const apiKey = randomUUID();
    
    const user = await updateAndReturn<any>(
      db.update(users).set({ apiKey }).where(eq(users.id, userId)),
      'users',
      'id = ?',
      [userId]
    );
    
    if (!user) {
      return undefined;
    }
    
    // MySQL returns snake_case, so check both formats
    return user.apiKey || user.api_key || undefined;
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
    const wallet = await insertAndReturn<Wallet>(
      db.insert(wallets).values(insertWallet),
      'wallets'
    );
    return wallet;
  }

  async findAvailableWallet(network: string): Promise<Wallet | undefined> {
    // First, release any expired wallets (except 'personal' ones)
    await this.releaseExpiredWallets();
    
    const now = new Date();
    const [wallet] = await db
      .select()
      .from(wallets)
      .where(
        and(
          eq(wallets.network, network),
          sql`(${wallets.reservationTime} IS NULL OR ${wallets.reservationTime} < ${now})`
        )
      )
      .limit(1);
    return wallet || undefined;
  }

  async reserveWallet(walletId: number, hours: number, reservationType?: string, userId?: number): Promise<Wallet | undefined> {
    const reservationTime = new Date();
    reservationTime.setHours(reservationTime.getHours() + hours);
    
    const updateData: any = { reservationTime };
    if (reservationType) {
      updateData.reserved = reservationType;
    }
    if (userId !== undefined) {
      updateData.idUser = userId;
    }
    
    const wallet = await updateAndReturn<Wallet>(
      db.update(wallets).set(updateData).where(eq(wallets.id, walletId)),
      'wallets',
      'id = ?',
      [walletId]
    );
    return wallet || undefined;
  }

  async releaseExpiredWallets(): Promise<number> {
    const now = new Date();
    
    // Release wallets where reservation time has expired
    // But exclude wallets with reserved='personal' (those are permanently assigned)
    const result = await db
      .update(wallets)
      .set({
        idUser: null,
        reservationTime: null,
        reserved: null,
      })
      .where(
        and(
          sql`${wallets.reservationTime} < ${now}`,
          sql`(${wallets.reserved} != 'personal' OR ${wallets.reserved} IS NULL)`
        )
      );
    
    return result.rowCount || 0;
  }

  async createWalletViaAPI(network: string, userId: number): Promise<{ address: string; privateKey: string } | null> {
    try {
      const apiKey = process.env.WALLET_API_KEY;
      if (!apiKey) {
        console.error("WALLET_API_KEY not found in environment variables");
        return null;
      }

      const nodeMap: Record<string, string> = {
        "TRC20": "TRON",
        "BEP20": "BSC",
        "TON": "TON"
      };

      const node = nodeMap[network];
      if (!node) {
        console.error(`Unknown network: ${network}`);
        return null;
      }

      const response = await fetch("https://demo.u-api.pro/api/wallet/create", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Authorization": apiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ node })
      });

      if (!response.ok) {
        console.error(`Failed to create wallet via API: ${response.status} ${response.statusText}`);
        return null;
      }

      const data = await response.json();
      return {
        address: data.address,
        privateKey: data.private_key
      };
    } catch (error) {
      console.error("Error creating wallet via API:", error);
      return null;
    }
  }

  async findOrReserveWalletForOperation(userId: number, network: string, operation: string): Promise<Wallet | undefined> {
    const now = new Date();
    const sixHoursFromNow = new Date(now.getTime() + 6 * 60 * 60 * 1000);
    
    // Find existing wallet reserved for this operation by this user
    // that has more than 6 hours left
    const existingWallets = await db
      .select()
      .from(wallets)
      .where(
        and(
          eq(wallets.idUser, userId),
          eq(wallets.network, network),
          eq(wallets.reserved, operation),
          sql`${wallets.reservationTime} > ${sixHoursFromNow}`
        )
      )
      .orderBy(sql`${wallets.reservationTime} DESC`)
      .limit(1);
    
    if (existingWallets.length > 0) {
      return existingWallets[0];
    }
    
    // Find an available wallet (not reserved or expired)
    const availableWallet = await this.findAvailableWallet(network);
    
    if (availableWallet) {
      // Reserve it for 24 hours and assign to user
      return await this.reserveWallet(availableWallet.id, 24, operation, userId);
    }
    
    // Create a new wallet via API
    const walletData = await this.createWalletViaAPI(network, userId);
    if (!walletData) {
      throw new Error("Failed to create wallet via API");
    }

    const newWallet = await this.createWallet({
      idUser: userId,
      network,
      address: walletData.address,
      privateKey: walletData.privateKey,
      reservationTime: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      reserved: operation,
      status: "active",
    });
    
    return newWallet;
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
    const transaction = await insertAndReturn<Transaction>(
      db.insert(transactions).values({
        ...insertTransaction,
        orderId: `order_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
      }),
      'transactions'
    );
    return transaction;
  }

  async updateTransactionStatus(id: string, status: string, txHash?: string): Promise<Transaction | undefined> {
    const updateData: any = { status };
    if (txHash) updateData.txHash = txHash;

    const transaction = await updateAndReturn<Transaction>(
      db.update(transactions).set(updateData).where(eq(transactions.id, id)),
      'transactions',
      'id = ?',
      [id]
    );
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
    const rate = await insertAndReturn<ExchangeRate>(
      db.insert(exchangeRates)
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
        }),
      'exchange_rates'
    );
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
    const chat = await insertAndReturn<SupportChat>(
      db.insert(supportChats).values(insertChat),
      'support_chats'
    );
    return chat;
  }

  async addMessageToChat(chatId: string, sender: string, message: string): Promise<SupportChat | undefined> {
    const chat = await this.getSupportChat(chatId);
    if (!chat) return undefined;

    const messages: { sender: string; message: string; timestamp: Date }[] = Array.isArray(chat.messages) ? [...chat.messages] : [];
    messages.push({ sender, message, timestamp: new Date() });

    const updatedChat = await updateAndReturn<SupportChat>(
      db.update(supportChats).set({ messages }).where(eq(supportChats.id, chatId)),
      'support_chats',
      'id = ?',
      [chatId]
    );
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

  // Bank methods
  async getBanksByCardId(cardId: number): Promise<Bank[]> {
    return await db.select().from(banks).where(
      and(
        eq(banks.cardId, cardId),
        eq(banks.status, "1")
      )
    );
  }

  async getBank(id: number): Promise<Bank | undefined> {
    const [bank] = await db.select().from(banks).where(eq(banks.id, id));
    return bank || undefined;
  }

  async createBank(insertBank: InsertBank): Promise<Bank> {
    const bank = await insertAndReturn<Bank>(
      db.insert(banks).values(insertBank),
      'banks'
    );
    return bank;
  }

  // Balance methods
  async getBalance(id: number): Promise<any | undefined> {
    const [balance] = await db.select().from(balances).where(eq(balances.id, id));
    return balance || undefined;
  }

  async getBalanceById(id: number): Promise<any | undefined> {
    const [balance] = await db.select().from(balances).where(eq(balances.id, id));
    return balance || undefined;
  }

  async getBalancesByIds(ids: string): Promise<any[]> {
    if (!ids) return [];
    const idArray = ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
    if (idArray.length === 0) return [];
    return await db.select().from(balances).where(inArray(balances.id, idArray));
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
    const result = await db
      .select({
        id: userCards.id,
        idCard: userCards.idCard,
        idUser: userCards.idUser,
        idBank: userCards.idBank,
        name: userCards.name,
        firstName: userCards.firstName,
        lastName: userCards.lastName,
        phone: userCards.phone,
        country: userCards.country,
        numberCard: userCards.numberCard,
        status: userCards.status,
        bankName: banks.bankName
      })
      .from(userCards)
      .leftJoin(banks, eq(userCards.idBank, banks.id))
      .where(eq(userCards.idUser, userId));
    
    return result;
  }

  async createUserCard(card: any): Promise<any> {
    const newCard = await insertAndReturn<any>(
      db.insert(userCards).values(card),
      'user_cards'
    );
    return newCard;
  }

  async deleteUserCard(id: string): Promise<void> {
    await db.delete(userCards).where(eq(userCards.id, parseInt(id)));
  }

  // Fiat balance methods
  async getFiatBalances(): Promise<any[]> {
    return await db.select().from(balances).where(eq(balances.balanceType, "fiat"));
  }

  async getCryptoBalances(): Promise<any[]> {
    return await db.select().from(balances).where(eq(balances.balanceType, "crypto"));
  }

  async getUserCryptoBalances(userId: number): Promise<any[]> {
    const cryptoBalances = await this.getCryptoBalances();
    
    // Filter out hidden balances
    const visibleBalances = cryptoBalances.filter(balance => balance.status !== 'hidden');
    
    const result = await Promise.all(
      visibleBalances.map(async (balance) => {
        const [userBalance] = await db
          .select()
          .from(usersBalances)
          .where(
            and(
              eq(usersBalances.idUser, userId),
              eq(usersBalances.idBalance, balance.id)
            )
          );

        return {
          id: balance.id,
          title: balance.title,
          network: balance.network,
          currency: balance.currency,
          sum: userBalance?.sum || "0.00",
          status: userBalance?.status || "inactive",
          balanceStatus: balance.status || "active", // Add system balance status
        };
      })
    );

    return result;
  }

  async getUserBalance(userId: number, balanceId: number): Promise<any> {
    const { usersBalances } = await import("@shared/schema");
    
    // Try to find existing user balance
    const [existingBalance] = await db
      .select()
      .from(usersBalances)
      .where(
        and(
          eq(usersBalances.idUser, userId),
          eq(usersBalances.idBalance, balanceId)
        )
      );

    if (existingBalance) {
      return existingBalance;
    }

    // Create new user balance if not exists
    const newBalance = await insertAndReturn<any>(
      db.insert(usersBalances).values({
        idUser: userId,
        idBalance: balanceId,
        sum: "0.0",
        status: "active"
      }),
      'users_balances'
    );

    return newBalance;
  }

  async updateUserBalance(userId: number, balanceId: number, amount: number): Promise<any> {
    const { usersBalances } = await import("@shared/schema");
    const { sql } = await import("drizzle-orm");
    
    // Get current balance
    const currentBalance = await this.getUserBalance(userId, balanceId);
    const newSum = (parseFloat(currentBalance.sum) + amount).toFixed(8);
    
    // Update balance
    const updatedBalance = await updateAndReturn<any>(
      db.update(usersBalances)
        .set({ sum: newSum })
        .where(
          and(
            eq(usersBalances.idUser, userId),
            eq(usersBalances.idBalance, balanceId)
          )
        ),
      'users_balances',
      'id_user = ? AND id_balance = ?',
      [userId, balanceId]
    );
    
    return updatedBalance;
  }

  async updateUserDefaultBalance(userId: number, balanceId: number): Promise<User | undefined> {
    const updatedUser = await updateAndReturn<User>(
      db.update(users).set({ defaultFiatBalanceId: balanceId }).where(eq(users.id, userId)),
      'users',
      'id = ?',
      [userId]
    );

    return updatedUser || undefined;
  }

  // Exchange methods
  async createExchange(exchange: any): Promise<any> {
    const newExchange = await insertAndReturn<any>(
      db.insert(exchanges).values(exchange),
      'exchanges'
    );
    // Add camelCase alias for compatibility
    return {
      ...newExchange,
      numberOrder: newExchange.number_order || newExchange.numberOrder
    };
  }

  async getExchange(id: number): Promise<any | undefined> {
    const [exchange] = await db
      .select()
      .from(exchanges)
      .where(eq(exchanges.id, id));
    
    if (!exchange) return undefined;
    
    // Add camelCase alias for compatibility
    return {
      ...exchange,
      numberOrder: exchange.number_order || exchange.numberOrder
    };
  }

  async getExchangeByOrderNumber(orderNumber: string): Promise<any | undefined> {
    const [result] = await db
      .select({
        exchange: exchanges,
        savedCardNumber: userCards.numberCard,
        cardId: userCards.idCard,
        bankId: userCards.idBank,
      })
      .from(exchanges)
      .leftJoin(userCards, eq(exchanges.idCard, userCards.id))
      .where(eq(exchanges.numberOrder, orderNumber));
    
    if (!result) return undefined;
    
    // Get time exchange from bank or card
    let timeExchange = 60; // Default 60 minutes
    
    if (result.bankId) {
      // Try to get time from bank first
      const [bank] = await db
        .select()
        .from(banks)
        .where(eq(banks.id, result.bankId));
      
      if (bank?.timeExchange) {
        timeExchange = bank.timeExchange;
      } else if (result.cardId) {
        // Fallback to card time
        const [card] = await db
          .select()
          .from(cards)
          .where(eq(cards.id, result.cardId));
        
        if (card?.timeExchange) {
          timeExchange = card.timeExchange;
        }
      }
    } else if (result.cardId) {
      // No bank, get time from card
      const [card] = await db
        .select()
        .from(cards)
        .where(eq(cards.id, result.cardId));
      
      if (card?.timeExchange) {
        timeExchange = card.timeExchange;
      }
    }
    
    // Use saved card number if available, otherwise use manual card number
    return {
      ...result.exchange,
      numberOrder: result.exchange.number_order || result.exchange.numberOrder,
      cardNumber: result.savedCardNumber || result.exchange.manualCardNumber,
      timeExchange
    };
  }

  async updateExchangeStatus(id: number, status: string): Promise<any | undefined> {
    const updatedExchange = await updateAndReturn<any>(
      db.update(exchanges)
        .set({ status: status as 'wait' | 'wait-paid' | 'paid' | 'complete' | 'canceled' | 'dispute' })
        .where(eq(exchanges.id, id)),
      'exchanges',
      'id = ?',
      [id]
    );
    
    if (!updatedExchange) return undefined;
    
    // Add camelCase alias for compatibility
    return {
      ...updatedExchange,
      numberOrder: updatedExchange.number_order || updatedExchange.numberOrder
    };
  }

  async getExchangeHistory(userId: number, limit: number, offset: number): Promise<any[]> {
    const { desc } = await import("drizzle-orm");
    
    const results = await db
      .select({
        exchange: exchanges,
        savedCardNumber: userCards.numberCard,
        cardId: userCards.idCard,
        bankId: userCards.idBank,
        walletAddress: wallets.address,
      })
      .from(exchanges)
      .leftJoin(userCards, eq(exchanges.idCard, userCards.id))
      .leftJoin(wallets, eq(exchanges.walletId, wallets.id))
      .where(eq(exchanges.idUser, userId))
      .orderBy(desc(exchanges.timestamp))
      .limit(limit)
      .offset(offset);
    
    // Enrich each result with timeExchange
    const enrichedResults = await Promise.all(results.map(async (result: any) => {
      let timeExchange = 60; // Default 60 minutes
      
      if (result.bankId) {
        const [bank] = await db
          .select()
          .from(banks)
          .where(eq(banks.id, result.bankId));
        
        if (bank?.timeExchange) {
          timeExchange = bank.timeExchange;
        } else if (result.cardId) {
          const [card] = await db
            .select()
            .from(cards)
            .where(eq(cards.id, result.cardId));
          
          if (card?.timeExchange) {
            timeExchange = card.timeExchange;
          }
        }
      } else if (result.cardId) {
        const [card] = await db
          .select()
          .from(cards)
          .where(eq(cards.id, result.cardId));
        
        if (card?.timeExchange) {
          timeExchange = card.timeExchange;
        }
      }
      
      return {
        ...result.exchange,
        numberOrder: result.exchange.number_order || result.exchange.numberOrder,
        cardNumber: result.savedCardNumber || result.exchange.manualCardNumber,
        walletAddress: result.walletAddress,
        timeExchange
      };
    }));
    
    return enrichedResults;
  }

  // Support ticket methods
  async createSupportTicket(ticket: InsertSupportTicket, initialMessage: string): Promise<SupportTicket> {
    return await db.transaction(async (tx: any) => {
      const newTicket = await insertAndReturnTx<SupportTicket>(
        tx.insert(supportTickets).values(ticket),
        tx,
        'support_tickets'
      );
      
      await tx.insert(supportMessages).values({
        ticketId: newTicket.id,
        sender: "user",
        message: initialMessage,
      });
      
      return newTicket;
    });
  }

  async getUserOpenTicket(userId: number): Promise<any | undefined> {
    const { not } = await import("drizzle-orm");
    
    const [ticket] = await db
      .select({
        ticket: supportTickets,
        exchangeNumber: exchanges.numberOrder,
      })
      .from(supportTickets)
      .leftJoin(exchanges, eq(supportTickets.exchangeId, exchanges.id))
      .where(
        and(
          eq(supportTickets.userId, userId),
          not(eq(supportTickets.status, "closed"))
        )
      )
      .limit(1);
    
    if (!ticket) return undefined;
    
    return {
      ...ticket.ticket,
      exchangeNumber: ticket.exchangeNumber,
    };
  }

  async getTicketMessages(ticketId: number): Promise<SupportMessage[]> {
    return await db
      .select()
      .from(supportMessages)
      .where(eq(supportMessages.ticketId, ticketId))
      .orderBy(supportMessages.createdAt);
  }

  async addTicketMessage(message: InsertSupportMessage): Promise<SupportMessage> {
    const newMessage = await insertAndReturn<SupportMessage>(
      db.insert(supportMessages).values(message),
      'support_messages'
    );
    
    await db
      .update(supportTickets)
      .set({ updatedAt: new Date() })
      .where(eq(supportTickets.id, message.ticketId));
    
    return newMessage;
  }

  async updateTicketStatus(ticketId: number, status: 'wait-user' | 'wait-support' | 'closed'): Promise<SupportTicket | undefined> {
    const updatedTicket = await updateAndReturn<SupportTicket>(
      db.update(supportTickets).set({ status, updatedAt: new Date() }).where(eq(supportTickets.id, ticketId)),
      'support_tickets',
      'id = ?',
      [ticketId]
    );
    return updatedTicket || undefined;
  }

  // Notification methods implementation
  async getUserNotifications(userId: number): Promise<any[]> {
    const { notifications } = await import("@shared/schema");
    return await db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(sql`${notifications.createdAt} DESC`);
  }

  async getUnreadNotificationsCount(userId: number): Promise<number> {
    const { notifications } = await import("@shared/schema");
    const result = await db.select({ count: sql<number>`count(*)` }).from(notifications).where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      )
    );
    return result[0]?.count || 0;
  }

  async createNotification(notification: any): Promise<any> {
    const { notifications } = await import("@shared/schema");
    const newNotification = await insertAndReturn<any>(
      db.insert(notifications).values(notification),
      'notifications'
    );
    return newNotification;
  }

  async markNotificationAsRead(id: number): Promise<any | undefined> {
    const { notifications } = await import("@shared/schema");
    const updatedNotification = await updateAndReturn<any>(
      db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id)),
      'notifications',
      'id = ?',
      [id]
    );
    return updatedNotification || undefined;
  }

  async markAllNotificationsAsRead(userId: number): Promise<void> {
    const { notifications } = await import("@shared/schema");
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, userId));
  }

  async deleteNotification(id: number): Promise<void> {
    const { notifications } = await import("@shared/schema");
    await db.delete(notifications).where(eq(notifications.id, id));
  }

  // Invoice methods implementation
  async getInvoice(id: number): Promise<any | undefined> {
    const { invoices } = await import("@shared/schema");
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    return invoice || undefined;
  }

  async getInvoiceByOrderNumber(orderNumber: string): Promise<any | undefined> {
    const { invoices } = await import("@shared/schema");
    const [invoice] = await db.select().from(invoices).where(eq(invoices.orderNumber, orderNumber));
    return invoice || undefined;
  }

  async getUserInvoices(userId: number): Promise<any[]> {
    const { invoices } = await import("@shared/schema");
    return await db.select().from(invoices).where(eq(invoices.userId, userId)).orderBy(sql`${invoices.createdAt} DESC`);
  }

  async getAllInvoices(): Promise<any[]> {
    const { invoices } = await import("@shared/schema");
    return await db.select().from(invoices).orderBy(sql`${invoices.createdAt} DESC`);
  }

  async createInvoice(invoice: any): Promise<any> {
    const { invoices } = await import("@shared/schema");
    const newInvoice = await insertAndReturn<any>(
      db.insert(invoices).values(invoice),
      'invoices'
    );
    return newInvoice;
  }

  async updateInvoiceStatus(id: number, status: string, paidAt?: Date, paymentHash?: string): Promise<any | undefined> {
    const { invoices } = await import("@shared/schema");
    const updateData: any = { status };
    if (paidAt) updateData.paidAt = paidAt;
    if (paymentHash) updateData.paymentHash = paymentHash;
    
    const updatedInvoice = await updateAndReturn<any>(
      db.update(invoices).set(updateData).where(eq(invoices.id, id)),
      'invoices',
      'id = ?',
      [id]
    );
    return updatedInvoice || undefined;
  }

  async getExpiredInvoices(): Promise<any[]> {
    const { invoices } = await import("@shared/schema");
    return await db.select().from(invoices).where(
      and(
        eq(invoices.status, 'pending'),
        sql`${invoices.expiresAt} < NOW()`
      )
    );
  }
}

export const storage = new DatabaseStorage();