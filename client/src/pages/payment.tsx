import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { X, ArrowDown, Copy, Check, Clock } from "lucide-react";
import { copyToClipboard } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export default function PaymentScreen() {
  const [timer, setTimer] = useState(3599); // 59:59 in seconds
  const [copied, setCopied] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const applicationNumber = "872342833";
  const transferAmount = "100.00";
  const currency = "USDT TRC20";
  const fullWalletAddress = "TW6LqMKykCfsgkMkLxd92HGbpQnGtcpLzGzJKTdLhQ2"; // Full address for copying
  const displayWalletAddress = "TW6LqMKykCfsgkMkLxd92HGbp..."; // Truncated for display
  const receiveAmount = "8000.00";
  const cardNumber = "4373 8349 9348 7328";

  // Timer countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Format timer to MM:SS
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleCopyAddress = async () => {
    try {
      await copyToClipboard(fullWalletAddress);
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

  const handlePaymentConfirmed = () => {
    setLocation("/wait");
  };

  return (
    <div className="mobile-screen text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-6">
        <h1 className="text-xl font-semibold" data-testid="text-title">
          Номер заявки
        </h1>
        <Link href="/exchange">
          <button 
            className="w-8 h-8 rounded-full bg-black/20 flex items-center justify-center"
            data-testid="button-close"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </Link>
      </div>

      <div className="px-6">
        {/* Application Number */}
        <div className="text-center mb-6">
          <div className="text-2xl font-bold text-yellow-400 mb-4" data-testid="text-application-number">
            {applicationNumber}
          </div>
          
          {/* Timer */}
          <div className="inline-flex items-center bg-secondary rounded-lg px-4 py-2">
            <Clock className="w-4 h-4 mr-2 text-yellow-400" />
            <span className="font-mono text-lg" data-testid="text-timer">
              {formatTime(timer)}
            </span>
          </div>
        </div>

        {/* Transfer Amount Section */}
        <div className="crypto-card mb-4">
          <div className="text-sm text-muted-foreground mb-2">Переведите сумму</div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-3xl font-bold">{transferAmount}</span>
            <div className="flex items-center bg-secondary rounded-lg px-3 py-1">
              <span className="text-yellow-400 font-medium">{currency}</span>
            </div>
          </div>
          
          {/* Wallet Address */}
          <div className="text-sm text-muted-foreground mb-2">На адрес кошелька</div>
          <div className="flex items-center bg-secondary rounded-lg p-3">
            <span 
              className="font-mono text-sm flex-1"
              data-testid="text-wallet-address"
            >
              {displayWalletAddress}
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

        {/* Arrow Down */}
        <div className="flex justify-center -mt-[25px] -mb-[25px] relative z-20">
          <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center border-[6px] relative -top-2" style={{borderColor: '#2a4c3b'}}>
            <ArrowDown className="w-6 h-6 text-accent-foreground" />
          </div>
        </div>

        {/* Receive Amount Section */}
        <div className="crypto-card mb-6">
          <div className="text-sm text-muted-foreground mb-2">Сумма к получению</div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-3xl font-bold">{receiveAmount}</span>
            <span className="text-2xl font-bold text-yellow-400">РУБ</span>
          </div>
          
          {/* Card Number */}
          <div className="text-sm text-muted-foreground mb-2">На номер карты</div>
          <div className="bg-secondary rounded-lg p-3">
            <span 
              className="font-mono text-sm"
              data-testid="text-card-number"
            >
              {cardNumber}
            </span>
          </div>
        </div>

        {/* Payment Confirmed Button */}
        <button 
          className="action-button"
          onClick={handlePaymentConfirmed}
          data-testid="button-payment-confirmed"
        >
          Я оплатил
          <ArrowDown className="w-5 h-5 ml-2 rotate-90" />
        </button>
      </div>
    </div>
  );
}