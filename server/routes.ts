import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { validate as validateInitData, parse as parseInitData } from "@telegram-apps/init-data-node";
import { storage } from "./storage";
import { insertTransactionSchema, insertSupportChatSchema, insertUserSchema } from "@shared/schema";

// Validation schemas for auth endpoints
const telegramAuthSchema = z.object({
  initData: z.string(),
});

// Environment variable for bot token (for development, use a placeholder)
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "dev-mock-token";

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
      blocked: user.blocked
    };
    
    next();
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Telegram Authentication with initData verification
  app.post("/api/auth/telegram", async (req, res) => {
    try {
      const validatedData = telegramAuthSchema.parse(req.body);
      const { initData } = validatedData;
      
      let userData;
      
      if (process.env.NODE_ENV === 'development' && TELEGRAM_BOT_TOKEN === 'dev-mock-token') {
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
        try {
          validateInitData(initData, TELEGRAM_BOT_TOKEN);
          userData = parseInitData(initData);
        } catch (validationError) {
          console.error('Telegram initData validation failed:', validationError);
          return res.status(401).json({ message: "Invalid Telegram data" });
        }
      }
      
      const tgId = userData.user.id.toString();
      const name = userData.user.first_name || userData.user.username || null;
      const img = userData.user.photo_url || null;
      
      // Check if user already exists
      let user = await storage.getUserByTgId(tgId);
      
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
      
      // Generate API key and return it (now secure after validation)
      const apiKey = await storage.generateApiKey(user.id);
      
      // Store API key in localStorage on client-side for subsequent requests
      const responseUser = {
        id: user.id,
        tgId: user.tgId,
        name: user.name,
        img: user.img,
        agreement: user.agreement
      };
      
      res.json({ 
        user: responseUser,
        apiKey // Safe to return now after verification
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      console.error('Telegram auth error:', error);
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

  const httpServer = createServer(app);
  return httpServer;
}
