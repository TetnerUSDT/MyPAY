import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { X, Copy, Check, Clock } from "lucide-react";
import { copyToClipboard, formatCountdown, formatOrderAmount } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";

type ExchangeStatus = "wait" | "wait-paid" | "paid" | "complete" | "canceled" | "dispute";

interface ExchangeHistory {
  id: number;
  numberOrder: string;
  idUser: number;
  walletId: number | null;
  idBalanceFrom: number | null;
  idBalanceTo: number | null;
  idCard: number | null;
  manualCardNumber: string | null;
  fromCurrency: string;
  toCurrency: string;
  amountFrom: string;
  amountTo: string;
  rate: string;
  commission: string;
  timestamp: string;
  status: ExchangeStatus;
  cancelReason: string | null;
  paymentHash: string | null;
  cardNumber: string | null;
  walletAddress: string | null;
  timeExchange: number;
}

export default function HistoryScreen() {
  const [offset, setOffset] = useState(0);
  const [allExchanges, setAllExchanges] = useState<ExchangeHistory[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [copiedItems, setCopiedItems] = useState<{ [key: string]: boolean }>({});
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const LIMIT = 10;

  // Fetch exchange history
  const { data: exchanges, isLoading } = useQuery<ExchangeHistory[]>({
    queryKey: [`/api/exchanges/history?limit=${LIMIT}&offset=${offset}`],
    refetchOnWindowFocus: false,
  });

  // Update all exchanges when new data comes in
  useEffect(() => {
    if (exchanges) {
      if (offset === 0) {
        // First load or refresh
        setAllExchanges(exchanges);
      } else {
        // Loading more
        setAllExchanges(prev => [...prev, ...exchanges]);
      }
      // If we got less than LIMIT exchanges, there are no more
      setHasMore(exchanges.length === LIMIT);
    }
  }, [exchanges, offset]);

  const handleCopy = async (text: string, itemId: string, type: string) => {
    try {
      await copyToClipboard(text);
      setCopiedItems(prev => ({ ...prev, [`${itemId}-${type}`]: true }));
      toast({
        title: "Copied!",
        description: `${type} copied to clipboard`,
      });
      setTimeout(() => {
        setCopiedItems(prev => ({ ...prev, [`${itemId}-${type}`]: false }));
      }, 2000);
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to copy ${type}`,
        variant: "destructive",
      });
    }
  };

  const handleLoadMore = () => {
    setOffset(prev => prev + LIMIT);
  };

  const handleCardClick = (orderNumber: string) => {
    setLocation(`/tracking?order=${orderNumber}`);
  };

  // Format card number with spaces every 4 digits
  const formatCardNumber = (value: string) => {
    if (!value) return '';
    const digits = value.replace(/\D/g, '');
    const formatted = digits.replace(/(\d{4})(?=\d)/g, '$1 ');
    return formatted.substring(0, 19);
  };

  // Calculate remaining time for wait status
  const getRemainingTime = (timestamp: string, timeExchange: number) => {
    const exchangeDate = new Date(timestamp);
    const expiryDate = new Date(exchangeDate.getTime() + timeExchange * 60 * 1000);
    const now = new Date();
    const remainingMs = expiryDate.getTime() - now.getTime();
    return Math.max(0, Math.floor(remainingMs / 1000));
  };

  const getStatusDisplay = (exchange: ExchangeHistory) => {
    const remainingSeconds = exchange.status === "wait" ? getRemainingTime(exchange.timestamp, exchange.timeExchange) : 0;
    const hasTimer = exchange.status === "wait" && remainingSeconds > 0;

    switch (exchange.status) {
      case "complete":
        return (
          <div className="flex items-center text-green-400">
            <div className="w-6 h-6 rounded-full bg-green-400 flex items-center justify-center mr-2">
              <Check className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm">Заявка выполнена успешно</span>
          </div>
        );
      case "wait":
        return (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center text-yellow-400">
              <div className="w-6 h-6 rounded-full bg-yellow-400 flex items-center justify-center mr-2">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              </div>
              <span className="text-sm">В ожидании</span>
            </div>
            {hasTimer && (
              <div className="flex items-center text-yellow-400">
                <Clock className="w-4 h-4 mr-1" />
                <span className="text-sm font-mono">{formatCountdown(remainingSeconds)}</span>
              </div>
            )}
          </div>
        );
      case "wait-paid":
        return (
          <div className="flex items-center text-blue-400">
            <div className="w-6 h-6 rounded-full bg-blue-400 flex items-center justify-center mr-2">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            </div>
            <span className="text-sm">Ожидаем подтверждения</span>
          </div>
        );
      case "paid":
        return (
          <div className="flex items-center text-green-400">
            <div className="w-6 h-6 rounded-full bg-green-400 flex items-center justify-center mr-2">
              <div className="w-2 h-2 bg-white rounded-full" />
            </div>
            <span className="text-sm">Оплачено, обрабатывается</span>
          </div>
        );
      case "canceled":
        return (
          <div className="flex items-center text-red-400">
            <div className="w-6 h-6 rounded-full bg-red-400 flex items-center justify-center mr-2">
              <X className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm">Отменена</span>
          </div>
        );
      case "dispute":
        return (
          <div className="flex items-center text-orange-400">
            <div className="w-6 h-6 rounded-full bg-orange-400 flex items-center justify-center mr-2">
              <div className="w-3 h-3 text-white font-bold">!</div>
            </div>
            <span className="text-sm">Спор</span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <TooltipProvider>
      <div className="mobile-screen gradient-bg text-white">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6">
            <h1 className="text-xl font-semibold" data-testid="text-history-title">
              История операций
            </h1>
            <Link href="/home">
              <button 
                className="w-8 h-8 rounded-full bg-black/20 flex items-center justify-center"
                data-testid="button-close"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </Link>
          </div>

          {/* Operations List */}
          <div className="flex-1 px-6 pb-4 overflow-y-auto">
            {isLoading && offset === 0 ? (
              <div className="text-center py-8">
                <div className="text-muted-foreground">Загрузка...</div>
              </div>
            ) : allExchanges.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-muted-foreground">История операций пуста</div>
              </div>
            ) : (
              <div className="space-y-4">
                {allExchanges.map((exchange) => (
                  <div 
                    key={exchange.id}
                    className="crypto-card cursor-pointer hover:bg-white/5 transition-colors"
                    onClick={() => handleCardClick(exchange.numberOrder)}
                    data-testid={`exchange-${exchange.id}`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-sm text-muted-foreground">
                          Обмен средств
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {new Date(exchange.timestamp).toLocaleString('ru-RU')}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center justify-end">
                          <span 
                            className="text-xl font-bold text-yellow-400"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy(exchange.numberOrder, exchange.id.toString(), 'applicationNumber');
                            }}
                            data-testid={`exchange-number-${exchange.id}`}
                          >
                            {exchange.numberOrder}
                          </span>
                          <button 
                            className="ml-2 p-1 hover:bg-white/10 rounded"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy(exchange.numberOrder, exchange.id.toString(), 'applicationNumber');
                            }}
                            data-testid={`button-copy-application-${exchange.id}`}
                          >
                            {copiedItems[`${exchange.id}-applicationNumber`] ? (
                              <Check className="w-4 h-4 text-green-400" />
                            ) : (
                              <Copy className="w-4 h-4 text-accent" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Exchange Info */}
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <div className="text-xs text-muted-foreground">Отправляете</div>
                        <div className="text-lg font-bold">{formatOrderAmount(exchange.amountFrom)} {exchange.fromCurrency}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">Получаете</div>
                        <div className="text-lg font-bold">{formatOrderAmount(exchange.amountTo)} {exchange.toCurrency}</div>
                      </div>
                    </div>

                    {/* Wallet Address */}
                    {exchange.walletAddress && (
                      <div className="mb-3">
                        <div className="bg-secondary rounded-lg p-3 flex items-center justify-between">
                          <span 
                            className="font-mono text-sm flex-1 truncate"
                            data-testid={`exchange-wallet-${exchange.id}`}
                          >
                            {exchange.walletAddress}
                          </span>
                          <button 
                            className="ml-2 p-1 hover:bg-white/10 rounded"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy(exchange.walletAddress!, exchange.id.toString(), 'wallet');
                            }}
                            data-testid={`button-copy-wallet-${exchange.id}`}
                          >
                            {copiedItems[`${exchange.id}-wallet`] ? (
                              <Check className="w-4 h-4 text-green-400" />
                            ) : (
                              <Copy className="w-4 h-4 text-accent" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Card Number */}
                    {exchange.cardNumber && (
                      <div className="mb-4">
                        <div className="text-xs text-muted-foreground mb-1">На номер карты</div>
                        <div className="bg-secondary rounded-lg p-3 flex items-center justify-between">
                          <span 
                            className="font-mono text-sm"
                            data-testid={`exchange-card-${exchange.id}`}
                          >
                            {formatCardNumber(exchange.cardNumber)}
                          </span>
                          <button 
                            className="ml-2 p-1 hover:bg-white/10 rounded"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy(exchange.cardNumber!, exchange.id.toString(), 'card');
                            }}
                            data-testid={`button-copy-card-${exchange.id}`}
                          >
                            {copiedItems[`${exchange.id}-card`] ? (
                              <Check className="w-4 h-4 text-green-400" />
                            ) : (
                              <Copy className="w-4 h-4 text-accent" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Status */}
                    <div data-testid={`exchange-status-${exchange.id}`}>
                      {exchange.status === "canceled" && exchange.cancelReason ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="cursor-pointer" onClick={(e) => e.stopPropagation()}>
                              {getStatusDisplay(exchange)}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{exchange.cancelReason}</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        getStatusDisplay(exchange)
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Show More Button */}
          {hasMore && allExchanges.length > 0 && (
            <div className="p-6">
              <button 
                className="action-button"
                onClick={handleLoadMore}
                disabled={isLoading}
                data-testid="button-show-more"
              >
                {isLoading && offset > 0 ? "Загрузка..." : "Показать больше"}
              </button>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
