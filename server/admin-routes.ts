import { Express } from "express";
import { AdminRequest, requireSuperAdmin, requireAdmin, requirePermission } from "./admin-middleware";
import { IStorage } from "./storage";
import { db } from "./db";
import { balances, exchanges, cards, banks, exchangeRates, supportTickets, supportMessages, supportChats, users, wallets, admins, userCards, usersBalances, botCommands, botCommandReactions, botCommandFiles, botMenus, botMenuButtons } from "@shared/schema";
import { eq, desc, sql, and, not } from "drizzle-orm";
import { insertBalanceSchema, insertCardSchema, insertBankSchema, insertExchangeRateSchema, insertSupportMessageSchema, insertAdminSchema, insertUsersBalancesSchema, insertBotCommandSchema, insertBotCommandReactionSchema, insertBotCommandFileSchema, insertBotMenuSchema, insertBotMenuButtonSchema } from "@shared/schema";
import { telegramService } from "./telegram-service";
import { notificationService } from "./notification-service";
import { formatBalance } from "./utils";
import { systemUpload } from "./upload-config";

// Helper functions for MySQL compatibility
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback UUID v4 generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// MySQL-only helper functions (we only use MySQL now)
async function insertAndReturn<T extends any, R>(table: T, values: any): Promise<R> {
  const result = await db.insert(table).values(values) as any;
  const insertId = result[0]?.insertId || result?.insertId;
  if (insertId) {
    const [inserted] = await db.select().from(table).where(eq((table as any).id, insertId)).limit(1);
    return inserted as R;
  }
  throw new Error('Failed to get inserted record');
}

async function updateAndReturn<T extends any, R>(table: T, updateData: any, condition: any): Promise<R> {
  await db.update(table).set(updateData).where(condition);
  const [updated] = await db.select().from(table).where(condition).limit(1);
  return updated as R;
}

export function registerAdminRoutes(app: Express, storage: IStorage) {
  const adminPath = process.env.ADMIN_URL || 'admin';

  // Admin login check
  app.get(`/${adminPath}/api/auth/check`, requireAdmin, async (req: AdminRequest, res) => {
    res.json({
      username: req.admin!.username,
      isSuperAdmin: req.admin!.isSuperAdmin,
      permissions: req.admin!.permissions,
    });
  });

  // ========== BALANCES MANAGEMENT ==========
  app.get(`/${adminPath}/api/balances`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const allBalances = await db.select().from(balances).orderBy(desc(balances.id));
      res.json(allBalances);
    } catch (error) {
      console.error('Get balances error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(`/${adminPath}/api/balances`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      console.log('Received balance data:', req.body);
      const validatedData = insertBalanceSchema.parse(req.body);
      console.log('Validated balance data:', validatedData);
      const newBalance = await insertAndReturn(balances, validatedData);
      res.json(newBalance);
    } catch (error) {
      console.error('Create balance error:', error);
      if (error instanceof Error) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(400).json({ message: "Invalid data" });
      }
    }
  });

  app.put(`/${adminPath}/api/balances/:id`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertBalanceSchema.parse(req.body);
      const updated = await updateAndReturn(balances, validatedData, eq(balances.id, parseInt(id)));
      res.json(updated);
    } catch (error) {
      console.error('Update balance error:', error);
      res.status(400).json({ message: "Invalid data" });
    }
  });

  app.delete(`/${adminPath}/api/balances/:id`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const { id } = req.params;
      await db.delete(balances).where(eq(balances.id, parseInt(id)));
      res.json({ success: true });
    } catch (error) {
      console.error('Delete balance error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ========== USER BALANCES MANAGEMENT ==========
  app.get(`/${adminPath}/api/user-balances`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const userBalancesWithDetails = await db
        .select({
          id: usersBalances.id,
          idUser: usersBalances.idUser,
          idBalance: usersBalances.idBalance,
          sum: usersBalances.sum,
          status: usersBalances.status,
          userName: users.name,
          userTgId: users.tgId,
          balanceTitle: balances.title,
          balanceNetwork: balances.network,
          balanceCurrency: balances.currency,
          balanceType: balances.balanceType,
        })
        .from(usersBalances)
        .leftJoin(users, eq(usersBalances.idUser, users.id))
        .leftJoin(balances, eq(usersBalances.idBalance, balances.id))
        .orderBy(desc(usersBalances.id));
      
      res.json(userBalancesWithDetails);
    } catch (error) {
      console.error('Get user balances error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(`/${adminPath}/api/user-balances`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const validatedData = insertUsersBalancesSchema.parse(req.body);
      const newUserBalance = await insertAndReturn(usersBalances, validatedData);
      res.json(newUserBalance);
    } catch (error: any) {
      console.error('Create user balance error:', error);
      
      // Check for duplicate key error (MySQL error code 1062)
      if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
        return res.status(400).json({ 
          message: "У этого пользователя уже есть баланс данного типа. Удалите существующий или измените его." 
        });
      }
      
      if (error instanceof Error) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(400).json({ message: "Invalid data" });
      }
    }
  });

  app.put(`/${adminPath}/api/user-balances/:id`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertUsersBalancesSchema.parse(req.body);
      const updated = await updateAndReturn(usersBalances, validatedData, eq(usersBalances.id, parseInt(id)));
      res.json(updated);
    } catch (error: any) {
      console.error('Update user balance error:', error);
      
      // Check for duplicate key error (MySQL error code 1062)
      if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
        return res.status(400).json({ 
          message: "У этого пользователя уже есть баланс данного типа. Выберите другой тип баланса." 
        });
      }
      
      res.status(400).json({ message: "Invalid data" });
    }
  });

  app.delete(`/${adminPath}/api/user-balances/:id`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const { id } = req.params;
      await db.delete(usersBalances).where(eq(usersBalances.id, parseInt(id)));
      res.json({ success: true });
    } catch (error) {
      console.error('Delete user balance error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ========== EXCHANGES MANAGEMENT ==========
  app.get(`/${adminPath}/api/exchanges`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const { limit = '50', offset = '0', status } = req.query;
      
      let results;
      if (status) {
        results = await db.select({
          id: exchanges.id,
          numberOrder: exchanges.numberOrder,
          idUser: exchanges.idUser,
          userName: users.name,
          walletId: exchanges.walletId,
          fromCurrency: exchanges.fromCurrency,
          toCurrency: exchanges.toCurrency,
          amountFrom: exchanges.amountFrom,
          amountTo: exchanges.amountTo,
          rate: exchanges.rate,
          status: exchanges.status,
          timestamp: exchanges.timestamp,
          cancelReason: exchanges.cancelReason,
          paymentHash: exchanges.paymentHash,
          tempBalance: exchanges.tempBalance,
          walletAddress: wallets.address,
          cardNumber: userCards.numberCard,
          manualCardNumber: exchanges.manualCardNumber,
          // User card details
          cardName: userCards.name,
          cardFirstName: userCards.firstName,
          cardLastName: userCards.lastName,
          cardPhone: userCards.phone,
          cardCountry: userCards.country,
          cardAccountNumber: userCards.accountNumber,
          cardBankName: banks.bankName,
        })
        .from(exchanges)
        .leftJoin(users, eq(exchanges.idUser, users.id))
        .leftJoin(wallets, eq(exchanges.walletId, wallets.id))
        .leftJoin(userCards, eq(exchanges.idCard, userCards.id))
        .leftJoin(banks, eq(userCards.idBank, banks.id))
        .where(eq(exchanges.status, status as string))
        .limit(parseInt(limit as string))
        .offset(parseInt(offset as string))
        .orderBy(desc(exchanges.id));
      } else {
        results = await db.select({
          id: exchanges.id,
          numberOrder: exchanges.numberOrder,
          idUser: exchanges.idUser,
          userName: users.name,
          walletId: exchanges.walletId,
          fromCurrency: exchanges.fromCurrency,
          toCurrency: exchanges.toCurrency,
          amountFrom: exchanges.amountFrom,
          amountTo: exchanges.amountTo,
          rate: exchanges.rate,
          status: exchanges.status,
          timestamp: exchanges.timestamp,
          cancelReason: exchanges.cancelReason,
          paymentHash: exchanges.paymentHash,
          tempBalance: exchanges.tempBalance,
          walletAddress: wallets.address,
          cardNumber: userCards.numberCard,
          manualCardNumber: exchanges.manualCardNumber,
          // User card details
          cardName: userCards.name,
          cardFirstName: userCards.firstName,
          cardLastName: userCards.lastName,
          cardPhone: userCards.phone,
          cardCountry: userCards.country,
          cardAccountNumber: userCards.accountNumber,
          cardBankName: banks.bankName,
        })
        .from(exchanges)
        .leftJoin(users, eq(exchanges.idUser, users.id))
        .leftJoin(wallets, eq(exchanges.walletId, wallets.id))
        .leftJoin(userCards, eq(exchanges.idCard, userCards.id))
        .leftJoin(banks, eq(userCards.idBank, banks.id))
        .limit(parseInt(limit as string))
        .offset(parseInt(offset as string))
        .orderBy(desc(exchanges.id));
      }
      
      console.log('[Admin] Returning exchanges:', results.length, 'records');
      if (results.length > 0) {
        console.log('[Admin] First exchange sample:', JSON.stringify(results[0]));
      }
      res.json(results);
    } catch (error) {
      console.error('Get exchanges error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(`/${adminPath}/api/exchanges/:id`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const { id } = req.params;
      const [exchange] = await db.select().from(exchanges).where(eq(exchanges.id, parseInt(id)));
      
      if (!exchange) {
        return res.status(404).json({ message: "Exchange not found" });
      }

      // Get wallet if exists
      let wallet = null;
      if (exchange.walletId) {
        wallet = await storage.getWallet(exchange.walletId);
      }

      res.json({ ...exchange, wallet });
    } catch (error) {
      console.error('Get exchange error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put(`/${adminPath}/api/exchanges/:id/status`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const { id } = req.params;
      const { status, cancelReason, paymentHash } = req.body;
      
      console.log(`[Admin] Updating exchange ${id} status to:`, status);
      
      const updateData: any = { status };
      if (cancelReason) updateData.cancelReason = cancelReason;
      if (paymentHash) updateData.paymentHash = paymentHash;
      
      const updated = await updateAndReturn(exchanges, updateData, eq(exchanges.id, parseInt(id)));
      console.log(`[Admin] Exchange ${id} updated successfully`);
      
      // Send SSE notification to user about exchange status update
      notificationService.notifyExchangeUpdate(updated.idUser.toString(), {
        exchangeId: updated.id,
        numberOrder: updated.numberOrder,
        status: updated.status,
        cancelReason: updated.cancelReason,
        paymentHash: updated.paymentHash
      });
      console.log(`[Admin] SSE notification sent to user ${updated.idUser} for exchange ${id}`);
      
      res.json(updated);
    } catch (error) {
      console.error('Update exchange status error:', error);
      res.status(400).json({ message: "Invalid data" });
    }
  });

  app.put(`/${adminPath}/api/exchanges/:id`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const { id } = req.params;
      const updated = await updateAndReturn(exchanges, req.body, eq(exchanges.id, parseInt(id)));
      res.json(updated);
    } catch (error) {
      console.error('Update exchange error:', error);
      res.status(400).json({ message: "Invalid data" });
    }
  });

  // ========== CARDS & BANKS MANAGEMENT ==========
  app.get(`/${adminPath}/api/cards`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const allCards = await db.select().from(cards).orderBy(desc(cards.id));
      res.json(allCards);
    } catch (error) {
      console.error('Get cards error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(`/${adminPath}/api/cards`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const validatedData = insertCardSchema.parse(req.body);
      const newCard = await insertAndReturn(cards, validatedData);
      res.json(newCard);
    } catch (error) {
      console.error('Create card error:', error);
      res.status(400).json({ message: "Invalid data" });
    }
  });

  app.put(`/${adminPath}/api/cards/:id`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertCardSchema.parse(req.body);
      const updated = await updateAndReturn(cards, validatedData, eq(cards.id, parseInt(id)));
      res.json(updated);
    } catch (error) {
      console.error('Update card error:', error);
      res.status(400).json({ message: "Invalid data" });
    }
  });

  app.delete(`/${adminPath}/api/cards/:id`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const { id } = req.params;
      await db.delete(cards).where(eq(cards.id, parseInt(id)));
      res.json({ success: true });
    } catch (error) {
      console.error('Delete card error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(`/${adminPath}/api/banks`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const allBanks = await db.select().from(banks).orderBy(desc(banks.id));
      res.json(allBanks);
    } catch (error) {
      console.error('Get banks error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(`/${adminPath}/api/banks`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const validatedData = insertBankSchema.parse(req.body);
      const newBank = await insertAndReturn(banks, validatedData);
      res.json(newBank);
    } catch (error) {
      console.error('Create bank error:', error);
      res.status(400).json({ message: "Invalid data" });
    }
  });

  app.put(`/${adminPath}/api/banks/:id`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertBankSchema.parse(req.body);
      const updated = await updateAndReturn(banks, validatedData, eq(banks.id, parseInt(id)));
      res.json(updated);
    } catch (error) {
      console.error('Update bank error:', error);
      res.status(400).json({ message: "Invalid data" });
    }
  });

  app.delete(`/${adminPath}/api/banks/:id`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const { id } = req.params;
      await db.delete(banks).where(eq(banks.id, parseInt(id)));
      res.json({ success: true });
    } catch (error) {
      console.error('Delete bank error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ========== EXCHANGE RATES MANAGEMENT ==========
  app.get(`/${adminPath}/api/exchange-rates`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const rates = await db.select().from(exchangeRates).orderBy(desc(exchangeRates.updatedAt));
      res.json(rates);
    } catch (error) {
      console.error('Get exchange rates error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(`/${adminPath}/api/exchange-rates`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const validatedData = insertExchangeRateSchema.parse(req.body);
      
      // Получаем валюты из связанных балансов
      const [fromBalance] = await db.select().from(balances).where(eq(balances.id, validatedData.fromBalanceId));
      const [toBalance] = await db.select().from(balances).where(eq(balances.id, validatedData.toBalanceId));
      
      if (!fromBalance || !toBalance) {
        return res.status(400).json({ message: "Балансы не найдены" });
      }
      
      // Проверка на дубликаты - курс с таким же направлением уже существует
      const [existingRate] = await db
        .select()
        .from(exchangeRates)
        .where(
          and(
            eq(exchangeRates.fromBalanceId, validatedData.fromBalanceId),
            eq(exchangeRates.toBalanceId, validatedData.toBalanceId)
          )
        )
        .limit(1);
      
      if (existingRate) {
        return res.status(409).json({ message: "Курс с таким направлением уже существует" });
      }
      
      const rateData = {
        ...validatedData,
        fromCurrency: fromBalance.currency,
        toCurrency: toBalance.currency,
        id: generateUUID(),
        updatedAt: new Date(),
      };
      await db.insert(exchangeRates).values(rateData);
      // Возвращаем вставленные данные (для UUID нельзя использовать insertAndReturn)
      const [newRate] = await db.select().from(exchangeRates).where(eq(exchangeRates.id, rateData.id)).limit(1);
      res.json(newRate);
    } catch (error) {
      console.error('Create exchange rate error:', error);
      res.status(400).json({ message: "Invalid data" });
    }
  });

  app.put(`/${adminPath}/api/exchange-rates/:id`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const id = req.params.id; // Keep as string for UUID comparison
      const validatedData = insertExchangeRateSchema.parse(req.body);
      
      // Получаем валюты из связанных балансов
      const [fromBalance] = await db.select().from(balances).where(eq(balances.id, validatedData.fromBalanceId));
      const [toBalance] = await db.select().from(balances).where(eq(balances.id, validatedData.toBalanceId));
      
      if (!fromBalance || !toBalance) {
        return res.status(400).json({ message: "Балансы не найдены" });
      }
      
      // Проверка на дубликаты - курс с таким же направлением уже существует (исключая текущий)
      const [existingRate] = await db
        .select()
        .from(exchangeRates)
        .where(
          and(
            eq(exchangeRates.fromBalanceId, validatedData.fromBalanceId),
            eq(exchangeRates.toBalanceId, validatedData.toBalanceId),
            not(eq(exchangeRates.id, id))
          )
        )
        .limit(1);
      
      if (existingRate) {
        return res.status(409).json({ message: "Курс с таким направлением уже существует" });
      }
      
      const updateData = {
        ...validatedData,
        fromCurrency: fromBalance.currency,
        toCurrency: toBalance.currency,
        updatedAt: new Date(),
      };
      const updated = await updateAndReturn(exchangeRates, updateData, eq(exchangeRates.id, id));
      res.json(updated);
    } catch (error) {
      console.error('Update exchange rate error:', error);
      res.status(400).json({ message: "Invalid data" });
    }
  });

  app.delete(`/${adminPath}/api/exchange-rates/:id`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const { id } = req.params;
      await db.delete(exchangeRates).where(eq(exchangeRates.id, id));
      res.json({ success: true });
    } catch (error) {
      console.error('Delete exchange rate error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ========== SUPPORT MANAGEMENT (Support Chats) ==========
  app.get(`/${adminPath}/api/support`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const { status } = req.query;
      
      let chats;
      if (status) {
        chats = await db.select().from(supportChats).where(eq(supportChats.status, status as string)).orderBy(desc(supportChats.createdAt));
      } else {
        chats = await db.select().from(supportChats).orderBy(desc(supportChats.createdAt));
      }
      
      res.json(chats);
    } catch (error) {
      console.error('Get support chats error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(`/${adminPath}/api/support/:chatId/reply`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const { chatId } = req.params;
      const { message } = req.body;
      
      const [chat] = await db.select().from(supportChats).where(eq(supportChats.id, chatId));
      
      if (!chat) {
        return res.status(404).json({ message: "Chat not found" });
      }

      const newMessage = {
        sender: 'admin',
        message,
        timestamp: new Date(),
      };

      const updatedMessages = [...(chat.messages || []), newMessage] as any;

      const updated = await updateAndReturn(
        supportChats,
        { messages: updatedMessages },
        eq(supportChats.id, chatId)
      );

      res.json(updated);
    } catch (error) {
      console.error('Reply to support chat error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(`/${adminPath}/api/support/:chatId/close`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const { chatId } = req.params;
      
      const updated = await updateAndReturn(
        supportChats,
        { status: 'closed' },
        eq(supportChats.id, chatId)
      );

      res.json(updated);
    } catch (error) {
      console.error('Close support chat error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Legacy support tickets routes (keeping for compatibility)
  app.get(`/${adminPath}/api/support/tickets`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const { status } = req.query;
      
      let tickets;
      if (status) {
        tickets = await db
          .select({
            id: supportTickets.id,
            userId: supportTickets.userId,
            exchangeId: supportTickets.exchangeId,
            status: supportTickets.status,
            createdAt: supportTickets.createdAt,
            updatedAt: supportTickets.updatedAt,
            exchangeNumber: exchanges.numberOrder,
          })
          .from(supportTickets)
          .leftJoin(exchanges, eq(supportTickets.exchangeId, exchanges.id))
          .where(eq(supportTickets.status, status as string))
          .orderBy(desc(supportTickets.id));
      } else {
        tickets = await db
          .select({
            id: supportTickets.id,
            userId: supportTickets.userId,
            exchangeId: supportTickets.exchangeId,
            status: supportTickets.status,
            createdAt: supportTickets.createdAt,
            updatedAt: supportTickets.updatedAt,
            exchangeNumber: exchanges.numberOrder,
          })
          .from(supportTickets)
          .leftJoin(exchanges, eq(supportTickets.exchangeId, exchanges.id))
          .orderBy(desc(supportTickets.id));
      }
      
      res.json(tickets);
    } catch (error) {
      console.error('Get support tickets error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(`/${adminPath}/api/support/tickets/:id/messages`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const { id } = req.params;
      const messages = await storage.getTicketMessages(parseInt(id));
      res.json(messages);
    } catch (error) {
      console.error('Get ticket messages error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(`/${adminPath}/api/support/tickets/:id/messages`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertSupportMessageSchema.parse({
        ticketId: parseInt(id),
        sender: 'support',
        message: req.body.message,
      });
      
      const newMessage = await storage.addTicketMessage(validatedData);
      
      // Update ticket status to wait-user
      await storage.updateTicketStatus(parseInt(id), 'wait-user');
      
      res.json(newMessage);
    } catch (error) {
      console.error('Add ticket message error:', error);
      res.status(400).json({ message: "Invalid data" });
    }
  });

  app.put(`/${adminPath}/api/support/tickets/:id/status`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const updated = await storage.updateTicketStatus(parseInt(id), status);
      res.json(updated);
    } catch (error) {
      console.error('Update ticket status error:', error);
      res.status(400).json({ message: "Invalid data" });
    }
  });

  app.post(`/${adminPath}/api/support/tickets/:id/reply`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertSupportMessageSchema.parse({
        ticketId: parseInt(id),
        sender: 'support',
        message: req.body.message,
      });
      
      const newMessage = await storage.addTicketMessage(validatedData);
      
      // Update ticket status to wait-user
      await storage.updateTicketStatus(parseInt(id), 'wait-user');
      
      res.json(newMessage);
    } catch (error) {
      console.error('Reply to ticket error:', error);
      res.status(400).json({ message: "Invalid data" });
    }
  });

  app.post(`/${adminPath}/api/support/tickets/:id/close`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const { id } = req.params;
      const updated = await storage.updateTicketStatus(parseInt(id), 'closed');
      res.json(updated);
    } catch (error) {
      console.error('Close ticket error:', error);
      res.status(400).json({ message: "Invalid data" });
    }
  });

  // ========== USERS MANAGEMENT ==========
  app.get(`/${adminPath}/api/users`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const { limit = '50', offset = '0', search } = req.query;
      
      let query = db.select().from(users).limit(parseInt(limit as string)).offset(parseInt(offset as string)).orderBy(desc(users.id));
      
      if (search) {
        query = db.select().from(users).where(
          sql`${users.name} ILIKE ${`%${search}%`} OR ${users.tgId} ILIKE ${`%${search}%`}`
        ).limit(parseInt(limit as string)).offset(parseInt(offset as string)).orderBy(desc(users.id));
      }
      
      const allUsers = await query;
      res.json(allUsers);
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(`/${adminPath}/api/users/:id`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const { id } = req.params;
      const user = await storage.getUser(parseInt(id));
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(user);
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put(`/${adminPath}/api/users/:id`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const { id } = req.params;
      const updated = await updateAndReturn(users, req.body, eq(users.id, parseInt(id)));
      res.json(updated);
    } catch (error) {
      console.error('Update user error:', error);
      res.status(400).json({ message: "Invalid data" });
    }
  });

  // Get Telegram user info and update database
  app.get(`/${adminPath}/api/users/:id/telegram-info`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const { id } = req.params;
      const user = await storage.getUser(parseInt(id));
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Fetch fresh data from Telegram
      const telegramData = await telegramService.extractUserData(user.tgId);
      
      // Update user data if we got new information
      if (telegramData.tgUsername || telegramData.name || telegramData.img) {
        await storage.updateUser(user.id, {
          tgUsername: telegramData.tgUsername || user.tgUsername,
          name: telegramData.name || user.name,
          img: telegramData.img || user.img
        });
      }

      // Get user photo URL
      const photoUrl = await telegramService.getUserProfilePhotos(user.tgId);

      res.json({
        id: user.id,
        tgId: user.tgId,
        tgUsername: telegramData.tgUsername || user.tgUsername,
        name: telegramData.name || user.name,
        img: photoUrl || telegramData.img || user.img,
        telegramLink: telegramData.tgUsername ? `https://t.me/${telegramData.tgUsername}` : null
      });
    } catch (error) {
      console.error('Get Telegram user info error:', error);
      res.status(500).json({ message: "Failed to fetch Telegram data" });
    }
  });

  // ========== WALLETS MANAGEMENT ==========
  app.get(`/${adminPath}/api/wallets`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const { address, network, operation } = req.query;
      
      const conditions = [];
      
      if (address && typeof address === 'string') {
        conditions.push(sql`${wallets.address} ILIKE ${'%' + address + '%'}`);
      }
      
      if (network && typeof network === 'string') {
        conditions.push(eq(wallets.network, network));
      }
      
      if (operation && typeof operation === 'string') {
        conditions.push(eq(wallets.reserved, operation));
      }
      
      let allWallets;
      if (conditions.length > 0) {
        allWallets = await db
          .select()
          .from(wallets)
          .where(sql`${sql.join(conditions, sql` AND `)}`)
          .orderBy(desc(wallets.id));
      } else {
        allWallets = await db.select().from(wallets).orderBy(desc(wallets.id));
      }
      
      res.json(allWallets);
    } catch (error) {
      console.error('Get wallets error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(`/${adminPath}/api/wallets/:id`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const { id } = req.params;
      const wallet = await storage.getWallet(parseInt(id));
      
      if (!wallet) {
        return res.status(404).json({ message: "Wallet not found" });
      }

      res.json(wallet);
    } catch (error) {
      console.error('Get wallet error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put(`/${adminPath}/api/wallets/:id`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const { id } = req.params;
      const updated = await updateAndReturn(wallets, req.body, eq(wallets.id, parseInt(id)));
      res.json(updated);
    } catch (error) {
      console.error('Update wallet error:', error);
      res.status(400).json({ message: "Invalid data" });
    }
  });

  // ========== ADMINS MANAGEMENT (Super Admin only) ==========
  app.get(`/${adminPath}/api/admins`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const allAdmins = await db.select().from(admins).orderBy(desc(admins.id));
      res.json(allAdmins);
    } catch (error) {
      console.error('Get admins error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(`/${adminPath}/api/admins`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const validatedData = insertAdminSchema.parse(req.body);
      const newAdmin = await insertAndReturn(admins, validatedData);
      res.json(newAdmin);
    } catch (error) {
      console.error('Create admin error:', error);
      res.status(400).json({ message: "Invalid data" });
    }
  });

  app.put(`/${adminPath}/api/admins/:id`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertAdminSchema.parse(req.body);
      const updated = await updateAndReturn(admins, validatedData, eq(admins.id, parseInt(id)));
      res.json(updated);
    } catch (error) {
      console.error('Update admin error:', error);
      res.status(400).json({ message: "Invalid data" });
    }
  });

  app.delete(`/${adminPath}/api/admins/:id`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const { id } = req.params;
      await db.delete(admins).where(eq(admins.id, parseInt(id)));
      res.json({ success: true });
    } catch (error) {
      console.error('Delete admin error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ========== INTERACTIVE (Notifications & Invoices) ==========
  app.get(`/${adminPath}/api/notifications`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const { notifications } = await import("@shared/schema");
      const allNotifications = await db.select().from(notifications).orderBy(desc(notifications.createdAt));
      res.json(allNotifications);
    } catch (error) {
      console.error('Get notifications error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(`/${adminPath}/api/notifications`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const notification = await storage.createNotification(req.body);
      res.json(notification);
    } catch (error) {
      console.error('Create notification error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete(`/${adminPath}/api/notifications/:id`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      await storage.deleteNotification(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error('Delete notification error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(`/${adminPath}/api/invoices`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const invoices = await storage.getAllInvoices();
      res.json(invoices);
    } catch (error) {
      console.error('Get invoices error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(`/${adminPath}/api/invoices`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const invoiceData = { ...req.body };
      
      // Convert expiresAt from ISO string to Date object for MySQL
      if (invoiceData.expiresAt) {
        invoiceData.expiresAt = new Date(invoiceData.expiresAt);
      }
      
      const invoice = await storage.createInvoice(invoiceData);
      
      if (!invoice || !invoice.userId) {
        throw new Error('Invoice creation failed - no invoice or userId returned');
      }
      
      // Don't send notification if admin creates invoice for themselves
      // (prevents admin from receiving notifications when logged in as user in another tab)
      const isAdminCreatingForSelf = req.admin && req.admin.userId === invoice.userId;
      
      if (!isAdminCreatingForSelf) {
        // Create notification for user about new invoice
        const notification = await storage.createNotification({
          userId: invoice.userId,
          type: 'invoice',
          title: 'Новый счет на оплату',
          message: `Выставлен счет ${invoice.orderNumber} на сумму ${formatBalance(invoice.amount)} ${invoice.currency}`,
          invoiceId: invoice.id,
          redirectTo: `/invoice/${invoice.orderNumber}`,
          isRead: false
        });
        
        // Send real-time push notification via SSE
        notificationService.notifyInvoice(invoice.userId.toString(), {
          ...invoice,
          notification
        });
        
        console.log(`[Invoice] Created invoice ${invoice.orderNumber} for user ${invoice.userId}, SSE notification sent`);
      } else {
        console.log(`[Invoice] Created invoice ${invoice.orderNumber} for user ${invoice.userId} (admin - no notification)`);
      }
      
      res.json(invoice);
    } catch (error) {
      console.error('Create invoice error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch(`/${adminPath}/api/invoices/:id/status`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const { id } = req.params;
      const { status, paymentHash } = req.body;
      const paidAt = status === 'paid' ? new Date() : undefined;
      const updatedInvoice = await storage.updateInvoiceStatus(parseInt(id), status, paidAt, paymentHash);
      res.json(updatedInvoice);
    } catch (error) {
      console.error('Update invoice status error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ========== TELEGRAM BOT WEBHOOK MANAGEMENT ==========
  app.post(`/${adminPath}/api/telegram/webhook/set`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const customWebhookUrl = req.body.webhookUrl;
      let webhookUrl: string;

      if (customWebhookUrl) {
        webhookUrl = customWebhookUrl;
      } else {
        const replitDomain = process.env.REPLIT_DEV_DOMAIN || process.env.REPL_SLUG;
        if (!replitDomain) {
          return res.status(400).json({ 
            ok: false, 
            message: "Не удалось определить домен Replit. Укажите webhookUrl вручную." 
          });
        }

        let hostname: string;
        if (replitDomain.includes('http://') || replitDomain.includes('https://')) {
          webhookUrl = replitDomain;
        } else {
          if (replitDomain.includes('.') || replitDomain.includes('repl.co')) {
            hostname = replitDomain;
          } else {
            const username = process.env.REPL_OWNER || 'user';
            hostname = `${replitDomain}.${username}.repl.co`;
          }
          webhookUrl = `https://${hostname}`;
        }

        webhookUrl = webhookUrl.replace(/\/$/, '');
        const webhookPath = req.body.webhookPath || '/api/telegram/webhook';
        if (!webhookUrl.endsWith(webhookPath)) {
          webhookUrl = `${webhookUrl}${webhookPath}`;
        }
      }

      const result = await telegramService.setWebhook(webhookUrl);
      res.json(result);
    } catch (error) {
      res.status(500).json({ 
        ok: false, 
        message: `Ошибка: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
    }
  });

  app.get(`/${adminPath}/api/telegram/webhook/info`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const result = await telegramService.getWebhookInfo();
      res.json(result);
    } catch (error) {
      res.status(500).json({ 
        ok: false, 
        message: `Ошибка: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
    }
  });

  app.delete(`/${adminPath}/api/telegram/webhook`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const result = await telegramService.deleteWebhook();
      res.json(result);
    } catch (error) {
      res.status(500).json({ 
        ok: false, 
        message: `Ошибка: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
    }
  });

  // ========== TELEGRAM BOT COMMANDS MANAGEMENT ==========
  app.get(`/${adminPath}/api/bot/commands`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const commands = await db.select().from(botCommands).orderBy(botCommands.command);
      res.json(commands);
    } catch (error) {
      console.error('Get bot commands error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(`/${adminPath}/api/bot/commands/:id`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const { id } = req.params;
      const [command] = await db.select().from(botCommands).where(eq(botCommands.id, parseInt(id))).limit(1);
      if (!command) {
        return res.status(404).json({ message: "Command not found" });
      }
      res.json(command);
    } catch (error) {
      console.error('Get bot command error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(`/${adminPath}/api/bot/commands`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const validatedData = insertBotCommandSchema.parse(req.body);
      const newCommand = await insertAndReturn(botCommands, validatedData);
      res.json(newCommand);
    } catch (error) {
      console.error('Create bot command error:', error);
      if (error instanceof Error) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.patch(`/${adminPath}/api/bot/commands/:id`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertBotCommandSchema.partial().parse(req.body);
      const updatedCommand = await updateAndReturn(botCommands, validatedData, eq(botCommands.id, parseInt(id)));
      res.json(updatedCommand);
    } catch (error) {
      console.error('Update bot command error:', error);
      if (error instanceof Error) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.delete(`/${adminPath}/api/bot/commands/:id`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const { id } = req.params;
      await db.delete(botCommands).where(eq(botCommands.id, parseInt(id)));
      res.json({ success: true });
    } catch (error) {
      console.error('Delete bot command error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ========== BOT COMMAND REACTIONS ==========
  app.get(`/${adminPath}/api/bot/commands/:commandId/reactions`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const { commandId } = req.params;
      const reactions = await db.select().from(botCommandReactions).where(eq(botCommandReactions.commandId, parseInt(commandId))).orderBy(botCommandReactions.priority);
      res.json(reactions);
    } catch (error) {
      console.error('Get command reactions error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(`/${adminPath}/api/bot/commands/:commandId/reactions`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const { commandId } = req.params;
      const validatedData = insertBotCommandReactionSchema.parse({ ...req.body, commandId: parseInt(commandId) });
      const newReaction = await insertAndReturn(botCommandReactions, validatedData);
      res.json(newReaction);
    } catch (error) {
      console.error('Create command reaction error:', error);
      if (error instanceof Error) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.patch(`/${adminPath}/api/bot/reactions/:id`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertBotCommandReactionSchema.partial().parse(req.body);
      const updatedReaction = await updateAndReturn(botCommandReactions, validatedData, eq(botCommandReactions.id, parseInt(id)));
      res.json(updatedReaction);
    } catch (error) {
      console.error('Update command reaction error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete(`/${adminPath}/api/bot/reactions/:id`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const { id } = req.params;
      await db.delete(botCommandReactions).where(eq(botCommandReactions.id, parseInt(id)));
      res.json({ success: true });
    } catch (error) {
      console.error('Delete command reaction error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Upload image for reaction
  app.post(`/${adminPath}/api/bot/reactions/upload-image`, requireSuperAdmin, systemUpload.single('image'), async (req: AdminRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      // Build full URL for Telegram API
      // req.file.path is "public/uploads/system/image-xxx.png"
      // We need URL like "https://domain.com/uploads/system/image-xxx.png"
      const protocol = req.protocol;
      const host = req.get('host');
      const publicPath = req.file.path.replace('public/', '');
      const imageUrl = `${protocol}://${host}/${publicPath}`;
      
      res.json({ imageUrl });
    } catch (error) {
      console.error('Upload reaction image error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Fix old image URLs (migration utility)
  app.post(`/${adminPath}/api/bot/reactions/fix-image-urls`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const protocol = req.protocol;
      const host = req.get('host');
      
      // Get all reactions with relative URLs (not starting with http)
      const reactions = await db.select().from(botCommandReactions);
      const toUpdate = reactions.filter(r => r.imageUrl && !r.imageUrl.startsWith('http'));
      
      let updated = 0;
      for (const reaction of toUpdate) {
        const oldUrl = reaction.imageUrl!;
        const newUrl = `${protocol}://${host}/${oldUrl.startsWith('/') ? oldUrl.substring(1) : oldUrl}`;
        
        await db.update(botCommandReactions)
          .set({ imageUrl: newUrl })
          .where(eq(botCommandReactions.id, reaction.id));
        
        console.log(`✅ Updated reaction ${reaction.id}: ${oldUrl} → ${newUrl}`);
        updated++;
      }
      
      res.json({ success: true, updated, total: toUpdate.length });
    } catch (error) {
      console.error('Fix image URLs error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ========== BOT MENUS NAVIGATION ==========
  app.get(`/${adminPath}/api/bot/menus`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const menus = await db.select().from(botMenus).orderBy(botMenus.isRoot, botMenus.title);
      res.json(menus);
    } catch (error) {
      console.error('Get bot menus error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(`/${adminPath}/api/bot/menus/:id`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const { id } = req.params;
      const [menu] = await db.select().from(botMenus).where(eq(botMenus.id, parseInt(id))).limit(1);
      if (!menu) {
        return res.status(404).json({ message: "Menu not found" });
      }
      const buttons = await db.select().from(botMenuButtons).where(eq(botMenuButtons.menuId, parseInt(id))).orderBy(botMenuButtons.rowIndex, botMenuButtons.columnIndex);
      res.json({ ...menu, buttons });
    } catch (error) {
      console.error('Get bot menu error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(`/${adminPath}/api/bot/menus`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const validatedData = insertBotMenuSchema.parse(req.body);
      const newMenu = await insertAndReturn(botMenus, validatedData);
      res.json(newMenu);
    } catch (error) {
      console.error('Create bot menu error:', error);
      if (error instanceof Error) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.patch(`/${adminPath}/api/bot/menus/:id`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertBotMenuSchema.partial().parse(req.body);
      const updatedMenu = await updateAndReturn(botMenus, validatedData, eq(botMenus.id, parseInt(id)));
      res.json(updatedMenu);
    } catch (error) {
      console.error('Update bot menu error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete(`/${adminPath}/api/bot/menus/:id`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const { id } = req.params;
      await db.delete(botMenus).where(eq(botMenus.id, parseInt(id)));
      res.json({ success: true });
    } catch (error) {
      console.error('Delete bot menu error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ========== BOT MENU BUTTONS ==========
  app.get(`/${adminPath}/api/bot/menus/:menuId/buttons`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const { menuId } = req.params;
      const buttons = await db.select().from(botMenuButtons).where(eq(botMenuButtons.menuId, parseInt(menuId))).orderBy(botMenuButtons.rowIndex, botMenuButtons.columnIndex);
      res.json(buttons);
    } catch (error) {
      console.error('Get menu buttons error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(`/${adminPath}/api/bot/menus/:menuId/buttons`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const { menuId } = req.params;
      const validatedData = insertBotMenuButtonSchema.parse({ ...req.body, menuId: parseInt(menuId) });
      const newButton = await insertAndReturn(botMenuButtons, validatedData);
      res.json(newButton);
    } catch (error) {
      console.error('Create menu button error:', error);
      if (error instanceof Error) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.patch(`/${adminPath}/api/bot/buttons/:id`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertBotMenuButtonSchema.partial().parse(req.body);
      const updatedButton = await updateAndReturn(botMenuButtons, validatedData, eq(botMenuButtons.id, parseInt(id)));
      res.json(updatedButton);
    } catch (error) {
      console.error('Update menu button error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete(`/${adminPath}/api/bot/buttons/:id`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const { id } = req.params;
      await db.delete(botMenuButtons).where(eq(botMenuButtons.id, parseInt(id)));
      res.json({ success: true });
    } catch (error) {
      console.error('Delete menu button error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ========== DATA FIX UTILITIES ==========
  app.post(`/${adminPath}/api/fix/user-balances`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const cryptoBalanceIds = [3, 4, 5, 7, 8];
      
      const allUsers = await db.select({ id: users.id }).from(users);
      let fixed = 0;
      
      for (const user of allUsers) {
        for (const balanceId of cryptoBalanceIds) {
          try {
            const [existing] = await db.select()
              .from(usersBalances)
              .where(and(
                eq(usersBalances.idUser, user.id),
                eq(usersBalances.idBalance, balanceId)
              ))
              .limit(1);
            
            if (!existing) {
              await db.insert(usersBalances).values({
                idUser: user.id,
                idBalance: balanceId,
                sum: "0.0",
                status: "active"
              });
              fixed++;
            }
          } catch (insertError) {
            console.error(`Error creating balance ${balanceId} for user ${user.id}:`, insertError);
          }
        }
      }
      
      res.json({ success: true, fixed, message: `Fixed ${fixed} missing user balances` });
    } catch (error) {
      console.error('Fix user balances error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(`/${adminPath}/api/fix/exchange-rates`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      // Correct balance IDs: TRC20(3), BEP20(4), TON(6), DAI(9), POL(10)
      // Note: id=5 is USD (fiat), NOT crypto!
      const correctRates = [
        { fromBalanceId: 4, toBalanceId: 9, fromCurrency: "BEP20.USDT", toCurrency: "DAI", rate: "0.9980", category: "crypto" },
        { fromBalanceId: 3, toBalanceId: 9, fromCurrency: "TRC20.USDT", toCurrency: "DAI", rate: "0.9980", category: "crypto" },
        { fromBalanceId: 6, toBalanceId: 9, fromCurrency: "TON.USDT", toCurrency: "DAI", rate: "0.9980", category: "crypto" },
        { fromBalanceId: 9, toBalanceId: 4, fromCurrency: "DAI", toCurrency: "BEP20.USDT", rate: "0.9980", category: "crypto" },
        { fromBalanceId: 9, toBalanceId: 3, fromCurrency: "DAI", toCurrency: "TRC20.USDT", rate: "0.9980", category: "crypto" },
        { fromBalanceId: 9, toBalanceId: 6, fromCurrency: "DAI", toCurrency: "TON.USDT", rate: "0.9980", category: "crypto" },
        { fromBalanceId: 4, toBalanceId: 10, fromCurrency: "BEP20.USDT", toCurrency: "POL", rate: "2.0500", category: "crypto" },
        { fromBalanceId: 3, toBalanceId: 10, fromCurrency: "TRC20.USDT", toCurrency: "POL", rate: "2.0500", category: "crypto" },
        { fromBalanceId: 6, toBalanceId: 10, fromCurrency: "TON.USDT", toCurrency: "POL", rate: "2.0500", category: "crypto" },
        { fromBalanceId: 10, toBalanceId: 4, fromCurrency: "POL", toCurrency: "BEP20.USDT", rate: "0.4878", category: "crypto" },
        { fromBalanceId: 10, toBalanceId: 3, fromCurrency: "POL", toCurrency: "TRC20.USDT", rate: "0.4878", category: "crypto" },
        { fromBalanceId: 10, toBalanceId: 6, fromCurrency: "POL", toCurrency: "TON.USDT", rate: "0.4878", category: "crypto" },
      ];
      
      let fixed = 0;
      
      for (const rate of correctRates) {
        const [existing] = await db.select().from(exchangeRates)
          .where(and(
            eq(exchangeRates.fromCurrency, rate.fromCurrency),
            eq(exchangeRates.toCurrency, rate.toCurrency)
          ))
          .limit(1);
        
        if (existing) {
          if (existing.fromBalanceId !== rate.fromBalanceId || existing.toBalanceId !== rate.toBalanceId) {
            await db.update(exchangeRates)
              .set({
                fromBalanceId: rate.fromBalanceId,
                toBalanceId: rate.toBalanceId,
                updatedAt: new Date()
              })
              .where(eq(exchangeRates.id, existing.id));
            fixed++;
          }
        } else {
          await db.insert(exchangeRates).values({
            id: generateUUID(),
            ...rate,
            updatedAt: new Date()
          } as any);
          fixed++;
        }
      }
      
      res.json({ success: true, fixed, message: `Fixed ${fixed} exchange rates` });
    } catch (error) {
      console.error('Fix exchange rates error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(`/${adminPath}/api/fix/system-balances`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      // Correct balance IDs: RUB(1), TRY(2), TRC20(3), BEP20(4), USD(5), TON(6), DAI(9), POL(10)
      const systemBalances = [
        { id: 1, title: "Российский рубль", network: null, currency: "RUB", type: "fiat", status: "active" },
        { id: 2, title: "Турецкая лира", network: null, currency: "TRY", type: "fiat", status: "active" },
        { id: 3, title: "USDT TRC20", network: "TRC20", currency: "USDT", type: "crypto", status: "active" },
        { id: 4, title: "USDT BEP20", network: "BEP20", currency: "USDT", type: "crypto", status: "active" },
        { id: 5, title: "American Dollar", network: null, currency: "USD", type: "fiat", status: "active" },
        { id: 6, title: "Ton Network", network: "TON", currency: "USDT", type: "crypto", status: "active" },
        { id: 9, title: "DAI", network: "Polygon", currency: "DAI", type: "crypto", status: "active" },
        { id: 10, title: "POL", network: "Polygon", currency: "POL", type: "crypto", status: "active" },
      ];
      
      let fixed = 0;
      
      for (const balance of systemBalances) {
        const [existing] = await db.select().from(balances).where(eq(balances.id, balance.id)).limit(1);
        if (!existing) {
          await db.insert(balances).values(balance as any);
          fixed++;
          console.log(`Added missing system balance: ${balance.title} (ID: ${balance.id})`);
        }
      }
      
      res.json({ success: true, fixed, message: `Added ${fixed} missing system balances` });
    } catch (error) {
      console.error('Fix system balances error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
}
