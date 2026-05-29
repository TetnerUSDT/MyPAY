import { useLocation } from "wouter";
import { useEffect, useState, lazy, Suspense } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

const logo1 = "/uploads/assets/logo-1.webp";
const logo2 = "/uploads/assets/logo-2.webp";
const logo3 = "/uploads/assets/logo-3.webp";

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

        {/* Logo / branding — 3 layered images with rotation animations */}
        <div className="relative z-10 w-56 mb-8" style={{ aspectRatio: "1 / 1" }}>
          <img
            src={logo1}
            alt="SwiftX"
            className="absolute inset-0 w-full h-full object-contain animate-glitch-logo1"
          />
          <img
            src={logo2}
            alt=""
            className="absolute inset-0 w-full h-full object-contain animate-spin-cw-85"
          />
          <img
            src={logo3}
            alt=""
            className="absolute inset-0 w-full h-full object-contain animate-spin-ccw"
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
            <p className="text-sm text-white/50">{TXT.loggingIn}</p>
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
