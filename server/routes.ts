import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { validate as validateInitData, parse as parseInitData } from "@telegram-apps/init-data-node";
import { storage } from "./storage";
import { insertTransactionSchema, insertSupportChatSchema, insertUserSchema } from "@shared/schema";
import { config, isTestMode, isTelegramMode, isDevelopment } from "./config";
import { createWalletViaAPI } from "./wallet-api";

// Unified login schema that supports both modes
const loginSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("telegram"),
    initData: z.string(),
  }),
  z.object({
    mode: z.literal("test"),
    name: z.string().min(1, "Имя обязательно"),
  })
]);

// Auto-detect login schema based on config
const autoLoginSchema = z.object({
  // For telegram mode
  initData: z.string().optional(),
  // For test mode
  name: z.string().optional(),
}).refine((data) => {
  if (isTestMode()) {
    return data.name && data.name.trim().length > 0;
  } else {
    return data.initData && data.initData.length > 0;
  }
}, {
  message: isTestMode() ? "Name is required in test mode" : "InitData is required in telegram mode"
});

// API Key authentication middleware
interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    tgId: string;
    name: string | null;
    img: string | null;
    agreement: number | null;
    status: string | null;
    blocked: boolean | null;
    defaultFiatBalanceId: number | null;
  };
}

const requireApiKey = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    
    if (!apiKey) {
      return res.status(401).json({ message: "API key required" });
    }
    
    const user = await storage.getUserByApiKey(apiKey);
    
    if (!user) {
      return res.status(401).json({ message: "Invalid API key" });
    }
    
    if (user.blocked) {
      return res.status(403).json({ message: "Account is blocked" });
    }
    
    if (user.status !== "active") {
      return res.status(403).json({ message: "Account is not active" });
    }
    
    // Attach user to request object
    req.user = {
      id: user.id,
      tgId: user.tgId,
      name: user.name,
      img: user.img,
      agreement: user.agreement,
      status: user.status,
      blocked: user.blocked,
      defaultFiatBalanceId: user.defaultFiatBalanceId
    };
    
    next();
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Unified authentication endpoint that adapts based on configuration
  app.post("/api/auth/login", async (req, res) => {
    try {
      const validatedData = autoLoginSchema.parse(req.body);
      
      let user;
      let apiKey;
      
      if (isTestMode()) {
        // Test mode authentication
        if (!config.auth.test.enabled) {
          return res.status(404).json({ message: "Test authentication is disabled" });
        }
        
        const name = validatedData.name!;
        
        // Generate deterministic test tg_id to avoid duplicate users
        const testTgId = `test_${name.toLowerCase().replace(/\s+/g, '_')}`;
        
        // Check if test user already exists
        user = await storage.getUserByTgId(testTgId);
        
        if (!user) {
          // Create new test user
          user = await storage.createUser({
            tgId: testTgId,
            google: null,
            name,
            img: null,
            status: "active",
            agreement: 0,
            blocked: false
          });
        }
        
        // Generate or reuse API key
        apiKey = await storage.generateApiKey(user.id);
        
      } else {
        // Telegram mode authentication
        const initData = validatedData.initData!;
        let userData;
        
        if (isDevelopment() && config.auth.telegram.botToken === 'dev-mock-token') {
          // Development mode: mock validation
          console.log('Development mode: Skipping Telegram initData validation');
          userData = {
            user: {
              id: Date.now(), // Mock user ID
              first_name: 'Dev User',
              username: 'devuser'
            }
          };
        } else {
          // Production mode: validate initData
          if (!config.auth.telegram.validateInitData) {
            return res.status(501).json({ message: "Telegram validation is disabled" });
          }
          
          try {
            validateInitData(initData, config.auth.telegram.botToken);
            userData = parseInitData(initData);
          } catch (validationError) {
            console.error('Telegram initData validation failed:', validationError);
            return res.status(401).json({ message: "Invalid Telegram data" });
          }
        }
        
        if (!userData.user) {
          return res.status(400).json({ message: "Invalid user data" });
        }
        
        const tgId = userData.user.id.toString();
        const name = userData.user.first_name || userData.user.username || null;
        const img = userData.user.photo_url || null;
        
        // Check if user already exists
        user = await storage.getUserByTgId(tgId);
        
        if (!user) {
          // Create new user
          user = await storage.createUser({
            tgId,
            google: null,
            name,
            img,
            status: "active",
            agreement: 0,
            blocked: false
          });
        }
        
        // Generate API key
        apiKey = await storage.generateApiKey(user.id);
      }
      
      const responseUser = {
        id: user.id,
        tgId: user.tgId,
        name: user.name,
        img: user.img,
        agreement: user.agreement
      };
      
      res.json({ 
        user: responseUser,
        apiKey,
        authMode: config.auth.mode // Include current mode for client info
      });
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid request data", 
          errors: error.errors,
          expectedMode: config.auth.mode 
        });
      }
      console.error('Auth error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Regenerate API key for authenticated user
  app.post("/api/auth/generate-key", requireApiKey, async (req: AuthenticatedRequest, res) => {
    try {
      const apiKey = await storage.generateApiKey(req.user!.id);
      
      res.json({ apiKey });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Get current user by API key
  app.get("/api/auth/me", requireApiKey, async (req: AuthenticatedRequest, res) => {
    try {
      res.json(req.user);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Update user agreement
  app.patch("/api/auth/agreement", requireApiKey, async (req: AuthenticatedRequest, res) => {
    try {
      const updatedUser = await storage.updateUserAgreement(req.user!.id, 1);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Update req.user with new agreement status
      req.user!.agreement = updatedUser.agreement;
      
      res.json(req.user);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Exchange rates
  app.get("/api/exchange-rates/:from/:to", async (req, res) => {
    try {
      const { from, to } = req.params;
      const rate = await storage.getExchangeRate(from.toUpperCase(), to.toUpperCase());
      
      if (!rate) {
        return res.status(404).json({ message: "Exchange rate not found" });
      }
      
      res.json(rate);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create transaction
  app.post("/api/transactions", requireApiKey, async (req: AuthenticatedRequest, res) => {
    try {
      const validatedData = insertTransactionSchema.parse(req.body);
      
      // Set userId from authenticated user (security: prevent IDOR)
      const transactionData = {
        ...validatedData,
        userId: req.user!.id
      };
      
      const transaction = await storage.createTransaction(transactionData);
      
      res.json(transaction);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid transaction data", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get transaction by order ID (protected)
  app.get("/api/transactions/order/:orderId", requireApiKey, async (req: AuthenticatedRequest, res) => {
    try {
      const { orderId } = req.params;
      const transaction = await storage.getTransactionByOrderId(orderId);
      
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      
      // Security: ensure user can only access their own transactions
      if (transaction.userId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json(transaction);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update transaction status (webhook/system only)
  // TODO: Implement proper webhook authentication with X-Webhook-Secret header
  app.patch("/api/transactions/:id/status", async (req, res) => {
    try {
      const { id } = req.params;
      const { status, txHash, webhookSecret } = req.body;
      
      // Basic webhook authentication (placeholder)
      // In production, verify X-Webhook-Secret header or require system-level auth
      if (!webhookSecret || webhookSecret !== "dev-webhook-secret") {
        return res.status(401).json({ message: "Unauthorized - webhook secret required" });
      }
      
      // Validate status
      const validStatuses = ["pending", "processing", "completed", "failed"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      
      const transaction = await storage.updateTransactionStatus(id, status, txHash);
      
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      
      res.json(transaction);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get user transactions
  app.get("/api/transactions/user", requireApiKey, async (req: AuthenticatedRequest, res) => {
    try {
      const transactions = await storage.getTransactionsByUserId(req.user!.id);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Wallets
  app.get("/api/wallets/user", requireApiKey, async (req: AuthenticatedRequest, res) => {
    try {
      const wallets = await storage.getWalletsByUserId(req.user!.id);
      res.json(wallets);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create wallet
  app.post("/api/wallets", requireApiKey, async (req: AuthenticatedRequest, res) => {
    try {
      const { currency } = req.body;
      
      // Generate a mock wallet address
      const generateAddress = (currency: string) => {
        const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
        let result = "";
        
        if (currency === "USDT" || currency === "TRC20") {
          result = "T";
          for (let i = 0; i < 33; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
          }
        } else {
          for (let i = 0; i < 34; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
          }
        }
        
        return result;
      };
      
      const wallet = await storage.createWallet({
        idUser: req.user!.id,
        network: currency,
        address: generateAddress(currency),
      });
      
      res.json(wallet);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Support chats
  app.post("/api/support/chats", requireApiKey, async (req: AuthenticatedRequest, res) => {
    try {
      const validatedData = insertSupportChatSchema.parse(req.body);
      
      // Set userId from authenticated user (security: prevent IDOR)
      const chatData = {
        ...validatedData,
        userId: req.user!.id
      };
      
      const chat = await storage.createSupportChat(chatData);
      res.json(chat);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid chat data", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Add message to chat
  app.post("/api/support/chats/:chatId/messages", requireApiKey, async (req: AuthenticatedRequest, res) => {
    try {
      const { chatId } = req.params;
      const { sender, message } = req.body;
      
      // Security: Check if user owns this chat (prevent IDOR)
      const existingChat = await storage.getSupportChat(chatId);
      if (!existingChat) {
        return res.status(404).json({ message: "Chat not found" });
      }
      
      if (existingChat.userId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const chat = await storage.addMessageToChat(chatId, sender, message);
      
      res.json(chat);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get user support chats
  app.get("/api/support/chats/user", requireApiKey, async (req: AuthenticatedRequest, res) => {
    try {
      const chats = await storage.getSupportChatsByUserId(req.user!.id);
      res.json(chats);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get active cards (countries for exchange)
  app.get("/api/cards/active", async (req, res) => {
    try {
      const activeCards = await storage.getActiveCards();
      res.json(activeCards);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get banks for a specific card
  app.get("/api/banks/:cardId", async (req, res) => {
    try {
      const cardId = parseInt(req.params.cardId);
      const banks = await storage.getBanksByCardId(cardId);
      res.json(banks);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get payment balance (USDT.BEP20)
  app.get("/api/exchange/payment-balance", async (req, res) => {
    try {
      const paymentBalance = await storage.getPaymentBalance();
      res.json(paymentBalance);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get receive balances for a card
  app.get("/api/exchange/receive-balances/:cardId", async (req, res) => {
    try {
      const cardId = parseInt(req.params.cardId);
      const card = await storage.getCard(cardId);
      
      if (!card || !card.idBalance) {
        return res.status(404).json({ message: "Card not found or no balances configured" });
      }

      const balances = await storage.getBalancesByIds(card.idBalance);
      res.json(balances);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Calculate exchange quote
  app.post("/api/exchange/quote", async (req, res) => {
    try {
      const { fromBalanceId, toBalanceId, amount } = req.body;
      
      const rate = await storage.getExchangeRateByBalances(fromBalanceId, toBalanceId);
      if (!rate) {
        return res.status(404).json({ message: "Exchange rate not found" });
      }

      const fromAmount = parseFloat(amount);
      const exchangeRate = parseFloat(rate.rate);
      const toAmount = fromAmount * exchangeRate;

      res.json({
        fromBalanceId,
        toBalanceId,
        fromAmount,
        toAmount,
        rate: exchangeRate
      });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get user cards
  app.get("/api/user-cards", requireApiKey, async (req: AuthenticatedRequest, res) => {
    try {
      const userCards = await storage.getUserCardsByUserId(req.user!.id);
      res.json(userCards);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create user card
  app.post("/api/user-cards", requireApiKey, async (req: AuthenticatedRequest, res) => {
    try {
      const cardData = {
        idCard: parseInt(req.body.idCard),
        idUser: req.user!.id,
        idBank: req.body.idBank ? parseInt(req.body.idBank) : null,
        name: req.body.name,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        phone: req.body.phone,
        country: req.body.country,
        numberCard: req.body.number,
        status: "active"
      };
      
      const newCard = await storage.createUserCard(cardData);
      res.json(newCard);
    } catch (error) {
      console.error('Error creating user card:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete user card
  app.delete("/api/user-cards/:id", requireApiKey, async (req: AuthenticatedRequest, res) => {
    try {
      await storage.deleteUserCard(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get all fiat balances
  app.get("/api/fiat-balances", requireApiKey, async (req: AuthenticatedRequest, res) => {
    try {
      const fiatBalances = await storage.getFiatBalances();
      res.json(fiatBalances);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get or create user balance
  app.get("/api/user-balance/:balanceId", requireApiKey, async (req: AuthenticatedRequest, res) => {
    try {
      const balanceId = parseInt(req.params.balanceId);
      const userBalance = await storage.getUserBalance(req.user!.id, balanceId);
      res.json(userBalance);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update user default fiat balance
  app.patch("/api/user/default-balance", requireApiKey, async (req: AuthenticatedRequest, res) => {
    try {
      const { balanceId } = req.body;
      const updatedUser = await storage.updateUserDefaultBalance(req.user!.id, balanceId);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Update req.user with new default balance
      req.user!.defaultFiatBalanceId = updatedUser.defaultFiatBalanceId;
      
      res.json(req.user);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create exchange order with wallet reservation
  app.post("/api/exchange/create", requireApiKey, async (req: AuthenticatedRequest, res) => {
    try {
      const {
        fromBalanceId,
        toBalanceId,
        fromCurrency,
        toCurrency,
        amountFrom,
        amountTo,
        rate,
        commission,
        cardId,
        manualCardNumber,
        network
      } = req.body;

      // Validate required fields
      if (!fromBalanceId || !toBalanceId || !fromCurrency || !toCurrency || !amountFrom || !amountTo || !rate || !network) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Generate unique order number (10 random alphanumeric characters)
      const generateOrderNumber = async (): Promise<string> => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let orderNumber: string;
        let isUnique = false;
        
        // Keep generating until we get a unique number
        while (!isUnique) {
          let result = '';
          for (let i = 0; i < 10; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          orderNumber = result;
          
          // Check if this order number already exists
          const existing = await storage.getExchangeByOrderNumber(orderNumber);
          if (!existing) {
            isUnique = true;
          }
        }
        
        return orderNumber!;
      };
      const orderNumber = await generateOrderNumber();

      // Find or create wallet
      let wallet = await storage.findAvailableWallet(network);
      
      if (!wallet) {
        console.log(`No available wallet found for ${network}, creating new one...`);
        try {
          // Create new wallet via external API
          const walletData = await createWalletViaAPI(network);
          
          // Store wallet in database
          wallet = await storage.createWallet({
            idUser: req.user!.id,
            network,
            address: walletData.address,
            privateKey: walletData.private_key,
            status: 'active'
          });
        } catch (error) {
          console.error('Failed to create wallet:', error);
          return res.status(500).json({ message: "Failed to create wallet for exchange" });
        }
      }

      // Reserve wallet for 12 hours
      await storage.reserveWallet(wallet.id, 12);

      // Create exchange order
      const exchange = await storage.createExchange({
        numberOrder: orderNumber,
        idUser: req.user!.id,
        walletId: wallet.id,
        idBalanceFrom: fromBalanceId,
        idBalanceTo: toBalanceId,
        idCard: cardId || null,
        manualCardNumber: manualCardNumber || null,
        fromCurrency,
        toCurrency,
        amountFrom,
        amountTo,
        rate,
        commission: commission || "0.0",
        status: "wait"
      });

      // Return exchange details with wallet address
      res.json({
        ...exchange,
        walletAddress: wallet.address,
        walletNetwork: wallet.network
      });
    } catch (error) {
      console.error('Create exchange error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get exchange by order number
  app.get("/api/exchange/:orderNumber", requireApiKey, async (req: AuthenticatedRequest, res) => {
    try {
      const { orderNumber } = req.params;
      const exchange = await storage.getExchangeByOrderNumber(orderNumber);
      
      if (!exchange) {
        return res.status(404).json({ message: "Exchange not found" });
      }

      // Get wallet details if walletId exists
      let walletAddress = null;
      let walletNetwork = null;
      if (exchange.walletId) {
        const wallet = await storage.getWallet(exchange.walletId);
        if (wallet) {
          walletAddress = wallet.address;
          walletNetwork = wallet.network;
        }
      }

      res.json({
        ...exchange,
        walletAddress,
        walletNetwork
      });
    } catch (error) {
      console.error('Get exchange error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update exchange status (for "I paid" button)
  app.patch("/api/exchange/:orderNumber/status", requireApiKey, async (req: AuthenticatedRequest, res) => {
    try {
      const { orderNumber } = req.params;
      const { status } = req.body;

      // Validate status
      const validStatuses = ['wait', 'wait-paid', 'paid', 'complete', 'canceled', 'dispute'];
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid status. Must be one of: wait, wait-paid, paid, complete, canceled, dispute" });
      }

      const exchange = await storage.getExchangeByOrderNumber(orderNumber);
      
      if (!exchange) {
        return res.status(404).json({ message: "Exchange not found" });
      }

      if (exchange.idUser !== req.user!.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const updatedExchange = await storage.updateExchangeStatus(exchange.id, status);
      res.json(updatedExchange);
    } catch (error) {
      console.error('Update exchange status error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
