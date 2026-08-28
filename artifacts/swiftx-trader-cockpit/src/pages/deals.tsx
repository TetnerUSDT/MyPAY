import { useLocation } from "wouter";
import { useOrders } from "@/hooks/use-p2p";
import { Clock, CheckCircle2, XCircle, AlertTriangle, History } from "lucide-react";

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
  waiting_payment: "text-[#e9b44c]",
  paid: "text-blue-400",
  released: "text-[#59d17e]",
  cancelled: "text-red-400",
  dispute: "text-orange-400",
  refunded: "text-white/40",
  expired: "text-red-400",
  created: "text-white/60",
};

function StatusIcon({ status }: { status: string }) {
  if (status === "released") return <CheckCircle2 className="w-4 h-4 text-[#59d17e]" />;
  if (status === "cancelled" || status === "expired") return <XCircle className="w-4 h-4 text-red-400" />;
  if (status === "dispute") return <AlertTriangle className="w-4 h-4 text-orange-400" />;
  return <Clock className="w-4 h-4 text-[#e9b44c]" />;
}

export default function Deals({ onClose }: { onClose?: () => void } = {}) {
  const [, setLocation] = useLocation();
  const { data: orders = [], isLoading, isError, error, refetch } = useOrders();

  const ordersList = Array.isArray(orders) ? orders : [];

  return (
    <div className="flex-1 overflow-y-auto px-8 py-7 bg-[#0b0d11]">
      <div className="mb-6 flex items-end justify-between max-w-4xl mx-auto">
        <div>
          <h2 className="text-[27px] font-semibold tracking-tight text-white">История сделок</h2>
          <p className="mt-1 text-sm text-white/40">Все ваши активные и завершенные сделки P2P.</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-[#111419] rounded-2xl border border-white/5 p-5 animate-pulse h-[110px]" />
            ))}
          </div>
        )}

        {isError && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 py-12 text-center">
            <p className="text-sm font-medium text-red-300">Не удалось загрузить сделки</p>
            <p className="mt-1 text-xs text-white/35">{error.message}</p>
            <button onClick={() => refetch()} className="mt-4 rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-white">Повторить</button>
          </div>
        )}
        {!isLoading && !isError && ordersList.length === 0 && (
          <div className="py-20 flex flex-col items-center justify-center border border-dashed border-white/10 rounded-2xl">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <History className="w-6 h-6 text-white/20" />
            </div>
            <p className="text-white/60 text-sm font-medium">Нет сделок</p>
            <p className="text-white/30 text-xs mt-1">Ваши P2P сделки появятся здесь</p>
          </div>
        )}

        {!isLoading && !isError && ordersList.length > 0 && (
          <div className="space-y-3">
            {ordersList.map((order: any) => {
              const isActive = !["released", "cancelled", "refunded", "expired"].includes(order.status);
              const isBuy = order.isCurrentUserBuyer;
              
              return (
                <div
                  key={order.id}
                   onClick={() => {
                     onClose?.();
                     setLocation(`/order/${order.id}`);
                   }}
                  className="bg-[#111419] border border-white/[.06] rounded-2xl p-5 cursor-pointer hover:border-[#3ab368]/30 hover:bg-[#14181d] transition-all group relative overflow-hidden"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <StatusIcon status={order.status} />
                      <span className={`text-xs font-bold ${STATUS_COLOR[order.status] || "text-white/50"}`}>
                        {STATUS_LABEL[order.status] || order.status}
                      </span>
                      {isActive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#e9b44c] animate-pulse ml-1" />
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-white/30">
                        {new Date(order.createdAt).toLocaleString("ru-RU", {
                          day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
                        })}
                      </span>
                      <span className="text-white/20">#{order.id}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-[1fr_1.5fr_auto] gap-4 items-end">
                    <div>
                      <span className="block text-[10px] uppercase tracking-wider text-white/30 mb-1">
                        Тип сделки
                      </span>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${isBuy ? "text-[#59d17e]" : "text-[#ff9c59]"}`}>
                          {isBuy ? "Покупка" : "Продажа"}
                        </span>
                        <span className="text-white/40 text-xs">
                          у {isBuy ? order.sellerName || "Продавца" : order.buyerName || "Покупателя"}
                        </span>
                      </div>
                    </div>

                    <div>
                      <span className="block text-[10px] uppercase tracking-wider text-white/30 mb-1">
                        Криптовалюта
                      </span>
                      <div className="text-lg font-bold text-white">
                        {parseFloat(order.assetAmount).toFixed(2)}
                        <span className="text-xs font-semibold text-white/50 ml-1.5">{order.assetCurrency}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="block text-[10px] uppercase tracking-wider text-white/30 mb-1">
                        Сумма
                      </span>
                      <div className="text-lg font-bold text-white">
                        {parseFloat(order.fiatAmount).toLocaleString("ru-RU", { maximumFractionDigits: 2 })}
                        <span className="text-xs font-semibold text-white/50 ml-1.5">₽</span>
                      </div>
                    </div>
                  </div>
                  
                  {isActive && (
                    <div className="absolute top-0 right-0 w-1 h-full bg-[#e9b44c]/80" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
