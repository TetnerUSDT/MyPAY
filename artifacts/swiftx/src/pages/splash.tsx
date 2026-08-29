import { useLocation } from "wouter";
import { useEffect, useState, lazy, Suspense } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { UnifiedPreloader } from "@/components/UnifiedPreloader";

// Telegram widget is heavy (loads external script). Only needed in browser mode,
// AFTER we know the bot username — lazy-load to keep splash bundle minimal.
const TelegramLoginButton = lazy(() => import("@/components/TelegramLoginButton"));

// Hardcoded splash strings — splash must render BEFORE i18n loads.
const TXT = {
  authError: "Ошибка авторизации. Попробуйте ещё раз.",
  loggingIn: "Вход...",
  loading: "Загрузка...",
};

export default function SplashScreen() {
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
      setAuthError(TXT.authError);
    },
  });

  useEffect(() => {
    let triggered = false;
    const tryTelegram = () => {
      if (triggered) return true;
      const tg = (window as any).Telegram?.WebApp;
      if (tg?.initData && tg.initData.length > 0) {
        triggered = true;
        setIsTelegramEnv(true);
        try {
          tg.expand();
          tg.setHeaderColor('#1a1a1a');
          tg.setBackgroundColor('#1a1a1a');
        } catch {}
        loginMutation.mutate({ initData: tg.initData });
        return true;
      }
      return false;
    };

    const init = async () => {
      // Telegram script is now loaded async — may not be ready yet. Poll briefly.
      if (tryTelegram()) return;

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

      // Poll for Telegram script for up to 2 seconds (covers async script load)
      let attempts = 0;
      const poll = setInterval(() => {
        attempts++;
        if (tryTelegram() || attempts >= 20) clearInterval(poll);
      }, 100);
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
      {/* Grid centered on splash page */}
      <div className="splash-grid" />
      <div className="flex flex-col items-center justify-center min-h-screen text-center px-6 relative">

        {/* Shared auth/loading visual — only one instance is mounted at a time. */}
        <UnifiedPreloader
          fullscreen={false}
          size="lg"
          label={loginMutation.isPending ? TXT.loggingIn : undefined}
          className="mb-8"
        />

        {authError && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-200 text-sm">
            {authError}
          </div>
        )}

        {/* Browser mode — show Telegram Login Widget */}
        {!isTelegramEnv && !loginMutation.isPending && (
          <div className="w-full max-w-sm space-y-4">
            {telegramConfig?.botUsername ? (
              <Suspense fallback={<p className="text-sm text-white/50">{TXT.loading}</p>}>
                <div className="flex justify-center">
                  <TelegramLoginButton
                    botUsername={telegramConfig.botUsername}
                    onAuth={handleTelegramWidgetAuth}
                    buttonSize="large"
                    lang="ru"
                  />
                </div>
              </Suspense>
            ) : (
              <p className="text-sm text-white/50">{TXT.loading}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
