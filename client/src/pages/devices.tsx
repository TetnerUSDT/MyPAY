import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Smartphone, Monitor, Chrome, Clock, Shield } from "lucide-react";
import BottomNavigation from "@/components/bottom-navigation";

interface DeviceInfo {
  platform: string;
  userAgent: string;
  language: string;
  screenSize: string;
  telegramPlatform?: string;
  telegramVersion?: string;
  browser: string;
  os: string;
}

export default function DevicesScreen() {
  const [, setLocation] = useLocation();
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    const getBrowserName = (userAgent: string): string => {
      if (userAgent.includes("Chrome") && !userAgent.includes("Edg")) return "Chrome";
      if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) return "Safari";
      if (userAgent.includes("Firefox")) return "Firefox";
      if (userAgent.includes("Edg")) return "Edge";
      if (userAgent.includes("Opera") || userAgent.includes("OPR")) return "Opera";
      return "Unknown";
    };

    const getOSName = (userAgent: string): string => {
      if (userAgent.includes("Windows")) return "Windows";
      if (userAgent.includes("Mac")) return "macOS";
      if (userAgent.includes("Linux")) return "Linux";
      if (userAgent.includes("Android")) return "Android";
      if (userAgent.includes("iOS") || userAgent.includes("iPhone") || userAgent.includes("iPad")) return "iOS";
      return "Unknown";
    };

    const info: DeviceInfo = {
      platform: navigator.platform || "Unknown",
      userAgent: navigator.userAgent,
      language: navigator.language,
      screenSize: `${window.screen.width}x${window.screen.height}`,
      browser: getBrowserName(navigator.userAgent),
      os: getOSName(navigator.userAgent),
    };

    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
      const tg = (window as any).Telegram.WebApp;
      info.telegramPlatform = tg.platform || "unknown";
      info.telegramVersion = tg.version || "unknown";
    }

    setDeviceInfo(info);
    
    setCurrentTime(new Date().toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }));
  }, []);

  return (
    <div className="mobile-screen gradient-bg text-white pb-24">
      <div className="px-4 pt-6 space-y-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setLocation("/settings")}
            className="p-2 hover:bg-green-800/30 rounded-lg transition-colors"
            data-testid="button-back"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <h1 className="text-xl font-bold text-white" data-testid="text-page-title">
            Активные сессии
          </h1>
          <div className="w-10"></div>
        </div>

        <div className="space-y-4">
          <div className="crypto-card">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center shrink-0">
                {deviceInfo?.telegramPlatform ? (
                  <Smartphone className="w-6 h-6 text-accent" />
                ) : (
                  <Monitor className="w-6 h-6 text-accent" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold mb-1" data-testid="text-device-name">
                  Текущее устройство
                </h3>
                <p className="text-green-200 text-sm">Активно сейчас</p>
              </div>
              <div className="bg-accent/20 px-3 py-1 rounded-full">
                <span className="text-accent text-xs font-medium">Активно</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-green-800/30">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-green-200" />
                  <span className="text-green-200 text-sm">Платформа</span>
                </div>
                <span className="text-white text-sm font-medium" data-testid="text-platform">
                  {deviceInfo?.os || "Загрузка..."}
                </span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-green-800/30">
                <div className="flex items-center gap-2">
                  <Chrome className="w-4 h-4 text-green-200" />
                  <span className="text-green-200 text-sm">Браузер</span>
                </div>
                <span className="text-white text-sm font-medium" data-testid="text-browser">
                  {deviceInfo?.browser || "Загрузка..."}
                </span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-green-800/30">
                <div className="flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-green-200" />
                  <span className="text-green-200 text-sm">Разрешение</span>
                </div>
                <span className="text-white text-sm font-medium" data-testid="text-screen-size">
                  {deviceInfo?.screenSize || "Загрузка..."}
                </span>
              </div>

              {deviceInfo?.telegramPlatform && (
                <>
                  <div className="flex items-center justify-between py-2 border-b border-green-800/30">
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-green-200" />
                      <span className="text-green-200 text-sm">Telegram</span>
                    </div>
                    <span className="text-white text-sm font-medium" data-testid="text-telegram-platform">
                      {deviceInfo.telegramPlatform}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2 border-b border-green-800/30">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-green-200" />
                      <span className="text-green-200 text-sm">Версия WebApp</span>
                    </div>
                    <span className="text-white text-sm font-medium" data-testid="text-telegram-version">
                      {deviceInfo.telegramVersion}
                    </span>
                  </div>
                </>
              )}

              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-green-200" />
                  <span className="text-green-200 text-sm">Последняя активность</span>
                </div>
                <span className="text-white text-sm font-medium" data-testid="text-last-activity">
                  {currentTime}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-green-800/20 border border-green-600/30 rounded-lg p-4">
            <p className="text-green-200 text-sm leading-relaxed">
              <span className="font-semibold text-white">Информация о безопасности:</span> В настоящее время система поддерживает только одну активную сессию на устройство. Для дополнительной безопасности рекомендуем не передавать доступ к аккаунту третьим лицам.
            </p>
          </div>
        </div>
      </div>

      <BottomNavigation />
    </div>
  );
}
