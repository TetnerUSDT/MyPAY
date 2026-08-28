import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Copy, Check, Clock, ChevronLeft, ArrowRight, History } from "lucide-react";
import { copyToClipboard, formatCountdown, formatOrderAmount, formatRecipientAddress, getRecipientLabelKey } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
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
          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1 rounded-full border bg-[#3ab368]/10 border-[#3ab368]/20 text-[#3ab368]">
            <Check className="w-3.5 h-3.5" />
            <span>{t('history.status.complete')}</span>
          </div>
        );
      case "wait":
        return (
          <div className="flex items-center justify-between w-full">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1 rounded-full border bg-yellow-400/10 border-yellow-400/20 text-yellow-400">
              <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
              <span>{t('history.status.wait')}</span>
              {hasTimer && (
                <>
                  <Clock className="w-3.5 h-3.5 ml-1" />
                  <span className="font-mono">{formatCountdown(remainingSeconds)}</span>
                </>
              )}
            </div>
          </div>
        );
      case "wait-paid":
        return (
          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1 rounded-full border bg-blue-400/10 border-blue-400/20 text-blue-400">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
            <span>{t('history.status.waitPaid')}</span>
          </div>
        );
      case "paid":
        return (
          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1 rounded-full border bg-[#3ab368]/10 border-[#3ab368]/20 text-[#3ab368]">
            <Check className="w-3.5 h-3.5" />
            <span>{t('history.status.paid')}</span>
          </div>
        );
      case "canceled":
        return (
          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1 rounded-full border bg-red-400/10 border-red-400/20 text-red-400">
            <span>{t('history.status.canceled')}</span>
          </div>
        );
      case "dispute":
        return (
          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1 rounded-full border bg-orange-400/10 border-orange-400/20 text-orange-400">
            <div className="font-bold">!</div>
            <span>{t('history.status.dispute')}</span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-[#0B0C10] text-[#E2E8F0] pb-28 font-sans selection:bg-[#3ab368]/30 selection:text-white">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-6 pb-4">
            <Link href="/home">
              <button 
                className="w-10 h-10 rounded-full bg-white/5 border border-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
                data-testid="button-close"
              >
                <ChevronLeft className="w-5 h-5 text-white/70" />
              </button>
            </Link>
            <h1 className="text-[17px] font-semibold tracking-tight" data-testid="text-history-title">
              {t('history.title')}
            </h1>
            <div className="w-10 h-10" />
          </div>

          {/* Operations List */}
          <div className="flex-1 px-5 space-y-4">
            {isLoading && offset === 0 ? (
              // Loading Skeleton
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-[#13151A] border border-white/5 rounded-3xl p-5 shadow-2xl shadow-black/40">
                    <div className="flex justify-between mb-4">
                      <div className="space-y-2">
                        <div className="w-16 h-3 bg-white/5 animate-pulse rounded" />
                        <div className="w-24 h-3 bg-white/5 animate-pulse rounded" />
                      </div>
                      <div className="w-20 h-4 bg-white/5 animate-pulse rounded" />
                    </div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="space-y-2">
                        <div className="w-12 h-3 bg-white/5 animate-pulse rounded" />
                        <div className="w-16 h-6 bg-white/5 animate-pulse rounded" />
                      </div>
                      <div className="w-4 h-4 bg-white/5 animate-pulse rounded-full" />
                      <div className="space-y-2 items-end flex flex-col">
                        <div className="w-12 h-3 bg-white/5 animate-pulse rounded" />
                        <div className="w-16 h-6 bg-white/5 animate-pulse rounded" />
                      </div>
                    </div>
                    <div className="w-24 h-6 bg-white/5 animate-pulse rounded-full" />
                  </div>
                ))}
              </div>
            ) : allExchanges.length === 0 ? (
              // Empty State
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-4">
                  <History className="w-8 h-8 text-white/15" />
                </div>
                <div className="text-white/40 font-medium">{t('history.emptyHistory')}</div>
                <div className="text-white/25 text-sm mt-1">{t('history.noOperationsYet', 'No operations yet')}</div>
              </div>
            ) : (
              <div className="space-y-4">
                {allExchanges.map((exchange) => (
                  <div 
                    key={exchange.id}
                    className="bg-[#13151A] border border-white/5 rounded-3xl p-5 shadow-2xl shadow-black/40 cursor-pointer hover:border-white/10 transition-all active:scale-[0.99]"
                    onClick={() => handleCardClick(exchange.numberOrder)}
                    data-testid={`exchange-${exchange.id}`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-[10px] font-bold uppercase tracking-wider text-white/35">
                          {t('history.exchangeFunds', 'Exchange')}
                        </h3>
                        <p className="text-[11px] text-white/40 mt-0.5">
                          {new Date(exchange.timestamp).toLocaleString('ru-RU')}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span 
                          className="font-mono text-[13px] text-white/70"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(exchange.numberOrder, exchange.id.toString(), 'applicationNumber');
                          }}
                          data-testid={`exchange-number-${exchange.id}`}
                        >
                          {exchange.numberOrder}
                        </span>
                        <button 
                          className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(exchange.numberOrder, exchange.id.toString(), 'applicationNumber');
                          }}
                          data-testid={`button-copy-application-${exchange.id}`}
                        >
                          {copiedItems[`${exchange.id}-applicationNumber`] ? (
                            <Check className="w-3.5 h-3.5 text-[#3ab368]" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-[#3ab368]" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Exchange Info */}
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] uppercase text-white/35 font-bold tracking-wider">{t('history.youSend')}</div>
                        <div className="text-xl font-bold text-white mt-1">
                          {formatOrderAmount(exchange.amountFrom)} <span className="text-white/60 text-sm">{exchange.fromCurrency}</span>
                        </div>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center shrink-0 mx-2">
                        <ArrowRight className="w-4 h-4 text-white/20" />
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] uppercase text-white/35 font-bold tracking-wider">{t('history.youReceive')}</div>
                        <div className="text-xl font-bold text-[#3ab368] mt-1">
                          {formatOrderAmount(exchange.amountTo)} <span className="text-[#3ab368]/70 text-sm">{exchange.toCurrency}</span>
                        </div>
                      </div>
                    </div>

                    {/* Wallet Address */}
                    {exchange.walletAddress && (
                      <div className="mb-4">
                        <div className="bg-[#1A1D24] border border-white/5 rounded-xl px-3 py-2 flex items-center justify-between">
                          <span 
                            className="font-mono text-[12px] text-white/70 flex-1 truncate"
                            data-testid={`exchange-wallet-${exchange.id}`}
                          >
                            {exchange.walletAddress}
                          </span>
                          <button 
                            className="ml-2 p-1.5 hover:bg-white/10 rounded-full transition-colors shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy(exchange.walletAddress!, exchange.id.toString(), 'wallet');
                            }}
                            data-testid={`button-copy-wallet-${exchange.id}`}
                          >
                            {copiedItems[`${exchange.id}-wallet`] ? (
                              <Check className="w-3.5 h-3.5 text-[#3ab368]" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 text-[#3ab368]" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Card Number / Wallet Address */}
                    {exchange.cardNumber && (
                      <div className="mb-4">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-white/35 mb-1.5">{t(getRecipientLabelKey(exchange.cardNumber))}</div>
                        <div className="bg-[#1A1D24] border border-white/5 rounded-xl px-3 py-2 flex items-center justify-between">
                          <span 
                            className="font-mono text-[12px] text-white/70 truncate flex-1"
                            data-testid={`exchange-card-${exchange.id}`}
                          >
                            {formatRecipientAddress(exchange.cardNumber)}
                          </span>
                          <button 
                            className="ml-2 p-1.5 hover:bg-white/10 rounded-full transition-colors shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy(exchange.cardNumber!, exchange.id.toString(), 'card');
                            }}
                            data-testid={`button-copy-card-${exchange.id}`}
                          >
                            {copiedItems[`${exchange.id}-card`] ? (
                              <Check className="w-3.5 h-3.5 text-[#3ab368]" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 text-[#3ab368]" />
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
                            <div className="cursor-pointer inline-block" onClick={(e) => e.stopPropagation()}>
                              {getStatusDisplay(exchange)}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="bg-[#1A1D24] border-white/10 text-white">
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
            <div className="px-5 mt-4 pb-6">
              <button 
                className="w-full flex items-center justify-center gap-2 bg-[#13151A] border border-white/5 hover:border-[#3ab368]/30 hover:bg-[#3ab368]/5 text-white/60 hover:text-white rounded-2xl py-3 text-sm font-medium transition-all"
                onClick={handleLoadMore}
                disabled={isLoading}
                data-testid="button-show-more"
              >
                {isLoading && offset > 0 ? t('common.loading') : t('history.loadMore')}
              </button>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
