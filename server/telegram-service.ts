import { config } from './config';
import { formatBalance } from './utils';

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

interface TelegramChat {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo?: {
    small_file_id: string;
    small_file_unique_id: string;
    big_file_id: string;
    big_file_unique_id: string;
  };
  bio?: string;
}

interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

export class TelegramService {
  private botToken: string;
  private baseUrl: string;
  private channelId: string;

  constructor() {
    this.botToken = config.auth.telegram.botToken;
    this.baseUrl = `https://api.telegram.org/bot${this.botToken}`;
    this.channelId = config.auth.telegram.channelId;
  }

  /**
   * Get user information from Telegram
   * Note: This only works if the user has interacted with the bot before
   */
  async getUserInfo(telegramId: string): Promise<TelegramChat | null> {
    try {
      const response = await fetch(`${this.baseUrl}/getChat?chat_id=${telegramId}`);
      const data: TelegramApiResponse<TelegramChat> = await response.json();

      if (data.ok && data.result) {
        return data.result;
      }

      console.error(`Failed to get user info for ${telegramId}:`, data.description);
      return null;
    } catch (error) {
      console.error(`Error fetching Telegram user ${telegramId}:`, error);
      return null;
    }
  }

  /**
   * Get user profile photos
   */
  async getUserProfilePhotos(telegramId: string, limit: number = 1): Promise<string | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/getUserProfilePhotos?user_id=${telegramId}&limit=${limit}`
      );
      const data: any = await response.json();

      if (data.ok && data.result?.photos?.length > 0) {
        // Get the first photo's file_id
        const fileId = data.result.photos[0][0].file_id;
        
        // Get file path
        const fileResponse = await fetch(`${this.baseUrl}/getFile?file_id=${fileId}`);
        const fileData: any = await fileResponse.json();

        if (fileData.ok && fileData.result?.file_path) {
          // Construct photo URL
          return `https://api.telegram.org/file/bot${this.botToken}/${fileData.result.file_path}`;
        }
      }

      return null;
    } catch (error) {
      console.error(`Error fetching profile photos for ${telegramId}:`, error);
      return null;
    }
  }

  /**
   * Extract user data for database update
   */
  async extractUserData(telegramId: string): Promise<{
    tgUsername: string | null;
    name: string | null;
    img: string | null;
  }> {
    const userInfo = await this.getUserInfo(telegramId);
    const photoUrl = await this.getUserProfilePhotos(telegramId);

    return {
      tgUsername: userInfo?.username || null,
      name: userInfo?.first_name || null,
      img: photoUrl || null,
    };
  }

  /**
   * Send message to a user or chat
   */
  async sendMessage(options: {
    chatId: string | number;
    text: string;
    parseMode?: 'HTML' | 'Markdown';
    replyMarkup?: any;
  }): Promise<boolean> {
    try {
      const body: any = {
        chat_id: options.chatId,
        text: options.text,
      };

      if (options.parseMode) {
        body.parse_mode = options.parseMode;
      }

      if (options.replyMarkup) {
        body.reply_markup = options.replyMarkup;
      }

      const response = await fetch(`${this.baseUrl}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data: TelegramApiResponse<any> = await response.json();

      if (data.ok) {
        console.log(`✅ Message sent to chat ${options.chatId}`);
        return true;
      } else {
        console.error(`Failed to send message:`, data.description);
        return false;
      }
    } catch (error) {
      console.error(`Error sending message:`, error);
      return false;
    }
  }

  /**
   * Send photo with caption and optional buttons
   */
  async sendPhoto(options: {
    chatId: string | number;
    photoUrl: string;
    caption?: string;
    parseMode?: 'HTML' | 'Markdown';
    replyMarkup?: any;
  }): Promise<boolean> {
    try {
      const body: any = {
        chat_id: options.chatId,
        photo: options.photoUrl,
      };

      if (options.caption) {
        body.caption = options.caption;
      }

      if (options.parseMode) {
        body.parse_mode = options.parseMode;
      }

      if (options.replyMarkup) {
        body.reply_markup = options.replyMarkup;
      }

      const response = await fetch(`${this.baseUrl}/sendPhoto`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data: TelegramApiResponse<any> = await response.json();

      if (data.ok) {
        console.log(`✅ Photo sent to chat ${options.chatId}`);
        return true;
      } else {
        console.error(`Failed to send photo:`, data.description);
        return false;
      }
    } catch (error) {
      console.error(`Error sending photo:`, error);
      return false;
    }
  }

  /**
   * Send message to admin channel
   */
  async sendChannelMessage(message: string, parseMode: 'HTML' | 'Markdown' = 'HTML'): Promise<boolean> {
    try {
      if (!this.channelId) {
        console.error('TELEGRAM_CHANNEL_ID is not configured');
        return false;
      }

      const response = await fetch(`${this.baseUrl}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: this.channelId,
          text: message,
          parse_mode: parseMode,
        }),
      });

      const data: TelegramApiResponse<any> = await response.json();

      if (data.ok) {
        console.log(`✅ Message sent to channel ${this.channelId}`);
        return true;
      } else {
        console.error(`Failed to send message to channel:`, data.description);
        return false;
      }
    } catch (error) {
      console.error(`Error sending message to channel:`, error);
      return false;
    }
  }

  /**
   * Send top-up notification to admin channel
   */
  async notifyTopUp(data: {
    userId: number;
    userName: string;
    walletAddress: string;
    network: string;
  }): Promise<boolean> {
    const message = `
🔔 <b>Новая заявка на пополнение</b>

👤 Пользователь: ${data.userName} (ID: ${data.userId})
💳 Адрес кошелька: <code>${data.walletAddress}</code>
🌐 Сеть: ${data.network}

⏰ Время: ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}
`;
    
    return this.sendChannelMessage(message.trim());
  }

  /**
   * Send exchange notification to admin channel
   */
  async notifyExchange(data: {
    userId: number;
    userName: string;
    orderNumber: string;
    fromAmount: string;
    fromCurrency: string;
    toAmount: string;
    toCurrency: string;
    walletAddress?: string;
    network?: string;
    paymentMethod?: string;
  }): Promise<boolean> {
    const message = `
🔔 <b>Новая заявка на обмен</b>

👤 Пользователь: ${data.userName} (ID: ${data.userId})
📋 Номер заказа: <code>${data.orderNumber}</code>

💸 Обмен: ${formatBalance(data.fromAmount)} ${data.fromCurrency} → ${formatBalance(data.toAmount)} ${data.toCurrency}
${data.paymentMethod ? `💳 Способ оплаты: ${data.paymentMethod === 'blockchain' ? 'Blockchain' : 'Баланс'}` : ''}
${data.walletAddress ? `💳 Адрес: <code>${data.walletAddress}</code>` : ''}
${data.network ? `🌐 Сеть: ${data.network}` : ''}

⏰ Время: ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}
`;
    
    return this.sendChannelMessage(message.trim());
  }

  /**
   * Set Telegram bot webhook
   */
  async setWebhook(webhookUrl: string): Promise<{ ok: boolean; message: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/setWebhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: webhookUrl,
        }),
      });

      const data: TelegramApiResponse<any> = await response.json();

      if (data.ok) {
        console.log(`✅ Webhook set to: ${webhookUrl}`);
        return {
          ok: true,
          message: `Webhook успешно установлен на: ${webhookUrl}`
        };
      } else {
        console.error(`Failed to set webhook:`, data.description);
        return {
          ok: false,
          message: `Ошибка установки webhook: ${data.description}`
        };
      }
    } catch (error) {
      console.error(`Error setting webhook:`, error);
      return {
        ok: false,
        message: `Ошибка: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get current webhook info
   */
  async getWebhookInfo(): Promise<{ ok: boolean; info?: any; message?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/getWebhookInfo`);
      const data: TelegramApiResponse<any> = await response.json();

      if (data.ok && data.result) {
        return {
          ok: true,
          info: data.result
        };
      }

      return {
        ok: false,
        message: data.description || 'Failed to get webhook info'
      };
    } catch (error) {
      console.error(`Error getting webhook info:`, error);
      return {
        ok: false,
        message: `Ошибка: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(): Promise<{ ok: boolean; message: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/deleteWebhook`, {
        method: 'POST',
      });

      const data: TelegramApiResponse<any> = await response.json();

      if (data.ok) {
        console.log(`✅ Webhook deleted`);
        return {
          ok: true,
          message: 'Webhook успешно удален'
        };
      } else {
        return {
          ok: false,
          message: `Ошибка удаления webhook: ${data.description}`
        };
      }
    } catch (error) {
      console.error(`Error deleting webhook:`, error);
      return {
        ok: false,
        message: `Ошибка: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Load active bot commands from database
   */
  async loadBotCommands() {
    try {
      const { db } = await import('./db');
      const { botCommands, botCommandReactions } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');
      
      const commands = await db
        .select()
        .from(botCommands)
        .where(eq(botCommands.isActive, true));
      
      return commands;
    } catch (error) {
      console.error('Error loading bot commands:', error);
      return [];
    }
  }

  /**
   * Load root menu from database
   */
  async loadRootMenu() {
    try {
      const { db } = await import('./db');
      const { botMenus, botMenuButtons } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');
      
      const [rootMenu] = await db
        .select()
        .from(botMenus)
        .where(and(eq(botMenus.isRoot, true), eq(botMenus.isActive, true)))
        .limit(1);
      
      if (!rootMenu) return null;
      
      const buttons = await db
        .select()
        .from(botMenuButtons)
        .where(and(eq(botMenuButtons.menuId, rootMenu.id), eq(botMenuButtons.isActive, true)))
        .orderBy(botMenuButtons.rowIndex, botMenuButtons.columnIndex);
      
      return { menu: rootMenu, buttons };
    } catch (error) {
      console.error('Error loading root menu:', error);
      return null;
    }
  }

  /**
   * Generate keyboard from menu and buttons
   */
  generateKeyboard(menuData: any) {
    if (!menuData || !menuData.buttons || menuData.buttons.length === 0) {
      return null;
    }

    const { menu, buttons } = menuData;
    const keyboard: any[][] = [];
    
    // Group buttons by row
    const rowMap = new Map<number, any[]>();
    buttons.forEach((button: any) => {
      if (!rowMap.has(button.rowIndex)) {
        rowMap.set(button.rowIndex, []);
      }
      rowMap.get(button.rowIndex)!.push(button);
    });
    
    // Sort rows and create keyboard structure
    const sortedRows = Array.from(rowMap.keys()).sort((a, b) => a - b);
    sortedRows.forEach(rowIndex => {
      const rowButtons = rowMap.get(rowIndex)!
        .sort((a, b) => a.columnIndex - b.columnIndex)
        .map(btn => ({ text: btn.text }));
      keyboard.push(rowButtons);
    });
    
    return {
      keyboard,
      resize_keyboard: true,
      one_time_keyboard: false
    };
  }
}

export const telegramService = new TelegramService();
