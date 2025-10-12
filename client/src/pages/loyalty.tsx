import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { X, Copy, Share2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LottieAnimation } from "@/components/LottieAnimation";
import shareAnimation from "@/assets/Share_1760211406270.json";

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
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("link");

  const { data: user } = useQuery<User>({
    queryKey: ['/api/auth/me'],
  });

  const { data: referrals = [] } = useQuery<Referral[]>({
    queryKey: ['/api/referrals'],
  });

  const { data: botConfig } = useQuery<{ botUrl: string }>({
    queryKey: ['/api/config/telegram-bot'],
  });

  const botUrl = botConfig?.botUrl || "https://t.me/swiftx_p2p_test_bot/test";
  const referralLink = user?.codeRef ? `${botUrl}?startapp=${user.codeRef}` : "";

  const handleCopyCode = () => {
    if (user?.codeRef) {
      navigator.clipboard.writeText(user.codeRef);
      toast({
        title: "Скопировано!",
        description: "Реферальный код скопирован в буфер обмена",
      });
    }
  };

  const handleCopyLink = () => {
    if (referralLink) {
      navigator.clipboard.writeText(referralLink);
      toast({
        title: "Скопировано!",
        description: "Реферальная ссылка скопирована в буфер обмена",
      });
    }
  };

  const handleShareLink = () => {
    if (referralLink && window.Telegram?.WebApp) {
      const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent("Присоединяйся к SwiftX и получи бонусы!")}`;
      window.Telegram.WebApp.openTelegramLink(shareUrl);
    } else {
      toast({
        title: "Ошибка",
        description: "Невозможно открыть Telegram в текущей среде",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="mobile-screen gradient-bg text-white pb-24">
      {/* Header */}
      <div className="flex items-center justify-between p-6">
        <h1 className="text-xl font-semibold" data-testid="text-loyalty-title">
          Программа лояльности
        </h1>
        <Link href="/settings">
          <button 
            className="w-8 h-8 rounded-full bg-black/20 flex items-center justify-center"
            data-testid="button-close"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </Link>
      </div>

      <div className="px-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-green-800/60 border border-green-500/40">
            <TabsTrigger 
              value="link" 
              className="data-[state=active]:bg-accent data-[state=active]:text-secondary"
              data-testid="tab-referral-link"
            >
              Ссылка
            </TabsTrigger>
            <TabsTrigger 
              value="partners" 
              className="data-[state=active]:bg-accent data-[state=active]:text-secondary"
              data-testid="tab-my-partners"
            >
              Мои партнеры
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

            {/* Commission Info */}
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold">Зарабатывай до 30%</h2>
              <p className="text-green-200 text-lg">
                Пригласи друзей в SwiftX и зарабатывай
              </p>
            </div>

            {/* Referral Code & Link */}
            <div className="space-y-4 bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-green-500/30">
              {/* Referral Code */}
              <div className="space-y-2">
                <label className="text-sm text-green-200">Реферальный код</label>
                <div className="flex items-center gap-2 bg-white/90 rounded-lg py-2 px-4">
                  <span className="flex-1 text-secondary text-lg font-semibold" data-testid="text-referral-code">
                    {user?.codeRef || "Загрузка..."}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleCopyCode}
                    className="text-secondary hover:bg-secondary/10"
                    data-testid="button-copy-code"
                  >
                    <Copy className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              {/* Referral Link */}
              <div className="space-y-2">
                <label className="text-sm text-green-200">Реферальная ссылка</label>
                <div className="flex items-center gap-2 bg-white/90 rounded-lg py-2 px-4">
                  <span className="flex-1 text-secondary text-lg font-semibold truncate" data-testid="text-referral-link">
                    {referralLink || "Загрузка..."}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleCopyLink}
                    className="text-secondary hover:bg-secondary/10"
                    data-testid="button-copy-link"
                  >
                    <Copy className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              {/* Share Button */}
              <Button
                onClick={handleShareLink}
                className="w-full bg-accent hover:bg-accent/90 text-secondary py-6 text-lg font-semibold"
                data-testid="button-share-link"
              >
                <Share2 className="w-6 h-6 mr-2" />
                Поделиться ссылкой
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
                  <h3 className="text-xl font-semibold text-white mb-2">Пока нет партнеров</h3>
                  <p className="text-green-200">Поделитесь реферальной ссылкой, чтобы пригласить друзей</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {referrals.map((referral) => (
                  <div
                    key={referral.id}
                    className="bg-gradient-to-r from-green-700/60 to-green-800/60 rounded-xl p-4 border border-green-500/40 backdrop-blur-sm"
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
