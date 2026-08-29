import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateAd, useCryptoBalances, usePaymentMethods, useUserPaymentMethods } from "@/hooks/use-p2p";
import { AlertTriangle, Info, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CRYPTO_BALANCES = [
  { id: 3, label: "USDT TRC20", currency: "USDT", network: "TRC20" },
  { id: 4, label: "USDT BEP20", currency: "USDT", network: "BEP20" },
  { id: 6, label: "USDT TON",   currency: "USDT", network: "TON" },
];

export default function CreateAd({ onClose }: { onClose?: () => void }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [side, setSide] = useState<"sell" | "buy">("sell");
  const [assetBalanceId, setAssetBalanceId] = useState<string>("3");
  const [price, setPrice] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [availableAmount, setAvailableAmount] = useState("");
  const [paymentTime, setPaymentTime] = useState("15");
  const [terms, setTerms] = useState("");
  const [selectedMethods, setSelectedMethods] = useState<number[]>([]);

  const { data: cryptoBalances = [] } = useCryptoBalances();
  const { data: methods = [] } = usePaymentMethods();
  const { data: userMethods = [], isLoading: loadingUM } = useUserPaymentMethods();
  const createAd = useCreateAd();

  const userMethodIds = new Set((Array.isArray(userMethods) ? userMethods : []).map(m => m.methodId));
  const hasAnyRequisites = userMethodIds.size > 0;

  const balanceMap = new Map<number, number>(
    (Array.isArray(cryptoBalances) ? cryptoBalances : []).map(b => [b.id, parseFloat(String(b.sum ?? 0))])
  );

  const selectedBalance = CRYPTO_BALANCES.find(b => b.id.toString() === assetBalanceId);
  const userBal = balanceMap.get(parseInt(assetBalanceId)) ?? 0;

  const toggleMethod = (id: number) => {
    if (side === "sell" && !userMethodIds.has(id)) return;
    setSelectedMethods(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSideChange = (s: "sell" | "buy") => {
    setSide(s);
    setSelectedMethods([]);
  };

  const isValid =
    parseFloat(price) > 0 &&
    parseFloat(minAmount) > 0 &&
    parseFloat(maxAmount) >= parseFloat(minAmount) &&
    parseFloat(availableAmount) > 0 &&
    parseFloat(availableAmount) >= parseFloat(maxAmount) &&
    (side !== "sell" || parseFloat(availableAmount) <= userBal) &&
    selectedMethods.length > 0 &&
    (side !== "sell" || hasAnyRequisites);

  const handleSubmit = () => {
    createAd.mutate({
      side,
      assetBalanceId: parseInt(assetBalanceId),
      price: parseFloat(price),
      minAmount: parseFloat(minAmount),
      maxAmount: parseFloat(maxAmount),
      availableAmount: parseFloat(availableAmount),
      paymentTimeMinutes: parseInt(paymentTime),
      terms: terms || null,
      paymentMethodIds: selectedMethods,
    }, {
      onSuccess: () => {
        toast({ title: "Объявление опубликовано" });
        if (onClose) onClose();
        else setLocation("/ads");
      },
      onError: (error) => toast({ title: "Не удалось опубликовать объявление", description: error.message, variant: "destructive" }),
    });
  };

  return (
    <div className={onClose ? "px-6 py-6" : "flex-1 overflow-y-auto px-8 py-7 bg-[#0b0d11]"}>
      <div className="max-w-4xl mx-auto">
        {!onClose && <div className="mb-8">
          <div className="text-[11px] font-bold uppercase tracking-[.18em] text-[#59d17e] mb-2">Новый оффер</div>
          <h2 className="text-[27px] font-semibold tracking-tight text-white">Создать объявление</h2>
          <p className="mt-1 text-sm text-white/40">Разместите свое предложение на P2P рынке.</p>
        </div>}

        <div className="grid grid-cols-[1fr_350px] gap-8">
          <div className="space-y-6">

            {/* Side */}
            <div className="bg-[#111419] p-1.5 rounded-2xl flex border border-white/[.06]">
              {(["sell", "buy"] as const).map(s => (
                <button
                  key={s}
                  onClick={() => handleSideChange(s)}
                  className={`flex-1 py-3 rounded-xl text-sm font-bold transition ${
                    side === s
                      ? s === "sell" ? "bg-[#3ab368] text-[#07100a] shadow-lg shadow-[#3ab368]/10" : "bg-[#f97316] text-white shadow-lg shadow-[#f97316]/10"
                      : "text-white/40 hover:text-white"
                  }`}
                >
                  {s === "sell" ? "Продажа (Вы продаете USDT)" : "Покупка (Вы покупаете USDT)"}
                </button>
              ))}
            </div>

            {side === "sell" && !loadingUM && !hasAnyRequisites && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 flex gap-4">
                <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-300 mb-1">Нет банковских реквизитов</p>
                  <p className="text-sm text-amber-400/70 leading-relaxed mb-3">
                    Для продажи вам нужно добавить хотя бы один банковский реквизит, чтобы покупатели знали, куда переводить средства.
                  </p>
                  <button
                    onClick={() => setLocation("/payment-details")}
                    className="flex items-center gap-1.5 text-xs font-bold text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 transition px-4 py-2 rounded-xl"
                  >
                    <Plus size={14} /> Добавить реквизиты
                  </button>
                </div>
              </div>
            )}

            <div className="bg-[#111419] border border-white/[.06] rounded-3xl p-6 space-y-6">
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-white/30 font-semibold mb-2 block">Криптовалюта</label>
                  <select
                    value={assetBalanceId}
                    onChange={e => setAssetBalanceId(e.target.value)}
                    className="w-full bg-[#171a20] border border-white/5 rounded-xl px-4 py-3.5 text-white text-sm outline-none focus:border-[#3ab368]/50"
                  >
                    {CRYPTO_BALANCES.map(b => (
                      <option key={b.id} value={b.id}>{b.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-white/30 font-semibold mb-2 block">Курс (₽)</label>
                  <input
                    type="number"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    placeholder="Например, 95.50"
                    className="w-full bg-[#171a20] border border-white/5 rounded-xl px-4 py-3.5 text-white text-sm outline-none focus:border-[#3ab368]/50 placeholder-white/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-white/30 font-semibold mb-2 block">Объем ({selectedBalance?.currency})</label>
                  <input
                    type="number"
                    value={availableAmount}
                    onChange={e => setAvailableAmount(e.target.value)}
                    placeholder="Доступно для сделок"
                    className="w-full bg-[#171a20] border border-white/5 rounded-xl px-4 py-3.5 text-white text-sm outline-none focus:border-[#3ab368]/50 placeholder-white/20"
                  />
                  {side === "sell" && (
                    <p className="text-[10px] text-white/30 mt-1.5 flex gap-1">
                      <Info size={12} className="shrink-0" />
                      Ваш баланс: {userBal.toFixed(2)} USDT
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-white/30 font-semibold mb-2 block">Лимиты одной сделки ({selectedBalance?.currency})</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={minAmount}
                      onChange={e => setMinAmount(e.target.value)}
                      placeholder="От"
                      className="w-full bg-[#171a20] border border-white/5 rounded-xl px-4 py-3.5 text-white text-sm outline-none focus:border-[#3ab368]/50 placeholder-white/20"
                    />
                    <span className="text-white/20">-</span>
                    <input
                      type="number"
                      value={maxAmount}
                      onChange={e => setMaxAmount(e.target.value)}
                      placeholder="До"
                      className="w-full bg-[#171a20] border border-white/5 rounded-xl px-4 py-3.5 text-white text-sm outline-none focus:border-[#3ab368]/50 placeholder-white/20"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#111419] border border-white/[.06] rounded-3xl p-6 space-y-6">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-[11px] uppercase tracking-wider text-white/30 font-semibold block">Методы оплаты</label>
                  {side === "sell" && hasAnyRequisites && (
                    <span className="text-[10px] text-white/30 bg-white/5 px-2 py-0.5 rounded-full">
                      Доступно: {userMethodIds.size} из {(methods as any[]).length}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {(methods as any[]).map(pm => {
                    const hasReq = userMethodIds.has(pm.id);
                    const isRestricted = side === "sell" && !hasReq;
                    const isSelected = selectedMethods.includes(pm.id);

                    return (
                      <button
                        key={pm.id}
                        onClick={() => toggleMethod(pm.id)}
                        disabled={isRestricted}
                        className={`text-sm px-4 py-2 rounded-xl font-medium transition-colors border ${
                          isRestricted
                            ? "bg-[#171a20] border-white/5 text-white/20 cursor-not-allowed"
                            : isSelected
                              ? "bg-[#3ab368]/20 border-[#3ab368]/50 text-[#59d17e]"
                              : "bg-[#171a20] border-white/5 text-white/60 hover:bg-white/5"
                        }`}
                      >
                        {pm.title}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wider text-white/30 font-semibold mb-2 block">Окно оплаты (мин)</label>
                <div className="flex gap-2">
                  {["10", "15", "30", "60"].map(t => (
                    <button
                      key={t}
                      onClick={() => setPaymentTime(t)}
                      className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition ${
                        paymentTime === t
                          ? "bg-[#3ab368]/20 border-[#3ab368]/50 text-[#59d17e]"
                          : "bg-[#171a20] border-white/5 text-white/60 hover:bg-white/5"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wider text-white/30 font-semibold mb-2 block">Условия сделки (опционально)</label>
                <textarea
                  value={terms}
                  onChange={e => setTerms(e.target.value)}
                  placeholder="Дополнительные условия для покупателей..."
                  rows={3}
                  className="w-full bg-[#171a20] border border-white/5 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#3ab368]/50 placeholder-white/20 resize-none"
                />
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={!isValid || createAd.isPending}
              className={`w-full py-4 rounded-2xl font-bold text-[15px] shadow-xl transition-transform active:scale-95 disabled:opacity-40 disabled:active:scale-100 ${
                side === "sell"
                  ? "bg-[#3ab368] text-[#07100a] shadow-[#3ab368]/20 hover:bg-[#59d17e]"
                  : "bg-[#f97316] text-white shadow-[#f97316]/20 hover:bg-[#ff914d]"
              }`}
            >
              {createAd.isPending ? "Публикация..." : "Разместить объявление"}
            </button>
          </div>

          {/* Right sidebar preview */}
          <div>
            <div className="sticky top-0 pt-2">
              <h3 className="text-sm font-semibold text-white mb-4">Превью объявления</h3>
              <div className="bg-[#111419] border border-[#3ab368]/30 rounded-3xl p-5 shadow-2xl shadow-black">
                <div className="flex items-center gap-2 mb-4">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                    side === "sell" ? "bg-[#3ab368]/20 text-[#59d17e]" : "bg-[#f97316]/20 text-[#ff9c59]"
                  }`}>
                    {side === "sell" ? "Продажа" : "Покупка"}
                  </span>
                  <span className="text-xs text-white/40">{selectedBalance?.label}</span>
                </div>

                <div className="mb-4">
                  <span className="block text-[10px] uppercase tracking-wider text-white/30">Курс</span>
                  <strong className="block text-2xl text-white mt-1">
                    {price ? parseFloat(price).toFixed(2) : "0.00"} <small className="text-sm opacity-60">₽</small>
                  </strong>
                </div>

                <div className="space-y-2 text-xs mb-5">
                  <div className="flex justify-between">
                    <span className="text-white/40">Объем:</span>
                    <strong className="text-white">{availableAmount || "0"} {selectedBalance?.currency}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">Лимиты:</span>
                    <strong className="text-white">{minAmount || "0"} - {maxAmount || "0"} {selectedBalance?.currency}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">Время:</span>
                    <strong className="text-white">{paymentTime} мин</strong>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {selectedMethods.length === 0 ? (
                    <span className="text-[10px] text-white/20">Методы не выбраны</span>
                  ) : (
                    selectedMethods.map(id => {
                      const title = (methods as any[]).find(m => m.id === id)?.title;
                      return <span key={id} className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded-full text-white/60">{title}</span>;
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
