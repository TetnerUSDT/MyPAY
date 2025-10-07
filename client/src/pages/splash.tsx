import { useLocation } from "wouter";
import { Bitcoin, Loader2, User } from "lucide-react";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import swiftxCard from "@assets/group (2)_1758368274951.png";
import TelegramLoginButton from "@/components/TelegramLoginButton";

export default function SplashScreen() {
  const [, setLocation] = useLocation();
  const [telegramWebApp, setTelegramWebApp] = useState<any>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showTestMode, setShowTestMode] = useState(false);
  const [testName, setTestName] = useState('');
  const [isTelegramEnv, setIsTelegramEnv] = useState(false); // Telegram App environment detection
  
  // Fetch Telegram bot username for widget
  const { data: telegramConfig } = useQuery<{ botUsername: string; authMode: string }>({
    queryKey: ["/api/config/telegram-bot"],
  });
  
  // Check existing authentication on mount
  useEffect(() => {
    const checkExistingAuth = async () => {
      const existingApiKey = localStorage.getItem('userApiKey');
      if (existingApiKey) {
        try {
          const response = await apiRequest('GET', '/api/auth/me');
          const userData = await response.json();
          
          if (userData.agreement === 1) {
            setLocation('/home');
            return;
          } else if (userData.agreement === 0) {
            setLocation('/agreement'); 
            return;
          }
        } catch (error) {
          // API key is invalid, remove it
          localStorage.removeItem('userApiKey');
        }
      }
    };

    checkExistingAuth();
  }, [setLocation]);

  // Initialize Telegram WebApp and detect environment
  useEffect(() => {
    // Check if running in Telegram WebApp
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
      const tg = (window as any).Telegram.WebApp;
      setTelegramWebApp(tg);
      
      // Check if we have initData (means running inside Telegram App)
      if (tg.initData) {
        setIsTelegramEnv(true);
        
        // Expand WebApp to full height
        tg.expand();
        
        // Set theme
        tg.setHeaderColor('#1a1a1a');
        tg.setBackgroundColor('#1a1a1a');
        
        // Auto-authenticate if running in Telegram and no existing auth
        if (!localStorage.getItem('userApiKey')) {
          handleTelegramAuth(tg.initData);
        }
      } else {
        // Running in browser (no initData available)
        setIsTelegramEnv(false);
      }
    } else {
      // Not in Telegram environment at all (regular browser)
      setIsTelegramEnv(false);
    }
  }, []);
  
  // Unified authentication mutation that works with both modes
  const loginMutation = useMutation({
    mutationFn: async (authData: { initData?: string; widgetData?: any; name?: string }) => {
      const response = await apiRequest('POST', '/api/auth/login', authData);
      return response.json();
    },
    onSuccess: (data) => {
      // Store API key for future requests
      if (data.apiKey) {
        localStorage.setItem('userApiKey', data.apiKey);
      }
      
      // Check if user needs to agree to terms
      if (data.user.agreement === 0) {
        setLocation('/agreement');
      } else {
        setLocation('/home');
      }
    },
    onError: (error) => {
      setAuthError('Ошибка аутентификации. Попробуйте позже.');
      console.error('Auth failed:', error);
    },
  });
  
  const handleTelegramAuth = async (initData: string) => {
    try {
      loginMutation.mutate({ initData });
    } catch (error) {
      setAuthError('Ошибка аутентификации');
    }
  };

  const handleTestAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (testName.trim()) {
      setAuthError(null);
      loginMutation.mutate({ name: testName.trim() });
    }
  };

  const handleTelegramWidgetAuth = (user: any) => {
    try {
      setAuthError(null);
      loginMutation.mutate({ widgetData: user });
    } catch (error) {
      setAuthError('Ошибка аутентификации через Telegram');
    }
  };
  
  const handleManualStart = () => {
    // For development or when not in Telegram - redirect to test mode instead
    setShowTestMode(true);
  };
  
  // If authenticating, show loading
  if (loginMutation.isPending) {
    return (
      <div className="mobile-screen gradient-bg text-white">
        <div className="flex flex-col items-center justify-center min-h-screen text-center px-6">
          <Loader2 className="w-12 h-12 mb-6 animate-spin" />
          <h2 className="text-xl font-semibold mb-2">Вход в систему</h2>
          <p className="text-sm text-gray-300">Проверяем ваши данные...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="mobile-screen gradient-bg text-white">
      <div className="flex flex-col items-center justify-center min-h-screen text-center px-6 relative">
        {/* Floating cards background effect */}
        <div className="absolute top-20 left-8 w-32 h-20 glass-effect rounded-xl opacity-50 transform rotate-12"></div>
        <div className="absolute top-32 right-12 w-24 h-16 glass-effect rounded-xl opacity-40 transform -rotate-6"></div>
        <div className="absolute bottom-40 left-16 w-28 h-18 glass-effect rounded-xl opacity-30 transform rotate-6"></div>
        
        {/* Main card with branding */}
        <div className="relative z-10 w-full max-w-sm mb-12">
          <img 
            src={swiftxCard} 
            alt="SwiftX Card" 
            className="w-full h-auto rounded-2xl shadow-2xl"
            data-testid="swiftx-card"
          />
        </div>
        
        <h2 className="text-2xl font-bold mb-4">Быстрый и надежный</h2>
        <h3 className="text-xl font-semibold mb-12">обмен криптовалют</h3>
        
        {authError && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-200 text-sm">
            {authError}
          </div>
        )}
        
        <div className="w-full max-w-sm space-y-4">
          {telegramWebApp && !showTestMode ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-300 mb-4">
                Добро пожаловать в Telegram Mini App!
              </p>
              {!telegramWebApp.initData && (
                <button 
                  onClick={handleManualStart}
                  className="action-button w-full"
                  data-testid="button-start-telegram"
                >
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Продолжить
                </button>
              )}
              {import.meta.env.DEV && (
                <button 
                  onClick={() => setShowTestMode(true)}
                  className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors text-sm"
                  data-testid="button-switch-test-mode"
                >
                  <User className="w-4 h-4 mr-2 inline" />
                  Тестовый режим
                </button>
              )}
            </div>
          ) : showTestMode ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-300 mb-4">
                Тестовый вход для разработки
              </p>
              <form onSubmit={handleTestAuth} className="space-y-4">
                <input
                  type="text"
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                  placeholder="Введите ваше имя"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  data-testid="input-test-name"
                  required
                />
                <button 
                  type="submit"
                  className="action-button w-full"
                  data-testid="button-test-login"
                  disabled={!testName.trim()}
                >
                  <User className="w-5 h-5 mr-2" />
                  Войти в тестовом режиме
                </button>
              </form>
              <button 
                onClick={() => {setShowTestMode(false); setTestName(''); setAuthError(null);}}
                className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors text-sm"
                data-testid="button-back-to-main"
              >
                Назад
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Browser mode: Show Telegram Login Widget or Test mode */}
              {import.meta.env.DEV ? (
                <>
                  {telegramConfig?.botUsername && (
                    <div className="flex justify-center" data-testid="telegram-widget-container">
                      <TelegramLoginButton
                        botUsername={telegramConfig.botUsername}
                        onAuth={handleTelegramWidgetAuth}
                        buttonSize="large"
                        lang="ru"
                      />
                    </div>
                  )}
                  <button 
                    onClick={handleManualStart}
                    className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors text-sm"
                    data-testid="button-start-test"
                  >
                    <User className="w-4 h-4 mr-2 inline" />
                    Тестовый режим
                  </button>
                </>
              ) : (
                <>
                  {telegramConfig?.botUsername ? (
                    <div className="flex justify-center" data-testid="telegram-widget-container">
                      <TelegramLoginButton
                        botUsername={telegramConfig.botUsername}
                        onAuth={handleTelegramWidgetAuth}
                        buttonSize="large"
                        lang="ru"
                      />
                    </div>
                  ) : (
                    <div className="text-sm text-gray-300">
                      Загрузка...
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
