import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Users, Shield, Globe, Smartphone, HelpCircle, Phone, Headphones, Check, ChevronRight, ChevronLeft } from "lucide-react";
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
  { code: 'en', name: 'English', flag: '🇬🇧', flagUrl: 'https://flagcdn.com/w40/gb.png' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺', flagUrl: 'https://flagcdn.com/w40/ru.png' },
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
    <div className="min-h-screen bg-[#0B0C10] text-[#E2E8F0] pb-28 font-sans selection:bg-[#3ab368]/30 selection:text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-6 pb-2">
        <Link href="/home">
          <button className="w-10 h-10 rounded-full bg-white/5 border border-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
            <ChevronLeft className="w-5 h-5 text-white/70" />
          </button>
        </Link>
        <h1 className="text-[17px] font-semibold tracking-tight text-white">{t('settings.settings', 'Settings')}</h1>
        <div className="w-10 h-10" />
      </div>

      <div className="px-5 space-y-4 mt-2">
        {/* Profile Card */}
        <div className="rounded-3xl bg-[#13151A] border border-white/5 p-5 shadow-2xl shadow-black/40 relative z-0">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <Link href="/notifications">
              <div className="relative cursor-pointer shrink-0">
                <div className={`w-16 h-16 rounded-full overflow-hidden border-2 ${unreadCount && unreadCount.count > 0 ? 'border-red-500/80 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'border-white/10'}`}>
                  <img 
                    src={user?.img || ""} 
                    alt="Profile Avatar" 
                    className="w-full h-full object-cover"
                    data-testid="profile-avatar"
                  />
                </div>
                {unreadCount && unreadCount.count > 0 && (
                  <>
                    <div className="absolute inset-0 rounded-full animate-ping bg-red-500/30" />
                    <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center z-10 border-2 border-[#13151A]" data-testid="notification-badge">
                      {unreadCount.count > 9 ? '9+' : unreadCount.count}
                    </div>
                  </>
                )}
              </div>
            </Link>

            {/* User Info */}
            <div className="flex-1 flex flex-col pt-1">
              <h2 className="text-xl font-semibold text-white tracking-tight leading-none mb-2" data-testid="text-settings-username">
                {user?.name || "User"}
              </h2>
              
              <div className="flex flex-wrap items-center gap-2">
                {/* Trust Score Chip */}
                <div className="flex items-center gap-1.5 bg-[#1A1D24] border border-white/5 rounded-full pl-2.5 pr-1 py-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Trust</span>
                  <div className="flex items-center gap-1 bg-[#3ab368]/10 rounded-full px-2 py-0.5">
                    <span className="text-sm font-bold text-[#3ab368]" data-testid="text-trust-value">
                      {user?.trust || 0}
                    </span>
                    <button 
                      className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-[#3ab368]/20 transition-colors ml-0.5"
                      onClick={() => toast({ title: t('settings.trustRating'), description: t('settings.trustRatingDesc') })}
                      data-testid="button-trust-info"
                    >
                      <HelpCircle className="w-3 h-3 text-[#3ab368]" />
                    </button>
                  </div>
                </div>

                {/* Phone Inline Block */}
                <div className="flex items-center gap-2 bg-[#1A1D24] border border-white/5 rounded-full px-3 py-1.5">
                  <Phone className="w-3.5 h-3.5 text-white/40" />
                  {user?.phone ? (
                    <span className="text-xs font-medium text-white/90" data-testid="text-phone-number">{user.phone}</span>
                  ) : (
                    <button 
                      onClick={handlePhoneClick}
                      className="text-xs font-semibold text-[#3ab368] hover:text-[#3ab368]/80 transition-colors"
                      data-testid="button-add-phone"
                    >
                      {t('settings.addPhone')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Menu Block 1 */}
        <div className="rounded-3xl bg-[#13151A] border border-white/5 shadow-2xl shadow-black/40 overflow-hidden relative z-0">
          <button
            onClick={handleLoyaltyClick}
            className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors border-b border-white/5 group"
            data-testid="button-loyalty-settings"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-[#1A1D24] border border-white/5 flex items-center justify-center shrink-0 group-hover:border-[#3ab368]/30 transition-colors">
                <Users className="w-4 h-4 text-[#3ab368]" />
              </div>
              <div className="flex flex-col items-start">
                <h3 className="text-white font-medium text-sm tracking-tight">{t('settings.loyaltyProgram')}</h3>
                <span className="text-[11px] text-white/40 font-medium">{t('settings.loyaltyDesc')}</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/40 transition-colors" />
          </button>

          <button
            onClick={handleSecurityClick}
            className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors border-b border-white/5 group"
            data-testid="button-security-settings"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-[#1A1D24] border border-white/5 flex items-center justify-center shrink-0 group-hover:border-[#3ab368]/30 transition-colors">
                <Shield className="w-4 h-4 text-[#3ab368]" />
              </div>
              <div className="flex flex-col items-start">
                <h3 className="text-white font-medium text-sm tracking-tight">{t('settings.security')}</h3>
                <span className="text-[11px] text-white/40 font-medium">{t('settings.securityDesc')}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#3ab368]">{t('settings.securityLevel')}</span>
              <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/40 transition-colors" />
            </div>
          </button>

          <button
            onClick={handleLanguageClick}
            className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors border-b border-white/5 group"
            data-testid="button-language-settings"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-[#1A1D24] border border-white/5 flex items-center justify-center shrink-0 group-hover:border-[#3ab368]/30 transition-colors">
                <Globe className="w-4 h-4 text-[#3ab368]" />
              </div>
              <div className="flex flex-col items-start">
                <h3 className="text-white font-medium text-sm tracking-tight">{t('settings.language')}</h3>
                <span className="text-[11px] text-white/40 font-medium">{t('settings.languageDesc')}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <img src={currentLanguage.flagUrl} alt={currentLanguage.name} className="w-5 h-3.5 object-cover rounded-sm shadow-sm" />
                <span className="text-[12px] font-medium text-white/60">{currentLanguage.name}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/40 transition-colors" />
            </div>
          </button>

          <button
            onClick={handleDevicesClick}
            className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors group"
            data-testid="button-devices-settings"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-[#1A1D24] border border-white/5 flex items-center justify-center shrink-0 group-hover:border-[#3ab368]/30 transition-colors">
                <Smartphone className="w-4 h-4 text-[#3ab368]" />
              </div>
              <div className="flex flex-col items-start">
                <h3 className="text-white font-medium text-sm tracking-tight">{t('settings.devices')}</h3>
                <span className="text-[11px] text-white/40 font-medium">{t('settings.devicesDesc')}</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/40 transition-colors" />
          </button>
        </div>

        {/* Support Block */}
        <div className="rounded-3xl bg-[#13151A] border border-white/5 shadow-2xl shadow-black/40 overflow-hidden relative z-0">
          <button
            onClick={handleSupportClick}
            className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors group"
            data-testid="button-support-settings"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-[#1A1D24] border border-white/5 flex items-center justify-center shrink-0 group-hover:border-[#3ab368]/30 transition-colors">
                <Headphones className="w-4 h-4 text-[#3ab368]" />
              </div>
              <div className="flex flex-col items-start">
                <h3 className="text-white font-medium text-sm tracking-tight">{t('settings.support')}</h3>
                <span className="text-[11px] text-white/40 font-medium">{t('settings.supportDesc')}</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/40 transition-colors" />
          </button>
        </div>
      </div>

      {/* Phone Input Dialog */}
      <Dialog open={isPhoneDialogOpen} onOpenChange={setIsPhoneDialogOpen}>
        <DialogContent className="sm:max-w-md bg-[#13151A] border-white/10 rounded-3xl text-white">
          <DialogHeader>
            <DialogTitle className="text-white text-lg font-semibold tracking-tight">{t('settings.phone')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-white/40">{t('settings.phone')}</label>
              <div className="bg-[#1A1D24] p-3 rounded-2xl border border-white/5 focus-within:border-[#3ab368]/50 transition-colors">
                <PhoneInput
                  international
                  defaultCountry="RU"
                  value={phoneValue}
                  onChange={(value) => setPhoneValue(value || "")}
                  className="phone-input-custom !bg-transparent"
                  placeholder={t('settings.enterPhone')}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button
              type="button"
              onClick={handleSavePhone}
              disabled={updatePhoneMutation.isPending}
              className="w-full h-12 bg-[#3ab368] hover:bg-[#3ab368]/90 text-[#0B0C10] font-semibold text-sm rounded-2xl transition-all"
            >
              {updatePhoneMutation.isPending ? t('common.loading') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Language Selection Modal */}
      <Dialog open={isLanguageModalOpen} onOpenChange={setIsLanguageModalOpen}>
        <DialogContent className="sm:max-w-md bg-[#13151A] border-white/10 rounded-3xl text-white">
          <DialogHeader>
            <DialogTitle className="text-white text-lg font-semibold tracking-tight">{t('settings.language')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-4">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleChangeLanguage(lang.code)}
                className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${
                  i18n.language === lang.code 
                    ? 'bg-[#1A1D24] border-[#3ab368]/30 shadow-[0_0_15px_rgba(58,179,104,0.1)]' 
                    : 'bg-[#1A1D24]/50 border-white/5 hover:bg-[#1A1D24] hover:border-white/10'
                }`}
                data-testid={`language-${lang.code}`}
              >
                <div className="flex items-center gap-3">
                  <img src={lang.flagUrl} alt={lang.name} className="w-8 h-5 object-cover rounded shadow-sm" />
                  <span className={`font-medium tracking-tight ${i18n.language === lang.code ? 'text-white' : 'text-white/70'}`}>
                    {lang.name}
                  </span>
                </div>
                {i18n.language === lang.code && (
                  <Check className="w-5 h-5 text-[#3ab368]" />
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
