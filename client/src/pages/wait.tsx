import { useState, useEffect } from "react";
import { Link } from "wouter";
import { X, Clock, ArrowDown, Copy, Check } from "lucide-react";
import { formatCountdown, copyToClipboard } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export default function WaitScreen() {
  const [countdown, setCountdown] = useState(900); // 15:00 in seconds
  const [txHash] = useState("0x149CA1F11D487c2bC6453E90080A eBEB4BA3C2bKujafs76Z1sd");
  const [cardNumber] = useState("4373 8349 9348 7328");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    // Auto-redirect to success after countdown
    if (countdown === 0) {
      setTimeout(() => {
        window.location.href = "/success";
      }, 2000);
    }

    return () => clearInterval(timer);
  }, [countdown]);

  const handleCopyTxHash = async () => {
    try {
      await copyToClipboard(txHash);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Transaction hash copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy transaction hash",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="mobile-screen text-white">
      {/* Header */}
      <div className="mobile-header">
        <h1 className="text-lg font-semibold" data-testid="text-title">
          Проверка платежа
        </h1>
        <Link href="/top-up">
          <button 
            className="w-8 h-8 rounded-full bg-black/20 flex items-center justify-center"
            data-testid="button-close"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </Link>
      </div>
      
      {/* Status */}
      <div className="text-center mb-4">
        <div className="text-yellow-400 font-semibold" data-testid="text-status">
          ищем транзакцию
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
      
      {/* Transaction Details */}
      <div className="px-6 space-y-6">
        {/* Transaction Found */}
        <div className="crypto-card">
          <div className="text-sm text-muted-foreground mb-2">Ваш транзакции найден</div>
          <div className="flex items-center justify-between mb-4">
            <div 
              className="text-3xl font-bold"
              data-testid="text-transaction-amount"
            >
              100.00
            </div>
            <div className="flex items-center bg-secondary rounded-lg px-3 py-1">
              <span className="font-semibold">USDT TRC20</span>
            </div>
          </div>
          
          <div className="bg-secondary rounded-lg p-3 mb-2">
            <div 
              className="font-mono text-xs break-all"
              data-testid="text-transaction-hash"
            >
              {txHash}
            </div>
          </div>
          
          <button 
            className="p-1 hover:bg-white/10 rounded"
            onClick={handleCopyTxHash}
            data-testid="button-copy-hash"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-400" />
            ) : (
              <Copy className="w-4 h-4 text-accent" />
            )}
          </button>
        </div>
        
        {/* Arrow Down */}
        <div className="flex justify-center">
          <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center">
            <ArrowDown className="w-6 h-6 text-accent-foreground" />
          </div>
        </div>
        
        {/* Ready to Send */}
        <div className="crypto-card">
          <div className="text-sm text-muted-foreground mb-2">Готовим к отправке</div>
          <div className="flex items-center justify-between mb-4">
            <div 
              className="text-3xl font-bold"
              data-testid="text-payout-amount"
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
        
        {/* Loading indicator */}
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 bg-accent rounded-full animate-pulse-green"></div>
        </div>
      </div>
    </div>
  );
}
