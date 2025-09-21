import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { X, ArrowDown, ArrowRight, ChevronDown } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type NetworkType = "TRC20" | "BEP20" | "TON";

export default function SellScreen() {
  const [sendAmount, setSendAmount] = useState("0");
  const [activeNetwork, setActiveNetwork] = useState<NetworkType>("TRC20");
  const [walletAddress] = useState("TW6LqMKykCfsgkMkLxd92HGbp...");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get user balance (mock data for demo)
  const { data: balance } = useQuery({
    queryKey: ["/api/wallets/user/demo"],
    queryFn: () => Promise.resolve({ balance: "100.000000" }),
  });

  // Calculate commission dynamically (1% of send amount)
  const commission = useMemo(() => {
    const amount = parseFloat(sendAmount) || 0;
    const commissionRate = 0.01; // 1%
    return (amount * commissionRate).toFixed(6);
  }, [sendAmount]);

  // Validation
  const isValidTransaction = useMemo(() => {
    const amount = parseFloat(sendAmount) || 0;
    const availableBalance = parseFloat(balance?.balance || "0");
    return amount > 0 && amount <= availableBalance;
  }, [sendAmount, balance?.balance]);

  // Create sell transaction mutation
  const sellMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/transactions", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      // Navigate to processing state
      setLocation("/transfer-processing");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to complete transaction",
        variant: "destructive",
      });
    },
  });

  const handleSell = async () => {
    if (!isValidTransaction) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount within your balance",
        variant: "destructive",
      });
      return;
    }

    const commissionAmount = parseFloat(commission);
    const receiveAmount = parseFloat(sendAmount) - commissionAmount;

    try {
      await sellMutation.mutateAsync({
        fromCurrency: "USDT",
        toCurrency: "USDT",
        fromAmount: sendAmount,
        toAmount: receiveAmount.toFixed(6),
        fromAddress: walletAddress,
        toAddress: walletAddress,
        cardNumber: null,
        status: "completed",
      });
    } catch (error) {
      // Error handling done in onError
    }
  };

  return (
    <div className="mobile-screen text-white">
      {/* Content */}
      <div className="px-6 py-8">
        <h1 className="text-2xl font-bold text-center mb-8" data-testid="text-title">
          Отправить
        </h1>
        
        {/* Network Selection */}
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
        
        {/* Balance Display */}
        <div className="text-center mb-8">
          <div className="text-sm text-muted-foreground">Баланс:</div>
          <div 
            className="text-2xl font-bold text-yellow-400"
            data-testid="text-balance"
          >
            {balance?.balance || "100.000000"} USDT
          </div>
        </div>
        
        {/* Send Amount */}
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
        
        {/* Arrow Down */}
        <div className="flex justify-center -mt-[50px] -mb-[50px] relative z-20">
          <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center border-[6px] relative -top-2" style={{borderColor: '#2a4c3b'}}>
            <ArrowDown className="w-6 h-6 text-accent-foreground" />
          </div>
        </div>
        
        {/* Recipient Wallet */}
        <div className="crypto-card mb-6">
          <div className="text-sm text-muted-foreground mb-2">Введите кошелек в сети {activeNetwork}</div>
          <div className="bg-secondary rounded-lg px-4 py-3 flex items-center">
            <span 
              className="font-mono text-sm flex-1"
              data-testid="text-recipient-wallet"
            >
              {walletAddress}
            </span>
            <ChevronDown className="w-4 h-4 ml-2" />
          </div>
        </div>
        
        {/* Commission */}
        <div className="text-center mb-8">
          <div className="text-sm text-muted-foreground">Комиссия составит</div>
          <div 
            className="text-lg font-semibold text-yellow-400"
            data-testid="text-commission"
          >
            {commission} USDT
          </div>
        </div>
        
        {/* Send Button */}
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
