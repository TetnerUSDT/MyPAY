import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Info } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const CRYPTO_BALANCES = [
  { id: 3, label: "USDT TRC20", currency: "USDT", network: "TRC20" },
  { id: 4, label: "USDT BEP20", currency: "USDT", network: "BEP20" },
  { id: 6, label: "USDT TON",   currency: "USDT", network: "TON" },
];

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

  const { data: methods = [] } = useQuery<any[]>({
    queryKey: ["/api/p2p/payment-methods"],
  });

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
    setSelectedMethods(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectedBalance = CRYPTO_BALANCES.find(b => b.id.toString() === assetBalanceId);

  const isValid =
    parseFloat(price) > 0 &&
    parseFloat(minAmount) > 0 &&
    parseFloat(maxAmount) >= parseFloat(minAmount) &&
    parseFloat(availableAmount) > 0 &&
    parseFloat(availableAmount) >= parseFloat(maxAmount) &&
    selectedMethods.length > 0;

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
                onClick={() => setSide(s)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  side === s
                    ? s === "sell" ? "bg-[#3ab368] text-[#0B0C10]" : "bg-[#f97316] text-white"
                    : "text-white/40"
                }`}
              >
                {s === "sell" ? "Продажа (я продаю крипто)" : "Покупка (я покупаю крипто)"}
              </button>
            ))}
          </div>
        </div>

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
            <div className="flex-1 relative">
              <input
                type="number"
                value={minAmount}
                onChange={e => setMinAmount(e.target.value)}
                placeholder="От"
                className="w-full bg-[#13151A] border border-white/5 rounded-2xl px-4 py-3.5 text-white text-base outline-none placeholder-white/20"
              />
            </div>
            <div className="flex-1 relative">
              <input
                type="number"
                value={maxAmount}
                onChange={e => setMaxAmount(e.target.value)}
                placeholder="До"
                className="w-full bg-[#13151A] border border-white/5 rounded-2xl px-4 py-3.5 text-white text-base outline-none placeholder-white/20"
              />
            </div>
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
          <label className="text-xs text-white/40 font-medium mb-2 block">Методы оплаты</label>
          <div className="flex flex-wrap gap-2">
            {(methods as any[]).map((pm: any) => (
              <button
                key={pm.id}
                onClick={() => toggleMethod(pm.id)}
                className={`text-sm px-3.5 py-2 rounded-2xl border font-medium transition-colors ${
                  selectedMethods.includes(pm.id)
                    ? "bg-[#3ab368]/20 border-[#3ab368]/50 text-[#3ab368]"
                    : "bg-[#13151A] border-white/5 text-white/60"
                }`}
              >
                {pm.title}
              </button>
            ))}
          </div>
          {selectedMethods.length === 0 && (
            <p className="text-[11px] text-red-400/70 mt-1.5">Выберите хотя бы один метод</p>
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
          </div>
        )}

        {/* Submit */}
        <button
          onClick={() => createAd.mutate()}
          disabled={!isValid || createAd.isPending}
          className="w-full py-4 rounded-2xl bg-[#3ab368] text-[#0B0C10] font-bold text-sm shadow-lg shadow-[#3ab368]/20 disabled:opacity-40 mt-2"
        >
          {createAd.isPending ? "Создание..." : "Разместить объявление"}
        </button>
      </div>
    </div>
  );
}
