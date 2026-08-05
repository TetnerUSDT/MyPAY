import { useState, useEffect, useCallback } from "react";
import { Settings, ChevronRight, ArrowRightLeft } from "lucide-react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { User } from "@shared/schema";
import { formatBalance } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import QuickActionButton from "@/components/QuickActionButton";
import useEmblaCarousel from 'embla-carousel-react';

const catImage = "/uploads/icons/cat-logo.png?v=2";

const RefreshIcon = ({ className = "w-6 h-6", ...props }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className={className} {...props}>
    <path fill="none" d="M0 0h24v24H0z"/>
    <path d="m22.69 18.37 1.14-1-1-1.73-1.45.49q-.48-.405-1.08-.63L20 14h-2l-.3 1.49q-.6.225-1.08.63l-1.45-.49-1 1.73 1.14 1c-.08.5-.08.76 0 1.26l-1.14 1 1 1.73 1.45-.49q.48.405 1.08.63L18 24h2l.3-1.49q.6-.225 1.08-.63l1.45.49 1-1.73-1.14-1c.08-.51.08-.77 0-1.27M19 21c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2M11 7v5.41l2.36 2.36 1.04-1.79-1.4-1.39V7zm10 5a9 9 0 0 0-9-9C9.17 3 6.65 4.32 5 6.36V4H3v6h6V8H6.26A7.01 7.01 0 0 1 12 5c3.86 0 7 3.14 7 7zm-10.14 6.91c-2.99-.49-5.35-2.9-5.78-5.91H3.06c.5 4.5 4.31 8 8.94 8h.07z"/>
  </svg>
);

interface ExchangeHistoryItem {
  id: number;
  numberOrder: string;
  fromCurrency: string;
  toCurrency: string;
  amountFrom: string;
  amountTo: string;
  timestamp: string;
  status: "wait" | "wait-paid" | "paid" | "complete" | "canceled" | "dispute";
  cardNumber: string | null;
  walletAddress: string | null;
}

function formatHistoryDate(iso: string, todayLabel: string, yesterdayLabel: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (d >= startOfToday) return `${todayLabel}, ${time}`;
  if (d >= startOfYesterday) return `${yesterdayLabel}, ${time}`;
  return `${d.toLocaleDateString()} ${time}`;
}

function trimAmount(s: string): string {
  if (!s) return "0";
  const n = parseFloat(s);
  if (!isFinite(n)) return s;
  return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

function shortAddress(s: string | null): string {
  if (!s) return "";
  const clean = s.replace(/\s+/g, "");
  if (clean.length <= 10) return clean;
  return `${clean.slice(0, 4)}...${clean.slice(-4)}`;
}

function HomeHistory() {
  const { t } = useTranslation();
  const { data: items = [], isLoading } = useQuery<ExchangeHistoryItem[]>({
    queryKey: ["/api/exchanges/history?limit=10&offset=0"],
    refetchOnWindowFocus: false,
  });

  return (
    <div className="px-6 mt-4 mb-3 shrink-0">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-base font-semibold text-white" data-testid="text-home-history-title">
          {t("home.history")}
        </h2>
        <Link href="/history">
          <button className="text-sm text-accent hover:underline" data-testid="link-home-history-view-all">
            {t("wallet.viewAll")}
          </button>
        </Link>
      </div>

      <div className="flex flex-col gap-1">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={`hskel-${i}`} className="flex items-center gap-3 py-3">
              <Skeleton className="w-10 h-10 rounded-full bg-white/10" />
              <div className="flex-1">
                <Skeleton className="h-4 w-24 mb-1.5 bg-white/10" />
                <Skeleton className="h-3 w-32 bg-white/10" />
              </div>
              <div className="text-right">
                <Skeleton className="h-4 w-20 bg-white/10 ml-auto mb-1.5" />
                <Skeleton className="h-3 w-16 bg-white/10 ml-auto" />
              </div>
            </div>
          ))
        ) : items.length === 0 ? (
          <div className="text-center text-white/40 text-sm py-6" data-testid="text-home-history-empty">
            {t("wallet.noOperations")}
          </div>
        ) : (
          items.slice(0, 10).map((ex) => {
            const isCanceled = ex.status === "canceled";
            const recipient = ex.cardNumber || ex.walletAddress;
            const recipientShort = shortAddress(recipient);
            const recipientLabel = t("home.historyTo");
            return (
              <Link key={ex.id} href={`/tracking?order=${ex.numberOrder}`}>
                <div
                  className="flex items-center gap-3 py-3 cursor-pointer"
                  data-testid={`home-history-item-${ex.id}`}
                >
                  <div className="w-10 h-10 rounded-full bg-white/10 text-white/80 flex items-center justify-center flex-shrink-0">
                    <ArrowRightLeft className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">
                      {t("home.historyExchange")}
                    </div>
                    <div className="text-xs text-white/50 truncate">
                      {recipientShort ? (
                        <>
                          <span className="text-white/40">{recipientLabel} </span>
                          <span className="font-mono">{recipientShort}</span>
                        </>
                      ) : (
                        <span className="text-white/40">#{ex.numberOrder}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div
                      className={`text-sm font-semibold ${
                        isCanceled ? "text-white/40 line-through" : "text-red-400"
                      }`}
                    >
                      −{trimAmount(ex.amountFrom)} {ex.fromCurrency}
                    </div>
                    <div
                      className={`text-xs font-medium ${
                        isCanceled ? "text-white/40 line-through" : "text-green-400"
                      }`}
                    >
                      +{trimAmount(ex.amountTo)} {ex.toCurrency}
                    </div>
                    <div className="text-[11px] text-white/40 mt-0.5">
                      {formatHistoryDate(ex.timestamp, t("wallet.today"), t("wallet.yesterday"))}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}

interface Banner {
  id: number;
  title: string;
  subtitle: string;
  link: string;
  bgGradient: string;
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const [selectedIndex, setSelectedIndex] = useState(0);

  const banners: Banner[] = [
    {
      id: 1,
      title: t('banners.vouchers'),
      subtitle: t('banners.vouchersDesc'),
      link: "/vouchers",
      bgGradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    },
    {
      id: 2,
      title: t('banners.inviteFriends'),
      subtitle: t('banners.inviteFriendsDesc'),
      link: "/loyalty",
      bgGradient: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)",
    },
    {
      id: 3,
      title: t('banners.fastExchange'),
      subtitle: t('banners.fastExchangeDesc'),
      link: "/exchange",
      bgGradient: "linear-gradient(135deg, #F2994A 0%, #F2C94C 100%)",
    },
  ];

  const { data: user } = useQuery<User>({ queryKey: ["/api/auth/me"] });
  const { data: cryptoBalances = [], isLoading: balancesLoading } = useQuery<any[]>({ queryKey: ["/api/user/crypto-balances"] });
  const { data: exchangeRates = [], isLoading: ratesLoading } = useQuery<any[]>({ queryKey: ["/api/services/crypto"] });
  const { data: unreadCount } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    refetchInterval: 60000,
  });

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on('select', onSelect);
    onSelect();
  }, [emblaApi, onSelect]);

  useEffect(() => {
    if (!emblaApi) return;
    const autoplay = setInterval(() => emblaApi.scrollNext(), 5000);
    return () => clearInterval(autoplay);
  }, [emblaApi]);

  const calculateTotalInUSDT = () => {
    let total = 0;
    cryptoBalances.forEach(balance => {
      const amount = parseFloat(balance.sum || '0');
      if (amount <= 0) return;
      if (balance.currency === 'USDT') {
        total += amount;
      } else {
        const usdtToAssetRate = exchangeRates.find(r =>
          r.toBalanceId === balance.id && r.fromCurrency === 'USDT' && r.category === 'crypto'
        );
        if (usdtToAssetRate && parseFloat(usdtToAssetRate.rate) > 0) {
          total += amount / parseFloat(usdtToAssetRate.rate);
        } else {
          const assetToUsdtRate = exchangeRates.find(r =>
            r.fromBalanceId === balance.id && r.toCurrency === 'USDT' && r.category === 'crypto'
          );
          if (assetToUsdtRate && parseFloat(assetToUsdtRate.rate) > 0) {
            total += amount * parseFloat(assetToUsdtRate.rate);
          }
        }
      }
    });
    return total;
  };

  const totalUSDT = calculateTotalInUSDT();

  const quickActions = [
    {
      href: "/exchange",
      testId: "quick-action-exchange",
      label: t('home.exchange'),
       iconColor: "#22c55e",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M7 16V4m0 0L3 8m4-4l4 4m6 4v12m0 0l4-4m-4 4l-4-4"/>
        </svg>
      ),
    },
    {
      href: "/wallet",
      testId: "quick-action-wallet",
      label: t('home.wallet'),
       iconColor: "#60a5fa",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M21 18v1c0 1.1-.9 2-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14c1.1 0 2 .9 2 2v1h-9a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2zm-9-2h10V8H12zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5"/>
        </svg>
      ),
    },
    {
      href: "/p2p",
      testId: "quick-action-p2p",
      label: "P2P",
       iconColor: "#22d3ee",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="7" cy="8" r="3"/>
          <circle cx="17" cy="8" r="3"/>
          <path d="M1 20v-1a5 5 0 0 1 5-5h2"/>
          <path d="M16 14h2a5 5 0 0 1 5 5v1"/>
          <path d="M12 14l2 2-2 2"/>
          <path d="M14 16H9"/>
        </svg>
      ),
    },
    {
      href: "/business",
      testId: "quick-action-business",
      label: t('home.business'),
       iconColor: "#fb923c",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="7" width="20" height="14" rx="2"/>
          <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
          <line x1="12" y1="12" x2="12" y2="12"/>
          <path d="M2 12h20"/>
        </svg>
      ),
    },
    {
      href: "/loyalty",
      testId: "quick-action-loyalty",
      label: t('home.bonuses'),
       iconColor: "#c084fc",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      ),
    },
    {
      href: "/vouchers",
      testId: "quick-action-vouchers",
      label: t('home.vouchers'),
       iconColor: "#facc15",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2 9V7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2"/>
          <path d="M2 15v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2"/>
          <path d="M2 12h20"/>
          <path d="M12 9v6"/>
        </svg>
      ),
    },
  ];

  return (
    <div className="mobile-screen gradient-bg text-white flex flex-col pb-20">
      {/* Header */}
      <div className="flex items-center justify-center px-6 pt-4 pb-3 shrink-0">
        <Link href="/history">
          <button
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center mr-4"
            data-testid="button-history"
          >
            <RefreshIcon className="w-5 h-5 text-white" />
          </button>
        </Link>

        <Link href="/notifications">
          <div className="relative">
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/20">
              <img
                src={user?.img || catImage}
                alt="Profile Avatar"
                className="w-full h-full object-cover"
                data-testid="profile-avatar"
              />
            </div>
            {unreadCount && unreadCount.count > 0 && (
              <>
                <div className="absolute inset-0 rounded-full animate-ping bg-red-500/50" />
                <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center z-10" data-testid="notification-badge">
                  {unreadCount.count > 9 ? '9+' : unreadCount.count}
                </div>
              </>
            )}
          </div>
        </Link>

        <Link href="/settings">
          <button
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center ml-4"
            data-testid="button-settings"
          >
            <Settings className="w-5 h-5 text-white" />
          </button>
        </Link>
      </div>

      {/* Total Balance Card */}
      <div className="px-6 mb-3 shrink-0">
        <div className="bg-card/60 rounded-2xl px-5 py-4 border border-border backdrop-blur-sm" data-testid="total-balance-card">
          <p className="text-xs text-white/60 mb-1">{t('home.totalBalance')}</p>
          {(balancesLoading || ratesLoading) ? (
            <Skeleton className="h-9 w-40 bg-white/10" />
          ) : (
            <div className="flex items-baseline">
              <span className="text-3xl font-bold text-white" data-testid="total-balance-amount">
                {formatBalance(totalUSDT.toFixed(2))}
              </span>
              <span className="text-lg font-semibold text-accent ml-2">USDT</span>
            </div>
          )}
          <p className="text-xs text-white/40 mt-1">{t('home.balanceEquivalent')}</p>
        </div>
      </div>

      {/* Banner Carousel */}
      <div className="px-6 mb-3 shrink-0">
        <div className="relative">
          <div className="overflow-hidden rounded-2xl" ref={emblaRef}>
            <div className="flex">
              {banners.map((banner) => (
                <div key={banner.id} className="flex-[0_0_100%] min-w-0">
                  <Link href={banner.link}>
                    <div
                      className="relative h-24 rounded-2xl p-4 cursor-pointer overflow-hidden"
                      style={{ background: banner.bgGradient }}
                      data-testid={`banner-${banner.id}`}
                    >
                      <div className="relative z-10">
                        <h3 className="text-base font-bold text-white mb-0.5">{banner.title}</h3>
                        <p className="text-xs text-white/80">{banner.subtitle}</p>
                        <p className="text-xs text-white/60 mt-1 flex items-center">
                          {t('common.learnMore')}
                          <ChevronRight className="w-3 h-3 ml-1" />
                        </p>
                      </div>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20">
                        <div className="w-16 h-16 rounded-xl bg-white/20 rotate-12" />
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          </div>

          {/* Dots */}
          <div className="flex justify-center mt-2 gap-2">
            {banners.map((_, index) => (
              <button
                key={index}
                className={`h-1.5 rounded-full transition-all ${index === selectedIndex ? 'bg-accent w-5' : 'bg-white/30 w-1.5'}`}
                onClick={() => emblaApi?.scrollTo(index)}
                data-testid={`banner-dot-${index}`}
              />
            ))}
          </div>
        </div>
      </div>

       {/* Quick Actions — wind-swept glass action rail */}
      <div className="shrink-0">
        <h3 className="text-sm font-semibold text-white/70 mb-3 px-6">{t('home.quickActions')}</h3>
         <div className="mb-[-16px] overflow-x-auto pb-4 scrollbar-hide" style={{ scrollbarWidth: "none" }}>
           <div
             className="flex gap-2 overflow-visible px-6 py-2"
             data-testid="quick-actions-scroll"
           >
             {quickActions.map((action) => (
               <Link href={action.href} key={action.href}>
                 <QuickActionButton
                   label={action.label}
                   iconColor={action.iconColor}
                   testId={action.testId}
                   icon={action.icon}
                   entryDelay={quickActions.indexOf(action) * 0.07}
                 />
               </Link>
             ))}
           </div>
        </div>
      </div>

      {/* Recent operations history */}
      <HomeHistory />
    </div>
  );
}
