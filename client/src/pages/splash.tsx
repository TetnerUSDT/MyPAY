import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import TelegramLoginButton from "@/components/TelegramLoginButton";

// Image from public directory - use direct URL
const swiftxCard = "/uploads/assets/swiftx-card.png";

export default function SplashScreen() {
  const [, setLocation] = useLocation();
  const [telegramWebApp, setTelegramWebApp] = useState<any>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isTelegramEnv, setIsTelegramEnv] = useState(false); // Telegram App environment detection
  
  // Fetch Telegram bot username for widget
  const { data: telegramConfig } = useQuery<{ botUsername: string; authMode: string }>({
    queryKey: ["/api/config/telegram-bot"],
  });
  
  // Initialize and authenticate - combined logic to avoid race conditions
  useEffect(() => {
    const initializeApp = async () => {
      // Check if running in Telegram WebApp
      if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
        const tg = (window as any).Telegram.WebApp;
        setTelegramWebApp(tg);
        
        console.log('🔍 Telegram WebApp detected:', {
          hasWebApp: !!tg,
          hasInitData: !!tg.initData,
          initDataLength: tg.initData?.length || 0,
          platform: tg.platform,
          version: tg.version
        });
        
        // Check if we have initData (means running inside Telegram App)
        if (tg.initData && tg.initData.length > 0) {
          console.log('✅ Running in Telegram Mini App with initData');
          setIsTelegramEnv(true);
          
          // Expand WebApp to full height
          tg.expand();
          
          // Set theme
          tg.setHeaderColor('#1a1a1a');
          tg.setBackgroundColor('#1a1a1a');
          
          // Always auto-authenticate in Telegram App to get fresh session
          handleTelegramAuth(tg.initData);
          return; // Stop here, wait for auth to complete
        } else {
          // Running in browser (no initData available)
          console.log('⚠️ Telegram WebApp detected but NO initData - running in browser mode');
          setIsTelegramEnv(false);
        }
      } else {
        // Not in Telegram environment at all (regular browser)
        console.log('ℹ️ Regular browser mode (no Telegram WebApp)');
        setIsTelegramEnv(false);
      }
      
      // Only check existing auth if NOT in Telegram Mini App
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

    initializeApp();
  }, [setLocation]);
  
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
      
      // In Telegram Mini App - don't auto redirect, show button instead
      // In browser - auto redirect as before
      if (!isTelegramEnv) {
        if (data.user.agreement === 0) {
          setLocation('/agreement');
        } else {
          setLocation('/home');
        }
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

  const handleTelegramWidgetAuth = (user: any) => {
    try {
      setAuthError(null);
      loginMutation.mutate({ widgetData: user });
    } catch (error) {
      setAuthError('Ошибка аутентификации через Telegram');
    }
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
  
  // If authenticated in Telegram Mini App, show button to proceed
  if (isTelegramEnv && loginMutation.isSuccess && loginMutation.data) {
    const needsAgreement = loginMutation.data.user.agreement === 0;
    
    return (
      <div className="mobile-screen gradient-bg text-white">
        <div className="flex flex-col items-center justify-center min-h-screen text-center px-6">
          
          {/* Main card with branding */}
          <div className="relative z-10 w-full max-w-sm mb-12">
            <img 
              src={swiftxCard} 
              alt="SwiftX Card" 
              className="w-full h-auto rounded-2xl shadow-2xl"
              data-testid="swiftx-card"
            />
          </div>
          
          <h2 className="text-2xl font-bold mb-4">Добро пожаловать!</h2>
          <p className="text-lg text-gray-300 mb-12">
            {loginMutation.data.user.name || 'Пользователь'}
          </p>
          
          <button 
            onClick={() => setLocation(needsAgreement ? '/agreement' : '/home')}
            className="action-button w-full max-w-sm"
            data-testid="button-proceed"
          >
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            {needsAgreement ? 'Перейти к соглашению' : 'Перейти в личный кабинет'}
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="mobile-screen gradient-bg text-white">
      <div className="flex flex-col items-center justify-center min-h-screen text-center px-6 relative">
        
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
          {/* Browser mode: Show Telegram Login Widget */}
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
        </div>
      </div>
    </div>
  );
}
