import { useState, useEffect } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Clock, ArrowDown, Copy, Check, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { formatCountdown, copyToClipboard, formatOrderAmount } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

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
  timestamp: string;
  status: 'wait' | 'wait-paid' | 'paid' | 'complete' | 'canceled' | 'dispute';
  walletAddress?: string;
  walletNetwork?: string;
  cardNumber?: string;
  timeExchange?: number;
  cancelReason?: string;
  paymentHash?: string;
}

export default function TrackingScreen() {
  const searchParams = new URLSearchParams(useSearch());
  const orderNumber = searchParams.get('order');
  const [countdown, setCountdown] = useState(3600); // 1 hour default
  const [copied, setCopied] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Load exchange order data with polling every 30 seconds
  const { data: orderData, isLoading } = useQuery<ExchangeOrder>({
    queryKey: ['/api/exchange', orderNumber],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/exchange/${orderNumber}`, undefined);
      return response.json();
    },
    enabled: !!orderNumber,
    refetchInterval: 30000, // Poll every 30 seconds
  });

  // Update countdown based on timeExchange when orderData is available
  useEffect(() => {
    if (orderData?.timeExchange) {
      setCountdown(orderData.timeExchange * 60); // Convert minutes to seconds
    }
  }, [orderData?.timeExchange]);

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Redirect if no order number
  useEffect(() => {
    if (!orderNumber) {
      setLocation("/exchange");
    }
  }, [orderNumber, setLocation]);

  const handleCopyTxHash = async () => {
    const txHash = orderData?.paymentHash || "";
    try {
      await copyToClipboard(txHash);
      setCopied(true);
      toast({
        title: "Скопировано!",
        description: "Хеш транзакции скопирован в буфер обмена",
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

  const handleBackToHome = () => {
    setLocation("/home");
  };

  // Format card number with spaces every 4 digits
  const formatCardNumber = (value: string) => {
    if (!value) return '';
    const digits = value.replace(/\D/g, '');
    const formatted = digits.replace(/(\d{4})(?=\d)/g, '$1 ');
    return formatted.substring(0, 19);
  };

  // Show loading state
  if (isLoading || !orderData) {
    return (
      <div className="mobile-screen text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg">Загрузка данных заявки...</div>
        </div>
      </div>
    );
  }

  // State 1: Waiting for payment (wait)
  if (orderData.status === "wait") {
    return (
      <div className="mobile-screen text-white relative overflow-hidden">
        <div className="flex flex-col items-center justify-center min-h-screen text-center px-6">
          <h1 className="text-2xl font-bold mb-4" data-testid="text-title">
            Ожидание платежа
          </h1>
          
          <div className="text-xl text-yellow-400 font-semibold mb-8" data-testid="text-status">
            ожидаем оплату
          </div>
          
          {/* Timer */}
          <div className="inline-flex items-center bg-secondary border border-yellow-400 rounded-lg px-4 py-2 mb-16">
            <Clock className="w-6 h-6 mr-2 text-yellow-400" />
            <span className="font-mono text-lg text-yellow-400" data-testid="text-countdown">
              {formatCountdown(countdown)}
            </span>
          </div>

          {/* Waiting Animation */}
          <div className="w-full max-w-md crypto-card flex items-center justify-center p-8">
            <Loader2 
              className="w-40 h-40 text-accent animate-spin"
              data-testid="animation-waiting"
            />
          </div>
        </div>
      </div>
    );
  }

  // State 2: Waiting for transaction confirmation (wait-paid)
  if (orderData.status === "wait-paid") {
    return (
      <div className="mobile-screen text-white relative overflow-hidden">
        <div className="flex flex-col items-center justify-center min-h-screen text-center px-6">
          <h1 className="text-2xl font-bold mb-4" data-testid="text-title">
            Проверка платежа
          </h1>
          
          <div className="text-xl text-yellow-400 font-semibold mb-8" data-testid="text-status">
            ищем транзакцию
          </div>
          
          {/* Timer */}
          <div className="inline-flex items-center bg-secondary border border-yellow-400 rounded-lg px-4 py-2 mb-16">
            <Clock className="w-6 h-6 mr-2 text-yellow-400" />
            <span className="font-mono text-lg text-yellow-400" data-testid="text-countdown">
              {formatCountdown(countdown)}
            </span>
          </div>

          {/* Payment Processing Animation */}
          <div className="w-full max-w-md crypto-card flex items-center justify-center p-8">
            <Loader2 
              className="w-40 h-40 text-accent animate-spin"
              data-testid="animation-payment-processing"
            />
          </div>
        </div>
      </div>
    );
  }

  // State 2: Processing application (paid)
  if (orderData.status === "paid") {
    return (
      <div className="mobile-screen text-white">
        <div className="flex flex-col items-center justify-center min-h-screen text-center px-6">
          <h1 className="text-2xl font-bold mb-4" data-testid="text-title">
            Выполнение заявки
          </h1>
          
          <div className="text-2xl text-yellow-400 font-bold mb-4" data-testid="text-application-number">
            {orderData.numberOrder}
          </div>
          
          {/* Timer */}
          <div className="inline-flex items-center bg-secondary border border-yellow-400 rounded-lg px-4 py-2 mb-8">
            <Clock className="w-6 h-6 mr-2 text-yellow-400" />
            <span className="font-mono text-lg text-yellow-400" data-testid="text-countdown">
              {formatCountdown(countdown)}
            </span>
          </div>

          {/* Transaction Found */}
          <div className="w-full max-w-md crypto-card mb-4">
            <div className="text-sm text-muted-foreground mb-2 text-left">Хеш транзакции найден</div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-3xl font-bold">{formatOrderAmount(orderData.amountFrom)}</span>
              <span className="text-lg font-semibold text-yellow-400">{orderData.fromCurrency}</span>
            </div>
            
            <div className="bg-secondary rounded-lg p-3 mb-2 relative">
              <div className="font-mono text-xs break-all text-left" data-testid="text-transaction-hash">
                {orderData.paymentHash || 'Ожидание хеша...'}
              </div>
              <button 
                className="absolute top-2 right-2 p-1 hover:bg-white/10 rounded"
                onClick={handleCopyTxHash}
                data-testid="button-copy-hash"
              >
                {copied ? (
                  <Check className="w-6 h-6 text-green-400" />
                ) : (
                  <Copy className="w-6 h-6 text-accent" />
                )}
              </button>
            </div>
          </div>

          {/* Arrow Down */}
          <div className="flex justify-center" style={{position: 'relative', marginTop: '-20px', marginBottom: '-30px', zIndex: 2}}>
            <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center border-[6px]" style={{borderColor: '#2a4c3b', top: '-10px', position: 'relative'}}>
              <ArrowDown className="w-6 h-6 text-accent-foreground" />
            </div>
          </div>

          {/* Ready to Send */}
          <div className="w-full max-w-md crypto-card mb-8">
            <div className="text-sm text-muted-foreground mb-2 text-left">Готовим к отправке</div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-3xl font-bold">{formatOrderAmount(orderData.amountTo)}</span>
              <span className="text-lg font-semibold text-yellow-400">{orderData.toCurrency}</span>
            </div>
            
            <div className="text-sm text-muted-foreground mb-2 text-left">На номер карты</div>
            <div className="bg-secondary rounded-lg p-3">
              <span className="font-mono" data-testid="text-card-number">
                {formatCardNumber(orderData.cardNumber || '') || 'Загрузка...'}
              </span>
            </div>
          </div>

          {/* Processing Animation Small */}
          <div className="w-12 h-12 crypto-card flex items-center justify-center p-1">
            <Loader2 
              className="w-8 h-8 text-accent animate-spin"
              data-testid="animation-hourglass-small"
            />
          </div>
        </div>
      </div>
    );
  }

  // State 3: Success (complete)
  if (orderData.status === "complete") {
    return (
      <div className="mobile-screen text-white relative">
        <div className="flex flex-col items-center justify-center min-h-screen text-center px-6 relative z-20">
          <h1 className="text-2xl font-bold mb-12" data-testid="text-title">
            Выполнена успешно
          </h1>
          
          {/* Success Animation */}
          <div className="w-32 h-32 mb-12 flex items-center justify-center">
            <CheckCircle2 
              className="w-32 h-32 text-accent"
              data-testid="animation-success"
            />
          </div>
          
          <p className="text-lg mb-16 px-4">
            Средства были отправлены на вашу карту,<br />
            обмен завершен с двух сторон!
          </p>
          
          <div className="w-full max-w-sm mb-8">
            <Link href="/support">
              <p className="text-sm text-yellow-400 text-center cursor-pointer hover:underline" data-testid="link-support">
                Что делать если вы не получили средства?
              </p>
            </Link>
          </div>
          
          <div className="w-full max-w-sm">
            <button 
              className="action-button"
              onClick={handleBackToHome}
              data-testid="button-back-home"
            >
              Вернуться на главную
            </button>
          </div>
        </div>
      </div>
    );
  }

  // State 4: Canceled
  if (orderData.status === "canceled") {
    return (
      <div className="mobile-screen text-white relative">
        <div className="flex flex-col items-center justify-center min-h-screen text-center px-6 relative z-20">
          <h1 className="text-2xl font-bold mb-12" data-testid="text-title">
            Платеж отменен
          </h1>
          
          {/* Cancel Icon */}
          <div className="w-32 h-32 mb-12 flex items-center justify-center">
            <XCircle 
              className="w-32 h-32 text-red-500"
              data-testid="animation-canceled"
            />
          </div>
          
          <p className="text-lg mb-8 px-4">
            Обмен был отменен
          </p>

          {orderData.cancelReason && (
            <div className="w-full max-w-md mb-12 crypto-card">
              <div className="text-sm text-muted-foreground mb-2">Причина отмены</div>
              <p className="text-base">{orderData.cancelReason}</p>
            </div>
          )}
          
          <div className="w-full max-w-sm mb-8">
            <Link href="/support">
              <p className="text-sm text-yellow-400 text-center cursor-pointer hover:underline" data-testid="link-support">
                Связаться с поддержкой
              </p>
            </Link>
          </div>
          
          <div className="w-full max-w-sm">
            <button 
              className="action-button"
              onClick={handleBackToHome}
              data-testid="button-back-home"
            >
              Вернуться на главную
            </button>
          </div>
        </div>
      </div>
    );
  }

  // State 5: Dispute
  if (orderData.status === "dispute") {
    return (
      <div className="mobile-screen text-white relative">
        <div className="flex flex-col items-center justify-center min-h-screen text-center px-6 relative z-20">
          <h1 className="text-2xl font-bold mb-12" data-testid="text-title">
            Спор открыт
          </h1>
          
          <div className="w-32 h-32 mb-12 flex items-center justify-center">
            <XCircle 
              className="w-32 h-32 text-yellow-400"
              data-testid="animation-dispute"
            />
          </div>
          
          <p className="text-lg mb-16 px-4">
            По данной заявке открыт спор.<br />
            Пожалуйста, свяжитесь с поддержкой.
          </p>
          
          <div className="w-full max-w-sm mb-8">
            <Link href="/support">
              <button className="action-button" data-testid="button-contact-support">
                Связаться с поддержкой
              </button>
            </Link>
          </div>
          
          <div className="w-full max-w-sm">
            <button 
              className="w-full py-3 bg-secondary hover:bg-secondary/80 text-white rounded-lg transition-colors"
              onClick={handleBackToHome}
              data-testid="button-back-home"
            >
              Вернуться на главную
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Default fallback
  return (
    <div className="mobile-screen text-white flex items-center justify-center">
      <div className="text-center">
        <div className="text-lg">Неизвестный статус заявки</div>
      </div>
    </div>
  );
}
