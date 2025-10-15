import { useState, useMemo, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { X, ArrowDown, ArrowRight, ChevronDown } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type NetworkType = "TRC20" | "BEP20" | "TON";

interface CryptoBalance {
  id: number;
  title: string;
  network: string;
  currency: string;
  sum: string;
  status: string;
}

export default function SellScreen() {
  const [sendAmount, setSendAmount] = useState("0");
  const [activeNetwork, setActiveNetwork] = useState<NetworkType>("TRC20");
  const [walletAddress, setWalletAddress] = useState("");
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const networkParam = urlParams.get('network') as NetworkType;
    if (networkParam && ['TRC20', 'BEP20', 'TON'].includes(networkParam)) {
      setActiveNetwork(networkParam);
    }
  }, [location]);

  const { data: cryptoBalances = [], isLoading } = useQuery<CryptoBalance[]>({
    queryKey: ["/api/user/crypto-balances"],
  });

  const currentBalance = useMemo(() => {
    const balance = cryptoBalances.find(b => b.network === activeNetwork);
    return balance?.sum || "0.00";
  }, [cryptoBalances, activeNetwork]);

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
        title: "Ошибка",
        description: "Не удалось выполнить транзакцию",
        variant: "destructive",
      });
    },
  });

  const handleSell = async () => {
    toast({
      title: "Сервис временно не доступен",
      description: "Пожалуйста, попробуйте позже",
      variant: "destructive",
    });
  };

  return (
    <div className="mobile-screen text-white pb-24">
      <div className="px-6 py-8">
        <h1 className="text-2xl font-bold text-center mb-8" data-testid="text-title">
          Отправить
        </h1>
        
        <div className="flex justify-center mb-8">
          <div className="flex bg-secondary rounded-lg p-1">
            {(["TRC20", "BEP20", "TON"] as NetworkType[]).map((network) => (
              <button
                key={network}
                onClick={() => setActiveNetwork(network)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
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
          <div className="text-sm text-muted-foreground">Баланс:</div>
          {isLoading ? (
            <div className="text-2xl font-bold text-yellow-400">Загрузка...</div>
          ) : (
            <div 
              className="text-2xl font-bold text-yellow-400"
              data-testid="text-balance"
            >
              {currentBalance} USDT
            </div>
          )}
        </div>
        
        <div className="crypto-card mb-6">
          <div className="text-sm text-muted-foreground mb-2">Введите сумму отправки</div>
          <div className="flex items-center bg-secondary rounded-lg">
            <input 
              type="number" 
              placeholder="0" 
              className="flex-1 bg-transparent text-3xl font-bold px-4 py-3 outline-none input-field"
              value={sendAmount}
              onChange={(e) => setSendAmount(e.target.value)}
              data-testid="input-send-amount"
            />
            <div className="bg-secondary rounded-lg px-4 py-2 mr-2 flex items-center">
              <span className="font-semibold">USDT</span>
              <ChevronDown className="w-4 h-4 ml-2" />
            </div>
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
            {commission} USDT
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
