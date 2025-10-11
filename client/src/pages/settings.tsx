import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Users, Shield, Globe, Smartphone, HelpCircle, Phone, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import BottomNavigation from "@/components/bottom-navigation";

interface User {
  id: number;
  name: string;
  tgUsername: string | null;
  img: string | null;
  trust: number;
  phone: string | null;
  email: string | null;
}

export default function SettingsScreen() {
  const { toast } = useToast();

  const { data: user } = useQuery<User>({
    queryKey: ['/api/auth/me']
  });

  // Get unread notifications count
  const { data: unreadCount } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    refetchInterval: 30000,
  });

  const handlePhoneClick = () => {
    toast({
      title: "Добавление телефона",
      description: "Функция будет доступна в ближайшее время",
    });
  };

  const handleEmailClick = () => {
    toast({
      title: "Добавление email",
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
      <div className="px-4 pt-8 space-y-4">
        {/* Compact User Profile Header - Avatar left, Username/Trust middle, Phone/Email right */}
        <div className="flex items-center gap-4 mb-6">
          {/* Avatar with notification badge and link */}
          <Link href="/notifications">
            <div className="relative">
              <div className="w-16 h-16 rounded-full overflow-hidden">
                <img 
                  src={user?.img || ""} 
                  alt="Profile Avatar" 
                  className="w-full h-full object-cover"
                  data-testid="profile-avatar"
                />
              </div>
              {unreadCount && unreadCount.count > 0 && (
                <>
                  {/* Ripple animation */}
                  <div className="absolute inset-0 rounded-full animate-ping bg-red-500/50" />
                  {/* Badge */}
                  <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center z-10" data-testid="notification-badge">
                    {unreadCount.count > 9 ? '9+' : unreadCount.count}
                  </div>
                </>
              )}
            </div>
          </Link>

          {/* Middle: Username and Trust */}
          <div className="flex-1">
            {/* Username row */}
            <h2 className="text-lg font-semibold text-white mb-2" data-testid="text-settings-username">
              {user?.name || "User"}
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

          {/* Right: Phone and Email */}
          <div className="flex flex-col gap-2 min-w-[200px]">
            {/* Phone row */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-green-200" />
                <span className="text-green-200 text-sm font-medium">Телефон</span>
              </div>
              {user?.phone ? (
                <span className="text-white text-sm" data-testid="text-phone-number">{user.phone}</span>
              ) : (
                <button 
                  onClick={handlePhoneClick}
                  className="text-accent text-xs px-3 py-1 border border-accent rounded-lg hover:bg-accent/10 transition-colors"
                  data-testid="button-add-phone"
                >
                  добавить
                </button>
              )}
            </div>
            
            {/* Email row */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-green-200" />
                <span className="text-green-200 text-sm font-medium">Email</span>
              </div>
              {user?.email ? (
                <span className="text-white text-sm" data-testid="text-email-value">{user.email}</span>
              ) : (
                <button 
                  onClick={handleEmailClick}
                  className="text-accent text-xs px-3 py-1 border border-accent rounded-lg hover:bg-accent/10 transition-colors"
                  data-testid="button-add-email"
                >
                  добавить
                </button>
              )}
            </div>
          </div>
        </div>

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
