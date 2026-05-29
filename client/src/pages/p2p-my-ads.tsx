import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Plus, Power, PowerOff, Trash2 } from "lucide-react";
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

export default function P2PMyAdsScreen() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

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
      toast({ title: "Объявление удалено" });
      qc.invalidateQueries({ queryKey: ["/api/p2p/my-ads"] });
    },
    onError: (err: any) => toast({ title: "Ошибка", description: err.message, variant: "destructive" }),
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
                  </div>
                  <div className="text-white/50 text-xs">{ad.assetTitle || ad.assetCurrency}</div>
                </div>
                <div className="flex items-center gap-1">
                  {(isActive || ad.status === "paused") && (
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
                  {ad.status !== "cancelled" && (
                    <button
                      onClick={() => deleteAd.mutate(ad.id)}
                      disabled={deleteAd.isPending}
                      className="w-8 h-8 rounded-full bg-white/5 border border-white/5 flex items-center justify-center"
                      title="Удалить"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-400/70" />
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
                    {parseFloat(ad.availableAmount).toFixed(4)} {ad.assetCurrency}
                  </div>
                </div>
                <div className="bg-[#1A1D24] rounded-2xl p-2.5">
                  <div className="text-[10px] text-white/30 mb-0.5">Лимиты</div>
                  <div className="text-xs font-semibold text-white">
                    {parseFloat(ad.minAmount).toFixed(0)} – {parseFloat(ad.maxAmount).toFixed(0)} {ad.assetCurrency}
                  </div>
                </div>
              </div>

              <div className="mt-2 text-[11px] text-white/30">
                #{ad.id} · {new Date(ad.createdAt).toLocaleDateString("ru-RU")}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
