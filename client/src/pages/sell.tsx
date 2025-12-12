import { useState, useMemo, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { X, ArrowDown, ArrowRight, ChevronDown } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "react-i18next";

type NetworkType = "TRC20" | "BEP20" | "TON" | "Polygon";

interface CryptoBalance {
  id: number;
  title: string;
  network: string;
  currency: string;
  sum: string;
  status: string;
}

export default function SellScreen() {
  const { t } = useTranslation();
  const [sendAmount, setSendAmount] = useState("0");
  const [activeNetwork, setActiveNetwork] = useState<NetworkType>("TRC20");
  const [selectedCurrency, setSelectedCurrency] = useState<string | null>(null);
  const [urlCurrencyParam, setUrlCurrencyParam] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState("");
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Parse URL params on mount/location change
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const networkParam = urlParams.get('network') as NetworkType;
    const currencyParam = urlParams.get('currency');
    
    if (networkParam && ['TRC20', 'BEP20', 'TON', 'Polygon'].includes(networkParam)) {
      setActiveNetwork(networkParam);
    }
    if (currencyParam) {
      setUrlCurrencyParam(currencyParam);
      setSelectedCurrency(currencyParam);
    }
  }, [location]);

  const { data: cryptoBalances = [], isLoading } = useQuery<CryptoBalance[]>({
    queryKey: ["/api/user/crypto-balances"],
  });

  const networkBalances = useMemo(() => {
    return cryptoBalances.filter(b => b.network === activeNetwork);
  }, [cryptoBalances, activeNetwork]);

  // Apply URL currency or fallback to first balance when balances load
  useEffect(() => {
    if (networkBalances.length > 0) {
      // If we have a URL currency param, try to use it
      if (urlCurrencyParam) {
        const urlCurrencyExists = networkBalances.some(b => b.currency === urlCurrencyParam);
        if (urlCurrencyExists) {
          setSelectedCurrency(urlCurrencyParam);
          return;
        }
      }
      
      // Check if current selection is valid
      if (selectedCurrency) {
        const currencyExists = networkBalances.some(b => b.currency === selectedCurrency);
        if (currencyExists) {
          return;
        }
      }
      
      // Fallback to first balance
      setSelectedCurrency(networkBalances[0].currency);
    }
  }, [networkBalances, urlCurrencyParam]);

  // Reset URL currency param when user manually switches network
  const handleNetworkChange = (network: NetworkType) => {
    setActiveNetwork(network);
    setUrlCurrencyParam(null);
    setSelectedCurrency(null);
  };

  const currentBalanceData = useMemo(() => {
    let balance: CryptoBalance | undefined;
    
    if (selectedCurrency) {
      balance = networkBalances.find(b => b.currency === selectedCurrency);
    }
    if (!balance && networkBalances.length > 0) {
      balance = networkBalances[0];
    }
    
    return {
      id: balance?.id,
      sum: balance?.sum || "0.00",
      currency: balance?.currency || "USDT"
    };
  }, [networkBalances, selectedCurrency]);

  const currentBalance = currentBalanceData.sum;
  const currentCurrency = currentBalanceData.currency;
  const hasMultipleCurrencies = networkBalances.length > 1;

  const commission = useMemo(() => {
    // Fixed commission for all networks
    return "2.00";
  }, []);

  const isValidTransaction = useMemo(() => {
    const amount = parseFloat(sendAmount) || 0;
    const availableBalance = parseFloat(currentBalance);
    return amount > 0 && amount <= availableBalance && walletAddress.trim().length > 0;
  }, [sendAmount, currentBalance, walletAddress]);

  const sellMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/transactions", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      setLocation("/transfer-processing");
    },
    onError: () => {
      toast({
        title: t('common.error'),
        description: t('sell.transactionError'),
        variant: "destructive",
      });
    },
  });

  const handleSell = async () => {
    toast({
      title: t('sell.serviceUnavailable'),
      description: t('sell.tryAgainLater'),
      variant: "destructive",
    });
  };

  return (
    <div className="mobile-screen text-white pb-24">
      <div className="px-6 py-8">
        <h1 className="text-2xl font-bold text-center mb-8" data-testid="text-title">
          {t('sell.title')}
        </h1>
        
        <div className="flex justify-center mb-8">
          <div className="flex bg-secondary rounded-lg p-1 flex-wrap gap-1">
            {(["TRC20", "BEP20", "TON", "Polygon"] as NetworkType[]).map((network) => (
              <button
                key={network}
                onClick={() => handleNetworkChange(network)}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                  activeNetwork === network
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                data-testid={`button-network-${network.toLowerCase()}`}
              >
                {network}
              </button>
            ))}
          </div>
        </div>
        
        <div className="text-center mb-8">
          <div className="text-sm text-muted-foreground">{t('sell.balance')}:</div>
          {isLoading ? (
            <div className="text-2xl font-bold text-yellow-400">{t('common.loading')}</div>
          ) : (
            <div 
              className="text-2xl font-bold text-yellow-400"
              data-testid="text-balance"
            >
              {currentBalance} {currentCurrency}
            </div>
          )}
        </div>
        
        <div className="crypto-card mb-6">
          <div className="text-sm text-muted-foreground mb-2">{t('sell.enterAmount')}</div>
          <div className="flex items-center bg-secondary rounded-lg">
            <input 
              type="number" 
              placeholder="0" 
              className="flex-1 bg-transparent text-3xl font-bold px-4 py-3 outline-none input-field"
              value={sendAmount}
              onChange={(e) => setSendAmount(e.target.value)}
              data-testid="input-send-amount"
            />
            {hasMultipleCurrencies ? (
              <DropdownMenu>
                <DropdownMenuTrigger className="bg-secondary rounded-lg px-4 py-2 mr-2 flex items-center cursor-pointer hover:bg-secondary/80 transition-colors">
                  <span className="font-semibold">{currentCurrency}</span>
                  <ChevronDown className="w-4 h-4 ml-2" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-secondary border-green-700">
                  {networkBalances.map((balance) => (
                    <DropdownMenuItem
                      key={balance.id}
                      onClick={() => setSelectedCurrency(balance.currency)}
                      className={`cursor-pointer ${balance.currency === currentCurrency ? 'bg-accent text-accent-foreground' : ''}`}
                    >
                      {balance.currency}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="bg-secondary rounded-lg px-4 py-2 mr-2 flex items-center">
                <span className="font-semibold">{currentCurrency}</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex justify-center -mt-[25px] -mb-[25px] relative z-20">
          <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center border-[6px] relative -top-2" style={{borderColor: '#2a4c3b'}}>
            <ArrowDown className="w-6 h-6 text-accent-foreground" />
          </div>
        </div>
        
        <div className="crypto-card mb-6">
          <div className="text-sm text-muted-foreground mb-2">Введите кошелек в сети {activeNetwork}</div>
          <div className="bg-secondary rounded-lg px-4 py-3">
            <input
              type="text"
              placeholder={`Введите адрес ${activeNetwork}`}
              className="w-full bg-transparent font-mono text-sm outline-none input-field"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              data-testid="input-recipient-wallet"
            />
          </div>
        </div>
        
        <div className="text-center mb-8">
          <div className="text-sm text-muted-foreground">Комиссия составит</div>
          <div 
            className="text-lg font-semibold text-yellow-400"
            data-testid="text-commission"
          >
            {commission} {currentCurrency}
          </div>
        </div>
        
        <button 
          className={`action-button ${!isValidTransaction ? 'opacity-50 cursor-not-allowed' : ''}`}
          onClick={handleSell}
          disabled={!isValidTransaction || sellMutation.isPending}
          data-testid="button-send"
        >
          {sellMutation.isPending ? "Обработка..." : "Отправить"}
          <ArrowRight className="w-5 h-5 ml-2" />
        </button>
      </div>
    </div>
  );
}
