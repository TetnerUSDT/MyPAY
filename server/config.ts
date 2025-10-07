// Configuration for authentication modes
export type AuthMode = 'test' | 'telegram';
export type DatabaseType = 'postgres' | 'mysql';

export interface AppConfig {
  auth: {
    mode: AuthMode;
    telegram: {
      botToken: string;
      botUsername: string;
      validateInitData: boolean;
    };
    test: {
      enabled: boolean;
      allowPermanentKeys: boolean;
    };
  };
  server: {
    port: number;
    environment: string;
  };
  database: {
    type: DatabaseType;
    url: string;
  };
}

// Load configuration from environment variables
export const config: AppConfig = {
  auth: {
    // AUTH_MODE can be 'test' or 'telegram'
    mode: (process.env.AUTH_MODE as AuthMode) || 'test',
    telegram: {
      botToken: process.env.TELEGRAM_BOT_TOKEN || 'dev-mock-token',
      botUsername: process.env.TELEGRAM_BOT_USERNAME || 'dev_bot',
      validateInitData: process.env.VALIDATE_TELEGRAM_INITDATA !== 'false',
    },
    test: {
      enabled: process.env.ENABLE_TEST_AUTH !== 'false',
      allowPermanentKeys: true, // For development convenience
    },
  },
  server: {
    port: parseInt(process.env.PORT || '5000'),
    environment: process.env.NODE_ENV || 'development',
  },
  database: {
    type: (process.env.DB_TYPE as DatabaseType) || 'postgres',
    url: process.env.DATABASE_URL || '',
  },
};

// Helper functions for mode checking
export const isTestMode = () => config.auth.mode === 'test';
export const isTelegramMode = () => config.auth.mode === 'telegram';
export const isDevelopment = () => config.server.environment === 'development';
export const isProduction = () => config.server.environment === 'production';
export const isPostgres = () => config.database.type === 'postgres';
export const isMySQL = () => config.database.type === 'mysql';

// Validation helpers
export const validateConfig = () => {
  if (isTelegramMode() && !config.auth.telegram.botToken) {
    throw new Error('TELEGRAM_BOT_TOKEN is required in telegram mode');
  }
  
  if (isProduction() && isTestMode()) {
    console.warn('WARNING: Test mode is enabled in production environment');
  }
  
  if (!config.database.url) {
    throw new Error('DATABASE_URL is required');
  }
  
  if (!['postgres', 'mysql'].includes(config.database.type)) {
    throw new Error('DB_TYPE must be either "postgres" or "mysql"');
  }
  
  return true;
};

// Log current configuration on startup
export const logConfig = () => {
  console.log(`🔧 Configuration loaded:`);
  console.log(`   Auth Mode: ${config.auth.mode}`);
  console.log(`   Environment: ${config.server.environment}`);
  console.log(`   Database Type: ${config.database.type}`);
  console.log(`   Test Auth: ${config.auth.test.enabled ? 'enabled' : 'disabled'}`);
  if (isTelegramMode()) {
    console.log(`   Telegram validation: ${config.auth.telegram.validateInitData ? 'enabled' : 'disabled'}`);
  }
};