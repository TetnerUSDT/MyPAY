import { Link } from "wouter";
import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { copyToClipboard } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export default function TransferSuccessScreen() {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const txHash = "jvuv22ev29ev2v92ev9c2ev92ev..."; // Mock transaction hash

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
      <div className="flex flex-col items-center justify-center min-h-screen text-center px-6">
        <h1 className="text-2xl font-bold mb-16" data-testid="text-title">
          Выполнена успешно
        </h1>
        
        {/* Success Icon - Checkmark */}
        <div className="w-32 h-32 mb-12 flex items-center justify-center">
          <svg 
            width="116" 
            height="116" 
            viewBox="0 0 116 116" 
            fill="none" 
            className="animate-pulse-green"
            data-testid="icon-success"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              height="116" 
              width="116" 
              viewBox="0 0 24 24" 
              fill="#a5fe7c"
            >
              <path fill="none" d="M0 0h24v24H0z"/>
              <path d="M22 5.18 10.59 16.6l-4.24-4.24 1.41-1.41 2.83 2.83 10-10zm-2.21 5.04c.13.57.21 1.17.21 1.78 0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8c1.58 0 3.04.46 4.28 1.25l1.44-1.44A9.9 9.9 0 0 0 12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10c0-1.19-.22-2.33-.6-3.39z"/>
            </svg>
          </svg>
        </div>
        
        <p className="text-lg mb-12 px-4">
          Средства были отправлены на указанный кошелек
        </p>
        
        {/* Transaction Hash Section */}
        <div className="w-full max-w-sm mb-12">
          <div className="text-sm text-muted-foreground mb-2">Хеш транзакции</div>
          <div className="flex items-center bg-secondary rounded-lg p-3">
            <span 
              className="font-mono text-sm flex-1 truncate"
              data-testid="text-transaction-hash"
            >
              {txHash}
            </span>
            <button 
              className="ml-2 p-1 hover:bg-white/10 rounded"
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
        </div>
        
        <div className="w-full max-w-sm">
          <Link href="/home" className="w-full">
            <button 
              className="action-button"
              data-testid="button-back-home"
            >
              Вернуться на главную
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}