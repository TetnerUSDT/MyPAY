import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Info, AlertTriangle, ExternalLink, Lock } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const CRYPTO_BALANCES = [
  { id: 3, label: "USDT TRC20", currency: "USDT", network: "TRC20" },
  { id: 4, label: "USDT BEP20", currency: "USDT", network: "BEP20" },
  { id: 6, label: "USDT TON",   currency: "USDT", network: "TON" },
];

interface PaymentMethod { id: number; title: string; code: string; }
interface UserMethod    { id: number; methodId: number; methodTitle: string; accountNumber: string | null; }

export default function P2PCreateAdScreen() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [side, setSide] = useState<"sell" | "buy">("sell");
  const [assetBalanceId, setAssetBalanceId] = useState<string>("3");
  const [price, setPrice] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [availableAmount, setAvailableAmount] = useState("");
  const [paymentTime, setPaymentTime] = useState("15");
  const [terms, setTerms] = useState("");
  const [selectedMethods, setSelectedMethods] = useState<number[]>([]);

  const { data: methods = [] } = useQuery<PaymentMethod[]>({
    queryKey: ["/api/p2p/payment-methods"],
  });

  const { data: userMethods = [], isLoading: loadingUserMethods } = useQuery<UserMethod[]>({
    queryKey: ["/api/p2p/user-payment-methods"],
  });

  // IDs методов, для которых у пользователя есть сохранённые реквизиты
  const userMethodIds = new Set((userMethods as UserMethod[]).map(m => m.methodId));
  const hasAnyRequisites = userMethodIds.size > 0;

  const createAd = useMutation({
    mutationFn: () => apiRequest("POST", "/api/p2p/ads", {
      side,
      assetBalanceId: parseInt(assetBalanceId),
      price: parseFloat(price),
      minAmount: parseFloat(minAmount),
      maxAmount: parseFloat(maxAmount),
      availableAmount: parseFloat(availableAmount),
      paymentTimeMinutes: parseInt(paymentTime),
      terms: terms || null,
      paymentMethodIds: selectedMethods,
    }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "Объявление создано" });
      qc.invalidateQueries({ queryKey: ["/api/p2p/my-ads"] });
      qc.invalidateQueries({ queryKey: ["/api/p2p/ads"] });
      setLocation("/p2p/my-ads");
    },
    onError: (err: any) => toast({ title: "Ошибка", description: err.message, variant: "destructive" }),
  });

  const toggleMethod = (id: number) => {
    // Для объявлений продажи — можно выбрать только методы с реквизитами
    if (side === "sell" && !userMethodIds.has(id)) return;
    setSelectedMethods(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // При смене типа — сбрасываем выбранные методы, т.к. ограничения разные
  const handleSideChange = (s: "sell" | "buy") => {
    setSide(s);
    setSelectedMethods([]);
  };

  const selectedBalance = CRYPTO_BALANCES.find(b => b.id.toString() === assetBalanceId);

  const isValid =
    parseFloat(price) > 0 &&
    parseFloat(minAmount) > 0 &&
    parseFloat(maxAmount) >= parseFloat(minAmount) &&
    parseFloat(availableAmount) > 0 &&
    parseFloat(availableAmount) >= parseFloat(maxAmount) &&
    selectedMethods.length > 0 &&
    // Для продажи — обязательно наличие реквизитов
    (side !== "sell" || hasAnyRequisites);

  return (
    <div className="min-h-screen bg-[#0B0C10] text-[#E2E8F0] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-6 pb-4">
        <button
          onClick={() => setLocation("/p2p")}
          className="w-10 h-10 rounded-full bg-white/5 border border-white/5 flex items-center justify-center"
        >
          <ChevronLeft className="w-5 h-5 text-white/70" />
        </button>
        <h1 className="text-[17px] font-semibold text-white">Создать объявление</h1>
        <div className="w-10" />
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-10 space-y-4">

        {/* Side toggle */}
        <div>
          <label className="text-xs text-white/40 font-medium mb-2 block">Тип объявления</label>
          <div className="flex bg-[#13151A] rounded-2xl p-1 border border-white/5">
            {(["sell", "buy"] as const).map(s => (
              <button
                key={s}
                onClick={() => handleSideChange(s)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  side === s
                    ? s === "sell" ? "bg-[#3ab368] text-[#0B0C10]" : "bg-[#f97316] text-white"
                    : "text-white/40"
                }`}
              >
                {s === "sell" ? "Продажа (я продаю)" : "Покупка (я покупаю)"}
              </button>
            ))}
          </div>
        </div>

        {/* ── Баннер: нет реквизитов (только для продажи) ─────────────────── */}
        {side === "sell" && !loadingUserMethods && !hasAnyRequisites && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-300">Нет банковских реквизитов</p>
              <p className="text-xs text-amber-400/70 mt-1 leading-relaxed">
                Для размещения объявления о продаже нужно добавить хотя бы один банковский реквизит — покупатели будут переводить на него деньги.
              </p>
              <button
                onClick={() => setLocation("/p2p/payment-methods")}
                className="mt-3 flex items-center gap-1.5 text-xs font-bold text-amber-300 bg-amber-500/15 px-3 py-1.5 rounded-xl"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Добавить реквизиты
              </button>
            </div>
          </div>
        )}

        {/* ── Баннер: есть реквизиты, напоминание (только для продажи) ───── */}
        {side === "sell" && !loadingUserMethods && hasAnyRequisites && (
          <div className="bg-[#3ab368]/8 border border-[#3ab368]/20 rounded-2xl p-3 flex gap-2.5 items-start">
            <Info className="w-4 h-4 text-[#3ab368] shrink-0 mt-0.5" />
            <p className="text-xs text-white/50 leading-relaxed">
              Выбрать можно только методы, для которых у вас добавлены реквизиты.{" "}
              <button
                onClick={() => setLocation("/p2p/payment-methods")}
                className="text-[#3ab368] underline-offset-2 underline"
              >
                Управлять реквизитами
              </button>
            </p>
          </div>
        )}

        {/* Asset */}
        <div>
          <label className="text-xs text-white/40 font-medium mb-2 block">Криптовалюта</label>
          <div className="flex gap-2 flex-wrap">
            {CRYPTO_BALANCES.map(b => (
              <button
                key={b.id}
                onClick={() => setAssetBalanceId(b.id.toString())}
                className={`text-sm px-4 py-2.5 rounded-2xl border font-medium transition-colors ${
                  assetBalanceId === b.id.toString()
                    ? "bg-[#3ab368]/20 border-[#3ab368]/50 text-[#3ab368]"
                    : "bg-[#13151A] border-white/5 text-white/60"
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        {/* Price */}
        <div>
          <label className="text-xs text-white/40 font-medium mb-2 block">
            Курс (₽ за 1 {selectedBalance?.currency})
          </label>
          <div className="relative">
            <input
              type="number"
              value={price}
              onChange={e => setPrice(e.target.value)}
              placeholder="например 95.50"
              className="w-full bg-[#13151A] border border-white/5 rounded-2xl px-4 py-3.5 text-white text-base outline-none placeholder-white/20 pr-16"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 text-sm font-medium">₽/USDT</span>
          </div>
        </div>

        {/* Limits */}
        <div>
          <label className="text-xs text-white/40 font-medium mb-2 block">
            Лимиты ({selectedBalance?.currency})
          </label>
          <div className="flex gap-3">
            <input
              type="number"
              value={minAmount}
              onChange={e => setMinAmount(e.target.value)}
              placeholder="От"
              className="flex-1 bg-[#13151A] border border-white/5 rounded-2xl px-4 py-3.5 text-white text-base outline-none placeholder-white/20"
            />
            <input
              type="number"
              value={maxAmount}
              onChange={e => setMaxAmount(e.target.value)}
              placeholder="До"
              className="flex-1 bg-[#13151A] border border-white/5 rounded-2xl px-4 py-3.5 text-white text-base outline-none placeholder-white/20"
            />
          </div>
        </div>

        {/* Available amount */}
        <div>
          <label className="text-xs text-white/40 font-medium mb-2 block">
            Доступный объём ({selectedBalance?.currency})
          </label>
          <div className="relative">
            <input
              type="number"
              value={availableAmount}
              onChange={e => setAvailableAmount(e.target.value)}
              placeholder="Сколько готовы продать/купить"
              className="w-full bg-[#13151A] border border-white/5 rounded-2xl px-4 py-3.5 text-white text-base outline-none placeholder-white/20 pr-20"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 text-sm font-medium">{selectedBalance?.currency}</span>
          </div>
          {side === "sell" && (
            <p className="text-[11px] text-white/30 mt-1.5 flex items-start gap-1">
              <Info className="w-3 h-3 shrink-0 mt-0.5" />
              При продаже средства будут заблокированы на балансе до завершения сделки
            </p>
          )}
        </div>

        {/* Payment time */}
        <div>
          <label className="text-xs text-white/40 font-medium mb-2 block">Время на оплату</label>
          <div className="flex gap-2">
            {["10", "15", "30", "60"].map(t => (
              <button
                key={t}
                onClick={() => setPaymentTime(t)}
                className={`flex-1 py-2.5 rounded-2xl border text-sm font-medium transition-colors ${
                  paymentTime === t
                    ? "bg-[#3ab368]/20 border-[#3ab368]/50 text-[#3ab368]"
                    : "bg-[#13151A] border-white/5 text-white/60"
                }`}
              >
                {t} мин
              </button>
            ))}
          </div>
        </div>

        {/* Payment methods */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-white/40 font-medium">Методы оплаты</label>
            {side === "sell" && hasAnyRequisites && (
              <span className="text-[10px] text-white/30">
                {userMethodIds.size} из {(methods as PaymentMethod[]).length} доступно
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {(methods as PaymentMethod[]).map((pm: PaymentMethod) => {
              const hasRequisite = userMethodIds.has(pm.id);
              const isRestricted = side === "sell" && !hasRequisite;
              const isSelected = selectedMethods.includes(pm.id);

              return (
                <button
                  key={pm.id}
                  onClick={() => toggleMethod(pm.id)}
                  disabled={isRestricted}
                  title={isRestricted ? "Добавьте реквизиты для этого метода" : undefined}
                  className={`text-sm px-3.5 py-2 rounded-2xl border font-medium transition-colors relative ${
                    isRestricted
                      ? "bg-[#13151A] border-white/5 text-white/20 cursor-not-allowed opacity-50"
                      : isSelected
                        ? "bg-[#3ab368]/20 border-[#3ab368]/50 text-[#3ab368]"
                        : "bg-[#13151A] border-white/5 text-white/60"
                  }`}
                >
                  {isRestricted && (
                    <Lock className="w-2.5 h-2.5 inline mr-1 opacity-50" />
                  )}
                  {pm.title}
                </button>
              );
            })}
          </div>

          {selectedMethods.length === 0 && (
            <p className="text-[11px] text-red-400/70 mt-1.5">
              {side === "sell" && !hasAnyRequisites
                ? "Сначала добавьте реквизиты, затем выберите методы оплаты"
                : "Выберите хотя бы один метод"}
            </p>
          )}
        </div>

        {/* Terms */}
        <div>
          <label className="text-xs text-white/40 font-medium mb-2 block">Условия (необязательно)</label>
          <textarea
            value={terms}
            onChange={e => setTerms(e.target.value)}
            placeholder="Дополнительные условия сделки..."
            rows={3}
            className="w-full bg-[#13151A] border border-white/5 rounded-2xl px-4 py-3 text-white text-sm outline-none placeholder-white/20 resize-none"
          />
        </div>

        {/* Preview card */}
        {price && minAmount && maxAmount && (
          <div className="bg-[#13151A] border border-[#3ab368]/20 rounded-3xl p-4 space-y-2">
            <h3 className="text-xs font-semibold text-[#3ab368] uppercase tracking-wider">Предпросмотр</h3>
            <div className="flex justify-between text-sm">
              <span className="text-white/50">Тип</span>
              <span className="font-semibold text-white">{side === "sell" ? "Продажа" : "Покупка"} {selectedBalance?.label}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/50">Курс</span>
              <span className="font-semibold text-[#3ab368]">{parseFloat(price || "0").toFixed(2)} ₽</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/50">Лимиты</span>
              <span className="font-semibold text-white">
                {parseFloat(minAmount || "0").toFixed(2)} – {parseFloat(maxAmount || "0").toFixed(2)} {selectedBalance?.currency}
              </span>
            </div>
            {selectedMethods.length > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Методы</span>
                <span className="font-semibold text-white text-right max-w-[60%]">
                  {(methods as PaymentMethod[]).filter(m => selectedMethods.includes(m.id)).map(m => m.title).join(", ")}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={() => {
            if (side === "sell" && !hasAnyRequisites) {
              toast({
                title: "Нет реквизитов",
                description: "Добавьте банковские реквизиты перед размещением объявления о продаже.",
                variant: "destructive",
              });
              return;
            }
            createAd.mutate();
          }}
          disabled={!isValid || createAd.isPending}
          className="w-full py-4 rounded-2xl bg-[#3ab368] text-[#0B0C10] font-bold text-sm shadow-lg shadow-[#3ab368]/20 disabled:opacity-40 mt-2"
        >
          {createAd.isPending ? "Создание..." : "Разместить объявление"}
        </button>
      </div>
    </div>
  );
}
