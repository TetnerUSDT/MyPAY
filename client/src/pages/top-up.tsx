import { Link, useLocation } from "wouter";
import { Copy, ArrowRight, Check, ChevronDown } from "lucide-react";
import { useState, useEffect } from "react";
import { copyToClipboard } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import StyledQRCodeComponent from "@/components/styled-qr-code";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getBalanceIcon } from "@/lib/balanceIcons";

interface ReservedWallet {
  id: number;
  idUser: number;
  network: string;
  address: string;
  privateKey: string | null;
  reservationTime: string | null;
  reserved: string | null;
  status: string | null;
}

type QRColorConfig = 
  | { type: 'single', color: string } 
  | { type: 'gradient', colors: [string, string] };

interface UserBalance {
  id: number;
  title: string;
  network: string;
  currency: string;
  sum: string;
  status: string;
  balanceStatus: string;
  accountNumber?: string;
  qrColor?: QRColorConfig;
  qrStyle?: 'square' | 'dots' | 'rounded' | 'extra-rounded' | 'classy' | 'classy-rounded';
}

export default function TopUpScreen() {
  const [activeBalance, setActiveBalance] = useState<UserBalance | null>(null);
  const [copied, setCopied] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const { toast } = useToast();
  const [location, navigate] = useLocation();

  // Get crypto balances
  const { data: cryptoBalances = [] } = useQuery<UserBalance[]>({
    queryKey: ["/api/user/crypto-balances"],
  });

  // Filter active (not frozen) balances - only crypto now
  const availableBalances = cryptoBalances.filter(balance => balance.balanceStatus !== 'frozen');

  const reserveWalletMutation = useMutation({
    mutationFn: async (network: string) => {
      const res = await apiRequest("POST", "/api/wallets/reserve-for-topup", {
        network
      });
      return (await res.json()) as ReservedWallet;
    }
  });

  const createTopupMutation = useMutation({
    mutationFn: async (data: { walletAddress: string; network: string }) => {
      const res = await apiRequest("POST", "/api/topup/create", data);
      return await res.json();
    },
    onSuccess: () => {
      navigate("/top-up-success");
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось создать заявку на пополнение",
        variant: "destructive",
      });
    }
  });

  // Initialize active balance when balances load
  useEffect(() => {
    if (availableBalances.length > 0) {
      const currentBalanceValid = activeBalance && availableBalances.some(b => b.id === activeBalance.id);
      if (!currentBalanceValid) {
        setActiveBalance(availableBalances[0]);
      }
    } else {
      setActiveBalance(null);
    }
  }, [cryptoBalances]);

  // Reserve wallet for crypto balances
  useEffect(() => {
    if (activeBalance && activeBalance.network) {
      reserveWalletMutation.reset();
      reserveWalletMutation.mutate(activeBalance.network);
    }
  }, [activeBalance]);

  const wallet = reserveWalletMutation.data;

  // Timer for crypto wallet reservation
  useEffect(() => {
    if (wallet?.reservationTime) {
      const updateTimer = () => {
        const now = new Date();
        const expiryTime = new Date(wallet.reservationTime!);
        const diff = expiryTime.getTime() - now.getTime();

        if (diff <= 0) {
          setTimeRemaining("00:00:00");
          if (activeBalance) {
            reserveWalletMutation.mutate(activeBalance.network);
          }
          return;
        }

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        setTimeRemaining(
          `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        );
      };

      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    }
  }, [wallet?.reservationTime, activeBalance]);

  // Determine what to display (wallet address)
  const displayValue = wallet?.address || "Loading...";
  const qrData = wallet?.address || "";

  const handleCopyAddress = async () => {
    if (!displayValue || displayValue === "Loading...") return;
    
    try {
      await copyToClipboard(displayValue);
      setCopied(true);
      toast({
        title: "Скопировано!",
        description: "Адрес кошелька скопирован в буфер обмена",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось скопировать",
        variant: "destructive",
      });
    }
  };

  const handleContinue = () => {
    if (wallet?.address && activeBalance) {
      createTopupMutation.mutate({
        walletAddress: wallet.address,
        network: activeBalance.network
      });
    }
  };

  const isLoading = reserveWalletMutation.isPending;
  const canContinue = wallet?.address && activeBalance;

  return (
    <div className="mobile-screen text-white overflow-y-auto pb-20">
      <div className="mobile-content">
        <h1 className="text-2xl font-bold text-center mb-8" data-testid="text-title">
          Пополнить {activeBalance?.currency || ""}
        </h1>
        
        {/* Crypto Currency Selector Dropdown */}
        <div className="mb-6">
          <Select
            value={activeBalance?.id?.toString() || ""}
            onValueChange={(value) => {
              const selected = availableBalances.find(b => b.id.toString() === value);
              if (selected) setActiveBalance(selected);
            }}
          >
            <SelectTrigger 
              className="w-full bg-secondary border-0 h-14"
              data-testid="select-crypto-currency"
            >
              <SelectValue placeholder="Выберите криптовалюту">
                {activeBalance && (
                  <div className="flex items-center">
                    <img 
                      src={getBalanceIcon(activeBalance.id)} 
                      alt={activeBalance.title}
                      className="w-8 h-8 rounded-full mr-3"
                    />
                    <div className="text-left">
                      <span className="font-medium">{activeBalance.title}</span>
                      <span className="text-muted-foreground ml-2 text-sm">({activeBalance.network})</span>
                    </div>
                  </div>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-secondary border-0">
              {availableBalances.map((balance) => (
                <SelectItem 
                  key={balance.id} 
                  value={balance.id.toString()}
                  data-testid={`select-item-${balance.currency.toLowerCase()}-${balance.id}`}
                >
                  <div className="flex items-center py-1">
                    <img 
                      src={getBalanceIcon(balance.id)} 
                      alt={balance.title}
                      className="w-8 h-8 rounded-full mr-3"
                    />
                    <div>
                      <span className="font-medium">{balance.title}</span>
                      <span className="text-muted-foreground ml-2 text-sm">({balance.network})</span>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="crypto-card text-center mb-8">
          
          {isLoading ? (
            <div className="flex justify-center items-center h-48 mb-6">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
            </div>
          ) : (
            <>
              <div className="qr-code-container mx-auto mb-6 w-48 h-48" data-testid="qr-code-container">
                <StyledQRCodeComponent 
                  value={qrData} 
                  size={192} 
                  balanceId={activeBalance?.id}
                  qrColor={activeBalance?.qrColor}
                  qrStyle={activeBalance?.qrStyle}
                />
              </div>
              
              <div className="text-sm text-muted-foreground mb-2">
                На адрес кошелька
              </div>
              <div className="flex items-center bg-secondary rounded-lg p-3 mb-3">
                <span 
                  className="font-mono text-sm flex-1 truncate"
                  data-testid="text-address"
                >
                  {displayValue}
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
              
              {timeRemaining && (
                <div className="text-sm text-muted-foreground" data-testid="text-timer">
                  Адрес действителен {timeRemaining}
                </div>
              )}
            </>
          )}
        </div>
        
        <Button
          onClick={handleContinue}
          className="action-button w-full"
          data-testid="button-continue"
          disabled={isLoading || createTopupMutation.isPending || !canContinue}
        >
          {createTopupMutation.isPending ? "Отправка..." : "Далее"}
          <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    </div>
  );
}
