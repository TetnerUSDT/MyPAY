import app from "./app";
import { logger } from "./lib/logger";
import { registerRoutes } from "./routes/routes";
import { validateConfig, logConfig } from "./config";
import { DatabaseStorage } from "./storage";
import { telegramService } from "./telegram-service";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

validateConfig();
logConfig();

DatabaseStorage.initialize().catch((err) => {
  logger.error({ err }, "Database initialization failed");
});

await registerRoutes(app);

const server = app.listen(port, async () => {
  logger.info({ port }, "Server listening");

  if (process.env.NODE_ENV === "production" && process.env.TELEGRAM_BOT_TOKEN) {
    const configuredBaseUrl =
      process.env.WEBHOOK_URL ||
      process.env.PROJECT_URL ||
      (process.env.REPLIT_DEV_DOMAIN
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : "");
    const webhookUrl = configuredBaseUrl.endsWith("/api/telegram/webhook")
      ? configuredBaseUrl
      : `${configuredBaseUrl.replace(/\/$/, "")}/api/telegram/webhook`;

    if (!configuredBaseUrl) {
      logger.warn("Telegram webhook URL is not configured");
      return;
    }

    try {
      const result = await telegramService.setWebhook(webhookUrl);
      if (result.ok) {
        logger.info({ webhookUrl }, "Telegram webhook configured");
      } else {
        logger.warn({ message: result.message }, "Telegram webhook setup failed");
      }
    } catch (err) {
      logger.warn({ err }, "Error setting up Telegram webhook");
    }
  }
});

server.on("error", (err) => {
  logger.error({ err }, "Error listening on port");
  process.exit(1);
});
