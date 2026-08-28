import { useState } from "react";
import { useLocation } from "wouter";
import {
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Clock3,
  History,
  Megaphone,
  Plus,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  WalletCards,
  X,
  CreditCard
} from "lucide-react";
import { useAds, useOrders, useCreateOrder, usePaymentMethods, useUserPaymentMethods } from "@/hooks/use-p2p";
import { useToast } from "@/hooks/use-toast";
import { CreateAdModal } from "@/components/create-ad-modal";
import { useP2PModal } from "@/components/layout";

const AVATAR_COLORS = ["#2f8d69", "#4267a7", "#9a6b43", "#7b558b", "#e63946", "#e9c46a"];
const getAvatarColor = (id: number) => AVATAR_COLORS[id % AVATAR_COLORS.length];

function OrderSheet({ ad, side, onClose }: { ad: any; side: "buy" | "sell"; onClose: () => void }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const createOrder = useCreateOrder();
  const { data: userMethods = [] } = useUserPaymentMethods();
  
  const price = parseFloat(ad.price);
  const minAmt = parseFloat(ad.minAmount);
  const maxAmt = parseFloat(ad.maxAmount);
  const available = parseFloat(ad.availableAmount);
  
  const assetAmount = Number(amount || 0);
  const value = assetAmount * price;
  const userMethodIds = new Set((Array.isArray(userMethods) ? userMethods : []).map((method: any) => method.methodId));
  const availableMethods = (ad.paymentMethods || []).filter((method: any) => side === "buy" || userMethodIds.has(method.id));
  const requiresPaymentMethod = (ad.paymentMethods || []).length > 0;
  const isValid = assetAmount > 0 && assetAmount <= available && assetAmount >= minAmt && assetAmount <= maxAmt
    && (!requiresPaymentMethod || !!paymentMethodId);

  const handleSubmit = () => {
    createOrder.mutate(
      {
        adId: ad.id,
        assetAmount,
        paymentMethodId: paymentMethodId ? Number(paymentMethodId) : null,
      },
      {
        onSuccess: (data) => {
          onClose();
          setLocation(`/order/${data.id}`);
        },
        onError: (error) => toast({
          title: "Не удалось создать сделку",
          description: error.message,
          variant: "destructive",
        }),
      }
    );
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#050609]/80 p-8 backdrop-blur-sm">
      <div className="w-[450px] overflow-hidden rounded-[26px] border border-white/10 bg-[#101318] shadow-2xl shadow-black/60 animate-scaleIn-fast">
        <div className="flex items-start justify-between border-b border-white/[.06] px-6 py-5">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[.18em] text-[#59d17e]">Новая сделка</div>
            <h2 className="mt-1 text-xl font-semibold text-white">{side === "buy" ? "Купить" : "Продать"} {ad.assetCurrency}</h2>
            <p className="mt-1 text-sm text-white/40">объявление {ad.traderName || "Мерчант"} · курс {price} ₽</p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-white/45 transition hover:bg-white/5 hover:text-white">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-5 px-6 py-6">
          <label className="block">
            <span className="mb-2 block text-xs font-medium text-white/45">Количество {ad.assetCurrency}</span>
            <div className="flex items-center rounded-2xl border border-white/10 bg-[#171a20] px-4 focus-within:border-[#3ab368]/60">
              <input 
                autoFocus 
                type="number"
                value={amount} 
                onChange={(e) => setAmount(e.target.value)} 
                className="w-full bg-transparent py-4 text-lg text-white outline-none" 
                placeholder="0.00" 
              />
              <span className="text-sm font-semibold text-white/40">{ad.assetCurrency}</span>
            </div>
          </label>
          <div className="flex items-center justify-between rounded-2xl bg-[#171a20] px-4 py-3">
            <span className="text-sm text-white/45">{side === "buy" ? "Вы платите" : "Вы получаете"}</span>
            <strong className="text-white">{value ? value.toLocaleString("ru-RU", { maximumFractionDigits: 2 }) : "0"} ₽</strong>
          </div>
          <div className="rounded-2xl border border-white/[.06] bg-[#0c0f13] p-4 text-xs text-white/45">
            <div className="flex justify-between">
              <span>Доступно</span>
              <b className="text-white/75">{available} {ad.assetCurrency}</b>
            </div>
            <div className="mt-2 flex justify-between">
              <span>Лимит</span>
              <b className="text-white/75">{minAmt} – {maxAmt} ₽</b>
            </div>
            <div className="mt-2 flex justify-between">
              <span>Метод</span>
              <b className="text-white/75">{availableMethods.find((method: any) => String(method.id) === paymentMethodId)?.title || "Не выбран"}</b>
            </div>
          </div>
          {requiresPaymentMethod && (
            <div>
              <span className="mb-2 block text-xs font-medium text-white/45">Способ оплаты</span>
              <div className="flex flex-wrap gap-2">
                {availableMethods.map((method: any) => (
                  <button
                    key={method.id}
                    onClick={() => setPaymentMethodId(String(method.id))}
                    className={`rounded-xl border px-3 py-2 text-xs font-semibold ${paymentMethodId === String(method.id) ? "border-[#3ab368]/50 bg-[#3ab368]/15 text-[#59d17e]" : "border-white/10 text-white/55"}`}
                  >
                    {method.title}
                  </button>
                ))}
                {availableMethods.length === 0 && <p className="text-xs text-amber-300">Сначала добавьте подходящие реквизиты.</p>}
              </div>
            </div>
          )}
          <button 
            onClick={handleSubmit} 
            disabled={!isValid || createOrder.isPending} 
            className={`w-full rounded-2xl py-3.5 text-sm font-bold transition hover:-translate-y-0.5 disabled:opacity-35 ${
              side === "buy" ? "bg-[#3ab368] text-[#08110b]" : "bg-[#f97316] text-white"
            }`}
          >
            {createOrder.isPending 
              ? "Создание..." 
              : side === "buy" ? "Продолжить покупку" : "Продолжить продажу"}
          </button>
          <p className="text-center text-[11px] text-white/25">
            <ShieldCheck className="mr-1 inline-block" size={13} />
            Средства блокируются до подтверждения сделки
          </p>
        </div>
      </div>
    </div>
  );
}

function RightSidebar() {
  const [, setLocation] = useLocation();
  const { openP2PModal } = useP2PModal();
  const { data: orders = [] } = useOrders();
  const activeOrders = (orders as any[]).filter(o => !["released", "cancelled", "refunded", "expired"].includes(o.status));
  const recentOrders = (orders as any[]).slice(0, 5);

  const activeFiat = activeOrders.reduce((sum, o) => sum + parseFloat(o.fiatAmount), 0);

  return (
    <aside className="w-[342px] shrink-0 border-l border-white/[.055] bg-[#0d1014] px-5 py-6 overflow-y-auto">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Рабочая панель</h2>
          <p className="mt-1 text-[11px] text-white/35">Ваши операции и быстрый доступ</p>
        </div>
      </div>
      
      <div className="mb-5 grid grid-cols-3 gap-1 rounded-xl border border-white/[.06] bg-[#13161b] p-1">
        <button onClick={() => openP2PModal("deals")} className="relative rounded-lg px-1 py-2 text-[10px] font-medium text-white/35 hover:text-white transition">
          <History size={14} className="mx-auto mb-1" />Сделки
          {activeOrders.length > 0 && <span className="absolute right-1 top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[#f97316] px-1 text-[8px] text-white">{activeOrders.length}</span>}
        </button>
        <button onClick={() => openP2PModal("ads")} className="relative rounded-lg px-1 py-2 text-[10px] font-medium text-white/35 hover:text-white transition">
          <Megaphone size={14} className="mx-auto mb-1" />Объявления
        </button>
        <button onClick={() => openP2PModal("payment-details")} className="relative rounded-lg px-1 py-2 text-[10px] font-medium text-white/35 hover:text-white transition">
          <WalletCards size={14} className="mx-auto mb-1" />Реквизиты
        </button>
      </div>

      <div className="mb-5 rounded-2xl border border-[#3ab368]/15 bg-[#112019] p-4">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-semibold text-white">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#59d17e]" />
            Активные сделки
          </span>
          <span className="text-[10px] text-[#59d17e]">{activeOrders.length} сейчас</span>
        </div>
        <div className="mt-4 flex items-end gap-1">
          <strong className="text-2xl text-white">{activeFiat.toLocaleString("ru-RU", { maximumFractionDigits: 0 })}</strong>
          <span className="mb-1 text-xs text-white/40">₽ в работе</span>
        </div>
        <div className="mt-3 flex items-center gap-2 text-[10px] text-white/40">
          <BarChart3 size={12} className="text-[#59d17e]" />
          В реальном времени
        </div>
      </div>

      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-white">Последняя активность</h3>
        <button onClick={() => openP2PModal("deals")} className="text-[10px] text-[#59d17e] hover:underline">Вся история</button>
      </div>
      <div className="space-y-2">
        {recentOrders.length === 0 && (
          <div className="text-[11px] text-white/30 text-center py-4 border border-dashed border-white/10 rounded-xl">
            Нет недавних сделок
          </div>
        )}
        {recentOrders.map((o: any) => {
          const isBuy = o.isCurrentUserBuyer;
          const tone = o.status === "released" ? "slate" : (isBuy ? "amber" : "green");
          return (
            <button key={o.id} onClick={() => setLocation(`/order/${o.id}`)} className="w-full rounded-xl border border-white/[.05] bg-[#13161b] p-3 text-left transition hover:border-white/15 block">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-semibold text-white">{isBuy ? "Покупка" : "Продажа"} {o.assetCurrency}</div>
                  <div className="mt-1 text-[10px] text-white/35">
                    {isBuy ? o.sellerName || "Продавец" : o.buyerName || "Покупатель"} · {parseFloat(o.fiatAmount).toLocaleString("ru-RU")} ₽
                  </div>
                </div>
                <span className={`mt-0.5 h-2 w-2 rounded-full ${tone === "green" ? "bg-[#3ab368]" : tone === "amber" ? "bg-[#e9b44c]" : "bg-white/25"}`} />
              </div>
              <div className="mt-2 text-[10px] text-white/45">{o.status}</div>
            </button>
          )
        })}
      </div>

      <div className="mt-5 border-t border-white/[.06] pt-5">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-white">
          <ShieldCheck size={15} className="text-[#59d17e]" />Защита сделки
        </div>
        <p className="text-[11px] leading-relaxed text-white/35">Средства блокируются в SwiftX до подтверждения оплаты обеими сторонами.</p>
      </div>
    </aside>
  );
}

export default function Market() {
  const [, setLocation] = useLocation();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [asset, setAsset] = useState("all");
  const [amount, setAmount] = useState("all");
  const [payment, setPayment] = useState("all");
  const [selectedAd, setSelectedAd] = useState<any | null>(null);
  const [showCreateAd, setShowCreateAd] = useState(false);
  const { data: paymentMethods = [] } = usePaymentMethods();
  const adSide = side === "buy" ? "sell" : "buy";
  
  const { data: adsRaw = [], isFetching, isError, error, refetch } = useAds({
    side: adSide,
    asset_balance_id: asset,
    amount,
    payment_method_id: payment,
  });

  const ads = Array.isArray(adsRaw) ? adsRaw : [];

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="min-w-0 flex-1 overflow-y-auto px-8 py-7">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.18em] text-[#59d17e]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#59d17e] animate-pulse" />
              Рынок в реальном времени
            </div>
            <h2 className="text-[27px] font-semibold tracking-tight text-white">Найдите лучшее предложение</h2>
            <p className="mt-1 text-sm text-white/40">Откликайтесь на сделки быстро — лучшие цены уже в ленте.</p>
          </div>
          <button 
            onClick={() => setShowCreateAd(true)}
            className="flex items-center gap-2 rounded-xl border border-[#3ab368]/30 bg-[#3ab368]/10 px-4 py-2.5 text-xs font-bold text-[#59d17e] transition hover:bg-[#3ab368]/20"
          >
            <Plus size={15} />Создать объявление
          </button>
        </div>

        <div className="mb-5 flex items-center justify-between rounded-2xl border border-white/[.06] bg-[#101318] p-1.5">
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setSide("buy")} 
              className={`rounded-xl px-7 py-2.5 text-sm font-bold transition ${
                side === "buy" 
                  ? "bg-[#3ab368] text-[#07100a] shadow-lg shadow-[#3ab368]/10" 
                  : "text-white/40 hover:text-white"
              }`}
            >
              Купить
            </button>
            <button 
              onClick={() => setSide("sell")} 
              className={`rounded-xl px-7 py-2.5 text-sm font-bold transition ${
                side === "sell" 
                  ? "bg-[#f97316] text-white shadow-lg shadow-[#f97316]/10" 
                  : "text-white/40 hover:text-white"
              }`}
            >
              Продать
            </button>
          </div>
          <div className="flex items-center gap-2 pr-2 text-[11px] text-white/35">
            <RefreshCw size={13} className={`text-[#59d17e] ${isFetching ? "animate-spin" : ""}`} />
            {isFetching ? "Обновление..." : "Обновлено"}
          </div>
        </div>

        <div className="mb-6 grid grid-cols-[1.2fr_1fr_1fr_auto] gap-2">
          <label className="rounded-xl border border-white/[.06] bg-[#13161b] px-3 py-2">
            <span className="block text-[10px] uppercase tracking-wider text-white/30">Актив</span>
            <select value={asset} onChange={(e) => setAsset(e.target.value)} className="mt-1 w-full bg-transparent text-xs font-semibold text-white outline-none cursor-pointer">
              <option className="bg-[#13161b]" value="all">Все активы</option>
              <option className="bg-[#13161b]" value="3">USDT TRC20</option>
              <option className="bg-[#13161b]" value="4">USDT BEP20</option>
              <option className="bg-[#13161b]" value="6">TON USDT</option>
            </select>
          </label>
          <label className="rounded-xl border border-white/[.06] bg-[#13161b] px-3 py-2">
            <span className="block text-[10px] uppercase tracking-wider text-white/30">Сумма (₽)</span>
            <select value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 w-full bg-transparent text-xs font-semibold text-white outline-none cursor-pointer">
              <option className="bg-[#13161b]" value="all">Любая сумма</option>
              <option className="bg-[#13161b]" value="5000">от 5 000 ₽</option>
              <option className="bg-[#13161b]" value="25000">от 25 000 ₽</option>
              <option className="bg-[#13161b]" value="100000">от 100 000 ₽</option>
            </select>
          </label>
          <label className="rounded-xl border border-white/[.06] bg-[#13161b] px-3 py-2">
            <span className="block text-[10px] uppercase tracking-wider text-white/30">Метод оплаты</span>
            <select value={payment} onChange={(e) => setPayment(e.target.value)} className="mt-1 w-full bg-transparent text-xs font-semibold text-white outline-none cursor-pointer">
              <option className="bg-[#13161b]" value="all">Все методы</option>
              {(Array.isArray(paymentMethods) ? paymentMethods : []).map((method: any) => (
                <option className="bg-[#13161b]" key={method.id} value={method.id}>{method.title}</option>
              ))}
            </select>
          </label>
          <button className="flex items-center justify-center rounded-xl border border-white/[.06] bg-[#13161b] px-3 text-white/45 transition hover:border-[#3ab368]/40 hover:text-[#59d17e]">
            <SlidersHorizontal size={16} />
          </button>
        </div>

        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-white">{side === "buy" ? "Объявления на продажу" : "Заявки на покупку"}</h3>
            <span className="rounded-full bg-white/[.06] px-2 py-0.5 text-[10px] text-white/40">{ads.length} найдено</span>
          </div>
          <button className="flex items-center gap-1 text-[11px] text-white/35 hover:text-white">
            Лучшая цена <ChevronDown size={13} />
          </button>
        </div>

        {isError ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-8 text-center">
            <p className="text-sm font-medium text-red-300">Не удалось загрузить рынок</p>
            <p className="mt-1 text-xs text-white/35">{error.message}</p>
            <button onClick={() => refetch()} className="mt-4 rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/15">Повторить</button>
          </div>
        ) : <div className="space-y-2.5">
          {ads.map((ad: any) => {
            const traderId = ad.traderId || ad.userId;
            const initials = (ad.traderName || "Мерчант").substring(0,2).toUpperCase();
            return (
              <div key={ad.id} className="group grid grid-cols-[1.35fr_.8fr_.85fr_1fr_112px] items-center gap-4 rounded-2xl border border-white/[.06] bg-[#111419] px-4 py-3.5 transition hover:-translate-y-0.5 hover:border-[#3ab368]/30 hover:bg-[#14181d]">
                <div className="flex items-center gap-3">
                  <span style={{ background: getAvatarColor(traderId) }} className="flex h-9 w-9 items-center justify-center rounded-xl text-[10px] font-bold text-white shrink-0">
                    {initials}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-white truncate">
                      {ad.traderName || "Мерчант"}
                      {ad.isMerchant && <CheckCircle2 size={13} className="text-[#59d17e] shrink-0" />}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-white/35">
                      <Star size={10} className="fill-[#e9c46a] text-[#e9c46a]" />
                      {Number(ad.rating || 0).toFixed(1)}
                      <span className="text-white/15">·</span>
                      {ad.totalOrders || 0} сделок
                    </div>
                  </div>
                </div>
                
                <div>
                  <span className="block text-[10px] text-white/30">Курс</span>
                  <strong className={`mt-1 block text-lg ${side === "buy" ? "text-[#59d17e]" : "text-[#ff9c59]"}`}>
                    {parseFloat(ad.price).toFixed(2)} <small className="text-[11px] opacity-60">₽</small>
                  </strong>
                </div>
                
                <div>
                  <span className="block text-[10px] text-white/30">Доступно</span>
                  <strong className="mt-1 block text-xs text-white/80">
                    {parseFloat(ad.availableAmount).toFixed(2)} <small className="text-[10px] text-white/35">{ad.assetCurrency}</small>
                  </strong>
                  <span className="mt-1 block text-[10px] text-white/30 truncate">
                    лимит {ad.minAmount} - {ad.maxAmount}
                  </span>
                </div>
                
                <div>
                  <div className="mb-1 flex items-center justify-between text-[10px]">
                    <span className="text-white/35">Надёжность</span>
                    <span className="font-semibold text-[#59d17e]">{Number(ad.successfulPercent || 0).toFixed(1)}%</span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-white/[.07]">
                    <div className="h-full rounded-full bg-[#3ab368]" style={{ width: `${Math.min(Number(ad.successfulPercent || 0), 100)}%` }} />
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] text-white/35 truncate">
                    <Clock3 size={11} className="shrink-0" />
                    {ad.paymentTimeMinutes || 15}м · {(ad.paymentMethods || []).slice(0, 2).map((m: any) => m.title).join(", ")}
                  </div>
                </div>
                
                <button 
                  onClick={() => setSelectedAd(ad)} 
                  className={`rounded-xl py-2.5 text-xs font-bold transition group-hover:shadow-lg ${
                    side === "buy" 
                      ? "bg-[#3ab368] text-[#07100a] hover:bg-[#59d17e]" 
                      : "bg-[#f97316] text-white hover:bg-[#ff914d]"
                  }`}
                >
                  {side === "buy" ? "Купить" : "Продать"}
                </button>
              </div>
            );
          })}
        </div>}

        {!isError && !isFetching && ads.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/10 py-14 text-center text-sm text-white/35 flex flex-col items-center">
            <SlidersHorizontal size={24} className="mb-3 text-white/20" />
            По этим фильтрам объявлений нет
          </div>
        )}

      </div>
      <RightSidebar />
      {selectedAd && <OrderSheet ad={selectedAd} side={side} onClose={() => setSelectedAd(null)} />}
      {showCreateAd && <CreateAdModal onClose={() => setShowCreateAd(false)} />}
    </div>
  );
}
