import { Link, useLocation } from "wouter";
import { X, ArrowDown, Copy, ArrowRight, Check } from "lucide-react";
import { useState, useEffect } from "react";
import { copyToClipboard } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import QRCodeComponent from "@/components/qr-code";
import { Button } from "@/components/ui/button";

type NetworkType = "TRC20" | "BEP20" | "TON";

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

export default function TopUpScreen() {
  const [activeNetwork, setActiveNetwork] = useState<NetworkType | null>(null);
  const [copied, setCopied] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const { toast } = useToast();
  const [location, navigate] = useLocation();

  // Get crypto balances to check status
  const { data: cryptoBalances = [] } = useQuery<any[]>({
    queryKey: ["/api/user/crypto-balances"],
  });

  // Filter active (not frozen) networks
  const availableNetworks = cryptoBalances
    .filter(balance => balance.balanceStatus !== 'frozen')
    .map(balance => {
      if (balance.network?.includes('TRC20')) return 'TRC20';
      if (balance.network?.includes('BEP20')) return 'BEP20';
      if (balance.network?.includes('TON')) return 'TON';
      return null;
    })
    .filter(Boolean) as NetworkType[];

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

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const networkParam = urlParams.get('network') as NetworkType;
    
    // Check if network from URL is available (not frozen)
    if (networkParam && availableNetworks.includes(networkParam)) {
      setActiveNetwork(networkParam);
    } else if (availableNetworks.length > 0 && !activeNetwork) {
      // Select first available network as default
      setActiveNetwork(availableNetworks[0]);
    }
  }, [location, cryptoBalances]);

  useEffect(() => {
    if (activeNetwork) {
      reserveWalletMutation.mutate(activeNetwork);
    }
  }, [activeNetwork]);

  const wallet = reserveWalletMutation.data;

  useEffect(() => {
    if (!wallet?.reservationTime) return;

    const updateTimer = () => {
      const now = new Date();
      const expiryTime = new Date(wallet.reservationTime!);
      const diff = expiryTime.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining("00:00:00");
        reserveWalletMutation.mutate(activeNetwork);
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
  }, [wallet?.reservationTime, activeNetwork]);

  const walletAddress = wallet?.address || "Loading...";
  const qrData = wallet?.address || "";

  const handleCopyAddress = async () => {
    if (!wallet?.address) return;
    
    try {
      await copyToClipboard(walletAddress);
      setCopied(true);
      toast({
        title: "Скопировано!",
        description: "Адрес кошелька скопирован в буфер обмена",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось скопировать адрес",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="mobile-screen text-white overflow-y-auto pb-20">
      <div className="mobile-content">
        <h1 className="text-2xl font-bold text-center mb-8" data-testid="text-title">
          Пополнить USDT
        </h1>
        
        <div className="flex justify-center mb-12">
          <div className="flex bg-secondary rounded-lg p-1">
            {availableNetworks.map((network) => (
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
        
        <div className="crypto-card text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center">
              <ArrowDown className="w-6 h-6 text-accent-foreground" />
            </div>
          </div>
          
          {reserveWalletMutation.isPending ? (
            <div className="flex justify-center items-center h-48 mb-6">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
            </div>
          ) : (
            <>
              <div className="qr-code-container mx-auto mb-6 w-48 h-48" data-testid="qr-code-container">
                <QRCodeComponent value={qrData} size={192} />
              </div>
              
              <div className="text-sm text-muted-foreground mb-2">На адрес кошелька</div>
              <div className="flex items-center bg-secondary rounded-lg p-3 mb-3">
                <span 
                  className="font-mono text-sm flex-1 truncate"
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
              
              {timeRemaining && (
                <div className="text-sm text-muted-foreground" data-testid="text-timer">
                  Адрес действителен {timeRemaining}
                </div>
              )}
            </>
          )}
        </div>
        
        <Button
          onClick={() => {
            if (wallet?.address && activeNetwork) {
              createTopupMutation.mutate({
                walletAddress: wallet.address,
                network: activeNetwork
              });
            }
          }}
          className="action-button w-full"
          data-testid="button-continue"
          disabled={reserveWalletMutation.isPending || createTopupMutation.isPending || !wallet?.address}
        >
          {createTopupMutation.isPending ? "Отправка..." : "Далее"}
          <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    </div>
  );
}
