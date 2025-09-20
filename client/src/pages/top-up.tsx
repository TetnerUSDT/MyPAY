import { Link } from "wouter";
import { X, ArrowDown, Copy, ArrowRight, Check } from "lucide-react";
import { useState } from "react";
import { copyToClipboard } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import QRCodeComponent from "@/components/qr-code";

export default function TopUpScreen() {
  const [walletAddress] = useState("TW6LqMKykCfsgkMkLxd92HGbp...");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

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

  return (
    <div className="mobile-screen text-white">
      {/* Header */}
      <div className="mobile-header">
        <div className="w-8 h-1 bg-white rounded-full"></div>
        <Link href="/exchange">
          <button 
            className="w-8 h-8 rounded-full bg-black/20 flex items-center justify-center"
            data-testid="button-close"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </Link>
      </div>
      
      {/* Content */}
      <div className="mobile-content">
        <h1 className="text-2xl font-bold text-center mb-12" data-testid="text-title">
          Пополнить
        </h1>
        
        {/* QR Code Section */}
        <div className="crypto-card text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center">
              <ArrowDown className="w-6 h-6 text-accent-foreground" />
            </div>
          </div>
          
          {/* QR Code */}
          <div className="qr-code-container mx-auto mb-6 w-48 h-48" data-testid="qr-code-container">
            <QRCodeComponent value={walletAddress} size={192} />
          </div>
          
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
        
        {/* Continue Button */}
        <Link href="/wait">
          <button 
            className="action-button"
            data-testid="button-continue"
          >
            Далее
            <ArrowRight className="w-5 h-5 ml-2" />
          </button>
        </Link>
      </div>
    </div>
  );
}
