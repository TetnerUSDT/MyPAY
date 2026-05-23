import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { createHash, createHmac } from "crypto";
import bcrypt from "bcryptjs";
import { validate as validateInitData, parse as parseInitData } from "@telegram-apps/init-data-node";
import { storage } from "./storage";
import { db } from "./db";
import { insertTransactionSchema, insertSupportChatSchema, insertUserSchema, insertSupportTicketSchema, insertSupportMessageSchema, usersBalances, balances } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { config, isTestMode, isTelegramMode, isDevelopment } from "./config";
import { createWalletViaAPI } from "./wallet-api";
import { registerAdminRoutes } from "./admin-routes";
import { telegramService } from "./telegram-service";
import { notificationService } from "./notification-service";
import { requireSuperAdmin, type AdminRequest } from "./admin-middleware";
import express from "express";
import path from "path";

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

// Telegram Widget user data schema
const telegramWidgetUserSchema = z.object({
  id: z.number(),
  first_name: z.string(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  photo_url: z.string().optional(),
  auth_date: z.number(),
  hash: z.string(),
});

// Function to validate Telegram Widget data
function validateTelegramWidget(data: z.infer<typeof telegramWidgetUserSchema>, botToken: string): boolean {
  const { hash, ...userData } = data;
  
  // Create data check string
  const dataCheckArr = Object.keys(userData)
    .sort()
    .map(key => `${key}=${(userData as any)[key]}`)
    .join('\n');
  
  // Create secret key: SHA256(bot_token)
  const secretKey = createHash('sha256').update(botToken).digest();
  
  // Calculate hash: HMAC-SHA256(data_check_string, secret_key)
  const calculatedHash = createHmac('sha256', secretKey)
    .update(dataCheckArr)
    .digest('hex');
  
  return calculatedHash === hash;
}

// Auto-detect login schema based on config
const autoLoginSchema = z.object({
  // For telegram WebApp mode (initData)
  initData: z.string().optional(),
  // For telegram Widget mode (browser)
  widgetData: telegramWidgetUserSchema.optional(),
  // For test mode
  name: z.string().optional(),
}).refine((data) => {
  // Allow widgetData or initData in any mode (Telegram auth works everywhere)
  if (data.widgetData || (data.initData && data.initData.length > 0)) {
    return true;
  }
  // Test mode fallback: require name
  if (isTestMode() && data.name && data.name.trim().length > 0) {
    return true;
  }
  return false;
}, {
  message: "Either Telegram auth data (initData/widgetData) or test name is required"
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
    phone: string | null;
    trust: number | null;
    tgUsername: string | null;
    codeRef: string | null;
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
      defaultFiatBalanceId: user.defaultFiatBalanceId,
      phone: user.phone,
      trust: user.trust,
      tgUsername: user.tgUsername,
      codeRef: user.codeRef
    };
    
    next();
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Public endpoint to get admin URL
  app.get("/api/config/admin-url", async (req, res) => {
    res.json({ adminUrl: process.env.ADMIN_URL || 'admin' });
  });

  // Public endpoint to get Telegram bot username for widget
  app.get("/api/config/telegram-bot", async (req, res) => {
    // Config never changes at runtime — cache aggressively in browser + CDN
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600');
    res.json({
      botUsername: config.auth.telegram.botUsername,
      authMode: config.auth.mode,
      botUrl: process.env.TELEGRAM_BOT_URL || ""
    });
  });

  // Get user with API key (uses API key header like other endpoints)
  app.get("/api/user", requireApiKey, (req: AuthenticatedRequest, res) => {
    res.json(req.user);
  });

  // Unified authentication endpoint that adapts based on configuration
  app.post("/api/auth/login", async (req, res) => {
    try {
      const validatedData = autoLoginSchema.parse(req.body);
      
      let user;
      let apiKey;
      
      // Check for Telegram authentication first (works in any mode)
      if (validatedData.widgetData || validatedData.initData) {
        // Telegram mode authentication
        let tgId: string;
        let name: string | null;
        let img: string | null;
        
        let tgUsername: string | null = null;
        
        if (validatedData.widgetData) {
          // Telegram Widget authentication (browser)
          const widgetData = validatedData.widgetData;
          
          // Validate widget data
          if (!isDevelopment() || config.auth.telegram.botToken !== 'dev-mock-token') {
            const isValid = validateTelegramWidget(widgetData, config.auth.telegram.botToken);
            if (!isValid) {
              console.error('Telegram widget validation failed');
              return res.status(401).json({ message: "Invalid Telegram widget data" });
            }
          }
          
          tgId = widgetData.id.toString();
          name = widgetData.first_name || widgetData.username || null;
          img = widgetData.photo_url || null;
          tgUsername = widgetData.username || null;
          
        } else {
          // Telegram WebApp authentication (initData)
          const initData = validatedData.initData!;
          let userData;
          
          if (isDevelopment() && config.auth.telegram.botToken === 'dev-mock-token') {
            // Development mode ONLY: mock validation when using dev-mock-token
            console.log('Development mode: Skipping Telegram initData validation (using dev-mock-token)');
            userData = {
              user: {
                id: Date.now(), // Mock user ID
                first_name: 'Dev User',
                username: 'devuser'
              }
            };
          } else {
            // Production or real bot token: always validate initData
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
          
          tgId = userData.user.id.toString();
          name = userData.user.first_name || userData.user.username || null;
          img = userData.user.photo_url || null;
          tgUsername = userData.user.username || null;
        }
        
        // Extract referral code from start_param (for initData only)
        let referrerId: number | null = null;
        if (validatedData.initData) {
          const initData = validatedData.initData;
          const userData = parseInitData(initData);
          const startParam = (userData as any).start_param || (userData as any).startParam;
          
          if (startParam) {
            console.log('Referral code from start_param:', startParam);
            const referrer = await storage.getUserByReferralCode(startParam);
            if (referrer) {
              referrerId = referrer.id;
              console.log('Found referrer:', referrer.id, referrer.name);
            }
          }
        }
        
        // Check if user already exists
        user = await storage.getUserByTgId(tgId);
        
        if (!user) {
          // Create new user using data from initData/widgetData — FAST PATH.
          // Telegram Bot API (getChat/getUserProfilePhotos) is called in the
          // background after the response so login is not blocked.
          user = await storage.createUser({
            tgId,
            tgUsername,
            google: null,
            name,
            img,
            status: "active",
            agreement: 0,
            blocked: false,
            idRef: referrerId || undefined
          });
        } else {
          // User exists — apply only the cheap updates from initData/widgetData.
          // Avatar/extra data refresh happens in the background (see below).
          const updates: any = {};
          if (tgUsername && user.tgUsername !== tgUsername) updates.tgUsername = tgUsername;
          if (name && user.name !== name) updates.name = name;
          if (img && img !== user.img) updates.img = img;

          if (Object.keys(updates).length > 0) {
            await storage.updateUser(user.id, updates);
            user = { ...user, ...updates };
          }
        }

        // Generate API key
        apiKey = await storage.generateApiKey(user.id);

        // Ensure user has all crypto balances (lazy per-user replacement for
        // the old startup-wide fixExistingUserBalances loop).
        await storage.ensureUserCryptoBalances(user.id);

        // Fire-and-forget: refresh Telegram profile data in the background
        // (getChat + getUserProfilePhotos). Doesn't block the login response.
        const userIdForBg = user.id;
        const currentImg = user.img;
        const currentUsername = user.tgUsername;
        const currentName = user.name;
        telegramService.extractUserData(tgId)
          .then(async (telegramData) => {
            const bgUpdates: any = {};
            if (telegramData.tgUsername && telegramData.tgUsername !== currentUsername) {
              bgUpdates.tgUsername = telegramData.tgUsername;
            }
            if (telegramData.name && telegramData.name !== currentName) {
              bgUpdates.name = telegramData.name;
            }
            if (telegramData.img && telegramData.img !== currentImg) {
              bgUpdates.img = telegramData.img;
            }
            if (Object.keys(bgUpdates).length > 0) {
              await storage.updateUser(userIdForBg, bgUpdates);
            }
          })
          .catch(() => {
            // Telegram API failure is non-fatal — user is already logged in
          });
      } else {
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
      
      // Return the updated user object from database
      res.json(updatedUser);
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

  // Get or reserve wallet for topup
  app.post("/api/wallets/reserve-for-topup", requireApiKey, async (req: AuthenticatedRequest, res) => {
    try {
      const { network } = req.body;
      
      if (!network) {
        return res.status(400).json({ message: "Network is required" });
      }
      
      const wallet = await storage.findOrReserveWalletForOperation(req.user!.id, network, "topup");
      
      if (!wallet) {
        return res.status(500).json({ message: "Failed to reserve wallet" });
      }
      
      res.json(wallet);
    } catch (error) {
      console.error("Error reserving wallet for topup:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create topup request and notify admin channel
  app.post("/api/topup/create", requireApiKey, async (req: AuthenticatedRequest, res) => {
    try {
      const { walletAddress, network } = req.body;
      
      if (!walletAddress || !network) {
        return res.status(400).json({ message: "Wallet address and network are required" });
      }

      // Send notification to admin channel
      await telegramService.notifyTopUp({
        userId: req.user!.id,
        userName: req.user!.name || `User ${req.user!.id}`,
        walletAddress,
        network
      });
      
      res.json({ success: true, message: "Top-up request created" });
    } catch (error) {
      console.error("Error creating topup request:", error);
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

  // Get services by category
  app.get("/api/services/banks", async (req, res) => {
    try {
      const bankCards = await storage.getActiveCardsByCategory('bank');
      res.json(bankCards);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/services/crypto", async (req, res) => {
    try {
      const cryptoRates = await storage.getExchangeRatesByCategory('crypto');
      res.json(cryptoRates);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/services/cash", async (req, res) => {
    try {
      // Placeholder for cash services - return empty array for now
      res.json([]);
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

  // Get available payment balances for a receive balance
  app.get("/api/exchange/payment-balances/:toBalanceId", async (req, res) => {
    try {
      const toBalanceId = parseInt(req.params.toBalanceId);
      const paymentBalances = await storage.getAvailablePaymentBalances(toBalanceId);
      res.json(paymentBalances);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get receive balances for crypto mode
  app.get("/api/exchange/crypto/receive-balances", async (req, res) => {
    try {
      const cryptoRates = await storage.getExchangeRatesByCategory('crypto');
      
      // Get unique "to" balances from crypto exchange rates
      const toBalanceIds = Array.from(new Set(cryptoRates.map(rate => rate.toBalanceId)));
      const receiveBalances = await Promise.all(
        toBalanceIds.map(id => storage.getBalanceById(id))
      );
      
      // Filter out null values and fiat balances - only crypto for top-up
      res.json(receiveBalances.filter(b => b !== null && b.balanceType === 'crypto'));
    } catch (error) {
      console.error('Error fetching crypto receive balances:', error);
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

  // Get exchange rate between two balances
  app.get("/api/exchange/rate/:fromBalanceId/:toBalanceId", async (req, res) => {
    try {
      const fromBalanceId = parseInt(req.params.fromBalanceId);
      const toBalanceId = parseInt(req.params.toBalanceId);
      
      const rateData = await storage.getExchangeRateByBalances(fromBalanceId, toBalanceId);
      if (!rateData) {
        return res.status(404).json({ message: "Exchange rate not found" });
      }

      const fromBalance = await storage.getBalance(fromBalanceId);
      const toBalance = await storage.getBalance(toBalanceId);

      res.json({
        rate: parseFloat(rateData.rate),
        fromCurrency: fromBalance?.currency || '',
        toCurrency: toBalance?.currency || '',
        fromNetwork: fromBalance?.network || '',
        toNetwork: toBalance?.network || ''
      });
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
      const cardData: any = {
        idCard: parseInt(req.body.idCard),
        idUser: req.user!.id,
        idBank: req.body.idBank ? parseInt(req.body.idBank) : null,
        name: req.body.name,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        phone: req.body.phone,
        country: req.body.country,
        status: "active"
      };
      
      if (req.body.number) {
        cardData.numberCard = req.body.number;
      }
      
      if (req.body.accountNumber) {
        cardData.accountNumber = req.body.accountNumber;
      }
      
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

  // Get user crypto balances
  app.get("/api/user/crypto-balances", requireApiKey, async (req: AuthenticatedRequest, res) => {
    try {
      const cryptoBalances = await storage.getUserCryptoBalances(req.user!.id);
      res.json(cryptoBalances);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get available networks (crypto balances user doesn't have yet)
  app.get("/api/user/available-networks", requireApiKey, async (req: AuthenticatedRequest, res) => {
    try {
      const availableNetworks = await storage.getAvailableNetworks(req.user!.id);
      res.json(availableNetworks);
    } catch (error) {
      console.error("Error getting available networks:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Add network to user (create user balance entry)
  app.post("/api/user/add-network", requireApiKey, async (req: AuthenticatedRequest, res) => {
    try {
      const { balanceId } = req.body;
      if (!balanceId) {
        return res.status(400).json({ message: "Balance ID is required" });
      }
      const userBalance = await storage.addUserNetwork(req.user!.id, balanceId);
      res.json(userBalance);
    } catch (error) {
      console.error("Error adding network:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get user fiat balances with account numbers
  app.get("/api/user/fiat-balances", requireApiKey, async (req: AuthenticatedRequest, res) => {
    try {
      const fiatBalances = await storage.getUserFiatBalances(req.user!.id);
      res.json(fiatBalances);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get all user balances (crypto + fiat) for voucher creation
  app.get("/api/user/balances", requireApiKey, async (req: AuthenticatedRequest, res) => {
    try {
      const allBalances = await storage.getAllUserBalances(req.user!.id);
      console.log('📊 User balances for voucher creation:', JSON.stringify(allBalances, null, 2));
      res.json(allBalances);
    } catch (error) {
      console.error('Error getting user balances:', error);
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

  // Update user phone number
  app.patch("/api/user/phone", requireApiKey, async (req: AuthenticatedRequest, res) => {
    try {
      const { phone } = req.body;
      
      if (!phone || typeof phone !== 'string') {
        return res.status(400).json({ message: "Phone number is required" });
      }
      
      const updatedUser = await storage.updateUserPhone(req.user!.id, phone);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(updatedUser);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get user referrals
  app.get("/api/referrals", requireApiKey, async (req: AuthenticatedRequest, res) => {
    try {
      const referrals = await storage.getUserReferrals(req.user!.id);
      res.json(referrals);
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
        network,
        paymentMethod = 'blockchain'
      } = req.body;

      // Validate required fields
      if (!fromBalanceId || !toBalanceId || !fromCurrency || !toCurrency || !amountFrom || !amountTo || !rate || !network) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Check if fromBalance is frozen or hidden
      const fromBalance = await storage.getBalanceById(fromBalanceId);
      if (!fromBalance) {
        return res.status(404).json({ message: "Balance not found" });
      }
      if (fromBalance.status === 'frozen') {
        return res.status(400).json({ message: "Этот баланс временно неактивен" });
      }
      if (fromBalance.status === 'hidden') {
        return res.status(400).json({ message: "Этот баланс недоступен" });
      }

      // Check if toBalance is frozen or hidden
      const toBalance = await storage.getBalanceById(toBalanceId);
      if (!toBalance) {
        return res.status(404).json({ message: "Balance not found" });
      }
      if (toBalance.status === 'frozen') {
        return res.status(400).json({ message: "Целевой баланс временно неактивен" });
      }
      if (toBalance.status === 'hidden') {
        return res.status(400).json({ message: "Целевой баланс недоступен" });
      }

      // Validate wallet address for crypto exchanges with blockchain payment
      if (paymentMethod === 'blockchain' && manualCardNumber && toBalance.pattern) {
        try {
          const pattern = new RegExp(toBalance.pattern);
          if (!pattern.test(manualCardNumber)) {
            return res.status(400).json({ 
              message: `Неверный формат адреса кошелька для ${toBalance.network || toBalance.currency}. Пожалуйста, проверьте адрес.` 
            });
          }
        } catch (error) {
          console.error('Invalid regex pattern in balance:', error);
        }
      }

      // If paying from balance, check and deduct funds
      let tempBalance = 0;
      if (paymentMethod === 'balance') {
        const userBalance = await storage.getUserBalance(req.user!.id, fromBalanceId);
        const availableBalance = parseFloat(userBalance.sum);
        const requiredAmount = parseFloat(amountFrom);

        if (requiredAmount > availableBalance) {
          return res.status(400).json({ 
            message: `Insufficient balance. Available: ${availableBalance} ${fromCurrency}` 
          });
        }

        // Deduct from user balance (will be stored in temp_balance)
        await storage.updateUserBalance(req.user!.id, fromBalanceId, -requiredAmount);
        tempBalance = requiredAmount;
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

      // Reserve wallet for 12 hours for exchange and assign to user
      await storage.reserveWallet(wallet.id, 12, "exchange", req.user!.id);

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
        tempBalance: tempBalance.toString(),
        status: "wait"
      });

      // Send notification to admin channel
      await telegramService.notifyExchange({
        userId: req.user!.id,
        userName: req.user!.name || `User ${req.user!.id}`,
        orderNumber,
        fromAmount: amountFrom,
        fromCurrency,
        toAmount: amountTo,
        toCurrency,
        walletAddress: wallet.address,
        network: wallet.network,
        paymentMethod
      });

      // Return exchange details with wallet address and payment method
      res.json({
        ...exchange,
        walletAddress: wallet.address,
        walletNetwork: wallet.network,
        paymentMethod
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

      // Disable caching to ensure real-time status updates
      res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        'Pragma': 'no-cache',
        'Expires': '0'
      });

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

      // If canceling order and has temp_balance, refund to user
      if (status === 'canceled' && exchange.tempBalance && parseFloat(exchange.tempBalance) > 0) {
        const refundAmount = parseFloat(exchange.tempBalance);
        await storage.updateUserBalance(exchange.idUser, exchange.idBalanceFrom, refundAmount);
        console.log(`Refunded ${refundAmount} to user ${exchange.idUser} balance ${exchange.idBalanceFrom}`);
      }

      const updatedExchange = await storage.updateExchangeStatus(exchange.id, status);
      res.json(updatedExchange);
    } catch (error) {
      console.error('Update exchange status error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get exchange history with pagination
  app.get("/api/exchanges/history", requireApiKey, async (req: AuthenticatedRequest, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = parseInt(req.query.offset as string) || 0;

      const history = await storage.getExchangeHistory(req.user!.id, limit, offset);
      res.json(history);
    } catch (error) {
      console.error('Get exchange history error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Support tickets
  // Create support ticket
  app.post("/api/support/tickets", requireApiKey, async (req: AuthenticatedRequest, res) => {
    try {
      const { exchangeNumber, message } = req.body;
      
      if (!exchangeNumber || !message) {
        return res.status(400).json({ message: "Exchange number and message are required" });
      }
      
      // Find exchange by order number
      const exchange = await storage.getExchangeByOrderNumber(exchangeNumber);
      if (!exchange) {
        return res.status(404).json({ message: "Exchange not found" });
      }
      
      // Security: ensure user owns this exchange
      if (exchange.idUser !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Check if user already has an open ticket
      const existingTicket = await storage.getUserOpenTicket(req.user!.id);
      if (existingTicket) {
        return res.status(400).json({ message: "You already have an open ticket" });
      }
      
      // Create ticket with initial message
      const ticket = await storage.createSupportTicket({
        userId: req.user!.id,
        exchangeId: exchange.id,
        status: "wait-support"
      }, message);
      
      res.json(ticket);
    } catch (error) {
      console.error('Create ticket error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get user's open ticket
  app.get("/api/support/tickets/open", requireApiKey, async (req: AuthenticatedRequest, res) => {
    try {
      const ticket = await storage.getUserOpenTicket(req.user!.id);
      
      if (!ticket) {
        return res.status(404).json({ message: "No open ticket found" });
      }
      
      res.json(ticket);
    } catch (error) {
      console.error('Get open ticket error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get messages for a ticket
  app.get("/api/support/tickets/:ticketId/messages", requireApiKey, async (req: AuthenticatedRequest, res) => {
    try {
      const ticketId = parseInt(req.params.ticketId);
      
      // Get ticket to verify ownership
      const ticket = await storage.getUserOpenTicket(req.user!.id);
      if (!ticket || ticket.id !== ticketId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const messages = await storage.getTicketMessages(ticketId);
      res.json(messages);
    } catch (error) {
      console.error('Get ticket messages error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Add message to ticket
  app.post("/api/support/tickets/:ticketId/messages", requireApiKey, async (req: AuthenticatedRequest, res) => {
    try {
      const ticketId = parseInt(req.params.ticketId);
      const { message } = req.body;
      
      if (!message) {
        return res.status(400).json({ message: "Message is required" });
      }
      
      // Get ticket to verify ownership
      const ticket = await storage.getUserOpenTicket(req.user!.id);
      if (!ticket || ticket.id !== ticketId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Add message and update ticket status to wait-support
      const newMessage = await storage.addTicketMessage({
        ticketId,
        sender: "user",
        message
      });
      
      await storage.updateTicketStatus(ticketId, "wait-support");
      
      res.json(newMessage);
    } catch (error) {
      console.error('Add ticket message error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Telegram webhook endpoint for bot updates
  app.post("/api/telegram/webhook", async (req, res) => {
    try {
      const update = req.body;
      
      // Handle /start command or any message from user
      if (update.message) {
        const telegramId = update.message.from.id.toString();
        const username = update.message.from.username || null;
        const firstName = update.message.from.first_name || null;
        const messageText = update.message.text || '';
        
        // Find user by Telegram ID
        const user = await storage.getUserByTgId(telegramId);
        
        if (user) {
          // Update user data if username exists and is different
          if (username && user.tgUsername !== username) {
            await storage.updateUser(user.id, { 
              tgUsername: username,
              name: firstName || user.name 
            });
          }
        }

        // Load dynamic commands and menu from DB
        const commands = await telegramService.loadBotCommands();
        const rootMenuData = await telegramService.loadRootMenu();
        
        // Find matching command
        let matchingCommand = commands.find((cmd: any) => 
          messageText === cmd.command || messageText.startsWith(cmd.command + ' ')
        );

        // If no direct command match, check if it's a button click
        if (!matchingCommand && rootMenuData?.buttons) {
          const clickedButton = rootMenuData.buttons.find((btn: any) => btn.text === messageText);
          if (clickedButton && clickedButton.actionType === 'command' && clickedButton.actionValue) {
            // Find command by actionValue
            matchingCommand = commands.find((cmd: any) => cmd.command === clickedButton.actionValue);
          }
        }

        if (matchingCommand) {
          // Load reactions for this command
          const { db } = await import('./db');
          const { botCommandReactions } = await import('@shared/schema');
          const { eq, and } = await import('drizzle-orm');
          
          const reactions = await db
            .select()
            .from(botCommandReactions)
            .where(and(
              eq(botCommandReactions.commandId, matchingCommand.id),
              eq(botCommandReactions.isActive, true)
            ))
            .orderBy(botCommandReactions.priority);

          // Execute reactions
          for (const reaction of reactions) {
            // Check conditions if they exist
            if (reaction.conditions && Array.isArray(reaction.conditions)) {
              let shouldExecute = true;
              
              for (const condition of reaction.conditions) {
                const { field, operator, value, action } = condition;
                
                // Get the actual value to compare
                let actualValue: any;
                if (field === 'userId' || field === 'tgId') {
                  actualValue = telegramId;
                } else if (field === 'username') {
                  actualValue = username;
                } else if (field === 'firstName') {
                  actualValue = firstName;
                } else if (field === 'messageText') {
                  actualValue = messageText;
                }
                
                // Perform comparison based on operator
                let conditionMet = false;
                if (operator === 'equals') {
                  conditionMet = actualValue == value;
                } else if (operator === 'not_equals') {
                  conditionMet = actualValue != value;
                } else if (operator === 'contains') {
                  conditionMet = actualValue && actualValue.toString().includes(value);
                } else if (operator === 'starts_with') {
                  conditionMet = actualValue && actualValue.toString().startsWith(value);
                } else if (operator === 'ends_with') {
                  conditionMet = actualValue && actualValue.toString().endsWith(value);
                }
                
                // Check action
                if (action === 'execute' && !conditionMet) {
                  shouldExecute = false;
                  break;
                } else if (action === 'skip' && conditionMet) {
                  shouldExecute = false;
                  break;
                }
              }
              
              if (!shouldExecute) {
                console.log(`⏭️  Reaction ${reaction.id} skipped due to conditions`);
                continue; // Skip this reaction
              }
            }
            
            if (reaction.reactionType === 'text' || reaction.reactionType === 'mixed') {
              if (reaction.textContent || reaction.imageUrl) {
                // For /start command, include menu
                let replyMarkup = undefined;
                if (matchingCommand.command === '/start' && rootMenuData) {
                  replyMarkup = telegramService.generateKeyboard(rootMenuData);
                }

                // Add inline button for link if provided
                if (reaction.linkUrl && reaction.linkText) {
                  const inlineKeyboard = {
                    inline_keyboard: [
                      [{ text: reaction.linkText, url: reaction.linkUrl }]
                    ]
                  };
                  // Merge with existing reply markup if any
                  if (replyMarkup) {
                    replyMarkup = {
                      ...replyMarkup,
                      inline_keyboard: inlineKeyboard.inline_keyboard
                    };
                  } else {
                    replyMarkup = inlineKeyboard;
                  }
                }

                // Send photo if imageUrl is provided, otherwise send text
                if (reaction.imageUrl) {
                  console.log(`📸 Sending photo with URL: ${reaction.imageUrl}`);
                  await telegramService.sendPhoto({
                    chatId: telegramId,
                    photoUrl: reaction.imageUrl,
                    caption: reaction.textContent || '',
                    replyMarkup
                  });
                } else if (reaction.textContent) {
                  await telegramService.sendMessage({
                    chatId: telegramId,
                    text: reaction.textContent,
                    replyMarkup
                  });
                }
              }
            }
            
            if (reaction.reactionType === 'endpoint' || reaction.reactionType === 'mixed') {
              if (reaction.endpointUrl) {
                // TODO: Make API request to endpoint
                console.log(`Calling endpoint: ${reaction.endpointMethod} ${reaction.endpointUrl}`);
              }
            }
          }
        }
      }
      
      res.json({ ok: true });
    } catch (error) {
      console.error('Telegram webhook error:', error);
      res.status(500).json({ ok: false });
    }
  });

  // Notification endpoints
  app.get("/api/notifications", requireApiKey, async (req: AuthenticatedRequest, res) => {
    try {
      const notifications = await storage.getUserNotifications(req.user!.id);
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/notifications/unread-count", requireApiKey, async (req: AuthenticatedRequest, res) => {
    try {
      const count = await storage.getUnreadNotificationsCount(req.user!.id);
      res.json({ count });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/notifications/unread-count", requireApiKey, async (req: AuthenticatedRequest, res) => {
    try {
      const count = await storage.getUnreadNotificationsCount(req.user!.id);
      res.json({ count });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/notifications/:id/read", requireApiKey, async (req: AuthenticatedRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const notification = await storage.markNotificationAsRead(id, req.user!.id);
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }
      res.json(notification);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/notifications/read-all", requireApiKey, async (req: AuthenticatedRequest, res) => {
    try {
      await storage.markAllNotificationsAsRead(req.user!.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Endpoint to generate SSE token (requires authentication)
  app.post("/api/notifications/sse-token", requireApiKey, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id.toString();
      const token = notificationService.generateSSEToken(userId);
      res.json({ token });
    } catch (error) {
      console.error('[SSE] Token generation error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Server-Sent Events endpoint for real-time notifications
  // Uses one-time tokens for security (no API keys in URL)
  app.get("/api/notifications/stream", async (req, res) => {
    try {
      // Get one-time token from query parameter
      const token = req.query.token as string;
      
      if (!token) {
        res.status(401).json({ message: "Token required" });
        return;
      }
      
      // Validate and consume token (one-time use)
      const userId = notificationService.validateSSEToken(token);
      
      if (!userId) {
        res.status(401).json({ message: "Invalid or expired token" });
        return;
      }
      
      // Set SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
      
      // Disable compression for SSE
      res.flushHeaders();
      
      console.log(`[SSE] User ${userId} connecting to notification stream`);
      
      // Register connection with notification service
      notificationService.addConnection(userId, res);
      
      // Connection will be automatically cleaned up by notificationService on close
    } catch (error) {
      console.error('[SSE] Connection error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Invoice endpoints
  app.get("/api/invoices", requireApiKey, async (req: AuthenticatedRequest, res) => {
    try {
      const invoices = await storage.getUserInvoices(req.user!.id);
      res.json(invoices);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get invoice by ID (for direct links from notifications)
  app.get("/api/invoices/by-id/:id", requireApiKey, async (req: AuthenticatedRequest, res) => {
    try {
      const invoice = await storage.getInvoice(parseInt(req.params.id));
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      // Verify user owns this invoice
      if (invoice.userId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      res.json(invoice);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/invoices/:orderNumber", requireApiKey, async (req: AuthenticatedRequest, res) => {
    try {
      const invoice = await storage.getInvoiceByOrderNumber(req.params.orderNumber);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      // Verify user owns this invoice
      if (invoice.userId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      res.json(invoice);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/invoices/:id/pay", requireApiKey, async (req: AuthenticatedRequest, res) => {
    try {
      const invoiceId = parseInt(req.params.id);
      const { paymentMethod, paymentHash } = req.body;

      // Get invoice
      const invoice = await storage.getInvoice(invoiceId);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      // Verify user owns this invoice
      if (invoice.userId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Check if already paid
      if (invoice.status === 'paid') {
        return res.status(400).json({ message: "Invoice already paid" });
      }

      // Check if expired
      if (invoice.expiresAt && new Date(invoice.expiresAt) < new Date()) {
        return res.status(400).json({ message: "Invoice expired" });
      }

      // Process payment based on method
      if (paymentMethod === 'balance') {
        // Check if user has enough balance
        const userBalance = await storage.getUserBalance(req.user!.id, invoice.balanceId!);
        if (!userBalance || parseFloat(userBalance.sum) < parseFloat(invoice.amount)) {
          return res.status(400).json({ message: "Insufficient balance" });
        }

        // Deduct balance (negative amount to deduct)
        await storage.updateUserBalance(req.user!.id, invoice.balanceId!, -parseFloat(invoice.amount));

        // Update invoice status
        const updatedInvoice = await storage.updateInvoiceStatus(invoiceId, 'paid', new Date());
        
        // Create notification
        await storage.createNotification({
          userId: req.user!.id,
          type: 'invoice',
          title: 'Счет оплачен',
          message: `Счет ${invoice.orderNumber} успешно оплачен`,
          invoiceId,
          isRead: false
        });

        res.json(updatedInvoice);
      } else if (paymentMethod === 'blockchain') {
        // For blockchain, just mark as pending for admin verification
        res.json({ message: "Payment pending admin verification" });
      } else {
        res.status(400).json({ message: "Invalid payment method" });
      }
    } catch (error) {
      console.error('Pay invoice error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Cancel invoice endpoint
  app.patch("/api/invoices/:id/cancel", requireApiKey, async (req: AuthenticatedRequest, res) => {
    try {
      const invoiceId = parseInt(req.params.id);

      // Get invoice
      const invoice = await storage.getInvoice(invoiceId);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      // Verify user owns this invoice
      if (invoice.userId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Check if already paid or canceled
      if (invoice.status === 'paid') {
        return res.status(400).json({ message: "Cannot cancel paid invoice" });
      }

      if (invoice.status === 'canceled') {
        return res.status(400).json({ message: "Invoice already canceled" });
      }

      // Update invoice status to canceled
      const updatedInvoice = await storage.updateInvoiceStatus(invoiceId, 'canceled');
      
      // Create notification
      await storage.createNotification({
        userId: req.user!.id,
        type: 'invoice',
        title: 'Счет отменен',
        message: `Счет ${invoice.orderNumber} был отменен`,
        invoiceId,
        isRead: false
      });

      res.json(updatedInvoice);
    } catch (error) {
      console.error('Cancel invoice error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Voucher routes
  // Generate voucher code: V + 13 digits + D
  function generateVoucherCode(): string {
    const digits = Math.floor(Math.random() * 10000000000000).toString().padStart(13, '0');
    return `V${digits}D`;
  }

  // Create voucher
  app.post("/api/vouchers/create", requireApiKey, async (req: AuthenticatedRequest, res) => {
    try {
      const { balanceId, amount, securityType, securityValue } = req.body;

      if (!balanceId || !amount) {
        return res.status(400).json({ message: "Balance ID and amount are required" });
      }

      const userId = req.user!.id;

      // Get balance details for currency
      const balance = await storage.getBalance(balanceId);
      if (!balance) {
        return res.status(404).json({ message: "Balance configuration not found" });
      }

      // For voucher-type balances, check and deduct from targetBalanceId
      const targetBalanceId = balance.targetBalanceId || balanceId;
      
      console.log(`💳 Creating voucher: balanceId=${balanceId}, targetBalanceId=${targetBalanceId}`);

      // Get user balance from TARGET balance (where the money is)
      const userBalance = await storage.getUserBalance(userId, targetBalanceId);
      if (!userBalance) {
        return res.status(404).json({ message: "Balance not found" });
      }

      // Check if balance status is active
      if (userBalance.balanceStatus === 'frozen') {
        return res.status(400).json({ message: "Balance is frozen" });
      }

      // Check if user has enough balance
      const currentBalance = parseFloat(userBalance.sum);
      const requestedAmount = parseFloat(amount);

      console.log(`💰 Balance check: current=${currentBalance}, requested=${requestedAmount}`);

      if (currentBalance < requestedAmount) {
        return res.status(400).json({ message: "Insufficient balance" });
      }

      // Hash security value if provided
      let hashedSecurityValue = null;
      if (securityType && securityType !== 'none' && securityValue) {
        hashedSecurityValue = await bcrypt.hash(securityValue, 10);
      }

      // Generate unique voucher code
      let voucherCode = generateVoucherCode();
      let existingVoucher = await storage.getVoucherByCode(voucherCode);
      while (existingVoucher) {
        voucherCode = generateVoucherCode();
        existingVoucher = await storage.getVoucherByCode(voucherCode);
      }

      // Create voucher
      const voucher = await storage.createVoucher({
        code: voucherCode,
        userId,
        balanceId,
        amount: requestedAmount.toFixed(8),
        currency: balance.currency,
        network: balance.network,
        securityType: securityType || 'none',
        securityValue: hashedSecurityValue,
        status: 'active'
      });

      // Deduct amount from TARGET balance (where the money is)
      const newBalance = (currentBalance - requestedAmount).toFixed(8);
      await db.update(usersBalances)
        .set({ sum: newBalance })
        .where(and(
          eq(usersBalances.idUser, userId),
          eq(usersBalances.idBalance, targetBalanceId)  // Deduct from target, not voucher balance
        ));

      console.log(`✅ Voucher created successfully. Deducted ${requestedAmount} from balance ${targetBalanceId}. New balance: ${newBalance}`);

      res.json(voucher);
    } catch (error) {
      console.error('Create voucher error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get user vouchers
  app.get("/api/vouchers/my", requireApiKey, async (req: AuthenticatedRequest, res) => {
    try {
      const { status } = req.query;
      const userId = req.user!.id;

      const vouchers = await storage.getUserVouchers(
        userId,
        status as 'active' | 'activated' | 'expired' | undefined
      );

      res.json(vouchers);
    } catch (error) {
      console.error('Get user vouchers error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Check voucher
  app.post("/api/vouchers/check", requireApiKey, async (req: AuthenticatedRequest, res) => {
    try {
      const { code } = req.body;

      if (!code) {
        return res.status(400).json({ message: "Voucher code is required" });
      }

      const voucher = await storage.getVoucherByCode(code);
      
      if (!voucher) {
        return res.status(404).json({ message: "Voucher not found" });
      }

      // Return voucher info without sensitive data
      res.json({
        id: voucher.id,
        amount: voucher.amount,
        currency: voucher.currency,
        network: voucher.network,
        status: voucher.status,
        securityType: voucher.securityType,
        requiresSecurity: voucher.securityType !== 'none',
        createdAt: voucher.createdAt
      });
    } catch (error) {
      console.error('Check voucher error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Activate voucher
  app.post("/api/vouchers/activate", requireApiKey, async (req: AuthenticatedRequest, res) => {
    try {
      const { code, securityValue } = req.body;

      if (!code) {
        return res.status(400).json({ message: "Voucher code is required" });
      }

      const userId = req.user!.id;
      const voucher = await storage.getVoucherByCode(code);
      
      if (!voucher) {
        return res.status(404).json({ message: "Voucher not found" });
      }

      if (voucher.status !== 'active') {
        return res.status(400).json({ message: "Voucher is not active" });
      }

      // Check security if required
      if (voucher.securityType !== 'none' && voucher.securityValue) {
        if (!securityValue) {
          return res.status(400).json({ message: "Security code is required" });
        }

        const isValid = await bcrypt.compare(securityValue, voucher.securityValue);
        if (!isValid) {
          return res.status(403).json({ message: "Invalid security code" });
        }
      }

      // Get source balance (voucher-type balance that was used to create the voucher)
      console.log('🎫 Activating voucher:', { voucherBalanceId: voucher.balanceId, currency: voucher.currency, network: voucher.network });
      
      const [sourceBalance] = await db.select()
        .from(balances)
        .where(eq(balances.id, voucher.balanceId));

      if (!sourceBalance) {
        console.log('❌ Source balance not found for voucher:', voucher.balanceId);
        return res.status(400).json({ message: "Упс. Ваучер существует но сеть не найдена" });
      }

      console.log('📦 Source balance:', { 
        id: sourceBalance.id, 
        title: sourceBalance.title, 
        type: sourceBalance.balanceType,
        targetBalanceId: sourceBalance.targetBalanceId 
      });

      // Determine target balance: use targetBalanceId if set, otherwise use source balance
      const targetBalanceId = sourceBalance.targetBalanceId || sourceBalance.id;
      
      console.log('🎯 Target balance ID:', targetBalanceId);

      // Get target balance details
      const [targetBalance] = await db.select()
        .from(balances)
        .where(eq(balances.id, targetBalanceId));

      if (!targetBalance) {
        console.log('❌ Target balance not found:', targetBalanceId);
        return res.status(400).json({ message: "Упс. Ваучер существует но сеть не найдена" });
      }

      console.log('✅ Target balance:', { 
        id: targetBalance.id, 
        title: targetBalance.title, 
        currency: targetBalance.currency,
        network: targetBalance.network,
        type: targetBalance.balanceType 
      });

      // Check if user has this target balance
      let userBalance = await storage.getUserBalance(userId, targetBalanceId);
      
      if (!userBalance) {
        console.log('❌ User does not have target balance:', targetBalanceId);
        return res.status(400).json({ message: "Упс. Ваучер существует но сеть не найдена" });
      }

      // Add voucher amount to user balance
      const currentBalance = parseFloat(userBalance.sum);
      const voucherAmount = parseFloat(voucher.amount);
      const newBalance = (currentBalance + voucherAmount).toFixed(8);

      console.log('💰 Crediting amount:', { voucherAmount, currentBalance, newBalance, targetBalanceId });

      await db.update(usersBalances)
        .set({ sum: newBalance })
        .where(and(
          eq(usersBalances.idUser, userId),
          eq(usersBalances.idBalance, targetBalanceId)
        ));

      // Mark voucher as activated
      const activatedVoucher = await storage.activateVoucher(code, userId);

      // Create notification
      await storage.createNotification({
        userId,
        type: 'info',
        title: 'Ваучер активирован',
        message: `Вы успешно активировали ваучер на сумму ${voucherAmount} ${targetBalance.currency}${targetBalance.network ? ` (${targetBalance.network})` : ''}`,
        isRead: false
      });

      console.log('✅ Voucher activated successfully');

      res.json({
        message: "Voucher activated successfully",
        amount: voucherAmount,
        currency: voucher.currency,
        newBalance
      });
    } catch (error) {
      console.error('Activate voucher error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Register admin routes
  registerAdminRoutes(app, storage);

  const httpServer = createServer(app);
  return httpServer;
}
