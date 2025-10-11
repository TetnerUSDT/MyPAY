import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Phone, Users, Shield, Globe, Smartphone, HelpCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import BottomNavigation from "@/components/bottom-navigation";

interface User {
  id: number;
  name: string;
  tgUsername: string | null;
  img: string | null;
  trust: number;
  phone: string | null;
}

export default function SettingsScreen() {
  const { toast } = useToast();

  const { data: user } = useQuery<User>({
    queryKey: ['/api/auth/me']
  });

  const { data: unreadCount = 0 } = useQuery<number>({
    queryKey: ['/api/notifications/unread-count'],
    select: (data: any) => data?.count || 0,
    refetchInterval: 30000
  });

  const handlePhoneClick = () => {
    toast({
      title: "Добавление телефона",
      description: "Функция будет доступна в ближайшее время",
    });
  };

  const handleLoyaltyClick = () => {
    toast({
      title: "Программа лояльности",
      description: "Зарабатывайте приглашая друзей",
    });
  };

  const handleSecurityClick = () => {
    toast({
      title: "Безопасность",
      description: "Настройки безопасности будут доступны скоро",
    });
  };

  const handleLanguageClick = () => {
    toast({
      title: "Языки",
      description: "Выбор языка будет доступен в следующей версии",
    });
  };

  const handleDevicesClick = () => {
    toast({
      title: "Устройства",
      description: "Управление сессиями будет доступно скоро",
    });
  };

  return (
    <div className="mobile-screen gradient-bg text-white pb-24">
      {/* Title */}
      <div className="text-center pt-8 pb-6">
        <h1 className="text-xl font-semibold" data-testid="text-settings-title">
          Настройки
        </h1>
      </div>

      <div className="px-4 space-y-4">
        {/* Compact User Profile Header - Avatar left, Username and Trust right */}
        <div className="flex items-center gap-4 mb-6">
          {/* Avatar with notification badge and link */}
          <Link href="/notifications">
            <div className="relative cursor-pointer">
              <div className="w-20 h-20 rounded-full overflow-hidden">
                {user?.img ? (
                  <img 
                    src={user.img} 
                    alt={user.name || "User"} 
                    className="w-full h-full object-cover"
                    data-testid="img-user-avatar-settings"
                  />
                ) : (
                  <div className="w-full h-full rounded-full bg-accent flex items-center justify-center text-2xl font-bold">
                    {user?.name?.[0]?.toUpperCase() || "U"}
                  </div>
                )}
              </div>
              
              {/* Ripple animation and notification badge */}
              {unreadCount > 0 && (
                <>
                  {/* Ripple animation on avatar */}
                  <div className="absolute inset-0 rounded-full animate-ping bg-accent/50" />
                  {/* Badge */}
                  <div className="absolute -top-1 -right-1 bg-accent text-secondary font-bold rounded-full w-6 h-6 flex items-center justify-center text-xs border-2 border-secondary z-10" data-testid="notification-badge-settings">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </div>
                </>
              )}
            </div>
          </Link>

          {/* Username and Trust - 2 rows on the right */}
          <div className="flex-1">
            {/* Username row */}
            <h2 className="text-lg font-semibold text-white mb-2" data-testid="text-settings-username">
              @{user?.tgUsername || "username"}
            </h2>
            
            {/* Trust row - compact */}
            <div className="flex items-center gap-2">
              <span className="text-green-200 text-sm font-medium">Trust</span>
              <div className="bg-green-900/50 border border-green-500/50 rounded-lg px-3 py-1">
                <span className="text-lg font-bold text-accent" data-testid="text-trust-value">
                  {user?.trust || 0}
                </span>
              </div>
              <button 
                className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center"
                onClick={() => toast({ title: "Trust Rating", description: "Рейтинг доверия основан на вашей активности" })}
                data-testid="button-trust-info"
              >
                <HelpCircle className="w-4 h-4 text-accent" />
              </button>
            </div>
          </div>
        </div>

        {/* Phone Section */}
        <button
          onClick={handlePhoneClick}
          className="w-full bg-gradient-to-r from-green-700/60 to-green-800/60 rounded-xl p-4 border border-green-500/40 backdrop-blur-sm hover:from-green-700/70 hover:to-green-800/70 transition-all"
          data-testid="button-phone-settings"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center">
              <Phone className="w-6 h-6 text-accent" />
            </div>
            <div className="flex-1 text-left">
              <h3 className="text-white font-semibold mb-1">Телефон</h3>
              <p className="text-green-200 text-sm">
                {user?.phone || "Не указан"}
              </p>
            </div>
            {!user?.phone && (
              <div className="px-4 py-2 rounded-lg border-2 border-accent">
                <span className="text-accent font-medium">Указать</span>
              </div>
            )}
          </div>
        </button>

        {/* Loyalty Program */}
        <button
          onClick={handleLoyaltyClick}
          className="w-full bg-gradient-to-r from-green-700/60 to-green-800/60 rounded-xl p-4 border border-green-500/40 backdrop-blur-sm hover:from-green-700/70 hover:to-green-800/70 transition-all"
          data-testid="button-loyalty-settings"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center">
              <Users className="w-6 h-6 text-accent" />
            </div>
            <div className="flex-1 text-left">
              <h3 className="text-white font-semibold mb-1">Программа лояльности</h3>
              <p className="text-green-200 text-sm">Зарабатывай приглашая друзей</p>
            </div>
          </div>
        </button>

        {/* Security */}
        <button
          onClick={handleSecurityClick}
          className="w-full bg-gradient-to-r from-green-700/60 to-green-800/60 rounded-xl p-4 border border-green-500/40 backdrop-blur-sm hover:from-green-700/70 hover:to-green-800/70 transition-all"
          data-testid="button-security-settings"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center">
              <Shield className="w-6 h-6 text-accent" />
            </div>
            <div className="flex-1 text-left">
              <h3 className="text-white font-semibold mb-1">Безопасность</h3>
              <p className="text-green-200 text-sm">Повышайте безопасность аккаунта</p>
            </div>
            <span className="text-sm text-accent font-medium">Средний уровень</span>
          </div>
        </button>

        {/* Languages */}
        <button
          onClick={handleLanguageClick}
          className="w-full bg-gradient-to-r from-green-700/60 to-green-800/60 rounded-xl p-4 border border-green-500/40 backdrop-blur-sm hover:from-green-700/70 hover:to-green-800/70 transition-all"
          data-testid="button-language-settings"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center">
              <Globe className="w-6 h-6 text-accent" />
            </div>
            <div className="flex-1 text-left">
              <h3 className="text-white font-semibold mb-1">Языки</h3>
              <p className="text-green-200 text-sm">Выберите язык для смены</p>
            </div>
            <span className="text-sm text-accent font-medium">Русский</span>
          </div>
        </button>

        {/* Devices */}
        <button
          onClick={handleDevicesClick}
          className="w-full bg-gradient-to-r from-green-700/60 to-green-800/60 rounded-xl p-4 border border-green-500/40 backdrop-blur-sm hover:from-green-700/70 hover:to-green-800/70 transition-all"
          data-testid="button-devices-settings"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center">
              <Smartphone className="w-6 h-6 text-accent" />
            </div>
            <div className="flex-1 text-left">
              <h3 className="text-white font-semibold mb-1">Устройства</h3>
              <p className="text-green-200 text-sm">Проверяйте активные сессии</p>
            </div>
          </div>
        </button>
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
}
