import { useState } from "react";
import { Link } from "wouter";
import { X, ArrowDown, ArrowRight, ChevronDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export default function SellScreen() {
  const [sendAmount, setSendAmount] = useState("0");
  const [walletAddress] = useState("TW6LqMKykCfsgkMkLxd92HGbp...");

  // Get user balance (mock data for demo)
  const { data: balance } = useQuery({
    queryKey: ["/api/wallets/user/demo"],
    queryFn: () => Promise.resolve({ balance: "0.000000" }),
  });

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
      <div className="px-6 py-8">
        <h1 className="text-2xl font-bold text-center mb-8" data-testid="text-title">
          Отправить Tether TRC20
        </h1>
        
        {/* Balance Display */}
        <div className="text-center mb-8">
          <div className="text-sm text-muted-foreground">Баланс:</div>
          <div 
            className="text-2xl font-bold text-yellow-400"
            data-testid="text-balance"
          >
            {balance?.balance || "0.000000"} USDT
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
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center">
            <ArrowDown className="w-6 h-6 text-accent-foreground" />
          </div>
        </div>
        
        {/* Recipient Wallet */}
        <div className="crypto-card mb-6">
          <div className="text-sm text-muted-foreground mb-2">Введите кошелек в сети TRC20</div>
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
            1.000000 USDT
          </div>
        </div>
        
        {/* Send Button */}
        <Link href="/success">
          <button 
            className="action-button"
            data-testid="button-send"
          >
            Отправить
            <ArrowRight className="w-5 h-5 ml-2" />
          </button>
        </Link>
      </div>
    </div>
  );
}
