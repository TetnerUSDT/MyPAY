import { useState, useMemo, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { ChevronLeft, ArrowDown, ArrowRight, ChevronDown, Wallet } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
    <div className="min-h-screen bg-[#0B0C10] text-[#E2E8F0] pb-28 font-sans selection:bg-[#3ab368]/30 selection:text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-6 pb-4">
        <Link href="/home">
          <button className="w-10 h-10 rounded-full bg-white/5 border border-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
            <ChevronLeft className="w-5 h-5 text-white/70" />
          </button>
        </Link>
        <h1 className="text-[17px] font-semibold tracking-tight text-white">{t('sell.title')}</h1>
        <div className="w-10 h-10" />
      </div>

      {/* Network Tabs */}
      <div className="px-5 mb-5 flex justify-center">
        <div className="bg-[#13151A] border border-white/5 rounded-2xl p-1 flex gap-1 w-full">
          {(["TRC20", "BEP20", "TON", "Polygon"] as NetworkType[]).map((network) => (
            <button
              key={network}
              onClick={() => handleNetworkChange(network)}
              className={`flex-1 px-3 py-2 text-xs font-semibold transition-all ${
                activeNetwork === network
                  ? "bg-[#1A1D24] border border-white/10 text-white rounded-xl shadow-sm"
                  : "text-white/40 hover:text-white/70 rounded-xl"
              }`}
              data-testid={`button-network-${network.toLowerCase()}`}
            >
              {network}
            </button>
          ))}
        </div>
      </div>

      {/* Main Card */}
      <div className="bg-[#13151A] border border-white/5 rounded-3xl p-5 mx-5 shadow-2xl shadow-black/40">
        
        {/* Balance Row */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-white/40 mb-1">{t('sell.balance')}</div>
            {isLoading ? (
              <div className="text-sm font-bold text-white/70">{t('common.loading')}</div>
            ) : (
              <div className="font-bold text-white text-base" data-testid="text-balance">
                {currentBalance} {currentCurrency}
              </div>
            )}
          </div>

          {hasMultipleCurrencies && (
            <Select value={selectedCurrency || undefined} onValueChange={(val) => setSelectedCurrency(val)}>
              <SelectTrigger className="w-auto min-w-[100px] bg-[#1A1D24] border-white/5 rounded-xl h-8 text-xs focus:ring-0">
                <SelectValue placeholder={currentCurrency} />
              </SelectTrigger>
              <SelectContent className="bg-[#1A1D24] border-white/10 text-white rounded-xl">
                {networkBalances.map((balance) => (
                  <SelectItem key={balance.id} value={balance.currency} className="focus:bg-white/5 focus:text-white rounded-lg cursor-pointer text-xs">
                    {balance.currency}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Amount Input */}
        <div className="mb-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-white/40 mb-2">{t('sell.enterAmount')}</div>
          <div className="flex items-center gap-2 mb-2 relative">
            <input 
              type="number"
              placeholder="0"
              className="text-4xl font-bold bg-transparent outline-none text-white w-full placeholder:text-white/20"
              value={sendAmount}
              onChange={(e) => setSendAmount(e.target.value)}
              data-testid="input-send-amount"
            />
            <div className="flex flex-col items-end gap-1 absolute right-0 top-1/2 -translate-y-1/2">
              <div className="text-white/50 text-sm font-semibold">{currentCurrency}</div>
              <button 
                onClick={() => setSendAmount(currentBalance)}
                className="bg-[#3ab368]/10 text-[#3ab368] text-[10px] font-bold px-2 py-0.5 rounded-full hover:bg-[#3ab368]/20 transition-colors"
              >
                MAX
              </button>
            </div>
          </div>
          <div className="border-b border-white/5 w-full"></div>
        </div>

        {/* Swap arrow */}
        <div className="flex items-center justify-center py-3">
          <div className="w-8 h-8 rounded-full bg-[#1A1D24] border border-white/5 flex items-center justify-center">
            <ArrowDown className="w-4 h-4 text-white/40" />
          </div>
        </div>

        {/* Wallet address */}
        <div className="mb-6">
          <div className="text-[11px] font-bold uppercase tracking-wider text-white/40 mb-2">
            {t('sell.enterWalletInNetwork', { network: activeNetwork })}
          </div>
          <div className="bg-[#1A1D24] rounded-2xl px-4 py-3 border border-white/5 focus-within:border-white/15 transition-colors flex items-center gap-3">
            <Wallet className="w-4 h-4 text-white/30 shrink-0" />
            <input
              type="text"
              placeholder={t('sell.enterAddress', { network: activeNetwork })}
              className="w-full bg-transparent font-mono text-sm outline-none text-white/90 placeholder:text-white/20"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              data-testid="input-recipient-wallet"
            />
          </div>
        </div>

        {/* Commission */}
        <div className="flex items-center justify-between mb-1 px-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-white/40">{t('sell.feeWillBe')}</div>
          <div className="text-sm font-semibold text-white/60" data-testid="text-commission">
            {commission} {currentCurrency}
          </div>
        </div>

        {/* Submit Button */}
        <button
          className="w-full bg-[#3ab368] hover:bg-[#3ab368]/90 disabled:opacity-40 disabled:cursor-not-allowed text-[#0B0C10] font-bold py-4 rounded-2xl transition-all shadow-lg shadow-[#3ab368]/20 active:scale-[0.98] flex items-center justify-center gap-2 mt-5"
          onClick={handleSell}
          disabled={!isValidTransaction || sellMutation.isPending}
          data-testid="button-send"
        >
          {sellMutation.isPending ? t('sell.processing') : t('sell.submit')}
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
