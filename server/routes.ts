import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { storage } from "./storage";
import { insertTransactionSchema, insertSupportChatSchema, insertUserSchema } from "@shared/schema";

// Validation schemas for auth endpoints
const telegramAuthSchema = z.object({
  tgId: z.string(),
  name: z.string().optional(),
  img: z.string().optional()
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
  // Telegram Authentication (Note: In production, validate Telegram WebApp initData signature)
  app.post("/api/auth/telegram", async (req, res) => {
    try {
      const validatedData = telegramAuthSchema.parse(req.body);
      const { tgId, name, img } = validatedData;
      
      // Check if user already exists
      let user = await storage.getUserByTgId(tgId);
      
      if (!user) {
        // Create new user
        user = await storage.createUser({
          tgId,
          google: null,
          name: name ?? null,
          img: img ?? null,
          status: "active",
          agreement: 0,
          blocked: false
        });
      }
      
      // Generate API key if user doesn't have one
      if (!user.apiKey) {
        const apiKey = await storage.generateApiKey(user.id);
        user.apiKey = apiKey ?? null;
      }
      
      res.json({ 
        user: {
          id: user.id,
          tgId: user.tgId,
          name: user.name,
          img: user.img,
          agreement: user.agreement
        },
        apiKey: user.apiKey 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Generate API key for existing user
  app.post("/api/auth/generate-key", async (req, res) => {
    try {
      const { tgId } = req.body;
      
      if (!tgId) {
        return res.status(400).json({ message: "Telegram ID is required" });
      }
      
      const user = await storage.getUserByTgId(tgId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const apiKey = await storage.generateApiKey(user.id);
      
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

  // Get transaction by order ID
  app.get("/api/transactions/order/:orderId", async (req, res) => {
    try {
      const { orderId } = req.params;
      const transaction = await storage.getTransactionByOrderId(orderId);
      
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      
      res.json(transaction);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update transaction status
  app.patch("/api/transactions/:id/status", async (req, res) => {
    try {
      const { id } = req.params;
      const { status, txHash } = req.body;
      
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
  app.get("/api/transactions/user/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const transactions = await storage.getTransactionsByUserId(parseInt(userId));
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Wallets
  app.get("/api/wallets/user/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const wallets = await storage.getWalletsByUserId(parseInt(userId));
      res.json(wallets);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create wallet
  app.post("/api/wallets", async (req, res) => {
    try {
      const { userId, currency } = req.body;
      
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
        idUser: parseInt(userId),
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
  app.get("/api/support/chats/user/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const chats = await storage.getSupportChatsByUserId(parseInt(userId));
      res.json(chats);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
