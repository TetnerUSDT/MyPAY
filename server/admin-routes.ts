import { Express } from "express";
import { AdminRequest, requireSuperAdmin, requireAdmin, requirePermission } from "./admin-middleware";
import { IStorage } from "./storage";
import { db } from "./db";
import { balances, exchanges, cards, banks, exchangeRates, supportTickets, supportMessages, supportChats, users, wallets, admins, userCards, usersBalances } from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";
import { insertBalanceSchema, insertCardSchema, insertBankSchema, insertExchangeRateSchema, insertSupportMessageSchema, insertAdminSchema, insertUsersBalancesSchema } from "@shared/schema";

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
      const [newBalance] = await db.insert(balances).values(validatedData).returning();
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
      const [updated] = await db.update(balances).set(validatedData).where(eq(balances.id, parseInt(id))).returning();
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
          balanceType: balances.type,
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
      const [newUserBalance] = await db.insert(usersBalances).values(validatedData).returning();
      res.json(newUserBalance);
    } catch (error) {
      console.error('Create user balance error:', error);
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
      const [updated] = await db.update(usersBalances).set(validatedData).where(eq(usersBalances.id, parseInt(id))).returning();
      res.json(updated);
    } catch (error) {
      console.error('Update user balance error:', error);
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
          walletAddress: wallets.address,
          cardNumber: userCards.numberCard,
          manualCardNumber: exchanges.manualCardNumber,
        })
        .from(exchanges)
        .leftJoin(wallets, eq(exchanges.walletId, wallets.id))
        .leftJoin(userCards, eq(exchanges.idCard, userCards.id))
        .where(eq(exchanges.status, status as string))
        .limit(parseInt(limit as string))
        .offset(parseInt(offset as string))
        .orderBy(desc(exchanges.id));
      } else {
        results = await db.select({
          id: exchanges.id,
          numberOrder: exchanges.numberOrder,
          idUser: exchanges.idUser,
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
          walletAddress: wallets.address,
          cardNumber: userCards.numberCard,
          manualCardNumber: exchanges.manualCardNumber,
        })
        .from(exchanges)
        .leftJoin(wallets, eq(exchanges.walletId, wallets.id))
        .leftJoin(userCards, eq(exchanges.idCard, userCards.id))
        .limit(parseInt(limit as string))
        .offset(parseInt(offset as string))
        .orderBy(desc(exchanges.id));
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
      
      const updateData: any = { status };
      if (cancelReason) updateData.cancelReason = cancelReason;
      if (paymentHash) updateData.paymentHash = paymentHash;
      
      const [updated] = await db.update(exchanges).set(updateData).where(eq(exchanges.id, parseInt(id))).returning();
      res.json(updated);
    } catch (error) {
      console.error('Update exchange status error:', error);
      res.status(400).json({ message: "Invalid data" });
    }
  });

  app.put(`/${adminPath}/api/exchanges/:id`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const { id } = req.params;
      const [updated] = await db.update(exchanges).set(req.body).where(eq(exchanges.id, parseInt(id))).returning();
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
      const [newCard] = await db.insert(cards).values(validatedData).returning();
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
      const [updated] = await db.update(cards).set(validatedData).where(eq(cards.id, parseInt(id))).returning();
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
      const [newBank] = await db.insert(banks).values(validatedData).returning();
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
      const [updated] = await db.update(banks).set(validatedData).where(eq(banks.id, parseInt(id))).returning();
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
      const [newRate] = await db.insert(exchangeRates).values({
        ...validatedData,
        id: sql`gen_random_uuid()`,
        updatedAt: new Date(),
      } as any).returning();
      res.json(newRate);
    } catch (error) {
      console.error('Create exchange rate error:', error);
      res.status(400).json({ message: "Invalid data" });
    }
  });

  app.put(`/${adminPath}/api/exchange-rates/:id`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertExchangeRateSchema.parse(req.body);
      const [updated] = await db.update(exchangeRates).set({
        ...validatedData,
        updatedAt: new Date(),
      }).where(eq(exchangeRates.id, id)).returning();
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

      const [updated] = await db.update(supportChats)
        .set({ messages: updatedMessages })
        .where(eq(supportChats.id, chatId))
        .returning();

      res.json(updated);
    } catch (error) {
      console.error('Reply to support chat error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(`/${adminPath}/api/support/:chatId/close`, requireSuperAdmin, async (req: AdminRequest, res) => {
    try {
      const { chatId } = req.params;
      
      const [updated] = await db.update(supportChats)
        .set({ status: 'closed' })
        .where(eq(supportChats.id, chatId))
        .returning();

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
      const [updated] = await db.update(users).set(req.body).where(eq(users.id, parseInt(id))).returning();
      res.json(updated);
    } catch (error) {
      console.error('Update user error:', error);
      res.status(400).json({ message: "Invalid data" });
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
      const [updated] = await db.update(wallets).set(req.body).where(eq(wallets.id, parseInt(id))).returning();
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
      const [newAdmin] = await db.insert(admins).values(validatedData).returning();
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
      const [updated] = await db.update(admins).set(validatedData).where(eq(admins.id, parseInt(id))).returning();
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
}
