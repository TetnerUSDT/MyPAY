import { useState, useEffect } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { X, ArrowDown, Copy, Check, Clock } from "lucide-react";
import { copyToClipboard, formatOrderAmount, formatRecipientAddress, getRecipientLabelKey } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";

interface ExchangeOrder {
  id: number;
  numberOrder: string;
  idUser: number;
  walletId: number;
  idBalanceFrom: number;
  idBalanceTo: number;
  idCard: number | null;
  fromCurrency: string;
  toCurrency: string;
  amountFrom: string;
  amountTo: string;
  rate: string;
  commission: string;
  tempBalance?: string;
  timestamp: string;
  status: string;
  walletAddress?: string;
  walletNetwork?: string;
  cardNumber?: string;
}

export default function PaymentScreen() {
  const { t } = useTranslation();
  const searchParams = new URLSearchParams(useSearch());
  const orderNumber = searchParams.get('order');
  const [timer, setTimer] = useState(3600); // 1 hour in seconds
  const [copied, setCopied] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Load exchange order data
  const { data: orderData, isLoading, error } = useQuery<ExchangeOrder>({
    queryKey: ['/api/exchange', orderNumber],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/exchange/${orderNumber}`, undefined);
      return response.json();
    },
    enabled: !!orderNumber,
  });

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

  // Update exchange status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PATCH", `/api/exchange/${orderNumber}/status`, {
        status: "wait-paid"
      });
      return response.json();
    },
    onSuccess: () => {
      // Navigate to tracking page
      setLocation(`/tracking?order=${orderNumber}`);
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || t('payment.statusUpdateError'),
        variant: "destructive",
      });
    }
  });

  const handleCopyAddress = async () => {
    const fullWalletAddress = orderData?.walletAddress || "";
    try {
      await copyToClipboard(fullWalletAddress);
      setCopied(true);
      toast({
        title: t('common.copied'),
        description: t('payment.addressCopied'),
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('payment.copyError'),
        variant: "destructive",
      });
    }
  };

  const handlePaymentConfirmed = () => {
    updateStatusMutation.mutate();
  };

  // Redirect if no order number
  useEffect(() => {
    if (!orderNumber) {
      setLocation("/exchange");
    }
  }, [orderNumber, setLocation]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="mobile-screen text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg">{t('common.loading')}</div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error || !orderData) {
    return (
      <div className="mobile-screen text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg text-red-500">{t('payment.loadError')}</div>
          <button 
            onClick={() => setLocation("/exchange")}
            className="action-button mt-4"
          >
            {t('payment.backToExchange')}
          </button>
        </div>
      </div>
    );
  }

  // Format wallet address for display (truncate middle)
  const displayWalletAddress = orderData.walletAddress 
    ? `${orderData.walletAddress.slice(0, 20)}...${orderData.walletAddress.slice(-6)}`
    : "";

  // Format currency with network
  const currencyDisplay = `${orderData.fromCurrency} ${orderData.walletNetwork || ''}`.trim();

  const displayCardNumber = orderData.cardNumber 
    ? formatRecipientAddress(orderData.cardNumber)
    : "";
  
  const recipientLabel = t(getRecipientLabelKey(orderData.cardNumber || ''));

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
            {orderData.numberOrder}
          </div>
          
          {/* Timer */}
          <div className="inline-flex items-center bg-secondary rounded-lg px-4 py-2">
            <Clock className="w-6 h-6 mr-2 text-yellow-400" />
            <span className="font-mono text-lg" data-testid="text-timer">
              {formatTime(timer)}
            </span>
          </div>
        </div>

        {/* Transfer Amount Section */}
        <div className="crypto-card mb-4">
          <div className="text-sm text-muted-foreground mb-2">{t('payment.transferAmount')}</div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-3xl font-bold">{formatOrderAmount(orderData.amountFrom)}</span>
            <div className="flex items-center bg-secondary rounded-lg px-3 py-1">
              <span className="text-yellow-400 font-medium">{currencyDisplay}</span>
            </div>
          </div>
          
          {/* Wallet Address or Internal Payment */}
          {orderData.tempBalance && parseFloat(orderData.tempBalance) > 0 ? (
            <>
              <div className="text-sm text-muted-foreground mb-2">{t('payment.paymentMethod')}</div>
              <div className="flex items-center justify-center bg-secondary rounded-lg p-4">
                <div className="relative overflow-hidden w-full">
                  <div 
                    className="text-accent font-medium whitespace-nowrap animate-marquee"
                    data-testid="text-internal-payment"
                  >
                    {t('payment.sendingFromWallet')}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="text-sm text-muted-foreground mb-2">{t('payment.toWalletAddress')}</div>
              <div className="flex items-center bg-secondary rounded-lg p-3">
                <span 
                  className="font-mono text-sm flex-1 break-all"
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
                    <Check className="w-6 h-6 text-green-400" />
                  ) : (
                    <Copy className="w-6 h-6 text-accent" />
                  )}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Arrow Down */}
        <div className="flex justify-center mb-4" style={{position: 'relative', marginTop: '-20px', marginBottom: '-30px', zIndex: 2}}>
          <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center border-[6px]" style={{borderColor: '#2a4c3b', top: '-10px', position: 'relative'}}>
            <ArrowDown className="w-6 h-6 text-accent-foreground" />
          </div>
        </div>

        {/* Receive Amount Section */}
        <div className="crypto-card mb-6">
          <div className="text-sm text-muted-foreground mb-2">{t('payment.amountToReceive')}</div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-3xl font-bold">{formatOrderAmount(orderData.amountTo)}</span>
            <span className="text-2xl font-bold text-yellow-400">{orderData.toCurrency}</span>
          </div>
          
          {/* Card Number / Wallet Address */}
          {orderData.cardNumber && (
            <>
              <div className="text-sm text-muted-foreground mb-2">{recipientLabel}</div>
              <div className="bg-secondary rounded-lg p-3">
                <span 
                  className="font-mono text-sm"
                  data-testid="text-card-number"
                >
                  {displayCardNumber}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Payment Confirmed Button */}
        <button 
          className="action-button"
          onClick={handlePaymentConfirmed}
          disabled={updateStatusMutation.isPending}
          data-testid="button-payment-confirmed"
        >
          {updateStatusMutation.isPending ? "Обработка..." : "Я оплатил"}
          {!updateStatusMutation.isPending && <ArrowDown className="w-6 h-6 ml-2 rotate-90" />}
        </button>
      </div>
    </div>
  );
}