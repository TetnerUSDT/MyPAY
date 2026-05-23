import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Users, Shield, Globe, Smartphone, HelpCircle, Phone, Headphones, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
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

const languages = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
];

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);

  const { data: user } = useQuery<User>({
    queryKey: ['/api/auth/me']
  });

  // Get unread notifications count
  const { data: unreadCount } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    refetchInterval: 60000,
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
    onSuccess: (data, phone) => {
      // Directly update the cache with new phone number
      queryClient.setQueryData(['/api/auth/me'], (oldData: User | undefined) => {
        if (!oldData) return oldData;
        return { ...oldData, phone };
      });
      setIsPhoneDialogOpen(false);
      setPhoneValue("");
      toast({
        title: t('common.success'),
        description: t('settings.phoneSuccess'),
      });
    },
    onError: () => {
      toast({
        title: t('common.error'),
        description: t('settings.phoneError'),
        variant: "destructive",
      });
    },
  });

  const handleSavePhone = () => {
    if (!phoneValue) {
      toast({
        title: t('common.error'),
        description: t('settings.enterPhone'),
        variant: "destructive",
      });
      return;
    }
    updatePhoneMutation.mutate(phoneValue);
  };

  const handleChangeLanguage = (langCode: string) => {
    i18n.changeLanguage(langCode);
    setIsLanguageModalOpen(false);
    toast({
      title: t('common.success'),
      description: languages.find(l => l.code === langCode)?.name,
    });
  };

  const currentLanguage = languages.find(l => l.code === i18n.language) || languages[0];

  const handleLoyaltyClick = () => {
    setLocation("/loyalty");
  };

  const handleSecurityClick = () => {
    setLocation("/settings/security");
  };

  const handleLanguageClick = () => {
    setIsLanguageModalOpen(true);
  };

  const handleDevicesClick = () => {
    setLocation("/devices");
  };

  const handleSupportClick = () => {
    setLocation("/support");
  };

  return (
    <div className="mobile-screen gradient-bg text-white pb-24">
      <div className="px-4 pt-4 space-y-3">
        {/* Compact User Profile Header - Avatar left, Username/Trust middle (75%), Phone/Email right (25%) */}
        <div className="flex items-center gap-4">
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
              <div className="bg-secondary/50 border border-primary/20 rounded-lg px-3 py-1">
                <span className="text-lg font-bold text-accent" data-testid="text-trust-value">
                  {user?.trust || 0}
                </span>
              </div>
              <button 
                className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center"
                onClick={() => toast({ title: t('settings.trustRating'), description: t('settings.trustRatingDesc') })}
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
                <span className="text-green-200 text-sm font-medium">{t('settings.phone')}</span>
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
                  {t('settings.addPhone')}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Loyalty Program */}
        <button
          onClick={handleLoyaltyClick}
          className="w-full crypto-card !p-3 hover:opacity-90 transition-all"
          data-testid="button-loyalty-settings"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center shrink-0">
              <Users className="w-6 h-6 text-accent" />
            </div>
            <div className="flex-1 flex flex-col gap-0.5">
              <h3 className="text-white font-semibold text-left text-sm">{t('settings.loyaltyProgram')}</h3>
              <p className="text-green-200 text-xs text-left">{t('settings.loyaltyDesc')}</p>
            </div>
          </div>
        </button>

        {/* Security */}
        <button
          onClick={handleSecurityClick}
          className="w-full crypto-card !p-3 hover:opacity-90 transition-all"
          data-testid="button-security-settings"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center shrink-0">
              <Shield className="w-6 h-6 text-accent" />
            </div>
            <div className="flex-1 flex flex-col gap-0.5">
              <div className="flex items-center justify-between w-full">
                <h3 className="text-white font-semibold text-left text-sm">{t('settings.security')}</h3>
                <span className="text-xs text-accent font-medium">{t('settings.securityLevel')}</span>
              </div>
              <p className="text-green-200 text-xs text-left">{t('settings.securityDesc')}</p>
            </div>
          </div>
        </button>

        {/* Languages */}
        <button
          onClick={handleLanguageClick}
          className="w-full crypto-card !p-3 hover:opacity-90 transition-all"
          data-testid="button-language-settings"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center shrink-0">
              <Globe className="w-6 h-6 text-accent" />
            </div>
            <div className="flex-1 flex flex-col gap-0.5">
              <div className="flex items-center justify-between w-full">
                <h3 className="text-white font-semibold text-left text-sm">{t('settings.language')}</h3>
                <span className="text-xs text-accent font-medium">{currentLanguage.flag} {currentLanguage.name}</span>
              </div>
              <p className="text-green-200 text-xs text-left">{t('settings.languageDesc')}</p>
            </div>
          </div>
        </button>

        {/* Devices */}
        <button
          onClick={handleDevicesClick}
          className="w-full crypto-card !p-3 hover:opacity-90 transition-all"
          data-testid="button-devices-settings"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center shrink-0">
              <Smartphone className="w-6 h-6 text-accent" />
            </div>
            <div className="flex-1 flex flex-col gap-0.5">
              <h3 className="text-white font-semibold text-left text-sm">{t('settings.devices')}</h3>
              <p className="text-green-200 text-xs text-left">{t('settings.devicesDesc')}</p>
            </div>
          </div>
        </button>

        {/* Support - Separate block */}
        <div className="pt-2 border-t border-green-500/20">
          <button
            onClick={handleSupportClick}
            className="w-full crypto-card !p-3 hover:opacity-90 transition-all"
            data-testid="button-support-settings"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center shrink-0">
                <Headphones className="w-6 h-6 text-accent" />
              </div>
              <div className="flex-1 flex flex-col gap-0.5">
                <h3 className="text-white font-semibold text-left text-sm">{t('settings.support')}</h3>
                <p className="text-green-200 text-xs text-left">{t('settings.supportDesc')}</p>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Phone Input Dialog */}
      <Dialog open={isPhoneDialogOpen} onOpenChange={setIsPhoneDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border text-white">
          <DialogHeader>
            <DialogTitle className="text-white">{t('settings.phone')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm text-green-200">{t('settings.phone')}</label>
              <PhoneInput
                international
                defaultCountry="RU"
                value={phoneValue}
                onChange={(value) => setPhoneValue(value || "")}
                className="phone-input-custom"
                placeholder={t('settings.enterPhone')}
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
              {updatePhoneMutation.isPending ? t('common.loading') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Language Selection Modal */}
      <Dialog open={isLanguageModalOpen} onOpenChange={setIsLanguageModalOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border text-white">
          <DialogHeader>
            <DialogTitle className="text-white">{t('settings.language')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-4">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleChangeLanguage(lang.code)}
                className={`w-full flex items-center justify-between p-4 rounded-xl transition-all ${
                  i18n.language === lang.code 
                    ? 'bg-accent/20 border border-accent' 
                    : 'bg-black/20 hover:bg-black/30'
                }`}
                data-testid={`language-${lang.code}`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{lang.flag}</span>
                  <span className="text-white font-medium">{lang.name}</span>
                </div>
                {i18n.language === lang.code && (
                  <Check className="w-5 h-5 text-accent" />
                )}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
}
