import { Link } from "wouter";
import { Loader2, Coins } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getBalanceIcon } from "@/lib/balanceIcons";

type CryptoRate = {
  id: string;
  fromBalanceId: number;
  toBalanceId: number;
  fromCurrency: string;
  toCurrency: string;
  rate: string;
  category: string;
};

export default function SelectCountryScreen() {
  const { data: cryptoRates = [], isLoading: isLoadingCrypto } = useQuery<CryptoRate[]>({
    queryKey: ["/api/services/crypto"],
  });

  return (
    <div className="mobile-screen gradient-bg text-white">
      <div className="flex flex-col h-full">
        {/* Title */}
        <div className="text-center pt-8 pb-6">
          <h1 className="text-xl font-semibold" data-testid="text-select-service-title">
            Выберите направление обмена
          </h1>
        </div>
        
        {/* Content */}
        {isLoadingCrypto ? (
          <div className="flex flex-col items-center justify-center flex-1">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">Загрузка...</p>
          </div>
        ) : (
          <div className="px-6">
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
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <img 
                            src={getBalanceIcon(rate.fromBalanceId)} 
                            alt={rate.fromCurrency}
                            className="w-8 h-8 rounded-full"
                          />
                          <h3 className="font-semibold text-base text-white">
                            {rate.fromCurrency}
                          </h3>
                          <span className="text-white/70">→</span>
                          <img 
                            src={getBalanceIcon(rate.toBalanceId)} 
                            alt={rate.toCurrency}
                            className="w-8 h-8 rounded-full"
                          />
                          <h3 className="font-semibold text-base text-white">
                            {rate.toCurrency}
                          </h3>
                        </div>
                        <p className="text-muted-foreground text-sm mt-2">
                          1 {rate.fromCurrency} = {parseFloat(rate.rate).toFixed(2)} {rate.toCurrency}
                        </p>
                      </div>
                      <div className="bg-secondary border-0 text-accent font-semibold px-4 py-3 rounded-lg min-w-[80px] text-center">
                        <div className="text-lg">
                          {parseFloat(rate.rate).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
