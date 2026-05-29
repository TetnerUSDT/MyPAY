import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft, HelpCircle, CheckCircle2, Star, SlidersHorizontal,
  Plus, Clock, TrendingUp, X
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const AVATAR_COLORS = ["#e63946","#2a9d8f","#e9c46a","#f4a261","#3ab368","#4361ee","#7209b7","#e76f51"];
const avatarColor = (id: number) => AVATAR_COLORS[id % AVATAR_COLORS.length];

interface CreateOrderSheetProps {
  ad: any;
  onClose: () => void;
}

function CreateOrderSheet({ ad, onClose }: CreateOrderSheetProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState<string>("");

  const { data: userMethods = [] } = useQuery<any[]>({
    queryKey: ["/api/p2p/user-payment-methods"],
  });

  const price = parseFloat(ad.price);
  const assetAmt = parseFloat(amount) || 0;
  const fiatAmt = assetAmt * price;
  const minAmt = parseFloat(ad.minAmount);
  const maxAmt = parseFloat(ad.maxAmount);

  const createOrder = useMutation({
    mutationFn: () => apiRequest("POST", "/api/p2p/orders", {
      adId: ad.id,
      assetAmount: assetAmt,
      paymentMethodId: paymentMethodId ? parseInt(paymentMethodId) : null,
    }),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["/api/p2p/ads"] });
      onClose();
      setLocation(`/p2p/order/${data.id}`);
    },
    onError: (err: any) => toast({ title: "Ошибка", description: err.message, variant: "destructive" }),
  });

  const isValid = assetAmt >= minAmt && assetAmt <= maxAmt && assetAmt <= parseFloat(ad.availableAmount);

  const quickAmounts = [minAmt, Math.round((minAmt + maxAmt) / 3), Math.round((minAmt + maxAmt) * 2 / 3), maxAmt].filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full bg-[#13151A] border-t border-white/5 rounded-t-3xl p-5 pb-10 space-y-5 max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">
              {ad.side === "sell" ? "Купить" : "Продать"} {ad.assetCurrency}
            </h2>
            <p className="text-xs text-white/40 mt-0.5">у {ad.traderName || "мерчанта"}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>

        {/* Price info */}
        <div className="bg-[#1A1D24] rounded-2xl p-3 flex justify-between items-center">
          <span className="text-xs text-white/40">Курс</span>
          <span className="font-bold text-[#3ab368]">{price.toFixed(2)} ₽</span>
        </div>

        {/* Amount input */}
        <div className="space-y-2">
          <label className="text-xs text-white/50 font-medium">Количество {ad.assetCurrency}</label>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder={`${minAmt} – ${maxAmt}`}
              className="w-full bg-[#1A1D24] border border-white/5 rounded-2xl px-4 py-3 text-white text-base outline-none placeholder-white/20 pr-20"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 text-sm font-medium">{ad.assetCurrency}</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {quickAmounts.map((qa, i) => (
              <button
                key={i}
                onClick={() => setAmount(qa.toString())}
                className="text-xs px-3 py-1.5 rounded-xl bg-[#1A1D24] border border-white/5 text-white/60 hover:text-white hover:border-[#3ab368]/30 transition-colors"
              >
                {qa.toLocaleString("ru-RU")}
              </button>
            ))}
          </div>
        </div>

        {/* Fiat calculation */}
        {assetAmt > 0 && (
          <div className="bg-[#1A1D24] rounded-2xl p-3 flex justify-between items-center">
            <span className="text-xs text-white/40">Вы {ad.side === "sell" ? "платите" : "получаете"}</span>
            <span className="font-bold text-white text-base">{fiatAmt.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ₽</span>
          </div>
        )}

        {/* Payment method selector */}
        {ad.paymentMethods?.length > 0 && (
          <div className="space-y-2">
            <label className="text-xs text-white/50 font-medium">Метод оплаты</label>
            <div className="flex flex-wrap gap-2">
              {ad.paymentMethods.map((pm: any) => (
                <button
                  key={pm.id}
                  onClick={() => setPaymentMethodId(paymentMethodId === pm.id.toString() ? "" : pm.id.toString())}
                  className={`text-xs px-3 py-1.5 rounded-xl border transition-colors ${
                    paymentMethodId === pm.id.toString()
                      ? "bg-[#3ab368]/20 border-[#3ab368]/50 text-[#3ab368]"
                      : "bg-[#1A1D24] border-white/5 text-white/60"
                  }`}
                >
                  {pm.title}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Limits */}
        <div className="text-xs text-white/30">
          Доступно: {parseFloat(ad.availableAmount).toFixed(4)} {ad.assetCurrency} · Лимиты: {minAmt.toLocaleString("ru-RU")} – {maxAmt.toLocaleString("ru-RU")}
        </div>

        {/* Submit */}
        <button
          onClick={() => createOrder.mutate()}
          disabled={!isValid || createOrder.isPending}
          className={`w-full py-4 rounded-2xl font-bold text-sm transition-all shadow-lg disabled:opacity-40 ${
            ad.side === "sell"
              ? "bg-[#3ab368] text-[#0B0C10] shadow-[#3ab368]/20"
              : "bg-[#f97316] text-white shadow-[#f97316]/20"
          }`}
        >
          {createOrder.isPending ? "Создание..." : ad.side === "sell" ? `Купить ${ad.assetCurrency}` : `Продать ${ad.assetCurrency}`}
        </button>
      </div>
    </div>
  );
}

function AdCardSkeleton() {
  return (
    <div className="bg-[#13151A] rounded-3xl border border-white/5 p-4 mb-3 animate-pulse">
      <div className="flex gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-white/5 shrink-0" />
        <div className="space-y-2 flex-1">
          <div className="h-3 bg-white/5 rounded-full w-28" />
          <div className="h-2 bg-white/5 rounded-full w-40" />
        </div>
      </div>
      <div className="h-6 bg-white/5 rounded-full w-32 mb-2" />
      <div className="space-y-1.5">
        <div className="h-2 bg-white/5 rounded-full w-full" />
        <div className="h-2 bg-white/5 rounded-full w-3/4" />
      </div>
    </div>
  );
}

export default function P2PScreen() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<"buy" | "sell">("buy");
  const [currency, setCurrency] = useState("any");
  const [amount, setAmount] = useState("any");
  const [payment, setPayment] = useState("any");
  const [expandedPayments, setExpandedPayments] = useState<Set<number>>(new Set());
  const [selectedAd, setSelectedAd] = useState<any | null>(null);

  const { data: paymentMethods = [] } = useQuery<any[]>({
    queryKey: ["/api/p2p/payment-methods"],
  });

  const adsQuery = useQuery<any[]>({
    queryKey: ["/api/p2p/ads", tab, currency, payment, amount],
    queryFn: () => {
      const params = new URLSearchParams({ side: tab });
      if (currency !== "any") params.set("asset_balance_id", currency);
      if (payment !== "any") params.set("payment_method_id", payment);
      if (amount !== "any") params.set("amount", amount);
      return fetch(`/api/p2p/ads?${params}`, {
        headers: { "x-api-key": localStorage.getItem("apiKey") || "" },
      }).then(r => r.json());
    },
    refetchInterval: 15000,
  });

  const ads = adsQuery.data ?? [];
  const isLoading = adsQuery.isLoading;

  return (
    <div className="min-h-screen bg-[#0B0C10] text-[#E2E8F0] pb-28 font-sans flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-6 pb-4">
        <Link href="/home">
          <button className="w-10 h-10 rounded-full bg-white/5 border border-white/5 flex items-center justify-center">
            <ChevronLeft className="w-5 h-5 text-white/70" />
          </button>
        </Link>
        <h1 className="text-[17px] font-semibold tracking-tight text-white">P2P Exchange</h1>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setLocation("/p2p/my-ads")}
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/5 transition-colors"
            title="Мои объявления"
          >
            <TrendingUp className="w-4 h-4 text-white/40" />
          </button>
          <button
            onClick={() => toast({ title: "P2P Exchange", description: "Прямая торговля крипто без комиссий. Безопасная сделка с блокировкой средств." })}
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/5 transition-colors"
          >
            <HelpCircle className="w-4 h-4 text-white/40" />
          </button>
        </div>
      </div>

      {/* Buy/Sell Tabs */}
      <div className="px-5 mt-1 mb-4">
        <div className="flex bg-[#13151A] rounded-2xl p-1 border border-white/5 relative shadow-lg">
          <div
            className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-[#1A1D24] border border-white/10 rounded-xl transition-all duration-300"
            style={{ left: tab === "buy" ? "4px" : "calc(50%)" }}
          />
          {(["buy", "sell"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 relative z-10 py-2.5 text-sm font-semibold rounded-xl transition-colors duration-200 ${
                tab === t ? "text-white" : "text-white/40"
              }`}
            >
              {t === "buy" ? "Купить" : "Продать"}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="px-5 mb-5 flex items-center gap-2 overflow-x-auto scrollbar-hide py-1">
        <Select value={currency} onValueChange={setCurrency}>
          <SelectTrigger className="bg-[#1A1D24] border border-white/5 rounded-xl h-9 text-xs font-medium text-white px-3 flex-shrink-0 w-auto focus:ring-0">
            <SelectValue placeholder="Валюта" />
          </SelectTrigger>
          <SelectContent className="bg-[#1A1D24] border-white/10 text-white rounded-xl">
            <SelectItem value="any">Все валюты</SelectItem>
            <SelectItem value="3">USDT TRC20</SelectItem>
            <SelectItem value="4">USDT BEP20</SelectItem>
            <SelectItem value="6">TON USDT</SelectItem>
          </SelectContent>
        </Select>

        <Select value={amount} onValueChange={setAmount}>
          <SelectTrigger className="bg-[#1A1D24] border border-white/5 rounded-xl h-9 text-xs font-medium text-white px-3 flex-shrink-0 w-auto focus:ring-0">
            <SelectValue placeholder="Сумма" />
          </SelectTrigger>
          <SelectContent className="bg-[#1A1D24] border-white/10 text-white rounded-xl">
            <SelectItem value="any">Любая сумма</SelectItem>
            <SelectItem value="1000">1 000 ₽</SelectItem>
            <SelectItem value="5000">5 000 ₽</SelectItem>
            <SelectItem value="10000">10 000 ₽</SelectItem>
            <SelectItem value="50000">50 000 ₽</SelectItem>
          </SelectContent>
        </Select>

        <Select value={payment} onValueChange={setPayment}>
          <SelectTrigger className="bg-[#1A1D24] border border-white/5 rounded-xl h-9 text-xs font-medium text-white px-3 flex-shrink-0 w-auto focus:ring-0">
            <SelectValue placeholder="Оплата" />
          </SelectTrigger>
          <SelectContent className="bg-[#1A1D24] border-white/10 text-white rounded-xl">
            <SelectItem value="any">Все методы</SelectItem>
            {paymentMethods.map((pm: any) => (
              <SelectItem key={pm.id} value={pm.id.toString()}>{pm.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <button className="h-9 w-9 bg-[#1A1D24] border border-white/5 rounded-xl flex items-center justify-center flex-shrink-0">
          <SlidersHorizontal className="w-4 h-4 text-white/70" />
        </button>
      </div>

      {/* Create Ad Button */}
      <div className="px-5 mb-4">
        <button
          onClick={() => setLocation("/p2p/create-ad")}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-[#3ab368]/10 border border-[#3ab368]/20 text-[#3ab368] text-sm font-semibold hover:bg-[#3ab368]/15 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Создать объявление
        </button>
      </div>

      {/* Ads List */}
      <div className="px-5 flex-1">
        {isLoading && (
          <>
            <AdCardSkeleton /><AdCardSkeleton /><AdCardSkeleton />
          </>
        )}

        {!isLoading && ads.length === 0 && (
          <div className="py-16 text-center flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <SlidersHorizontal className="w-6 h-6 text-white/20" />
            </div>
            <p className="text-white/40 text-sm font-medium">Объявлений не найдено</p>
            <p className="text-white/25 text-xs mt-1">Попробуйте изменить фильтры</p>
          </div>
        )}

        {!isLoading && ads.map((ad: any) => {
          const traderId = ad.traderId ?? ad.userId;
          const traderName = ad.traderName || "Мерчант";
          const orders = Number(ad.totalOrders ?? 0);
          const completion = Number(ad.successfulPercent ?? 0);
          const rating = Number(ad.rating ?? 0);
          const isMerchant = Boolean(ad.isMerchant);
          const isExpanded = expandedPayments.has(ad.id);

          return (
            <div
              key={ad.id}
              className="bg-[#13151A] rounded-3xl border border-white/5 p-4 shadow-2xl shadow-black/40 mb-3"
            >
              {/* Trader info */}
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                  style={{ backgroundColor: avatarColor(traderId) }}
                >
                  {traderName.substring(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-white text-sm truncate">{traderName}</span>
                    {isMerchant && <CheckCircle2 className="w-3.5 h-3.5 text-[#3ab368] shrink-0" />}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {rating > 0 && (
                      <div className="flex items-center text-[10px] text-white/50">
                        <Star className="w-2.5 h-2.5 text-[#e9c46a] mr-0.5 fill-current" />
                        {Number(rating).toFixed(1)}
                      </div>
                    )}
                    {orders > 0 && (
                      <>
                        <div className="w-0.5 h-0.5 rounded-full bg-white/10" />
                        <span className="text-[10px] text-white/50">{orders} сделок</span>
                      </>
                    )}
                    {completion > 0 && (
                      <>
                        <div className="w-0.5 h-0.5 rounded-full bg-white/10" />
                        <div className="flex items-center gap-1 text-[10px] text-white/50">
                          {completion.toFixed(1)}%
                          <div className="w-8 h-1 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-[#3ab368]" style={{ width: `${Math.min(completion, 100)}%` }} />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                {ad.paymentTimeMinutes && (
                  <div className="flex items-center gap-1 text-[10px] text-white/30 shrink-0">
                    <Clock className="w-3 h-3" />{ad.paymentTimeMinutes}м
                  </div>
                )}
              </div>

              {/* Price & details */}
              <div className="flex items-end gap-2 mb-2">
                <div className="text-2xl font-bold tracking-tight text-[#3ab368]">
                  {parseFloat(ad.price).toFixed(2)}
                  <span className="text-xs font-semibold text-[#3ab368]/60 ml-1">₽</span>
                </div>
              </div>

              <div className="space-y-1 mb-3">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-white/40">Доступно</span>
                  <span className="text-white/80 font-semibold">
                    {parseFloat(ad.availableAmount).toFixed(4)} {ad.assetCurrency}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-white/40">Лимиты</span>
                  <span className="text-white/80 font-semibold">
                    {parseFloat(ad.minAmount).toLocaleString("ru-RU")} – {parseFloat(ad.maxAmount).toLocaleString("ru-RU")} ₽
                  </span>
                </div>
              </div>

              {/* Bottom row */}
              <div className="flex items-center justify-between gap-3 border-t border-white/5 pt-3">
                <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
                  {(isExpanded ? ad.paymentMethods : ad.paymentMethods?.slice(0, 2))?.map((pm: any, i: number) => (
                    <span key={i} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#1A1D24] border border-white/5 text-white/60">
                      {pm.title}
                    </span>
                  ))}
                  {(ad.paymentMethods?.length ?? 0) > 2 && (
                    <button
                      onClick={() => setExpandedPayments(prev => {
                        const n = new Set(prev);
                        n.has(ad.id) ? n.delete(ad.id) : n.add(ad.id);
                        return n;
                      })}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#1A1D24] border border-[#3ab368]/30 text-[#3ab368]"
                    >
                      {isExpanded ? "Скрыть" : `+${ad.paymentMethods.length - 2}`}
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setSelectedAd(ad)}
                  className={`shrink-0 py-2 px-5 rounded-xl text-sm font-bold transition-all shadow-lg active:scale-95 ${
                    tab === "buy"
                      ? "bg-[#3ab368] text-[#0B0C10] shadow-[#3ab368]/20"
                      : "bg-[#f97316] text-white shadow-[#f97316]/20"
                  }`}
                >
                  {tab === "buy" ? "Купить" : "Продать"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Order Sheet */}
      {selectedAd && (
        <CreateOrderSheet ad={selectedAd} onClose={() => setSelectedAd(null)} />
      )}
    </div>
  );
}
