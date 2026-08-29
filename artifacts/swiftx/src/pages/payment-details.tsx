import { useState } from "react";
import { usePaymentMethods, useUserPaymentMethods, useCreateUserPaymentMethod, useUpdateUserPaymentMethod, useDeleteUserPaymentMethod } from "@/hooks/use-p2p";
import { Plus, Pencil, Trash2, Check, X, WalletCards } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function RequisiteForm({
  catalog,
  initial,
  onSave,
  onCancel,
  saving
}: {
  catalog: any[];
  initial?: any;
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
    <div className="bg-[#1a1e24] border border-[#3ab368]/20 rounded-2xl p-5 mb-4 animate-scaleIn-fast">
      <h3 className="text-sm font-semibold text-[#59d17e] mb-4">
        {initial ? "Редактирование реквизита" : "Новый реквизит"}
      </h3>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="text-xs text-white/40 mb-2 block">Способ оплаты</label>
          <select
            value={methodId}
            onChange={e => setMethodId(e.target.value)}
            className="w-full bg-[#111419] border border-white/5 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#3ab368]/50"
          >
            <option value="" disabled>Выберите метод</option>
            {catalog.map(m => (
              <option key={m.id} value={m.id}>{m.title}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-white/40 mb-2 block">Номер карты / счёта / телефон *</label>
          <input
            value={accountNumber}
            onChange={e => setAccountNumber(e.target.value)}
            placeholder="1234 5678 9012 3456"
            className="w-full bg-[#111419] border border-white/5 rounded-xl px-4 py-3 text-white text-sm outline-none placeholder-white/20 focus:border-[#3ab368]/50"
          />
        </div>

        <div>
          <label className="text-xs text-white/40 mb-2 block">Имя получателя</label>
          <input
            value={accountName}
            onChange={e => setAccountName(e.target.value)}
            placeholder="Иван Иванов"
            className="w-full bg-[#111419] border border-white/5 rounded-xl px-4 py-3 text-white text-sm outline-none placeholder-white/20 focus:border-[#3ab368]/50"
          />
        </div>

        <div>
          <label className="text-xs text-white/40 mb-2 block">Банк / комментарий</label>
          <input
            value={bankName}
            onChange={e => setBankName(e.target.value)}
            placeholder="Необязательно"
            className="w-full bg-[#111419] border border-white/5 rounded-xl px-4 py-3 text-white text-sm outline-none placeholder-white/20 focus:border-[#3ab368]/50"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          onClick={onCancel}
          className="px-6 py-2.5 rounded-xl border border-white/10 text-white/60 text-sm font-semibold hover:bg-white/5 transition"
        >
          Отмена
        </button>
        <button
          onClick={() => onSave({ methodId: parseInt(methodId), accountNumber, accountName, bankName })}
          disabled={!isValid || saving}
          className="px-6 py-2.5 rounded-xl bg-[#3ab368] text-[#07100a] text-sm font-bold disabled:opacity-40 hover:bg-[#59d17e] transition flex items-center gap-2"
        >
          <Check className="w-4 h-4" /> {saving ? "Сохранение..." : "Сохранить"}
        </button>
      </div>
    </div>
  );
}

export default function PaymentDetails() {
  const { data: catalog = [] } = usePaymentMethods();
  const { data: userMethods = [], isLoading } = useUserPaymentMethods();
  const create = useCreateUserPaymentMethod();
  const update = useUpdateUserPaymentMethod();
  const remove = useDeleteUserPaymentMethod();
  const { toast } = useToast();
  const showError = (error: Error) => toast({ title: "Не удалось сохранить реквизиты", description: error.message, variant: "destructive" });

  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const catalogList = Array.isArray(catalog) ? catalog : [];
  const list = Array.isArray(userMethods) ? userMethods : [];

  return (
    <div className="flex-1 overflow-y-auto px-8 py-7 bg-[#0b0d11]">
      <div className="mb-6 flex items-end justify-between max-w-5xl mx-auto">
        <div>
          <h2 className="text-[27px] font-semibold tracking-tight text-white">Мои реквизиты</h2>
          <p className="mt-1 text-sm text-white/40">Банковские данные для получения оплаты от покупателей.</p>
        </div>
        {!showAdd && (
          <button
            onClick={() => { setShowAdd(true); setEditingId(null); }}
            className="flex items-center gap-2 rounded-xl border border-[#3ab368]/30 bg-[#3ab368]/10 px-4 py-2.5 text-xs font-bold text-[#59d17e] transition hover:bg-[#3ab368]/20"
          >
            <Plus size={15} />Добавить реквизит
          </button>
        )}
      </div>

      <div className="max-w-5xl mx-auto">
        {showAdd && (
          <RequisiteForm
            catalog={catalogList}
            onSave={(data) => {
              create.mutate(data, { onSuccess: () => setShowAdd(false), onError: showError });
            }}
            onCancel={() => setShowAdd(false)}
            saving={create.isPending}
          />
        )}

        {isLoading && (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="bg-[#111419] rounded-2xl border border-white/5 p-5 animate-pulse h-[100px]" />
            ))}
          </div>
        )}

        {!isLoading && list.length === 0 && !showAdd && (
          <div className="py-20 flex flex-col items-center justify-center border border-dashed border-white/10 rounded-2xl">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <WalletCards className="w-6 h-6 text-white/20" />
            </div>
            <p className="text-white/60 text-sm font-medium">Нет реквизитов</p>
            <p className="text-white/30 text-xs mt-1 mb-6 max-w-xs text-center">
              Добавьте банковские данные, чтобы покупатели знали, куда переводить средства.
            </p>
            <button
              onClick={() => setShowAdd(true)}
              className="rounded-xl px-7 py-2.5 text-sm font-bold bg-[#3ab368] text-[#07100a] shadow-lg shadow-[#3ab368]/10 transition hover:bg-[#59d17e]"
            >
              Добавить
            </button>
          </div>
        )}

        {!isLoading && list.map((um: any) => (
          <div key={um.id}>
            {editingId === um.id ? (
              <RequisiteForm
                catalog={catalogList}
                initial={um}
                onSave={(data) => {
                  update.mutate({ id: um.id, data }, { onSuccess: () => setEditingId(null), onError: showError });
                }}
                onCancel={() => setEditingId(null)}
                saving={update.isPending}
              />
            ) : (
              <div className="bg-[#111419] border border-white/[.06] rounded-2xl p-5 mb-3 flex items-center justify-between hover:border-white/10 transition">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-bold text-[#59d17e] px-2.5 py-1 bg-[#3ab368]/10 rounded-lg border border-[#3ab368]/20">
                      {um.methodTitle}
                    </span>
                    <span className="font-mono text-white font-semibold text-lg">{um.accountNumber}</span>
                  </div>
                  <div className="flex gap-4 text-xs text-white/40">
                    {um.accountName && <div>Имя: <span className="text-white/70">{um.accountName}</span></div>}
                    {um.bankName && <div>Банк: <span className="text-white/70">{um.bankName}</span></div>}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => { setEditingId(um.id); setShowAdd(false); }}
                    className="p-2.5 rounded-xl bg-[#1a1e24] border border-white/5 hover:border-white/20 text-white/50 hover:text-white transition"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => remove.mutate(um.id, { onError: showError })}
                    disabled={remove.isPending}
                    className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-400 transition"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
