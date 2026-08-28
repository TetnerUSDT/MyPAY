import { useState } from "react";
import { useMyAds, useUpdateAd, useDeleteAd } from "@/hooks/use-p2p";
import { Plus, Power, PowerOff, X, AlertTriangle, Megaphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CreateAdModal } from "@/components/create-ad-modal";

const STATUS_LABEL: Record<string, string> = {
  active: "Активно",
  paused: "На паузе",
  cancelled: "Отменено",
  completed: "Завершено",
};

const STATUS_COLOR: Record<string, string> = {
  active: "text-[#59d17e]",
  paused: "text-[#e9b44c]",
  cancelled: "text-red-400",
  completed: "text-white/40",
};

export default function Ads({ onClose }: { onClose?: () => void } = {}) {
  const { data: ads = [], isLoading, isError, error, refetch } = useMyAds();
  const updateAd = useUpdateAd();
  const deleteAd = useDeleteAd();
  const { toast } = useToast();
  const showError = (error: Error) => toast({ title: "Операция не выполнена", description: error.message, variant: "destructive" });
  
  const [cancelTarget, setCancelTarget] = useState<any | null>(null);
  const [showCreateAd, setShowCreateAd] = useState(false);
  
  const adsList = Array.isArray(ads) ? ads : [];

  return (
    <div className="flex-1 overflow-y-auto px-8 py-7 bg-[#0b0d11]">
      <div className="mb-6 flex items-end justify-between max-w-5xl mx-auto">
        <div>
          <h2 className="text-[27px] font-semibold tracking-tight text-white">Мои объявления</h2>
          <p className="mt-1 text-sm text-white/40">Управляйте вашими предложениями на рынке.</p>
        </div>
        <button 
          onClick={() => setShowCreateAd(true)}
          className="flex items-center gap-2 rounded-xl border border-[#3ab368]/30 bg-[#3ab368]/10 px-4 py-2.5 text-xs font-bold text-[#59d17e] transition hover:bg-[#3ab368]/20"
        >
          <Plus size={15} />Создать объявление
        </button>
      </div>

      <div className="max-w-5xl mx-auto space-y-4">
        {isLoading && (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="bg-[#111419] rounded-2xl border border-white/5 p-5 animate-pulse h-[140px]" />
            ))}
          </div>
        )}

        {isError && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 py-12 text-center">
            <p className="text-sm font-medium text-red-300">Не удалось загрузить объявления</p>
            <p className="mt-1 text-xs text-white/35">{error.message}</p>
            <button onClick={() => refetch()} className="mt-4 rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-white">Повторить</button>
          </div>
        )}
        {!isLoading && !isError && adsList.length === 0 && (
          <div className="py-20 flex flex-col items-center justify-center border border-dashed border-white/10 rounded-2xl">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <Megaphone className="w-6 h-6 text-white/20" />
            </div>
            <p className="text-white/60 text-sm font-medium">Нет активных объявлений</p>
            <p className="text-white/30 text-xs mt-1 mb-6">Создайте предложение, чтобы начать торговать</p>
            <button 
              onClick={() => setShowCreateAd(true)}
              className="rounded-xl px-7 py-2.5 text-sm font-bold bg-[#3ab368] text-[#07100a] shadow-lg shadow-[#3ab368]/10 transition hover:bg-[#59d17e]"
            >
              Разместить объявление
            </button>
          </div>
        )}

        {!isLoading && !isError && adsList.map((ad: any) => {
          const isActive = ad.status === "active";
          const isPaused = ad.status === "paused";
          const canManage = isActive || isPaused;
          const remaining = parseFloat(ad.availableAmount || 0);
          const isSell = ad.side === "sell";

          return (
            <div key={ad.id} className="bg-[#111419] border border-white/[.06] rounded-2xl p-5 hover:border-white/10 transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-bold px-3 py-1 rounded-lg uppercase tracking-wider ${
                    isSell
                      ? "bg-[#3ab368]/10 text-[#59d17e] border border-[#3ab368]/20"
                      : "bg-[#f97316]/10 text-[#ff9c59] border border-[#f97316]/20"
                  }`}>
                    {isSell ? "Продажа" : "Покупка"}
                  </span>
                  <span className={`text-xs font-bold ${STATUS_COLOR[ad.status] || "text-white/40"}`}>
                    {STATUS_LABEL[ad.status] || ad.status}
                  </span>
                  <span className="text-xs text-white/30">#{ad.id}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  {canManage && (
                    <button
                      onClick={() => updateAd.mutate({ id: ad.id, data: { status: isActive ? "paused" : "active" } }, { onError: showError })}
                      disabled={updateAd.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a1e24] border border-white/5 hover:border-white/20 text-xs font-medium text-white/70 transition"
                    >
                      {isActive
                        ? <><PowerOff className="w-3.5 h-3.5 text-[#e9b44c]" /> Приостановить</>
                        : <><Power className="w-3.5 h-3.5 text-[#59d17e]" /> Активировать</>
                      }
                    </button>
                  )}
                  {canManage && (
                    <button
                      onClick={() => setCancelTarget(ad)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-xs font-medium text-red-400 transition"
                    >
                      <X className="w-3.5 h-3.5" /> Закрыть
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-[1fr_1fr_1.5fr] gap-6 items-end border-t border-white/[.04] pt-4">
                <div>
                  <span className="block text-[10px] uppercase tracking-wider text-white/30 mb-1">Курс</span>
                  <div className="text-xl font-bold text-white">
                    {parseFloat(ad.price).toFixed(2)}
                    <span className="text-sm font-semibold text-white/50 ml-1.5">₽</span>
                  </div>
                </div>

                <div>
                  <span className="block text-[10px] uppercase tracking-wider text-white/30 mb-1">Доступно</span>
                  <div className="text-lg font-semibold text-white">
                    {remaining.toFixed(2)}
                    <span className="text-xs font-semibold text-white/50 ml-1.5">{ad.assetCurrency}</span>
                  </div>
                </div>

                <div>
                  <span className="block text-[10px] uppercase tracking-wider text-white/30 mb-1">Лимиты</span>
                  <div className="text-sm font-medium text-white/80">
                    {parseFloat(ad.minAmount).toLocaleString("ru-RU")} – {parseFloat(ad.maxAmount).toLocaleString("ru-RU")} ₽
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050609]/80 backdrop-blur-sm">
          <div className="w-[400px] rounded-[26px] border border-white/10 bg-[#101318] p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Закрыть объявление?</h3>
                <p className="text-xs text-white/40">Действие нельзя отменить</p>
              </div>
            </div>
            
            <p className="text-sm text-white/60 mb-6 leading-relaxed">
              Объявление будет навсегда закрыто и убрано из рынка.
              {cancelTarget.side === "sell" && " Замороженные средства, не участвующие в сделках, вернутся на баланс."}
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setCancelTarget(null)}
                className="flex-1 py-3 rounded-xl border border-white/10 text-white/60 text-sm font-semibold hover:bg-white/5 transition"
              >
                Отмена
              </button>
              <button
                onClick={() => {
                  deleteAd.mutate(cancelTarget.id, {
                    onSuccess: () => setCancelTarget(null),
                    onError: showError,
                  });
                }}
                disabled={deleteAd.isPending}
                className="flex-1 py-3 rounded-xl bg-red-500/90 text-white font-bold text-sm shadow-lg shadow-red-500/20 disabled:opacity-50 hover:bg-red-500 transition"
              >
                {deleteAd.isPending ? "Закрытие..." : "Подтвердить"}
              </button>
            </div>
          </div>
        </div>
      )}
      {showCreateAd && <CreateAdModal onClose={() => setShowCreateAd(false)} />}
    </div>
  );
}
