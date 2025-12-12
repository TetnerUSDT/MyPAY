import { useState, useEffect, useCallback } from "react";
import { Settings, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { User } from "@shared/schema";
import { formatBalance } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import useEmblaCarousel from 'embla-carousel-react';

const catImage = "/uploads/icons/cat-logo.png?v=2";

const RefreshIcon = ({ className = "w-6 h-6", ...props }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className={className} {...props}>
    <path fill="none" d="M0 0h24v24H0z"/>
    <path d="m22.69 18.37 1.14-1-1-1.73-1.45.49q-.48-.405-1.08-.63L20 14h-2l-.3 1.49q-.6.225-1.08.63l-1.45-.49-1 1.73 1.14 1c-.08.5-.08.76 0 1.26l-1.14 1 1 1.73 1.45-.49q.48.405 1.08.63L18 24h2l.3-1.49q.6-.225 1.08-.63l1.45.49 1-1.73-1.14-1c.08-.51.08-.77 0-1.27M19 21c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2M11 7v5.41l2.36 2.36 1.04-1.79-1.4-1.39V7zm10 5a9 9 0 0 0-9-9C9.17 3 6.65 4.32 5 6.36V4H3v6h6V8H6.26A7.01 7.01 0 0 1 12 5c3.86 0 7 3.14 7 7zm-10.14 6.91c-2.99-.49-5.35-2.9-5.78-5.91H3.06c.5 4.5 4.31 8 8.94 8h.07z"/>
  </svg>
);

interface Banner {
  id: number;
  title: string;
  subtitle: string;
  link: string;
  bgGradient: string;
  image?: string;
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
      link: "/select-country",
      bgGradient: "linear-gradient(135deg, #F2994A 0%, #F2C94C 100%)",
    },
  ];

  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });

  const { data: cryptoBalances = [], isLoading: balancesLoading } = useQuery<any[]>({
    queryKey: ["/api/user/crypto-balances"],
  });

  const { data: exchangeRates = [], isLoading: ratesLoading } = useQuery<any[]>({
    queryKey: ["/api/services/crypto"],
  });

  const { data: unreadCount } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    refetchInterval: 30000,
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
    const autoplay = setInterval(() => {
      emblaApi.scrollNext();
    }, 5000);
    return () => clearInterval(autoplay);
  }, [emblaApi]);

  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext();
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
          r.toBalanceId === balance.id && 
          r.fromCurrency === 'USDT' &&
          r.category === 'crypto'
        );
        
        if (usdtToAssetRate && parseFloat(usdtToAssetRate.rate) > 0) {
          total += amount / parseFloat(usdtToAssetRate.rate);
        } else {
          const assetToUsdtRate = exchangeRates.find(r => 
            r.fromBalanceId === balance.id && 
            r.toCurrency === 'USDT' &&
            r.category === 'crypto'
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

  return (
    <div className="mobile-screen gradient-bg text-white overflow-y-auto pb-20">
      <div className="flex flex-col min-h-full">
        {/* Header with Profile */}
        <div className="flex items-center justify-center p-6">
          <div className="flex items-center">
            <Link href="/history">
              <button 
                className="w-10 h-10 rounded-full bg-black/20 flex items-center justify-center mr-4"
                data-testid="button-history"
              >
                <RefreshIcon className="w-5 h-5 text-white" />
              </button>
            </Link>
            
            <Link href="/notifications">
              <div className="relative">
                <div className="w-16 h-16 rounded-full overflow-hidden">
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
          </div>
          
          <Link href="/settings">
            <button 
              className="w-10 h-10 rounded-full bg-black/20 flex items-center justify-center ml-4"
              data-testid="button-settings"
            >
              <Settings className="w-5 h-5 text-white" />
            </button>
          </Link>
        </div>

        {/* Total Balance Card */}
        <div className="px-6 mb-8">
          <div 
            className="bg-gradient-to-br from-green-600/30 to-green-800/30 rounded-3xl p-6 border border-green-500/20 backdrop-blur-sm"
            data-testid="total-balance-card"
          >
            <p className="text-sm text-white/70 mb-2">{t('home.totalBalance')}</p>
            {(balancesLoading || ratesLoading) ? (
              <Skeleton className="h-10 w-48 bg-white/10" />
            ) : (
              <div className="flex items-baseline">
                <span className="text-4xl font-bold text-white" data-testid="total-balance-amount">
                  {formatBalance(totalUSDT.toFixed(2))}
                </span>
                <span className="text-xl font-semibold text-accent ml-2">USDT</span>
              </div>
            )}
            <p className="text-xs text-white/50 mt-2">
              {t('home.balanceEquivalent')}
            </p>
          </div>
        </div>

        {/* Banner Carousel */}
        <div className="px-6 mb-8">
          <div className="relative">
            <div className="overflow-hidden rounded-2xl" ref={emblaRef}>
              <div className="flex">
                {banners.map((banner) => (
                  <div key={banner.id} className="flex-[0_0_100%] min-w-0">
                    <Link href={banner.link}>
                      <div 
                        className="relative h-28 rounded-2xl p-4 cursor-pointer overflow-hidden"
                        style={{ background: banner.bgGradient }}
                        data-testid={`banner-${banner.id}`}
                      >
                        <div className="relative z-10">
                          <h3 className="text-lg font-bold text-white mb-1">
                            {banner.title}
                          </h3>
                          <p className="text-sm text-white/80">
                            {banner.subtitle}
                          </p>
                          <p className="text-xs text-white/60 mt-2 flex items-center">
                            {t('common.learnMore')}
                            <ChevronRight className="w-3 h-3 ml-1" />
                          </p>
                        </div>
                        
                        {/* Decorative elements */}
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-30">
                          <div className="w-20 h-20 rounded-xl bg-white/20 rotate-12" />
                        </div>
                      </div>
                    </Link>
                  </div>
                ))}
              </div>
            </div>

            {/* Carousel Navigation Dots */}
            <div className="flex justify-center mt-4 gap-2">
              {banners.map((_, index) => (
                <button
                  key={index}
                  className={`w-2 h-2 rounded-full transition-all ${
                    index === selectedIndex 
                      ? 'bg-accent w-6' 
                      : 'bg-white/30'
                  }`}
                  onClick={() => emblaApi?.scrollTo(index)}
                  data-testid={`banner-dot-${index}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="px-6 flex-1 mb-6">
          <h3 className="text-lg font-semibold mb-4">{t('home.quickActions')}</h3>
          <div className="grid grid-cols-2 gap-4">
            <Link href="/select-country">
              <div className="crypto-card p-4 text-center cursor-pointer hover:bg-white/10 transition-colors" data-testid="quick-action-exchange">
                <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center mx-auto mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M7 16V4m0 0L3 8m4-4l4 4m6 4v12m0 0l4-4m-4 4l-4-4"/>
                  </svg>
                </div>
                <p className="font-medium text-white">{t('home.exchange')}</p>
                <p className="text-xs text-muted-foreground mt-1">{t('home.exchangeDesc')}</p>
              </div>
            </Link>
            
            <Link href="/wallet">
              <div className="crypto-card p-4 text-center cursor-pointer hover:bg-white/10 transition-colors" data-testid="quick-action-wallet">
                <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center mx-auto mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M21 18v1c0 1.1-.9 2-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14c1.1 0 2 .9 2 2v1h-9a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2zm-9-2h10V8H12zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5"/>
                  </svg>
                </div>
                <p className="font-medium text-white">{t('home.wallet')}</p>
                <p className="text-xs text-muted-foreground mt-1">{t('home.walletDesc')}</p>
              </div>
            </Link>
            
            <Link href="/loyalty">
              <div className="crypto-card p-4 text-center cursor-pointer hover:bg-white/10 transition-colors" data-testid="quick-action-loyalty">
                <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center mx-auto mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-purple-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                </div>
                <p className="font-medium text-white">{t('home.bonuses')}</p>
                <p className="text-xs text-muted-foreground mt-1">{t('home.bonusesDesc')}</p>
              </div>
            </Link>
            
            <Link href="/history">
              <div className="crypto-card p-4 text-center cursor-pointer hover:bg-white/10 transition-colors" data-testid="quick-action-history">
                <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center mx-auto mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-orange-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12,6 12,12 16,14"/>
                  </svg>
                </div>
                <p className="font-medium text-white">{t('home.history')}</p>
                <p className="text-xs text-muted-foreground mt-1">{t('home.historyDesc')}</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
