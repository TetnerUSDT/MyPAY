import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Plus, Power, PowerOff, X, AlertTriangle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const STATUS_LABEL: Record<string, string> = {
  active: "Активно",
  paused: "На паузе",
  cancelled: "Отменено",
  completed: "Завершено",
};
const STATUS_COLOR: Record<string, string> = {
  active: "text-[#3ab368]",
  paused: "text-yellow-400",
  cancelled: "text-red-400",
  completed: "text-white/40",
};

function AdCardSkeleton() {
  return (
    <div className="bg-[#13151A] rounded-3xl border border-white/5 p-4 mb-3 animate-pulse">
      <div className="h-3 bg-white/5 rounded-full w-24 mb-3" />
      <div className="h-6 bg-white/5 rounded-full w-32 mb-2" />
      <div className="h-2 bg-white/5 rounded-full w-full" />
    </div>
  );
}

interface CancelSheetProps {
  ad: any;
  onConfirm: () => void;
  onClose: () => void;
  isPending: boolean;
}

function CancelSheet({ ad, onConfirm, onClose, isPending }: CancelSheetProps) {
  const isSell = ad.side === "sell";
  const isLocked = ad.balance_locked || ad.balanceLocked;
  const remaining = parseFloat(ad.availableAmount ?? ad.available_amount ?? 0);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-[#13151A] border border-white/10 rounded-t-3xl px-5 pt-5 pb-10"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-white/10 mx-auto mb-5" />

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Закрыть объявление?</h3>
            <p className="text-xs text-white/40">#{ad.id} · {ad.assetTitle || ad.assetCurrency}</p>
          </div>
        </div>

        {isSell && isLocked && remaining > 0 ? (
          <div className="bg-[#3ab368]/8 border border-[#3ab368]/20 rounded-2xl p-4 mb-5">
            <p className="text-sm text-white/70 leading-relaxed">
              Средства вернутся на ваш баланс:
            </p>
            <p className="text-2xl font-bold text-[#3ab368] mt-1">
              {remaining.toFixed(2)}{" "}
              <span className="text-base font-semibold text-[#3ab368]/60">
                {ad.assetCurrency}
              </span>
            </p>
          </div>
        ) : isSell && isLocked && remaining === 0 ? (
          <div className="bg-white/3 border border-white/8 rounded-2xl p-4 mb-5">
            <p className="text-sm text-white/50 leading-relaxed">
              Все средства из этого объявления уже используются в активных сделках. Возврата нет.
            </p>
          </div>
        ) : (
          <div className="bg-white/3 border border-white/8 rounded-2xl p-4 mb-5">
            <p className="text-sm text-white/50 leading-relaxed">
              Объявление будет закрыто. Действие нельзя отменить.
            </p>
          </div>
        )}

        <button
          onClick={onConfirm}
          disabled={isPending}
          className="w-full py-4 rounded-2xl bg-red-500/90 text-white font-bold text-sm shadow-lg shadow-red-500/20 disabled:opacity-50 mb-3 active:scale-95 transition-transform"
        >
          {isPending
            ? "Закрываем..."
            : isSell && isLocked && remaining > 0
              ? `Закрыть и вернуть ${remaining.toFixed(2)} ${ad.assetCurrency}`
              : "Закрыть объявление"}
        </button>
        <button
          onClick={onClose}
          className="w-full py-3 rounded-2xl bg-white/5 text-white/60 font-semibold text-sm"
        >
          Отмена
        </button>
      </div>
    </div>
  );
}

export default function P2PMyAdsScreen() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [cancelTarget, setCancelTarget] = useState<any | null>(null);

  const { data: ads = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/p2p/my-ads"],
  });

  const updateAd = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest("PATCH", `/api/p2p/ads/${id}`, { status }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/p2p/my-ads"] });
      qc.invalidateQueries({ queryKey: ["/api/p2p/ads"] });
    },
    onError: (err: any) => toast({ title: "Ошибка", description: err.message, variant: "destructive" }),
  });

  const deleteAd = useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/p2p/ads/${id}`),
    onSuccess: () => {
      const ad = cancelTarget;
      setCancelTarget(null);
      const remaining = parseFloat(ad?.availableAmount ?? ad?.available_amount ?? 0);
      const isLocked = ad?.balance_locked || ad?.balanceLocked;
      if (ad?.side === "sell" && isLocked && remaining > 0) {
        toast({ title: `Возвращено ${remaining.toFixed(2)} ${ad.assetCurrency}`, description: "Средства зачислены на баланс" });
      } else {
        toast({ title: "Объявление закрыто" });
      }
      qc.invalidateQueries({ queryKey: ["/api/p2p/my-ads"] });
      qc.invalidateQueries({ queryKey: ["/api/user/crypto-balances"] });
    },
    onError: (err: any) => {
      setCancelTarget(null);
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    },
  });

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
        <h1 className="text-[17px] font-semibold text-white">Мои объявления</h1>
        <button
          onClick={() => setLocation("/p2p/create-ad")}
          className="w-10 h-10 rounded-full bg-[#3ab368]/10 border border-[#3ab368]/20 flex items-center justify-center"
        >
          <Plus className="w-5 h-5 text-[#3ab368]" />
        </button>
      </div>

      <div className="flex-1 px-5 pb-10 overflow-y-auto">
        {isLoading && (
          <><AdCardSkeleton /><AdCardSkeleton /><AdCardSkeleton /></>
        )}

        {!isLoading && (ads as any[]).length === 0 && (
          <div className="py-20 flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <Plus className="w-6 h-6 text-white/20" />
            </div>
            <p className="text-white/40 text-sm font-medium">Нет объявлений</p>
            <p className="text-white/25 text-xs mt-1 mb-6">Создайте первое объявление</p>
            <button
              onClick={() => setLocation("/p2p/create-ad")}
              className="px-6 py-3 rounded-2xl bg-[#3ab368] text-[#0B0C10] font-bold text-sm shadow-lg shadow-[#3ab368]/20"
            >
              Создать объявление
            </button>
          </div>
        )}

        {!isLoading && (ads as any[]).map((ad: any) => {
          const isActive = ad.status === "active";
          const isPaused = ad.status === "paused";
          const canManage = isActive || isPaused;
          const remaining = parseFloat(ad.availableAmount ?? ad.available_amount ?? 0);
          const isLocked = ad.balance_locked || ad.balanceLocked;

          return (
            <div key={ad.id} className="bg-[#13151A] border border-white/5 rounded-3xl p-4 mb-3 shadow-2xl shadow-black/30">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      ad.side === "sell"
                        ? "bg-[#3ab368]/10 text-[#3ab368]"
                        : "bg-[#f97316]/10 text-[#f97316]"
                    }`}>
                      {ad.side === "sell" ? "Продажа" : "Покупка"}
                    </span>
                    <span className={`text-xs font-medium ${STATUS_COLOR[ad.status] || "text-white/40"}`}>
                      {STATUS_LABEL[ad.status] || ad.status}
                    </span>
                    {ad.side === "sell" && isLocked && canManage && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        🔒 заморожено
                      </span>
                    )}
                  </div>
                  <div className="text-white/50 text-xs">{ad.assetTitle || ad.assetCurrency}</div>
                </div>
                <div className="flex items-center gap-1">
                  {canManage && (
                    <button
                      onClick={() => updateAd.mutate({ id: ad.id, status: isActive ? "paused" : "active" })}
                      disabled={updateAd.isPending}
                      className="w-8 h-8 rounded-full bg-white/5 border border-white/5 flex items-center justify-center"
                      title={isActive ? "Приостановить" : "Активировать"}
                    >
                      {isActive
                        ? <PowerOff className="w-3.5 h-3.5 text-yellow-400" />
                        : <Power className="w-3.5 h-3.5 text-[#3ab368]" />
                      }
                    </button>
                  )}
                  {canManage && (
                    <button
                      onClick={() => setCancelTarget(ad)}
                      className="w-8 h-8 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center"
                      title="Закрыть объявление"
                    >
                      <X className="w-3.5 h-3.5 text-red-400" />
                    </button>
                  )}
                </div>
              </div>

              <div className="text-2xl font-bold text-[#3ab368] mb-2">
                {parseFloat(ad.price).toFixed(2)}
                <span className="text-sm font-semibold text-[#3ab368]/60 ml-1">₽</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#1A1D24] rounded-2xl p-2.5">
                  <div className="text-[10px] text-white/30 mb-0.5">Доступно</div>
                  <div className="text-sm font-semibold text-white">
                    {remaining.toFixed(2)} {ad.assetCurrency}
                  </div>
                </div>
                <div className="bg-[#1A1D24] rounded-2xl p-2.5">
                  <div className="text-[10px] text-white/30 mb-0.5">Лимиты</div>
                  <div className="text-xs font-semibold text-white">
                    {parseFloat(ad.minAmount).toFixed(0)} – {parseFloat(ad.maxAmount).toFixed(0)} {ad.assetCurrency}
                  </div>
                </div>
              </div>

              {ad.side === "sell" && isLocked && canManage && (
                <div className="mt-2 text-[11px] text-amber-400/60 flex items-center gap-1">
                  <span>💡</span>
                  <span>Нажмите ✕ чтобы закрыть объявление и вернуть {remaining.toFixed(2)} {ad.assetCurrency} на баланс</span>
                </div>
              )}

              <div className="mt-2 text-[11px] text-white/30">
                #{ad.id} · {new Date(ad.createdAt).toLocaleDateString("ru-RU")}
              </div>
            </div>
          );
        })}
      </div>

      {cancelTarget && (
        <CancelSheet
          ad={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onConfirm={() => deleteAd.mutate(cancelTarget.id)}
          isPending={deleteAd.isPending}
        />
      )}
    </div>
  );
}
