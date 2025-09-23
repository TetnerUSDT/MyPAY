// Configuration for authentication modes
export type AuthMode = 'test' | 'telegram';

export interface AppConfig {
  auth: {
    mode: AuthMode;
    telegram: {
      botToken: string;
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
}

// Load configuration from environment variables
export const config: AppConfig = {
  auth: {
    // AUTH_MODE can be 'test' or 'telegram'
    mode: (process.env.AUTH_MODE as AuthMode) || 'test',
    telegram: {
      botToken: process.env.TELEGRAM_BOT_TOKEN || 'dev-mock-token',
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
};

// Helper functions for mode checking
export const isTestMode = () => config.auth.mode === 'test';
export const isTelegramMode = () => config.auth.mode === 'telegram';
export const isDevelopment = () => config.server.environment === 'development';
export const isProduction = () => config.server.environment === 'production';

// Validation helpers
export const validateConfig = () => {
  if (isTelegramMode() && !config.auth.telegram.botToken) {
    throw new Error('TELEGRAM_BOT_TOKEN is required in telegram mode');
  }
  
  if (isProduction() && isTestMode()) {
    console.warn('WARNING: Test mode is enabled in production environment');
  }
  
  return true;
};

// Log current configuration on startup
export const logConfig = () => {
  console.log(`🔧 Configuration loaded:`);
  console.log(`   Auth Mode: ${config.auth.mode}`);
  console.log(`   Environment: ${config.server.environment}`);
  console.log(`   Test Auth: ${config.auth.test.enabled ? 'enabled' : 'disabled'}`);
  if (isTelegramMode()) {
    console.log(`   Telegram validation: ${config.auth.telegram.validateInitData ? 'enabled' : 'disabled'}`);
  }
};