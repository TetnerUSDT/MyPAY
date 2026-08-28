import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiQuery, apiRequest } from "@/lib/api";
import { useMyAds, useOrders, useUpdateAd, useDeleteAd } from "@/hooks/use-p2p";
import { CreateAdModal } from "@/components/create-ad-modal";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Clock3,
  History,
  Megaphone,
  Pause,
  Percent,
  Play,
  Plus,
  ShieldCheck,
  Star,
  WalletCards,
  X,
  Zap
} from "lucide-react";

function useMerchantDashboard() {
  return useQuery({
    queryKey: ["/api/p2p/dashboard"],
    queryFn: () => apiQuery("/api/p2p/dashboard"),
    refetchInterval: 30000,
    retry: 1,
  });
}

const STATUS_LABEL: Record<string, string> = {
  waiting_payment: "Ожидание оплаты",
  paid: "Оплачено",
  released: "Завершена",
  cancelled: "Отменена",
  dispute: "Спор",
  refunded: "Возвращена",
  expired: "Истекла",
  created: "Создана",
};

type WorkspaceModalTarget = "deals" | "ads" | "payment-details";

function formatReleaseTime(seconds: number) {
  if (!seconds) return "—";
  if (seconds < 60) return `${seconds} сек`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} мин`;
  return `${(seconds / 3600).toFixed(1)} ч`;
}

function formatMerchantLevel(level: string) {
  if (level === "pro") return "Про";
  if (level === "verified") return "Верифицирован";
  if (level === "basic") return "Мерчант";
  return "Обычный";
}

export function MerchantCockpit({ onOpenModal }: { onOpenModal?: (modal: WorkspaceModalTarget) => void }) {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  
  const [showCreateAd, setShowCreateAd] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<any | null>(null);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [promotingId, setPromotingId] = useState<number | null>(null);
  const cancelTriggerRef = useRef<HTMLButtonElement | null>(null);

  const closeCancelDialog = () => {
    setCancelTarget(null);
    window.requestAnimationFrame(() => cancelTriggerRef.current?.focus());
  };

  // Data hooks
  const {
    data: dashboard,
    isLoading: dashLoading,
    isError: dashError,
    error: dashboardError,
    refetch: refetchDashboard,
  } = useMerchantDashboard();
  const {
    data: orders = [],
    isLoading: ordersLoading,
    isError: ordersError,
    error: ordersErrorDetails,
    refetch: refetchOrders,
  } = useOrders();
  const {
    data: ads = [],
    isLoading: adsLoading,
    isError: adsError,
    error: adsErrorDetails,
    refetch: refetchAds,
  } = useMyAds();
  const updateAd = useUpdateAd();
  const deleteAd = useDeleteAd();

  // Process data
  const stats = dashboard || {};
  const merchantLevel = String(stats.merchantLevel || "none");
  const rating = Number(stats.rating ?? 0);
  const completion = Number(stats.successfulPercent ?? 0);
  const ordersCount = Number(stats.totalOrders ?? 0);
  const completedOrders = Number(stats.completedOrders ?? 0);
  const releaseSpeed = formatReleaseTime(Number(stats.avgReleaseTimeSeconds ?? 0));
  const disputes = Number(stats.disputesTotal ?? 0);

  const adsList = Array.isArray(ads) ? ads : [];
  const activeAdsCount = adsList.filter(a => a.status === "active").length;

  const ordersList = Array.isArray(orders) ? orders : [];
  const activeOrders = ordersList.filter(o => !["released", "cancelled", "refunded", "expired"].includes(o.status));
  const incomingOrders = activeOrders.filter(o => !o.isCurrentUserBuyer);

  // Determine if a deal needs merchant attention
  const needsAttention = (o: any) => {
    const isBuyer = o.isCurrentUserBuyer;
    if (!isBuyer && o.status === "paid") return true;
    if (o.status === "dispute") return true;
    return false;
  };

  const handleBulkToggle = async (status: "active" | "paused") => {
    if (adsList.length === 0) return;
    setIsBulkUpdating(true);
    try {
      await apiRequest("PATCH", "/api/p2p/ads/bulk", { status });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["/api/p2p/my-ads"] }),
        qc.invalidateQueries({ queryKey: ["/api/p2p/ads"] }),
      ]);
      toast({ 
        title: "Готово", 
        description: `Объявления ${status === "active" ? "активированы" : "приостановлены"}`,
      });
    } catch (error: any) {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handlePromote = async (id: number) => {
    setPromotingId(id);
    try {
      const response = await apiRequest("POST", `/api/p2p/ads/${id}/promote`);
      const result = await response.json();
      if (!result.success) throw new Error(result.message || "Не удалось продвинуть объявление");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["/api/p2p/my-ads"] }),
        qc.invalidateQueries({ queryKey: ["/api/p2p/ads"] }),
      ]);
      toast({ title: "Объявление продвинуто", description: "Приоритет в выдаче повышен на 24 часа." });
    } catch (error: any) {
      toast({ title: "Продвижение не выполнено", description: error.message, variant: "destructive" });
    } finally {
      setPromotingId(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 md:px-8 md:py-8 bg-[#0b0d11] min-h-0 relative">
      <div className="max-w-[1400px] mx-auto">
        
        {/* Header */}
        <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.18em] text-[#59d17e]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#59d17e] animate-pulse" />
              Кокпит мерчанта
            </div>
            <h2 className="text-[27px] font-semibold tracking-tight text-white">Кабинет мерчанта</h2>
            <p className="mt-1 text-sm text-white/40">Контроль ликвидности и оперативное управление сделками.</p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={() => onOpenModal?.("payment-details")}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#13161b] px-4 py-2.5 text-xs font-semibold text-white/70 transition hover:bg-white/5 hover:text-white"
            >
              <WalletCards size={15} />Реквизиты
            </button>
            <button 
              onClick={() => setShowCreateAd(true)}
              className="flex items-center gap-2 rounded-xl border border-[#3ab368]/30 bg-[#3ab368]/10 px-4 py-2.5 text-xs font-bold text-[#59d17e] transition hover:bg-[#3ab368]/20"
            >
              <Plus size={15} />Создать объявление
            </button>
          </div>
        </div>

        {/* Stats Row */}
        {dashLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-8">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-[#111419] border border-white/[.06] rounded-xl p-4 h-[92px] animate-pulse" />
            ))}
          </div>
        ) : dashError ? (
          <div className="mb-8 flex items-center justify-between rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-4">
            <div>
              <p className="text-sm font-medium text-red-300">Не удалось загрузить статистику</p>
              <p className="mt-1 text-xs text-white/35">{dashboardError?.message}</p>
            </div>
            <button onClick={() => refetchDashboard()} className="rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/15">
              Повторить
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-8 animate-in fade-in slide-in-from-top-2 duration-500 delay-100">
            <div className="bg-[#111419] border border-white/[.06] rounded-xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-white/40 mb-3">
                <span className="text-[10px] uppercase tracking-wider font-semibold">Уровень</span>
                <ShieldCheck size={14} className="text-[#59d17e]" />
              </div>
              <div>
                <div className="text-lg font-bold text-white truncate leading-none">{formatMerchantLevel(merchantLevel)}</div>
              </div>
            </div>

            <div className="bg-[#111419] border border-white/[.06] rounded-xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-white/40 mb-3">
                <span className="text-[10px] uppercase tracking-wider font-semibold">Всего сделок</span>
                <Activity size={14} />
              </div>
              <div>
                <div className="text-2xl font-bold text-white leading-none">{ordersCount}</div>
                <div className="mt-1 text-[10px] text-white/35">{completedOrders} завершено</div>
              </div>
            </div>

            <div className="bg-[#111419] border border-white/[.06] rounded-xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-white/40 mb-3">
                <span className="text-[10px] uppercase tracking-wider font-semibold">Успешность</span>
                <Percent size={14} />
              </div>
              <div>
                <div className="text-2xl font-bold text-white leading-none">{Number(completion).toFixed(1)}%</div>
              </div>
            </div>

            <div className="bg-[#111419] border border-white/[.06] rounded-xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-white/40 mb-3">
                <span className="text-[10px] uppercase tracking-wider font-semibold">Рейтинг</span>
                <Star size={14} className="text-[#e9b44c]" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white leading-none">{rating.toFixed(1)}</div>
                <div className="mt-1 text-[10px] text-white/35">{Number(stats.reviewsCount ?? 0)} отзывов</div>
              </div>
            </div>

            <div className="bg-[#111419] border border-white/[.06] rounded-xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-white/40 mb-3">
                <span className="text-[10px] uppercase tracking-wider font-semibold">Скорость</span>
                <Clock3 size={14} />
              </div>
              <div>
                <div className="text-2xl font-bold text-white leading-none">{releaseSpeed}</div>
                <div className="mt-1 text-[10px] text-white/35">средний выпуск</div>
              </div>
            </div>

            <div className="bg-[#111419] border border-white/[.06] rounded-xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-white/40 mb-3">
                <span className="text-[10px] uppercase tracking-wider font-semibold">Споры</span>
                <AlertTriangle size={14} className={Number(disputes) > 0 ? "text-red-400" : ""} />
              </div>
              <div>
                <div className="text-2xl font-bold text-white leading-none">{disputes}</div>
              </div>
            </div>
          </div>
        )}

        {/* Main Workspace */}
        <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_1fr] gap-6 xl:gap-8">
          
          {/* Deals Column */}
          <div className="flex flex-col min-h-0 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold text-white">Входящие и активные сделки</h3>
                <span className="text-[10px] bg-white/10 text-white/60 px-2 py-0.5 rounded-md font-medium">
                  {incomingOrders.length} входящих
                </span>
              </div>
              <button 
                onClick={() => onOpenModal?.("deals")}
                className="text-[10px] uppercase tracking-wider font-bold text-white/40 hover:text-white transition"
              >
                Все сделки
              </button>
            </div>

            {ordersLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="bg-[#111419] border border-white/[.06] rounded-2xl h-[160px] animate-pulse" />
                ))}
              </div>
            ) : ordersError ? (
              <div className="border border-red-500/20 bg-red-500/5 rounded-2xl p-6 text-center">
                <AlertTriangle className="w-6 h-6 text-red-400 mx-auto mb-2" />
                <p className="text-sm text-red-300 font-medium">Ошибка загрузки сделок</p>
                <p className="mt-1 text-xs text-white/35">{ordersErrorDetails?.message}</p>
                <button onClick={() => refetchOrders()} className="mt-4 rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/15">Повторить</button>
              </div>
            ) : activeOrders.length === 0 ? (
              <div className="border border-dashed border-white/10 rounded-2xl py-14 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mb-3">
                  <History className="text-white/20 w-5 h-5" />
                </div>
                <p className="text-sm text-white/60 font-medium">Нет активных сделок</p>
                <p className="text-xs text-white/30 mt-1">Новые заявки от контрагентов появятся здесь</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeOrders.map(o => {
                  const isBuy = o.isCurrentUserBuyer;
                  const attention = needsAttention(o);
                  
                  return (
                    <button 
                      key={o.id}
                      onClick={() => setLocation(`/order/${o.id}`)}
                      className={`w-full text-left rounded-2xl p-4 md:p-5 transition-all duration-200 border group block ${
                        attention 
                          ? 'bg-[#151a16] border-[#3ab368]/40 hover:border-[#3ab368]/70 shadow-[0_0_20px_rgba(58,179,104,0.06)]' 
                          : 'bg-[#111419] border-white/[.06] hover:border-white/15'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${attention ? 'bg-[#3ab368]/10 text-[#59d17e]' : 'bg-white/5 text-white/40'}`}>
                            {isBuy ? <ArrowRight size={14} className="rotate-45" /> : <ArrowRight size={14} className="-rotate-45" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white">{isBuy ? "ПОКУПКА" : "ПРОДАЖА"}</span>
                              {attention && <span className="w-1.5 h-1.5 rounded-full bg-[#59d17e] animate-pulse" />}
                            </div>
                            <span className="text-[10px] text-white/30">#{o.id}</span>
                          </div>
                        </div>
                        <div className={`text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider ${attention ? 'bg-[#3ab368]/15 text-[#59d17e]' : 'bg-white/5 text-white/40'}`}>
                          {STATUS_LABEL[o.status] || o.status}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 items-end">
                        <div>
                          <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Сумма в рублях</div>
                          <div className="text-xl md:text-2xl font-bold text-white leading-none">
                            {parseFloat(o.fiatAmount).toLocaleString("ru-RU")} 
                            <span className="text-xs md:text-sm text-white/50 ml-1 font-semibold">₽</span>
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Криптовалюта</div>
                          <div className="text-lg md:text-xl font-bold text-white leading-none">
                            {parseFloat(o.assetAmount).toLocaleString("ru-RU")} 
                            <span className="text-xs md:text-sm text-white/50 ml-1 font-semibold">{o.assetCurrency}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-5 pt-3 border-t border-white/[.04] flex items-center justify-between text-[11px] text-white/40">
                        <div className="flex items-center gap-1.5 bg-black/20 px-2.5 py-1 rounded-md">
                          <Clock3 size={11} />
                          {new Date(o.createdAt).toLocaleTimeString("ru-RU", { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-white/20">Контрагент:</span>
                          <span className="text-white/70 font-medium">{isBuy ? o.sellerName || "Продавец" : o.buyerName || "Покупатель"}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Ads Column */}
          <div className="flex flex-col min-h-0 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold text-white">Мои объявления</h3>
                <span className="text-[10px] bg-[#3ab368]/10 text-[#59d17e] border border-[#3ab368]/20 px-2 py-0.5 rounded-md font-medium">
                  {activeAdsCount} активно
                </span>
              </div>
              
              <div className="flex items-center gap-1.5 bg-[#13161b] p-1 rounded-xl border border-white/[.06]">
                <button 
                  onClick={() => handleBulkToggle("active")}
                  disabled={isBulkUpdating || adsList.length === 0}
                  className="flex items-center gap-1.5 text-[10px] font-bold text-white/60 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 transition disabled:opacity-50"
                >
                  <Play size={12} className="text-[#59d17e]" /> ВКЛ ВСЕ
                </button>
                <div className="w-px h-3 bg-white/10"></div>
                <button 
                  onClick={() => handleBulkToggle("paused")}
                  disabled={isBulkUpdating || adsList.length === 0}
                  className="flex items-center gap-1.5 text-[10px] font-bold text-white/60 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 transition disabled:opacity-50"
                >
                  <Pause size={12} className="text-[#e9b44c]" /> ВЫКЛ ВСЕ
                </button>
              </div>
            </div>

            {adsLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="bg-[#111419] border border-white/[.06] rounded-2xl h-[140px] animate-pulse" />
                ))}
              </div>
            ) : adsError ? (
              <div className="border border-red-500/20 bg-red-500/5 rounded-2xl p-6 text-center">
                <AlertTriangle className="w-6 h-6 text-red-400 mx-auto mb-2" />
                <p className="text-sm text-red-300 font-medium">Ошибка загрузки объявлений</p>
                <p className="mt-1 text-xs text-white/35">{adsErrorDetails?.message}</p>
                <button onClick={() => refetchAds()} className="mt-4 rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/15">Повторить</button>
              </div>
            ) : adsList.length === 0 ? (
              <div className="border border-dashed border-white/10 rounded-2xl py-14 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mb-3">
                  <Megaphone className="text-white/20 w-5 h-5" />
                </div>
                <p className="text-sm text-white/60 font-medium">Нет объявлений</p>
                <p className="text-xs text-white/30 mt-1 mb-4">Создайте предложение для торговли</p>
                <button 
                  onClick={() => setShowCreateAd(true)}
                  className="text-xs font-bold bg-[#3ab368]/10 text-[#59d17e] border border-[#3ab368]/20 px-4 py-2 rounded-xl hover:bg-[#3ab368]/20 transition"
                >
                  Создать объявление
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {adsList.map(ad => {
                  const isActive = ad.status === "active";
                  const isSell = ad.side === "sell";
                  const canManage = isActive || ad.status === "paused";
                  
                  return (
                    <div 
                      key={ad.id} 
                      data-testid={`merchant-ad-${ad.id}`}
                      className={`p-4 md:p-5 rounded-2xl border transition-all ${
                        isActive 
                          ? 'bg-[#111419] border-white/[.08] hover:border-white/15' 
                          : 'bg-[#0a0c0f] border-white/[.02] opacity-80 hover:opacity-100'
                      } relative overflow-hidden group`}
                    >
                      <div className="flex justify-between items-start mb-5 relative z-10">
                        <div className="flex items-center gap-3">
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider ${isSell ? 'bg-[#3ab368]/10 text-[#59d17e] border border-[#3ab368]/20' : 'bg-[#f97316]/10 text-[#ff9c59] border border-[#f97316]/20'}`}>
                            {isSell ? 'Продажа' : 'Покупка'}
                          </span>
                          <span className="text-[10px] text-white/30">#{ad.id}</span>
                          <span className={`text-[9px] font-bold uppercase tracking-wider ${
                            isActive ? "text-[#59d17e]" : ad.status === "paused" ? "text-[#e9b44c]" : "text-white/35"
                          }`}>
                            {isActive ? "Активно" : ad.status === "paused" ? "На паузе" : ad.status}
                          </span>
                          {ad.isPromoted && (
                            <span className="text-[9px] font-bold uppercase tracking-wider text-[#e9b44c]">Продвинуто</span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-1">
                          {canManage && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePromote(ad.id);
                                }}
                                disabled={promotingId === ad.id}
                                className="p-1.5 rounded-lg bg-transparent text-[#e9b44c]/60 hover:bg-[#e9b44c]/10 hover:text-[#e9b44c] transition disabled:opacity-40"
                                title="Продвинуть в топ"
                              >
                                <Zap size={14} className={promotingId === ad.id ? "animate-pulse" : ""} />
                              </button>
                              <div className="w-px h-4 bg-white/10 mx-1"></div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateAd.mutate({ id: ad.id, data: { status: isActive ? "paused" : "active" } }, {
                                    onError: (err) => toast({ title: "Ошибка", description: err.message, variant: "destructive" })
                                  })
                                }}
                                disabled={updateAd.isPending}
                                className={`p-1.5 rounded-lg transition disabled:opacity-50 ${isActive ? 'bg-[#3ab368]/10 text-[#59d17e] hover:bg-[#3ab368]/20' : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'}`}
                                title={isActive ? "Приостановить" : "Активировать"}
                              >
                                {isActive ? <Pause size={14} /> : <Play size={14} />}
                              </button>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  cancelTriggerRef.current = e.currentTarget;
                                  setCancelTarget(ad);
                                }}
                                className="p-1.5 rounded-lg bg-transparent text-white/30 hover:bg-red-500/10 hover:text-red-400 transition ml-1"
                                title="Закрыть объявление"
                              >
                                <X size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-[1fr_1fr_auto] gap-4 items-end relative z-10">
                        <div>
                          <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Курс</div>
                          <div className="text-xl font-bold text-white leading-none">
                            {parseFloat(ad.price).toFixed(2)} <span className="text-xs text-white/50 ml-0.5">₽</span>
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Остаток</div>
                          <div className="text-sm font-semibold text-white/90 leading-none mb-0.5">
                            {parseFloat(ad.availableAmount).toFixed(2)} <span className="text-[10px] text-white/40 ml-0.5">{ad.assetCurrency}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Лимиты</div>
                          <div className="text-xs font-medium text-white/60 leading-none mb-0.5">
                            {parseFloat(ad.minAmount).toLocaleString("ru-RU")} – {parseFloat(ad.maxAmount).toLocaleString("ru-RU")} <span className="text-[10px]">₽</span>
                          </div>
                        </div>
                      </div>
                      
                      {!isActive && (
                        <div className="absolute inset-0 bg-black/40 pointer-events-none group-hover:bg-black/20 transition-colors" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showCreateAd && <CreateAdModal onClose={() => setShowCreateAd(false)} />}
      
      <AlertDialog
        open={!!cancelTarget}
        onOpenChange={(open) => {
          if (!open && !deleteAd.isPending) closeCancelDialog();
        }}
      >
        <AlertDialogContent className="w-full max-w-sm rounded-[26px] border-white/10 bg-[#101318] p-6 text-white shadow-2xl">
          <AlertDialogHeader>
            <div className="mb-1 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-red-500/20 bg-red-500/10">
                <AlertTriangle className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <AlertDialogTitle className="text-lg font-bold text-white">Закрыть объявление?</AlertDialogTitle>
                <p className="text-xs text-white/40">#{cancelTarget?.id}</p>
              </div>
            </div>
            <AlertDialogDescription className="text-left text-sm leading-relaxed text-white/60">
              Объявление будет навсегда закрыто и удалено с рынка.
              {cancelTarget?.side === "sell" && " Замороженные средства вернутся на баланс."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2 flex-row gap-3 space-x-0">
            <AlertDialogCancel
              disabled={deleteAd.isPending}
              className="mt-0 flex-1 rounded-xl border-white/10 bg-transparent py-3 text-sm font-semibold text-white/60 hover:bg-white/5 hover:text-white"
            >
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteAd.isPending || !cancelTarget}
              onClick={(event) => {
                event.preventDefault();
                if (!cancelTarget) return;
                deleteAd.mutate(cancelTarget.id, {
                  onSuccess: () => {
                    closeCancelDialog();
                    toast({ title: "Объявление закрыто", className: "bg-[#111419] border-white/10 text-white" });
                  },
                  onError: (err) => toast({ title: "Ошибка", description: err.message, variant: "destructive" }),
                });
              }}
              className="flex-1 rounded-xl bg-red-500/90 py-3 text-sm font-bold text-white shadow-lg shadow-red-500/20 hover:bg-red-500 focus-visible:ring-red-400 disabled:opacity-50"
            >
              {deleteAd.isPending ? "Закрытие..." : "Закрыть"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
