import { useLocation } from "wouter";
import { Bitcoin, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import swiftxCard from "@assets/group (2)_1758368274951.png";

export default function SplashScreen() {
  const [, setLocation] = useLocation();
  const [telegramWebApp, setTelegramWebApp] = useState<any>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  
  // Initialize Telegram WebApp
  useEffect(() => {
    // Check if running in Telegram WebApp
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
      const tg = (window as any).Telegram.WebApp;
      setTelegramWebApp(tg);
      
      // Expand WebApp to full height
      tg.expand();
      
      // Set theme
      tg.setHeaderColor('#1a1a1a');
      tg.setBackgroundColor('#1a1a1a');
      
      // Auto-authenticate if running in Telegram
      if (tg.initData) {
        handleTelegramAuth(tg.initData);
      }
    }
  }, []);
  
  // Mutation for Telegram authentication
  const telegramAuthMutation = useMutation({
    mutationFn: async (initData: string) => {
      const response = await apiRequest('POST', '/api/auth/telegram', {
        initData
      });
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
      console.error('Telegram auth failed:', error);
    },
  });
  
  const handleTelegramAuth = async (initData: string) => {
    try {
      telegramAuthMutation.mutate(initData);
    } catch (error) {
      setAuthError('Ошибка аутентификации');
    }
  };
  
  const handleManualStart = () => {
    // For development or when not in Telegram
    setLocation('/agreement');
  };
  
  // If authenticating via Telegram, show loading
  if (telegramAuthMutation.isPending) {
    return (
      <div className="mobile-screen gradient-bg text-white">
        <div className="flex flex-col items-center justify-center min-h-screen text-center px-6">
          <Loader2 className="w-12 h-12 mb-6 animate-spin" />
          <h2 className="text-xl font-semibold mb-2">Вход через Telegram</h2>
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
        
        {telegramWebApp ? (
          <div className="w-full max-w-sm space-y-4">
            <p className="text-sm text-gray-300 mb-4">
              Добро пожаловать в Telegram Mini App!
            </p>
            {!telegramWebApp.initData && (
              <button 
                onClick={handleManualStart}
                className="action-button"
                data-testid="button-start-telegram"
              >
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Продолжить
              </button>
            )}
          </div>
        ) : (
          <button 
            onClick={handleManualStart}
            className="action-button w-full max-w-sm"
            data-testid="button-start-agreement"
          >
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Перейти к соглашению
          </button>
        )}
      </div>
    </div>
  );
}
