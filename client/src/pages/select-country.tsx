import { Link } from "wouter";
import { Zap, CreditCard, Loader2, Banknote, Coins, Wallet } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { RussiaFlag, TurkeyFlag } from "@/components/flags";
import { useState } from "react";

type Card = {
  id: number;
  title: string;
  country: string;
  lang: string | null;
  timeExchange: number;
  commission: string;
  idBalance: string | null;
  status: string | null;
  category?: string;
};

type CryptoRate = {
  id: string;
  fromBalanceId: number;
  toBalanceId: number;
  fromCurrency: string;
  toCurrency: string;
  rate: string;
  category: string;
};

type ServiceCategory = 'banks' | 'crypto' | 'cash';

// Map language codes to flag components
const flagMap: Record<string, React.FC<React.SVGProps<SVGSVGElement>>> = {
  ru: RussiaFlag,
  tr: TurkeyFlag,
};

export default function SelectCountryScreen() {
  const [activeCategory, setActiveCategory] = useState<ServiceCategory>('banks');

  const { data: bankCards = [], isLoading: isLoadingBanks } = useQuery<Card[]>({
    queryKey: ["/api/services/banks"],
    enabled: activeCategory === 'banks',
  });

  const { data: cryptoRates = [], isLoading: isLoadingCrypto } = useQuery<CryptoRate[]>({
    queryKey: ["/api/services/crypto"],
    enabled: activeCategory === 'crypto',
  });

  const isLoading = (activeCategory === 'banks' && isLoadingBanks) || (activeCategory === 'crypto' && isLoadingCrypto);

  return (
    <div className="mobile-screen gradient-bg text-white">
      <div className="flex flex-col h-full">
        {/* Title */}
        <div className="text-center pt-8 pb-6">
          <h1 className="text-xl font-semibold" data-testid="text-select-service-title">
            Выберите услугу
          </h1>
        </div>

        {/* Tab Switches */}
        <div className="px-6 mb-6">
          <div className="flex rounded-full bg-black/20 p-1">
            <button
              className={`flex-1 flex items-center justify-center px-4 py-3 rounded-full transition-all text-sm ${
                activeCategory === "banks" 
                  ? "bg-accent text-accent-foreground" 
                  : "text-white"
              }`}
              onClick={() => setActiveCategory("banks")}
              data-testid="tab-banks"
            >
              <Banknote className="w-4 h-4 mr-2" />
              Банки
            </button>
            <button
              className={`flex-1 flex items-center justify-center px-4 py-3 rounded-full transition-all text-sm ${
                activeCategory === "crypto" 
                  ? "bg-accent text-accent-foreground" 
                  : "text-white"
              }`}
              onClick={() => setActiveCategory("crypto")}
              data-testid="tab-crypto"
            >
              <Coins className="w-4 h-4 mr-2" />
              Криптовалюта
            </button>
            <button
              className={`flex-1 flex items-center justify-center px-4 py-3 rounded-full transition-all text-sm ${
                activeCategory === "cash" 
                  ? "bg-accent text-accent-foreground" 
                  : "text-white"
              }`}
              onClick={() => setActiveCategory("cash")}
              data-testid="tab-cash"
            >
              <Wallet className="w-4 h-4 mr-2" />
              Наличные
            </button>
          </div>
        </div>
        
        {/* Content */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center flex-1">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">Загрузка...</p>
          </div>
        ) : (
          <div className="px-6">
            {/* Banks Tab Content */}
            {activeCategory === 'banks' && (
              <>
                {bankCards.map((card) => {
                  const FlagComponent = card.lang ? flagMap[card.lang] : null;
                  
                  return (
                    <Link key={card.id} href={`/exchange?country=${card.id}`}>
                      <div 
                        className="crypto-card cursor-pointer hover:opacity-90 transition-all mb-[15px] flex items-center justify-between gap-4"
                        data-testid={`country-card-${card.id}`}
                      >
                        {/* Country Flag & Info */}
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-12 h-12 rounded-full flex items-center justify-center bg-white/5 border border-white/10 overflow-hidden shrink-0"
                            data-testid={`flag-wrapper-${card.id}`}
                          >
                            {FlagComponent ? (
                              <FlagComponent 
                                className="w-10 h-10" 
                                data-testid={`flag-${card.id}`}
                                aria-label={`${card.title} flag`}
                              />
                            ) : (
                              <div className="w-10 h-10 flex items-center justify-center text-white/50">
                                ?
                              </div>
                            )}
                          </div>
                          
                          <div>
                            <h3 className="font-semibold text-base text-white" data-testid={`country-name-${card.id}`}>
                              {card.title}
                            </h3>
                            <p className="text-muted-foreground text-xs" data-testid={`country-description-${card.id}`}>
                              {card.country}
                            </p>
                          </div>
                        </div>
                        
                        {/* Time & Method */}
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <Zap className="w-4 h-4 text-yellow-400" />
                            <span className="text-white whitespace-nowrap" data-testid={`country-time-${card.id}`}>
                              {card.timeExchange} мин
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <CreditCard className="w-4 h-4 text-yellow-400" />
                            <span className="text-white" data-testid={`country-method-${card.id}`}>
                              Card
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </>
            )}

            {/* Crypto Tab Content */}
            {activeCategory === 'crypto' && (
              <>
                {cryptoRates.length === 0 ? (
                  <div className="text-center py-12">
                    <Coins className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-white mb-2">Нет доступных обменов</h3>
                    <p className="text-muted-foreground">Криптовалютные обмены пока не настроены</p>
                  </div>
                ) : (
                  cryptoRates.map((rate) => (
                    <Link key={rate.id} href={`/exchange?mode=crypto&from=${rate.fromBalanceId}&to=${rate.toBalanceId}`}>
                      <div 
                        className="crypto-card cursor-pointer hover:opacity-90 transition-all mb-[15px]"
                        data-testid={`crypto-rate-${rate.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold text-base text-white">
                              {rate.fromCurrency} → {rate.toCurrency}
                            </h3>
                            <p className="text-muted-foreground text-sm mt-1">
                              1 {rate.fromCurrency} = {parseFloat(rate.rate).toFixed(2)} {rate.toCurrency}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-accent font-semibold text-lg">
                              {parseFloat(rate.rate).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </>
            )}

            {/* Cash Tab Content */}
            {activeCategory === 'cash' && (
              <div className="text-center py-12">
                <Wallet className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">Скоро будет доступно</h3>
                <p className="text-muted-foreground">Обмен наличных в разработке</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}