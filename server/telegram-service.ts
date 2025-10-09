import { config } from './config';

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

  constructor() {
    this.botToken = config.auth.telegram.botToken;
    this.baseUrl = `https://api.telegram.org/bot${this.botToken}`;
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
}

export const telegramService = new TelegramService();
