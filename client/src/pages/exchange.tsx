import { useState, useEffect } from "react";
import { Link } from "wouter";
import { X, Clock, Copy, ArrowDown, ArrowRight, Check } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { formatCountdown, copyToClipboard, generateOrderId } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export default function ExchangeScreen() {
  const [countdown, setCountdown] = useState(3599); // 59:59 in seconds
  const [orderId] = useState(() => generateOrderId());
  const [walletAddress] = useState("TW6LqMKykCfsgkMkLxd92HGbp...");
  const [cardNumber] = useState("4373 8349 9348 7328");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get exchange rate
  const { data: exchangeRate } = useQuery({
    queryKey: ["/api/exchange-rates/USDT/RUB"],
  });

  // Create transaction mutation
  const createTransactionMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/transactions", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
    },
  });

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleCopyAddress = async () => {
    try {
      await copyToClipboard(walletAddress);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Wallet address copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy address",
        variant: "destructive",
      });
    }
  };

  const handlePay = async () => {
    try {
      await createTransactionMutation.mutateAsync({
        fromCurrency: "USDT",
        toCurrency: "RUB",
        fromAmount: "100.00",
        toAmount: "8000.00",
        fromAddress: walletAddress,
        toAddress: null,
        cardNumber: cardNumber,
        status: "pending",
      });
      
      // Navigate to top-up screen
      window.location.href = "/top-up";
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create transaction",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="mobile-screen text-white">
      {/* Header */}
      <div className="mobile-header">
        <h1 className="text-lg font-semibold" data-testid="text-order-title">
          Номер заявки
        </h1>
        <Link href="/country">
          <button 
            className="w-8 h-8 rounded-full bg-black/20 flex items-center justify-center"
            data-testid="button-close"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </Link>
      </div>
      
      {/* Order Number */}
      <div className="text-center mb-4">
        <div 
          className="text-2xl font-bold text-yellow-400"
          data-testid="text-order-number"
        >
          {orderId}
        </div>
        <div className="countdown-timer inline-flex items-center px-4 py-2 rounded-full mt-2">
          <Clock className="w-4 h-4 mr-2 text-yellow-400" />
          <span 
            className="font-mono"
            data-testid="text-countdown"
          >
            {formatCountdown(countdown)}
          </span>
        </div>
      </div>
      
      {/* Exchange Details */}
      <div className="px-6 space-y-6">
        {/* Send Amount */}
        <div className="crypto-card">
          <div className="text-sm text-muted-foreground mb-2">Переведите сумму</div>
          <div className="flex items-center justify-between">
            <div 
              className="text-3xl font-bold"
              data-testid="text-send-amount"
            >
              100.00
            </div>
            <div className="flex items-center bg-secondary rounded-lg px-3 py-1">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              <span className="font-semibold">USDT TRC20</span>
            </div>
          </div>
          
          <div className="mt-4">
            <div className="text-sm text-muted-foreground mb-2">На адрес кошелька</div>
            <div className="flex items-center bg-secondary rounded-lg p-3">
              <span 
                className="font-mono text-sm flex-1"
                data-testid="text-wallet-address"
              >
                {walletAddress}
              </span>
              <button 
                className="ml-2 p-1 hover:bg-white/10 rounded"
                onClick={handleCopyAddress}
                data-testid="button-copy-address"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-accent" />
                )}
              </button>
            </div>
          </div>
        </div>
        
        {/* Arrow Down */}
        <div className="flex justify-center">
          <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center">
            <ArrowDown className="w-6 h-6 text-accent-foreground" />
          </div>
        </div>
        
        {/* Receive Amount */}
        <div className="crypto-card">
          <div className="text-sm text-muted-foreground mb-2">Сумма к получению</div>
          <div className="flex items-center justify-between mb-4">
            <div 
              className="text-3xl font-bold"
              data-testid="text-receive-amount"
            >
              8000.00
            </div>
            <div className="text-xl font-semibold text-muted-foreground">РУБ</div>
          </div>
          
          <div>
            <div className="text-sm text-muted-foreground mb-2">На номер карты</div>
            <div className="bg-secondary rounded-lg p-3">
              <span 
                className="font-mono"
                data-testid="text-card-number"
              >
                {cardNumber}
              </span>
            </div>
          </div>
        </div>
        
        {/* Pay Button */}
        <button 
          className="action-button"
          onClick={handlePay}
          disabled={createTransactionMutation.isPending}
          data-testid="button-pay"
        >
          {createTransactionMutation.isPending ? "Обработка..." : "Я оплатил"}
          <ArrowRight className="w-5 h-5 ml-2" />
        </button>
      </div>
    </div>
  );
}
