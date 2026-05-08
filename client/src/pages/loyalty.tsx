import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { X, Copy, Share2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <div className="mobile-screen gradient-bg text-white pb-24">
      {/* Header */}
      <div className="flex items-center justify-between p-6">
        <h1 className="text-xl font-semibold" data-testid="text-loyalty-title">
          {t('loyalty.title')}
        </h1>
        <button 
          onClick={() => window.history.back()}
          className="w-8 h-8 rounded-full bg-black/20 flex items-center justify-center"
          data-testid="button-close"
        >
          <X className="w-4 h-4 text-white" />
        </button>
      </div>

      <div className="px-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-secondary/60 border border-white/10">
            <TabsTrigger 
              value="link" 
              className="data-[state=active]:bg-accent data-[state=active]:text-secondary"
              data-testid="tab-referral-link"
            >
              {t('loyalty.link')}
            </TabsTrigger>
            <TabsTrigger 
              value="partners" 
              className="data-[state=active]:bg-accent data-[state=active]:text-secondary"
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

            {/* Commission Info - временно скрыто
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold">Зарабатывай до 30%</h2>
              <p className="text-green-200 text-lg">
                Пригласи друзей в SwiftX и зарабатывай
              </p>
            </div>
            */}

            {/* Referral Code & Link */}
            <div className="space-y-3 bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-green-500/30">
              {/* Referral Code */}
              <div className="space-y-1">
                <label className="text-xs text-green-200">{t('loyalty.referralCode')}</label>
                <div className="flex items-center gap-2 bg-white/90 rounded-lg py-1.5 px-3">
                  <span className="flex-1 text-secondary text-base font-semibold" data-testid="text-referral-code">
                    {user?.codeRef || t('common.loading')}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleCopyCode}
                    className="h-7 w-7 text-secondary hover:bg-secondary/10"
                    data-testid="button-copy-code"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Referral Link */}
              <div className="space-y-1">
                <label className="text-xs text-green-200">{t('loyalty.referralLink')}</label>
                <div className="flex items-center gap-2 bg-white/90 rounded-lg py-1.5 px-3">
                  <span className="flex-1 text-secondary text-base font-semibold truncate" data-testid="text-referral-link">
                    {isLoadingLink ? t('common.loading') : referralLink || t('loyalty.botUrlNotConfigured')}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleCopyLink}
                    disabled={!referralLink || isLoadingLink}
                    className="h-7 w-7 text-secondary hover:bg-secondary/10 disabled:opacity-50"
                    data-testid="button-copy-link"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Share Button */}
              <Button
                onClick={handleShareLink}
                disabled={!referralLink || isLoadingLink}
                className="w-full bg-accent hover:bg-accent/90 text-secondary py-3 text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="button-share-link"
              >
                <Share2 className="w-5 h-5 mr-2" />
                {t('loyalty.shareLink')}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="partners" className="space-y-4 mt-6">
            {referrals.length === 0 ? (
              <div className="text-center py-12 space-y-4">
                <div className="w-20 h-20 mx-auto rounded-full bg-accent/20 flex items-center justify-center">
                  <Users className="w-10 h-10 text-accent" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">{t('loyalty.noPartners')}</h3>
                  <p className="text-green-200">{t('loyalty.shareToInvite')}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {referrals.map((referral) => (
                  <div
                    key={referral.id}
                    className="bg-secondary/60 rounded-xl p-4 border border-green-500/40 backdrop-blur-sm"
                    data-testid={`partner-card-${referral.id}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-accent/20 flex items-center justify-center">
                        {referral.img ? (
                          <img src={referral.img} alt={referral.name} className="w-full h-full object-cover" />
                        ) : (
                          <Users className="w-6 h-6 text-accent" />
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className="text-white font-semibold">{referral.name}</h4>
                        {referral.tgUsername && (
                          <p className="text-sm text-green-200">@{referral.tgUsername}</p>
                        )}
                      </div>
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
