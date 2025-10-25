import { Link, useLocation } from "wouter";
import { Copy, ArrowRight, Check } from "lucide-react";
import { useState, useEffect } from "react";
import { copyToClipboard } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import StyledQRCodeComponent from "@/components/styled-qr-code";
import { Button } from "@/components/ui/button";

type BalanceType = "crypto" | "fiat";

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
  const [balanceType, setBalanceType] = useState<BalanceType>("crypto");
  const [activeBalance, setActiveBalance] = useState<UserBalance | null>(null);
  const [copied, setCopied] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const { toast } = useToast();
  const [location, navigate] = useLocation();

  // Get crypto balances
  const { data: cryptoBalances = [] } = useQuery<UserBalance[]>({
    queryKey: ["/api/user/crypto-balances"],
  });

  // Get fiat balances
  const { data: fiatBalances = [] } = useQuery<UserBalance[]>({
    queryKey: ["/api/user/fiat-balances"],
  });

  // Filter active (not frozen) balances
  const availableBalances = (balanceType === "crypto" ? cryptoBalances : fiatBalances)
    .filter(balance => balance.balanceStatus !== 'frozen');

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

  // Initialize active balance when balances load or type changes
  useEffect(() => {
    if (availableBalances.length > 0) {
      // Set first available balance when data loads or type switches
      // Only update if active balance is not in current list (type switch or initial load)
      const currentBalanceValid = activeBalance && availableBalances.some(b => b.id === activeBalance.id);
      if (!currentBalanceValid) {
        setActiveBalance(availableBalances[0]);
      }
    } else {
      setActiveBalance(null);
    }
  }, [balanceType, cryptoBalances, fiatBalances]);

  // Reserve wallet for crypto balances
  useEffect(() => {
    if (balanceType === "crypto" && activeBalance) {
      // Ensure the active balance is actually a crypto balance before reserving
      const isCryptoBalance = cryptoBalances.some(b => b.id === activeBalance.id);
      
      if (isCryptoBalance && activeBalance.network) {
        // Reset previous wallet data when switching
        reserveWalletMutation.reset();
        // Reserve wallet for crypto
        reserveWalletMutation.mutate(activeBalance.network);
      }
    } else if (balanceType === "fiat") {
      // Reset wallet data when switching to fiat
      reserveWalletMutation.reset();
    }
  }, [activeBalance, balanceType, cryptoBalances]);

  const wallet = reserveWalletMutation.data;

  // Timer for crypto wallet reservation
  useEffect(() => {
    if (balanceType === "crypto" && wallet?.reservationTime) {
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
  }, [wallet?.reservationTime, activeBalance, balanceType]);

  // Determine what to display (wallet address or account number)
  const displayValue = balanceType === "crypto" 
    ? (wallet?.address || "Loading...") 
    : (activeBalance?.accountNumber || "Loading...");

  const qrData = balanceType === "crypto" 
    ? (wallet?.address || "") 
    : (activeBalance?.accountNumber || "");

  const handleCopyAddress = async () => {
    if (!displayValue || displayValue === "Loading...") return;
    
    try {
      await copyToClipboard(displayValue);
      setCopied(true);
      toast({
        title: "Скопировано!",
        description: balanceType === "crypto" 
          ? "Адрес кошелька скопирован в буфер обмена"
          : "Номер счета скопирован в буфер обмена",
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
    if (balanceType === "crypto" && wallet?.address && activeBalance) {
      createTopupMutation.mutate({
        walletAddress: wallet.address,
        network: activeBalance.network
      });
    } else if (balanceType === "fiat") {
      // For fiat, navigate to success page or handle differently
      navigate("/top-up-success");
    }
  };

  const isLoading = balanceType === "crypto" && reserveWalletMutation.isPending;
  const canContinue = balanceType === "crypto" 
    ? (wallet?.address && activeBalance) 
    : activeBalance;

  return (
    <div className="mobile-screen text-white overflow-y-auto pb-20">
      <div className="mobile-content">
        <h1 className="text-2xl font-bold text-center mb-8" data-testid="text-title">
          Пополнить {activeBalance?.currency || ""}
        </h1>
        
        {/* Balance Type Selector */}
        <div className="flex justify-center mb-8">
          <div className="flex bg-secondary rounded-lg p-1">
            <button
              onClick={() => setBalanceType("crypto")}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${
                balanceType === "crypto"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid="button-type-crypto"
            >
              Криптовалюты
            </button>
            <button
              onClick={() => setBalanceType("fiat")}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${
                balanceType === "fiat"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid="button-type-fiat"
            >
              Фиат
            </button>
          </div>
        </div>
        
        <div className="crypto-card text-center mb-8">
          {/* Currency Selector (moved above QR code) */}
          <div className="flex justify-center mb-6">
            <div className="flex bg-secondary rounded-lg p-1 flex-wrap gap-1">
              {availableBalances.map((balance) => (
                <button
                  key={balance.id}
                  onClick={() => setActiveBalance(balance)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    activeBalance?.id === balance.id
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  data-testid={`button-balance-${balance.currency.toLowerCase()}`}
                >
                  {balanceType === "fiat" ? balance.currency : balance.title}
                </button>
              ))}
            </div>
          </div>
          
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
                {balanceType === "crypto" ? "На адрес кошелька" : "Номер счета для пополнения"}
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
              
              {balanceType === "crypto" && timeRemaining && (
                <div className="text-sm text-muted-foreground" data-testid="text-timer">
                  Адрес действителен {timeRemaining}
                </div>
              )}
            </>
          )}
        </div>
        
        {balanceType === "crypto" ? (
          <Button
            onClick={handleContinue}
            className="action-button w-full"
            data-testid="button-continue"
            disabled={isLoading || createTopupMutation.isPending || !canContinue}
          >
            {createTopupMutation.isPending ? "Отправка..." : "Далее"}
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        ) : (
          <div className="space-y-4">
            <div className="bg-secondary/50 rounded-lg py-3 px-4 text-center">
              <p className="text-sm text-muted-foreground leading-snug" data-testid="text-fiat-info">
                Пополнить фиатный баланс можно только переводом от другого пользователя по QR коду или номеру счета!
                <br />
                Или если у вас есть ваучер пополнения
              </p>
            </div>
            <Button
              onClick={() => navigate("/vouchers?action=activate")}
              className="action-button w-full"
              data-testid="button-activate-voucher"
            >
              Активировать ваучер
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
