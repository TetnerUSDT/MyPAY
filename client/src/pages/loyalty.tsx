import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ChevronLeft, Copy, Share2, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LottieAnimation } from "@/components/LottieAnimation";
import shareAnimation from "@/assets/Share_1760211406270.json";
import { useTranslation } from "react-i18next";

interface User {
  id: number;
  name: string;
  codeRef: string;
  img?: string;
  tgUsername?: string;
}

interface Referral {
  id: number;
  name: string;
  img?: string;
  tgUsername?: string;
  createdAt: string;
}

export default function LoyaltyPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("link");

  const { data: user, isLoading: userLoading } = useQuery<User>({
    queryKey: ['/api/auth/me'],
  });

  const { data: referrals = [] } = useQuery<Referral[]>({
    queryKey: ['/api/referrals'],
  });

  const { data: botConfig, isLoading: botConfigLoading } = useQuery<{ botUrl: string }>({
    queryKey: ['/api/config/telegram-bot'],
  });

  const botUrl = botConfig?.botUrl || "";
  const referralLink = user?.codeRef && botUrl ? `${botUrl}?startapp=${user.codeRef}` : "";
  const isLoadingLink = userLoading || botConfigLoading;

  const handleCopyCode = () => {
    if (user?.codeRef) {
      navigator.clipboard.writeText(user.codeRef);
      toast({
        title: t('common.copied'),
        description: t('loyalty.referralCode'),
      });
    }
  };

  const handleCopyLink = () => {
    if (referralLink) {
      navigator.clipboard.writeText(referralLink);
      toast({
        title: t('common.copied'),
        description: t('loyalty.referralLink'),
      });
    }
  };

  const handleShareLink = () => {
    if (referralLink && window.Telegram?.WebApp) {
      const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(t('loyalty.joinAndGetBonuses'))}`;
      window.Telegram.WebApp.openTelegramLink(shareUrl);
    } else {
      toast({
        title: t('common.error'),
        description: t('loyalty.telegramError'),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0C10] text-[#E2E8F0] pb-28 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-6 pb-4">
        <button
          onClick={() => window.history.back()}
          className="w-10 h-10 rounded-full bg-white/5 border border-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
          data-testid="button-close"
        >
          <ChevronLeft className="w-5 h-5 text-white/70" />
        </button>
        <h1 className="text-[17px] font-semibold tracking-tight text-white" data-testid="text-loyalty-title">
          {t('loyalty.title')}
        </h1>
        <div className="w-10 h-10" />
      </div>

      <div className="px-5 mt-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-[#13151A] border border-white/5 rounded-2xl p-1 h-auto">
            <TabsTrigger
              value="link"
              className="rounded-xl py-2.5 text-sm font-semibold text-white/40 data-[state=active]:bg-[#1A1D24] data-[state=active]:text-white data-[state=active]:border data-[state=active]:border-white/10 transition-all"
              data-testid="tab-referral-link"
            >
              {t('loyalty.link')}
            </TabsTrigger>
            <TabsTrigger
              value="partners"
              className="rounded-xl py-2.5 text-sm font-semibold text-white/40 data-[state=active]:bg-[#1A1D24] data-[state=active]:text-white data-[state=active]:border data-[state=active]:border-white/10 transition-all"
              data-testid="tab-my-partners"
            >
              {t('loyalty.partners')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="link" className="space-y-6 mt-6">
            {/* Hero Animation */}
            <div className="flex justify-center">
              <LottieAnimation
                animationData={shareAnimation}
                width="100%"
                height={300}
                loop={true}
                autoplay={true}
                className="max-w-md"
              />
            </div>

            {/* Referral Code & Link */}
            <div className="bg-[#13151A] border border-white/5 rounded-3xl p-5 space-y-4">
              {/* Referral Code row */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-white/40">
                  {t('loyalty.referralCode')}
                </label>
                <div className="flex items-center gap-3 bg-[#1A1D24] border border-white/5 rounded-2xl px-4 py-3">
                  <span className="flex-1 font-mono font-bold text-white tracking-widest" data-testid="text-referral-code">
                    {user?.codeRef || '...'}
                  </span>
                  <button
                    onClick={handleCopyCode}
                    className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                    data-testid="button-copy-code"
                  >
                    <Copy className="w-4 h-4 text-white/50" />
                  </button>
                </div>
              </div>

              {/* Referral Link row */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-white/40">
                  {t('loyalty.referralLink')}
                </label>
                <div className="flex items-center gap-3 bg-[#1A1D24] border border-white/5 rounded-2xl px-4 py-3">
                  <span className="flex-1 font-mono text-xs text-white/60 truncate" data-testid="text-referral-link">
                    {isLoadingLink ? '...' : referralLink || t('loyalty.botUrlNotConfigured')}
                  </span>
                  <button
                    onClick={handleCopyLink}
                    disabled={!referralLink || isLoadingLink}
                    className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors disabled:opacity-40"
                    data-testid="button-copy-link"
                  >
                    <Copy className="w-4 h-4 text-white/50" />
                  </button>
                </div>
              </div>

              {/* Share Button */}
              <button
                onClick={handleShareLink}
                disabled={!referralLink || isLoadingLink}
                className="w-full bg-[#3ab368] hover:bg-[#3ab368]/90 disabled:opacity-40 disabled:cursor-not-allowed text-[#0B0C10] font-bold py-4 rounded-2xl transition-all shadow-lg shadow-[#3ab368]/20 active:scale-[0.98] flex items-center justify-center gap-2"
                data-testid="button-share-link"
              >
                <Share2 className="w-5 h-5" />
                {t('loyalty.shareLink')}
              </button>
            </div>
          </TabsContent>

          <TabsContent value="partners" className="space-y-4 mt-6">
            {referrals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-5">
                  <Users className="w-10 h-10 text-white/10" />
                </div>
                <p className="text-white/40 font-medium">{t('loyalty.noPartners')}</p>
                <p className="text-white/20 text-sm mt-1.5">{t('loyalty.shareToInvite')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {referrals.map((referral) => (
                  <div
                    key={referral.id}
                    className="bg-[#13151A] border border-white/5 rounded-3xl p-4 flex items-center gap-4"
                    data-testid={`partner-card-${referral.id}`}
                  >
                    <div className="w-12 h-12 rounded-2xl overflow-hidden bg-[#1A1D24] border border-white/5 flex items-center justify-center flex-shrink-0">
                      {referral.img ? (
                        <img src={referral.img} alt={referral.name} className="w-full h-full object-cover" />
                      ) : (
                        <Users className="w-6 h-6 text-white/20" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white leading-snug">{referral.name}</p>
                      {referral.tgUsername && (
                        <p className="text-sm text-white/40 mt-0.5">@{referral.tgUsername}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
