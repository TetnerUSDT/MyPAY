import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Info, AlertTriangle, Lock, Plus, X, Check, Trash2, Pencil, CreditCard } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const CRYPTO_BALANCES = [
  { id: 3, label: "USDT TRC20", currency: "USDT", network: "TRC20" },
  { id: 4, label: "USDT BEP20", currency: "USDT", network: "BEP20" },
  { id: 6, label: "USDT TON",   currency: "USDT", network: "TON" },
];

interface CryptoBalance { id: number; currency: string; network: string; sum: string | number; }
interface PaymentMethod { id: number; title: string; code: string; }
interface UserMethod {
  id: number;
  methodId: number;
  methodTitle: string;
  accountNumber: string | null;
  accountName: string | null;
  bankName: string | null;
}

// ── Форма добавления/редактирования реквизита ─────────────────────────────────
function RequisiteForm({
  methods,
  initial,
  onSave,
  onCancel,
  saving,
}: {
  methods: PaymentMethod[];
  initial?: Partial<UserMethod>;
  onSave: (data: any) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [methodId, setMethodId] = useState<string>(initial?.methodId?.toString() ?? "");
  const [accountNumber, setAccountNumber] = useState(initial?.accountNumber ?? "");
  const [accountName, setAccountName] = useState(initial?.accountName ?? "");
  const [bankName, setBankName] = useState(initial?.bankName ?? "");

  const isValid = methodId && accountNumber.trim();

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-white/40 mb-2 block">Способ оплаты</label>
        <div className="flex flex-wrap gap-2">
          {methods.map(m => (
            <button
              key={m.id}
              onClick={() => setMethodId(m.id.toString())}
              className={`text-sm px-3 py-2 rounded-2xl border font-medium transition-colors ${
                methodId === m.id.toString()
                  ? "bg-[#3ab368]/20 border-[#3ab368]/50 text-[#3ab368]"
                  : "bg-[#1A1D24] border-white/5 text-white/60"
              }`}
            >
              {m.title}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-white/40 mb-1 block">Номер карты / счёта / телефон *</label>
        <input
          value={accountNumber}
          onChange={e => setAccountNumber(e.target.value)}
          placeholder="1234 5678 9012 3456"
          className="w-full bg-[#1A1D24] border border-white/5 rounded-2xl px-4 py-3 text-white text-sm outline-none placeholder-white/20"
        />
      </div>

      <div>
        <label className="text-xs text-white/40 mb-1 block">Имя получателя</label>
        <input
          value={accountName}
          onChange={e => setAccountName(e.target.value)}
          placeholder="Иван Иванов"
          className="w-full bg-[#1A1D24] border border-white/5 rounded-2xl px-4 py-3 text-white text-sm outline-none placeholder-white/20"
        />
      </div>

      <div>
        <label className="text-xs text-white/40 mb-1 block">Банк / комментарий</label>
        <input
          value={bankName}
          onChange={e => setBankName(e.target.value)}
          placeholder="Необязательно"
          className="w-full bg-[#1A1D24] border border-white/5 rounded-2xl px-4 py-3 text-white text-sm outline-none placeholder-white/20"
        />
      </div>

      <div className="flex gap-3 pt-1">
        <button
          onClick={onCancel}
          className="flex-1 py-3 rounded-2xl border border-white/10 text-white/60 text-sm font-semibold"
        >
          Отмена
        </button>
        <button
          onClick={() => onSave({ methodId: parseInt(methodId), accountNumber, accountName, bankName })}
          disabled={!isValid || saving}
          className="flex-1 py-3 rounded-2xl bg-[#3ab368] text-[#0B0C10] text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40"
        >
          <Check className="w-4 h-4" /> {saving ? "Сохранение..." : "Сохранить"}
        </button>
      </div>
    </div>
  );
}

// ── Модальное окно управления реквизитами ─────────────────────────────────────
function RequisitesModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const { data: methods = [] } = useQuery<PaymentMethod[]>({ queryKey: ["/api/p2p/payment-methods"] });
  const { data: userMethods = [], isLoading } = useQuery<UserMethod[]>({ queryKey: ["/api/p2p/user-payment-methods"] });

  const addMethod = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/p2p/user-payment-methods", data).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "Реквизит добавлен" });
      setShowAdd(false);
      qc.invalidateQueries({ queryKey: ["/api/p2p/user-payment-methods"] });
    },
    onError: (err: any) => toast({ title: "Ошибка", description: err.message, variant: "destructive" }),
  });

  const updateMethod = useMutation({
    mutationFn: ({ id, ...data }: any) => apiRequest("PATCH", `/api/p2p/user-payment-methods/${id}`, data).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "Реквизит обновлён" });
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ["/api/p2p/user-payment-methods"] });
    },
    onError: (err: any) => toast({ title: "Ошибка", description: err.message, variant: "destructive" }),
  });

  const deleteMethod = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/p2p/user-payment-methods/${id}`),
    onSuccess: () => {
      toast({ title: "Реквизит удалён" });
      qc.invalidateQueries({ queryKey: ["/api/p2p/user-payment-methods"] });
    },
    onError: (err: any) => toast({ title: "Ошибка", description: err.message, variant: "destructive" }),
  });

  const list = userMethods as UserMethod[];

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative bg-[#13151A] border-t border-white/10 rounded-t-3xl flex flex-col"
        style={{ maxHeight: "90vh" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle + header */}
        <div className="px-5 pt-4 pb-3 shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/10 mx-auto mb-4" />
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white">Мои реквизиты</h2>
            <div className="flex items-center gap-2">
              {!showAdd && editingId === null && (
                <button
                  onClick={() => setShowAdd(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#3ab368]/15 border border-[#3ab368]/30 text-[#3ab368] text-xs font-bold"
                >
                  <Plus className="w-3.5 h-3.5" /> Добавить
                </button>
              )}
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"
              >
                <X className="w-4 h-4 text-white/50" />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-5 pb-8 space-y-3">
          {/* Add form */}
          {showAdd && (
            <div className="bg-[#1A1D24] border border-[#3ab368]/20 rounded-3xl p-4">
              <p className="text-xs font-semibold text-[#3ab368] mb-3">Новый реквизит</p>
              <RequisiteForm
                methods={methods as PaymentMethod[]}
                onSave={(data) => addMethod.mutate(data)}
                onCancel={() => setShowAdd(false)}
                saving={addMethod.isPending}
              />
            </div>
          )}

          {/* Skeleton */}
          {isLoading && (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="bg-[#1A1D24] rounded-3xl border border-white/5 p-4 animate-pulse">
                  <div className="h-3 bg-white/5 rounded-full w-20 mb-3" />
                  <div className="h-4 bg-white/5 rounded-full w-40" />
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && list.length === 0 && !showAdd && (
            <div className="py-10 flex flex-col items-center">
              <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mb-3">
                <CreditCard className="w-6 h-6 text-white/20" />
              </div>
              <p className="text-white/40 text-sm font-medium">Нет реквизитов</p>
              <p className="text-white/25 text-xs mt-1 mb-5 text-center max-w-xs">
                Добавьте банковские данные — покупатели будут переводить на них деньги
              </p>
              <button
                onClick={() => setShowAdd(true)}
                className="px-6 py-3 rounded-2xl bg-[#3ab368] text-[#0B0C10] font-bold text-sm shadow-lg shadow-[#3ab368]/20"
              >
                Добавить реквизит
              </button>
            </div>
          )}

          {/* List */}
          {!isLoading && list.map((um: UserMethod) => (
            <div key={um.id}>
              {editingId === um.id ? (
                <div className="bg-[#1A1D24] border border-[#3ab368]/20 rounded-3xl p-4">
                  <p className="text-xs font-semibold text-[#3ab368] mb-3">Редактирование</p>
                  <RequisiteForm
                    methods={methods as PaymentMethod[]}
                    initial={um}
                    onSave={(data) => updateMethod.mutate({ id: um.id, ...data })}
                    onCancel={() => setEditingId(null)}
                    saving={updateMethod.isPending}
                  />
                </div>
              ) : (
                <div className="bg-[#1A1D24] border border-white/5 rounded-3xl p-4">
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xs font-bold text-[#3ab368] px-2.5 py-0.5 bg-[#3ab368]/10 rounded-full">
                      {um.methodTitle}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => { setEditingId(um.id); setShowAdd(false); }}
                        className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center"
                      >
                        <Pencil className="w-3 h-3 text-white/50" />
                      </button>
                      <button
                        onClick={() => deleteMethod.mutate(um.id)}
                        disabled={deleteMethod.isPending}
                        className="w-7 h-7 rounded-full bg-red-500/10 flex items-center justify-center"
                      >
                        <Trash2 className="w-3 h-3 text-red-400/70" />
                      </button>
                    </div>
                  </div>
                  <div className="font-mono text-white text-base">{um.accountNumber}</div>
                  {um.accountName && <div className="text-sm text-white/60 mt-0.5">{um.accountName}</div>}
                  {um.bankName && <div className="text-xs text-white/40 mt-0.5">{um.bankName}</div>}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer — close button if has requisites */}
        {list.length > 0 && !showAdd && editingId === null && (
          <div className="px-5 pb-8 pt-2 shrink-0">
            <button
              onClick={onClose}
              className="w-full py-3.5 rounded-2xl bg-[#3ab368] text-[#0B0C10] font-bold text-sm shadow-lg shadow-[#3ab368]/20"
            >
              Готово
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Основная страница создания объявления ─────────────────────────────────────
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
  const [showRequisitesModal, setShowRequisitesModal] = useState(false);

  const { data: methods = [] } = useQuery<PaymentMethod[]>({
    queryKey: ["/api/p2p/payment-methods"],
  });

  const { data: userMethods = [], isLoading: loadingUserMethods } = useQuery<UserMethod[]>({
    queryKey: ["/api/p2p/user-payment-methods"],
  });

  const { data: cryptoBalances = [] } = useQuery<CryptoBalance[]>({
    queryKey: ["/api/user/crypto-balances"],
  });

  const userMethodIds = new Set((userMethods as UserMethod[]).map(m => m.methodId));
  const hasAnyRequisites = userMethodIds.size > 0;

  const balanceMap = new Map<number, number>(
    (cryptoBalances as CryptoBalance[]).map(b => [b.id, parseFloat(String(b.sum ?? 0))])
  );

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
    if (side === "sell" && !userMethodIds.has(id)) return;
    setSelectedMethods(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

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
                onClick={() => setShowRequisitesModal(true)}
                className="mt-3 flex items-center gap-1.5 text-xs font-bold text-amber-300 bg-amber-500/15 px-3 py-1.5 rounded-xl"
              >
                <Plus className="w-3.5 h-3.5" />
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
                onClick={() => setShowRequisitesModal(true)}
                className="text-[#3ab368] underline-offset-2 underline"
              >
                Управлять реквизитами
              </button>
            </p>
          </div>
        )}

        {/* Asset */}
        <div>
          <label className="text-xs text-white/40 font-medium mb-2 block">Криптовалюта и сеть</label>
          <div className="flex flex-col gap-2">
            {CRYPTO_BALANCES.map(b => {
              const userBal = balanceMap.get(b.id) ?? 0;
              const isSelected = assetBalanceId === b.id.toString();
              return (
                <button
                  key={b.id}
                  onClick={() => setAssetBalanceId(b.id.toString())}
                  className={`flex items-center justify-between px-4 py-3 rounded-2xl border font-medium transition-colors ${
                    isSelected
                      ? "bg-[#3ab368]/15 border-[#3ab368]/50 text-[#3ab368]"
                      : "bg-[#13151A] border-white/5 text-white/60"
                  }`}
                >
                  <span className="text-sm">{b.label}</span>
                  <span className={`text-xs font-semibold tabular-nums ${
                    isSelected ? "text-[#3ab368]/80" : "text-white/30"
                  }`}>
                    {userBal > 0 ? `${userBal.toFixed(4)} USDT` : "нет средств"}
                  </span>
                </button>
              );
            })}
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
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-white/40 font-medium">
              Лимиты ({selectedBalance?.currency})
            </label>
            {availableAmount && parseFloat(availableAmount) > 0 && (
              <span className="text-[10px] text-white/25">
                макс. = доступный объём ({parseFloat(availableAmount).toFixed(2)})
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <input
              type="number"
              value={minAmount}
              onChange={e => setMinAmount(e.target.value)}
              placeholder="От"
              className="flex-1 min-w-0 bg-[#13151A] border border-white/5 rounded-2xl px-4 py-3.5 text-white text-base outline-none placeholder-white/20"
            />
            <div className="flex-1 min-w-0 relative">
              <input
                type="number"
                value={maxAmount}
                onChange={e => setMaxAmount(e.target.value)}
                placeholder="До"
                className={`w-full bg-[#13151A] rounded-2xl px-4 py-3.5 text-white text-base outline-none placeholder-white/20 border ${
                  maxAmount && availableAmount &&
                  parseFloat(maxAmount) > parseFloat(availableAmount)
                    ? "border-red-500/50"
                    : "border-white/5"
                }`}
              />
            </div>
          </div>
          {maxAmount && availableAmount &&
           parseFloat(maxAmount) > parseFloat(availableAmount) && (
            <p className="text-[11px] text-red-400/80 mt-1.5 flex items-start gap-1">
              <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
              «До» не может превышать доступный объём ({parseFloat(availableAmount).toFixed(2)} {selectedBalance?.currency})
            </p>
          )}
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
          {side === "sell" && (() => {
            const selectedBal = balanceMap.get(parseInt(assetBalanceId)) ?? 0;
            const entered = parseFloat(availableAmount) || 0;
            const insufficient = entered > 0 && entered > selectedBal;
            if (insufficient) {
              return (
                <p className="text-[11px] text-red-400/80 mt-1.5 flex items-start gap-1">
                  <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                  Недостаточно средств. На выбранном балансе: {selectedBal.toFixed(4)} USDT
                </p>
              );
            }
            return (
              <p className="text-[11px] text-white/30 mt-1.5 flex items-start gap-1">
                <Info className="w-3 h-3 shrink-0 mt-0.5" />
                {entered > 0
                  ? `Заморозится ${entered.toFixed(4)} USDT с вашего баланса ${selectedBalance?.network ?? ""}`
                  : "При продаже средства заморозятся на балансе до завершения сделки"}
              </p>
            );
          })()}
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
              setShowRequisitesModal(true);
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

      {/* Requisites modal */}
      {showRequisitesModal && (
        <RequisitesModal onClose={() => setShowRequisitesModal(false)} />
      )}
    </div>
  );
}
