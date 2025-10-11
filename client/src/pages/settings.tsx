import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Users, Shield, Globe, Smartphone, HelpCircle, Phone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import BottomNavigation from "@/components/bottom-navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { queryClient, apiRequest } from "@/lib/queryClient";

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

  // Get unread notifications count
  const { data: unreadCount } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    refetchInterval: 30000,
  });

  const [isPhoneDialogOpen, setIsPhoneDialogOpen] = useState(false);
  const [phoneValue, setPhoneValue] = useState<string>("");

  const handlePhoneClick = () => {
    setIsPhoneDialogOpen(true);
  };

  const updatePhoneMutation = useMutation({
    mutationFn: async (phone: string) => {
      return await apiRequest("PATCH", "/api/user/phone", { phone });
    },
    onSuccess: () => {
      // Force refetch to avoid 304 caching issue
      queryClient.refetchQueries({ queryKey: ['/api/auth/me'], type: 'active' });
      setIsPhoneDialogOpen(false);
      setPhoneValue("");
      toast({
        title: "Успешно!",
        description: "Телефон успешно сохранен",
      });
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить телефон",
        variant: "destructive",
      });
    },
  });

  const handleSavePhone = () => {
    if (!phoneValue) {
      toast({
        title: "Ошибка",
        description: "Введите номер телефона",
        variant: "destructive",
      });
      return;
    }
    updatePhoneMutation.mutate(phoneValue);
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
        {/* Compact User Profile Header - Avatar left, Username/Trust middle (75%), Phone/Email right (25%) */}
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

          {/* Middle: Username and Trust - 75% width */}
          <div className="flex-[3]">
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

          {/* Right: Phone block with border - 25% width */}
          <div className="flex-[1] border border-green-500/40 rounded-lg" style={{ padding: '0.8rem 1.0rem' }}>
            <div className="flex flex-col gap-2">
              {/* Phone label row */}
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-green-200" />
                <span className="text-green-200 text-sm font-medium">Телефон</span>
              </div>
              
              {/* Phone value or add button row */}
              {user?.phone ? (
                <span className="text-white text-sm" data-testid="text-phone-number">{user.phone}</span>
              ) : (
                <button 
                  onClick={handlePhoneClick}
                  className="w-full text-accent text-sm py-1 border border-accent hover:bg-accent/10 transition-colors"
                  style={{ borderRadius: '0.5rem' }}
                  data-testid="button-add-phone"
                >
                  Добавить
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

      {/* Phone Input Dialog */}
      <Dialog open={isPhoneDialogOpen} onOpenChange={setIsPhoneDialogOpen}>
        <DialogContent className="sm:max-w-md bg-gradient-to-br from-green-800 to-green-900 border-green-600/50 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Добавить номер телефона</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm text-green-200">Номер телефона</label>
              <PhoneInput
                international
                defaultCountry="RU"
                value={phoneValue}
                onChange={(value) => setPhoneValue(value || "")}
                className="phone-input-custom"
                placeholder="Введите номер телефона"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              onClick={handleSavePhone}
              disabled={updatePhoneMutation.isPending}
              className="w-full bg-accent hover:bg-accent/90 text-secondary"
            >
              {updatePhoneMutation.isPending ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
}
