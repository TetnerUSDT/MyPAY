import { Link } from "wouter";
import { Copy, Check, CheckCircle } from "lucide-react";
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
        
        {/* Success Animation */}
        <div className="w-32 h-32 mb-12 flex items-center justify-center">
          <CheckCircle 
            className="w-24 h-24 text-accent" 
            data-testid="animation-success"
          />
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