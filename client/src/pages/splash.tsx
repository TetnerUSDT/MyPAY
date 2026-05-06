import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiRequest } from "@/lib/queryClient";
import TelegramLoginButton from "@/components/TelegramLoginButton";

const swiftxCard = "/uploads/assets/start-bg.webp";

export default function SplashScreen() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [isTelegramEnv, setIsTelegramEnv] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Fetch bot username for browser login widget
  const { data: telegramConfig } = useQuery<{ botUsername: string; authMode: string }>({
    queryKey: ["/api/config/telegram-bot"],
  });

  const loginMutation = useMutation({
    mutationFn: async (authData: { initData?: string; widgetData?: any }) => {
      const response = await apiRequest('POST', '/api/auth/login', authData);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.apiKey) {
        localStorage.setItem('userApiKey', data.apiKey);
      }
      // Always auto-redirect — no intermediate "proceed" button
      if (data.user.agreement === 0) {
        setLocation('/agreement');
      } else {
        setLocation('/home');
      }
    },
    onError: () => {
      setAuthError(t('splash.authError'));
    },
  });

  useEffect(() => {
    const init = async () => {
      const tg = (window as any).Telegram?.WebApp;

      if (tg?.initData && tg.initData.length > 0) {
        // Running inside Telegram Mini App
        setIsTelegramEnv(true);
        tg.expand();
        tg.setHeaderColor('#1a1a1a');
        tg.setBackgroundColor('#1a1a1a');
        loginMutation.mutate({ initData: tg.initData });
        return;
      }

      // Browser mode — check for existing session first
      const existingKey = localStorage.getItem('userApiKey');
      if (existingKey) {
        try {
          const res = await apiRequest('GET', '/api/auth/me');
          const user = await res.json();
          setLocation(user.agreement === 1 ? '/home' : '/agreement');
          return;
        } catch {
          localStorage.removeItem('userApiKey');
        }
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTelegramWidgetAuth = (user: any) => {
    setAuthError(null);
    loginMutation.mutate({ widgetData: user });
  };

  return (
    <div className="mobile-screen gradient-bg text-white">
      <div className="flex flex-col items-center justify-center min-h-screen text-center px-6 relative">

        {/* Logo / branding — always visible immediately */}
        <div className="relative z-10 w-full max-w-sm mb-12">
          <img
            src={swiftxCard}
            alt="MyPay"
            className="w-full h-auto"
          />
        </div>

        {authError && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-200 text-sm">
            {authError}
          </div>
        )}

        {/* While authenticating in Telegram — show a subtle inline spinner */}
        {loginMutation.isPending && (
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-green-400 animate-spin" />
            <p className="text-sm text-white/50">{t('splash.loggingIn')}</p>
          </div>
        )}

        {/* Browser mode — show Telegram Login Widget */}
        {!isTelegramEnv && !loginMutation.isPending && (
          <div className="w-full max-w-sm space-y-4">
            {telegramConfig?.botUsername ? (
              <div className="flex justify-center">
                <TelegramLoginButton
                  botUsername={telegramConfig.botUsername}
                  onAuth={handleTelegramWidgetAuth}
                  buttonSize="large"
                  lang="ru"
                />
              </div>
            ) : (
              <p className="text-sm text-white/50">{t('splash.loading')}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
