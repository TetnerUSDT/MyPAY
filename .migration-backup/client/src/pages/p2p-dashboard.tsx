import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft, TrendingUp, Package, Star, Clock, CheckCircle2,
  AlertTriangle, Zap, BarChart3, Power, PowerOff, Settings2
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const userApiKey = () => localStorage.getItem("userApiKey") || "";

function fetchP2P(path: string) {
  return fetch(path, { headers: { "x-api-key": userApiKey() } }).then(r => r.json());
}

function StatCard({ label, value, sub, icon: Icon, color = "#3ab368" }: any) {
  return (
    <div className="bg-[#13151A] border border-white/5 rounded-2xl p-4 flex flex-col gap-1">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-white/40 uppercase tracking-wide">{label}</span>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: color + "15" }}>
          <Icon className="w-3.5 h-3.5" style={{ color }} />
        </div>
      </div>
      <span className="text-[22px] font-bold text-white leading-none">{value}</span>
      {sub && <span className="text-[11px]" style={{ color }}>{sub}</span>}
    </div>
  );
}

function formatReleaseTime(s: number) {
  if (!s || s === 0) return "—";
  if (s < 60) return `${s} сек`;
  if (s < 3600) return `${Math.round(s / 60)} мин`;
  return `${(s / 3600).toFixed(1)} ч`;
}

function AdRow({ ad, onToggle, onPromote }: any) {
  const isActive = ad.status === "active";
  return (
    <div className="bg-[#1A1D24] border border-white/5 rounded-2xl p-4 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ad.side === "sell" ? "bg-red-500/10 text-red-400" : "bg-[#3ab368]/10 text-[#3ab368]"}`}>
            {ad.side === "sell" ? "Продажа" : "Покупка"}
          </span>
          <span className="text-xs text-white/40">{ad.assetCurrency || ad.asset_currency}</span>
          {ad.isPromoted && <span className="text-[10px] text-[#e9c46a] font-bold">★ Продвинуто</span>}
        </div>
        <div className="text-sm font-semibold text-white">{parseFloat(ad.price || 0).toFixed(2)} ₽</div>
        <div className="text-[11px] text-white/30">Доступно: {parseFloat(ad.availableAmount || ad.available_amount || 0).toFixed(2)}</div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPromote(ad.id)}
          className="w-8 h-8 rounded-xl bg-[#e9c46a]/10 border border-[#e9c46a]/20 flex items-center justify-center"
          title="Продвинуть"
        >
          <Zap className="w-3.5 h-3.5 text-[#e9c46a]" />
        </button>
        <button
          onClick={() => onToggle(ad.id, isActive ? "paused" : "active")}
          className={`w-8 h-8 rounded-xl flex items-center justify-center border ${isActive ? "bg-red-500/10 border-red-500/20" : "bg-[#3ab368]/10 border-[#3ab368]/20"}`}
        >
          {isActive
            ? <PowerOff className="w-3.5 h-3.5 text-red-400" />
            : <Power className="w-3.5 h-3.5 text-[#3ab368]" />}
        </button>
      </div>
    </div>
  );
}

export default function P2PDashboardScreen() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"overview" | "ads" | "orders">("overview");

  const { data: stats, isLoading: statsLoading } = useQuery<any>({
    queryKey: ["/api/p2p/dashboard"],
    queryFn: () => fetchP2P("/api/p2p/dashboard"),
  });

  const { data: ads = [], isLoading: adsLoading } = useQuery<any[]>({
    queryKey: ["/api/p2p/my-ads"],
    queryFn: () => fetchP2P("/api/p2p/my-ads"),
    enabled: activeTab === "ads",
  });

  const { data: orders = [], isLoading: ordersLoading } = useQuery<any[]>({
    queryKey: ["/api/p2p/orders"],
    queryFn: () => fetchP2P("/api/p2p/orders"),
    enabled: activeTab === "orders",
  });

  const toggleAd = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest("PATCH", `/api/p2p/ads/${id}`, { status }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/p2p/my-ads"] }),
    onError: (e: any) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  const promoteAd = useMutation({
    mutationFn: (id: number) =>
      apiRequest("POST", `/api/p2p/ads/${id}/promote`).then(r => r.json()),
    onSuccess: (data: any) => {
      if (data.success) {
        toast({ title: "Объявление продвинуто на 24 часа" });
        qc.invalidateQueries({ queryKey: ["/api/p2p/my-ads"] });
      } else {
        toast({ title: "Ошибка", description: data.message, variant: "destructive" });
      }
    },
    onError: (e: any) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  const bulkToggle = useMutation({
    mutationFn: ({ status }: { status: string }) =>
      apiRequest("PATCH", "/api/p2p/ads/bulk", { status }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "Объявления обновлены" });
      qc.invalidateQueries({ queryKey: ["/api/p2p/my-ads"] });
    },
    onError: (e: any) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  const activeAds = (ads as any[]).filter(a => a.status === "active").length;
  const pausedAds = (ads as any[]).filter(a => a.status === "paused").length;

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
        <h1 className="text-[17px] font-semibold text-white">Кабинет мерчанта</h1>
        <button
          onClick={() => setLocation("/p2p/verify")}
          className="w-10 h-10 rounded-full bg-[#3ab368]/10 border border-[#3ab368]/20 flex items-center justify-center"
          title="Верификация"
        >
          <Settings2 className="w-4.5 h-4.5 text-[#3ab368]" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-5 mb-5">
        {(["overview", "ads", "orders"] as const).map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`flex-1 py-2 rounded-xl text-[13px] font-semibold transition-colors ${
              activeTab === t
                ? "bg-[#3ab368] text-[#0B0C10]"
                : "bg-[#13151A] text-white/50 border border-white/5"
            }`}
          >
            {t === "overview" ? "Обзор" : t === "ads" ? "Объявления" : "Сделки"}
          </button>
        ))}
      </div>

      <div className="flex-1 px-5 pb-10 overflow-y-auto">
        {/* Overview Tab */}
        {activeTab === "overview" && (
          <>
            {statsLoading ? (
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-24 bg-[#13151A] rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : stats ? (
              <>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <StatCard
                    label="Всего сделок"
                    value={stats.totalOrders ?? 0}
                    sub={`${stats.completedOrders ?? 0} завершено`}
                    icon={BarChart3}
                    color="#3ab368"
                  />
                  <StatCard
                    label="Успешность"
                    value={`${parseFloat(stats.successfulPercent ?? 0).toFixed(1)}%`}
                    sub={`${stats.cancelledOrders ?? 0} отменено`}
                    icon={CheckCircle2}
                    color="#3ab368"
                  />
                  <StatCard
                    label="Рейтинг"
                    value={parseFloat(stats.rating ?? 0).toFixed(1)}
                    sub={`${stats.reviewsCount ?? 0} отзывов`}
                    icon={Star}
                    color="#e9c46a"
                  />
                  <StatCard
                    label="Ср. скорость"
                    value={formatReleaseTime(stats.avgReleaseTimeSeconds ?? 0)}
                    sub="время выпуска"
                    icon={Clock}
                    color="#4361ee"
                  />
                  <StatCard
                    label="Споры"
                    value={stats.disputesTotal ?? 0}
                    sub="всего споров"
                    icon={AlertTriangle}
                    color="#e63946"
                  />
                  <StatCard
                    label="Уровень"
                    value={
                      stats.merchantLevel === "pro" ? "Про" :
                      stats.merchantLevel === "verified" ? "Верифицир." :
                      stats.merchantLevel === "basic" ? "Мерчант" : "Обычный"
                    }
                    sub={stats.merchantLevel !== "pro" ? "повысить уровень" : "максимальный"}
                    icon={TrendingUp}
                    color={
                      stats.merchantLevel === "pro" ? "#e9c46a" :
                      stats.merchantLevel === "verified" ? "#3ab368" : "#4361ee"
                    }
                  />
                </div>

                {/* Verification banner */}
                {stats.merchantLevel === "none" && (
                  <button
                    onClick={() => setLocation("/p2p/verify")}
                    className="w-full bg-gradient-to-r from-[#3ab368]/10 to-[#4361ee]/10 border border-[#3ab368]/20 rounded-2xl p-4 flex items-center gap-3 mb-4"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#3ab368]/15 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-5 h-5 text-[#3ab368]" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-semibold text-white">Стать мерчантом</p>
                      <p className="text-[11px] text-white/40">Получите значок, приоритет в выдаче и доверие покупателей</p>
                    </div>
                    <ChevronLeft className="w-4 h-4 text-white/30 rotate-180" />
                  </button>
                )}
              </>
            ) : (
              <div className="py-20 flex flex-col items-center gap-3">
                <Package className="w-10 h-10 text-white/10" />
                <p className="text-white/40 text-sm">Нет данных</p>
                <p className="text-white/25 text-xs">Совершите первую сделку</p>
              </div>
            )}
          </>
        )}

        {/* Ads Tab */}
        {activeTab === "ads" && (
          <>
            {/* Bulk actions */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => bulkToggle.mutate({ status: "active" })}
                disabled={bulkToggle.isPending}
                className="flex-1 py-2.5 rounded-xl bg-[#3ab368]/10 border border-[#3ab368]/20 text-[#3ab368] text-sm font-semibold flex items-center justify-center gap-1.5"
              >
                <Power className="w-3.5 h-3.5" />
                Включить все
              </button>
              <button
                onClick={() => bulkToggle.mutate({ status: "paused" })}
                disabled={bulkToggle.isPending}
                className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/60 text-sm font-semibold flex items-center justify-center gap-1.5"
              >
                <PowerOff className="w-3.5 h-3.5" />
                Выключить все
              </button>
            </div>
            <div className="flex gap-3 mb-4 text-[12px] text-white/40">
              <span className="text-[#3ab368]">● Активных: {activeAds}</span>
              <span>● Пауза: {pausedAds}</span>
            </div>

            {adsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="h-20 bg-[#13151A] rounded-2xl animate-pulse" />)}
              </div>
            ) : (ads as any[]).length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-white/40 text-sm">Нет объявлений</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(ads as any[]).map(ad => (
                  <AdRow
                    key={ad.id}
                    ad={ad}
                    onToggle={(id: number, status: string) => toggleAd.mutate({ id, status })}
                    onPromote={(id: number) => promoteAd.mutate(id)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Orders Tab */}
        {activeTab === "orders" && (
          <>
            {ordersLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="h-16 bg-[#13151A] rounded-2xl animate-pulse" />)}
              </div>
            ) : (orders as any[]).length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-white/40 text-sm">Нет сделок</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(orders as any[]).slice(0, 30).map((order: any) => {
                  const statusColor: Record<string, string> = {
                    released: "text-[#3ab368]",
                    waiting_payment: "text-yellow-400",
                    paid: "text-yellow-400",
                    cancelled: "text-red-400",
                    dispute: "text-orange-400",
                    refunded: "text-white/40",
                  };
                  const statusLabel: Record<string, string> = {
                    released: "Завершена",
                    waiting_payment: "Ожидание",
                    paid: "Оплачено",
                    cancelled: "Отменена",
                    dispute: "Спор",
                    refunded: "Возврат",
                  };
                  return (
                    <button
                      key={order.id}
                      onClick={() => setLocation(`/p2p/order/${order.id}`)}
                      className="w-full bg-[#13151A] border border-white/5 rounded-2xl p-4 flex items-center gap-3 text-left"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs text-white/40">#{order.id}</span>
                          <span className={`text-xs font-semibold ${statusColor[order.status] || "text-white/40"}`}>
                            {statusLabel[order.status] || order.status}
                          </span>
                        </div>
                        <div className="text-sm font-semibold text-white">
                          {parseFloat(order.assetAmount || order.asset_amount || 0).toFixed(2)} {order.assetCurrency || order.asset_currency}
                        </div>
                        <div className="text-[11px] text-white/30">
                          {parseFloat(order.fiatAmount || order.fiat_amount || 0).toFixed(2)} ₽
                        </div>
                      </div>
                      <ChevronLeft className="w-4 h-4 text-white/20 rotate-180" />
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
