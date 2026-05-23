import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { validateConfig, logConfig } from "./config";
import { DatabaseStorage } from "./storage";
import { telegramService } from "./telegram-service";
import path from "path";
import fs from "fs";

const app = express();

// Serve uploaded files BEFORE any other middleware to prevent Vite from intercepting
app.use('/uploads', async (req, res, next) => {
  const uploadsPath = path.resolve(import.meta.dirname, '..', 'public', 'uploads');
  const filePath = path.join(uploadsPath, req.path);
  
  // Security check: ensure the file is within uploads directory
  if (!filePath.startsWith(uploadsPath)) {
    return res.status(403).send('Forbidden');
  }
  
  try {
    // Check if file exists
    await fs.promises.access(filePath, fs.constants.R_OK);
    
    // Set proper content type based on extension
    const ext = path.extname(filePath).toLowerCase();
    const contentTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };
    
    if (contentTypes[ext]) {
      res.setHeader('Content-Type', contentTypes[ext]);
    }

    // Cache static uploads for 1 hour in browser, 24h on CDN
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    
    // Send the file
    res.sendFile(filePath);
  } catch (error) {
    // File doesn't exist or not readable
    next();
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Validate and log configuration
  validateConfig();
  logConfig();

  // Initialize database storage in the background — don't block server startup.
  // Initialization seeds default data and is safe to run after the server starts listening.
  DatabaseStorage.initialize().catch((err) => {
    console.error('[Startup] Database initialization failed:', err);
  });

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, async () => {
    log(`serving on port ${port}`);
    
    // Auto-setup Telegram webhook in production
    if (process.env.NODE_ENV === 'production' && process.env.TELEGRAM_BOT_TOKEN) {
      try {
        const webhookUrl = process.env.WEBHOOK_URL || `https://${process.env.REPLIT_DEV_DOMAIN}/api/telegram/webhook`;
        const result = await telegramService.setWebhook(webhookUrl);
        if (result.ok) {
          log(`✅ Telegram webhook auto-configured: ${webhookUrl}`);
        } else {
          log(`⚠️  Telegram webhook auto-setup failed: ${result.message}`);
        }
      } catch (error) {
        log(`⚠️  Error setting up Telegram webhook: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  });
})();
