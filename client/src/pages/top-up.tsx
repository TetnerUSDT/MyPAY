import { Link } from "wouter";
import { X, ArrowDown, Copy, ArrowRight, Check } from "lucide-react";
import { useState } from "react";
import { copyToClipboard } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import QRCodeComponent from "@/components/qr-code";

type NetworkType = "TRC20" | "BEP20" | "TON";

export default function TopUpScreen() {
  const [activeNetwork, setActiveNetwork] = useState<NetworkType>("TRC20");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const networkData: Record<NetworkType, { address: string; qrData: string }> = {
    TRC20: {
      address: "TW6LqMKykCfsgkMkLxd92HGbp...",
      qrData: "TW6LqMKykCfsgkMkLxd92HGbp..."
    },
    BEP20: {
      address: "0x1234567890abcdef12345678...",
      qrData: "0x1234567890abcdef12345678..."
    },
    TON: {
      address: "EQD1234567890abcdef123456...",
      qrData: "EQD1234567890abcdef123456..."
    }
  };

  const walletAddress = networkData[activeNetwork].address;
  const qrData = networkData[activeNetwork].qrData;

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
      {/* Content */}
      <div className="mobile-content">
        <h1 className="text-2xl font-bold text-center mb-8" data-testid="text-title">
          Пополнить USDT
        </h1>
        
        {/* Network Selection */}
        <div className="flex justify-center mb-12">
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
        
        {/* QR Code Section */}
        <div className="crypto-card text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center">
              <ArrowDown className="w-6 h-6 text-accent-foreground" />
            </div>
          </div>
          
          {/* QR Code */}
          <div className="qr-code-container mx-auto mb-6 w-48 h-48" data-testid="qr-code-container">
            <QRCodeComponent value={qrData} size={192} />
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
        <Link href="/top-up-success">
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
