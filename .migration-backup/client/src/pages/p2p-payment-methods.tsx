import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Method { id: number; title: string; code: string; }
interface UserMethod {
  id: number;
  methodId: number;
  methodTitle: string;
  methodCode: string;
  accountName: string | null;
  accountNumber: string | null;
  bankName: string | null;
}

function MethodForm({
  methods,
  initial,
  onSave,
  onCancel,
  saving,
}: {
  methods: Method[];
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
    <div className="bg-[#13151A] border border-white/5 rounded-3xl p-4 space-y-3">
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
          className="flex-1 py-3 rounded-2xl border border-white/10 text-white/60 text-sm font-semibold flex items-center justify-center gap-2"
        >
          <X className="w-4 h-4" /> Отмена
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

export default function P2PPaymentMethodsScreen() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const { data: methods = [] } = useQuery<Method[]>({
    queryKey: ["/api/p2p/payment-methods"],
  });

  const { data: userMethods = [], isLoading } = useQuery<UserMethod[]>({
    queryKey: ["/api/p2p/user-payment-methods"],
  });

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

  return (
    <div className="min-h-screen bg-[#0B0C10] text-[#E2E8F0] flex flex-col">
      <div className="flex items-center justify-between px-5 pt-6 pb-4">
        <button
          onClick={() => setLocation("/p2p")}
          className="w-10 h-10 rounded-full bg-white/5 border border-white/5 flex items-center justify-center"
        >
          <ChevronLeft className="w-5 h-5 text-white/70" />
        </button>
        <h1 className="text-[17px] font-semibold text-white">Мои реквизиты</h1>
        <button
          onClick={() => { setShowAdd(true); setEditingId(null); }}
          className="w-10 h-10 rounded-full bg-[#3ab368]/10 border border-[#3ab368]/20 flex items-center justify-center"
        >
          <Plus className="w-5 h-5 text-[#3ab368]" />
        </button>
      </div>

      <div className="flex-1 px-5 pb-10 overflow-y-auto space-y-3">
        <p className="text-xs text-white/30 mb-4 leading-relaxed">
          Добавьте банковские реквизиты, которые покупатели будут видеть при оплате сделки.
        </p>

        {showAdd && (
          <MethodForm
            methods={methods as Method[]}
            onSave={(data) => addMethod.mutate(data)}
            onCancel={() => setShowAdd(false)}
            saving={addMethod.isPending}
          />
        )}

        {isLoading && (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="bg-[#13151A] rounded-3xl border border-white/5 p-4 animate-pulse">
                <div className="h-3 bg-white/5 rounded-full w-20 mb-3" />
                <div className="h-4 bg-white/5 rounded-full w-40" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && (userMethods as UserMethod[]).length === 0 && !showAdd && (
          <div className="py-16 flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <Plus className="w-6 h-6 text-white/20" />
            </div>
            <p className="text-white/40 text-sm font-medium">Нет реквизитов</p>
            <p className="text-white/25 text-xs mt-1 mb-6 text-center max-w-xs">
              Добавьте банковские данные для получения оплаты от покупателей
            </p>
            <button
              onClick={() => setShowAdd(true)}
              className="px-6 py-3 rounded-2xl bg-[#3ab368] text-[#0B0C10] font-bold text-sm shadow-lg shadow-[#3ab368]/20"
            >
              Добавить реквизит
            </button>
          </div>
        )}

        {!isLoading && (userMethods as UserMethod[]).map((um: UserMethod) => (
          <div key={um.id}>
            {editingId === um.id ? (
              <MethodForm
                methods={methods as Method[]}
                initial={um}
                onSave={(data) => updateMethod.mutate({ id: um.id, ...data })}
                onCancel={() => setEditingId(null)}
                saving={updateMethod.isPending}
              />
            ) : (
              <div className="bg-[#13151A] border border-white/5 rounded-3xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-xs font-bold text-[#3ab368] px-2.5 py-0.5 bg-[#3ab368]/10 rounded-full">
                    {um.methodTitle}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => { setEditingId(um.id); setShowAdd(false); }}
                      className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"
                    >
                      <Pencil className="w-3.5 h-3.5 text-white/50" />
                    </button>
                    <button
                      onClick={() => deleteMethod.mutate(um.id)}
                      disabled={deleteMethod.isPending}
                      className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-400/70" />
                    </button>
                  </div>
                </div>
                <div className="font-mono text-white text-base mt-1">{um.accountNumber}</div>
                {um.accountName && <div className="text-sm text-white/60 mt-0.5">{um.accountName}</div>}
                {um.bankName && <div className="text-xs text-white/40 mt-0.5">{um.bankName}</div>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
