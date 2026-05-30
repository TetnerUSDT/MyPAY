import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Clock, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  waiting_payment: "Ожидание оплаты",
  paid: "Оплачено",
  released: "Завершена",
  cancelled: "Отменена",
  dispute: "Спор",
  refunded: "Возвращена",
  expired: "Истекла",
  created: "Создана",
};

const STATUS_COLOR: Record<string, string> = {
  waiting_payment: "text-yellow-400",
  paid: "text-blue-400",
  released: "text-[#3ab368]",
  cancelled: "text-red-400",
  dispute: "text-orange-400",
  refunded: "text-white/40",
  expired: "text-red-400",
  created: "text-white/60",
};

function StatusIcon({ status }: { status: string }) {
  if (status === "released") return <CheckCircle2 className="w-4 h-4 text-[#3ab368]" />;
  if (status === "cancelled" || status === "expired") return <XCircle className="w-4 h-4 text-red-400" />;
  if (status === "dispute") return <AlertTriangle className="w-4 h-4 text-orange-400" />;
  return <Clock className="w-4 h-4 text-yellow-400" />;
}

function OrderSkeleton() {
  return (
    <div className="bg-[#13151A] rounded-3xl border border-white/5 p-4 mb-3 animate-pulse">
      <div className="flex justify-between mb-3">
        <div className="h-3 bg-white/5 rounded-full w-24" />
        <div className="h-3 bg-white/5 rounded-full w-16" />
      </div>
      <div className="h-5 bg-white/5 rounded-full w-32 mb-2" />
      <div className="h-2 bg-white/5 rounded-full w-full" />
    </div>
  );
}

export default function P2POrdersScreen() {
  const [, setLocation] = useLocation();

  const { data: orders = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/p2p/orders"],
    refetchInterval: 15000,
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
        <h1 className="text-[17px] font-semibold text-white">История сделок</h1>
        <div className="w-10" />
      </div>

      <div className="flex-1 px-5 pb-10 overflow-y-auto">
        {isLoading && (
          <><OrderSkeleton /><OrderSkeleton /><OrderSkeleton /></>
        )}

        {!isLoading && (orders as any[]).length === 0 && (
          <div className="py-20 flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <Clock className="w-6 h-6 text-white/20" />
            </div>
            <p className="text-white/40 text-sm font-medium">Нет сделок</p>
            <p className="text-white/25 text-xs mt-1">Ваши P2P сделки появятся здесь</p>
          </div>
        )}

        {!isLoading && (orders as any[]).map((order: any) => {
          const isActive = !["released", "cancelled", "refunded", "expired"].includes(order.status);
          return (
            <div
              key={order.id}
              onClick={() => setLocation(`/p2p/order/${order.id}`)}
              className="bg-[#13151A] border border-white/5 rounded-3xl p-4 mb-3 cursor-pointer active:scale-[0.99] transition-transform"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <StatusIcon status={order.status} />
                  <span className={`text-xs font-semibold ${STATUS_COLOR[order.status] || "text-white/50"}`}>
                    {STATUS_LABEL[order.status] || order.status}
                  </span>
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                  )}
                </div>
                <span className="text-[11px] text-white/30">#{order.id}</span>
              </div>

              <div className="flex items-end justify-between mt-3">
                <div>
                  <div className="text-xl font-bold text-white">
                    {parseFloat(order.assetAmount).toFixed(2)}
                    <span className="text-sm font-semibold text-white/50 ml-1.5">{order.assetCurrency}</span>
                  </div>
                  <div className="text-[#3ab368] text-sm font-semibold mt-0.5">
                    {parseFloat(order.fiatAmount).toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ₽
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-white/30">
                    {order.buyerId ? (
                      order.isCurrentUserBuyer !== false
                        ? <span className="text-[#3ab368]/70">Покупка</span>
                        : <span className="text-[#f97316]/70">Продажа</span>
                    ) : null}
                  </div>
                  <div className="text-[11px] text-white/30 mt-0.5">
                    {new Date(order.createdAt).toLocaleString("ru-RU", {
                      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                <div className="text-xs text-white/30">
                  {order.buyerName && order.sellerName ? (
                    `${order.buyerName} → ${order.sellerName}`
                  ) : "P2P сделка"}
                </div>
                <span className="text-[10px] text-[#3ab368] font-medium">
                  {isActive ? "Открыть →" : "Детали →"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
