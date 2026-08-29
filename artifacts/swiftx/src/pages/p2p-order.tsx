import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Clock, AlertTriangle, CheckCircle2, Send, Shield, Copy, XCircle, Star } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { UnifiedPreloader } from "@/components/UnifiedPreloader";

function ReviewForm({ orderId, onDone }: { orderId: string; onDone: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [hovered, setHovered] = useState(0);

  const submitReview = useMutation({
    mutationFn: () => apiRequest("POST", `/api/p2p/orders/${orderId}/review`, { rating, comment }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "Отзыв оставлен" });
      qc.invalidateQueries({ queryKey: ["/api/p2p/orders", orderId, "reviews"] });
      onDone();
    },
    onError: (err: any) => toast({ title: "Ошибка", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="bg-[#13151A] border border-[#3ab368]/20 rounded-3xl p-4 space-y-3">
      <h3 className="text-sm font-semibold text-white">Оставить отзыв</h3>
      <div className="flex gap-1.5 justify-center py-1">
        {[1,2,3,4,5].map(s => (
          <button
            key={s}
            onClick={() => setRating(s)}
            onMouseEnter={() => setHovered(s)}
            onMouseLeave={() => setHovered(0)}
            className="transition-transform active:scale-90"
          >
            <Star
              className={`w-8 h-8 ${(hovered || rating) >= s ? "text-[#e9c46a] fill-[#e9c46a]" : "text-white/20"}`}
            />
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={e => setComment(e.target.value)}
        placeholder="Комментарий (необязательно)..."
        rows={2}
        className="w-full bg-[#1A1D24] border border-white/5 rounded-2xl px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none resize-none"
      />
      <div className="flex gap-2">
        <button onClick={onDone} className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/50 text-sm">
          Позже
        </button>
        <button
          onClick={() => submitReview.mutate()}
          disabled={submitReview.isPending}
          className="flex-1 py-2.5 rounded-xl bg-[#3ab368] text-[#0B0C10] text-sm font-bold disabled:opacity-40"
        >
          {submitReview.isPending ? "..." : "Отправить"}
        </button>
      </div>
    </div>
  );
}

function Timer({ deadline }: { deadline: string | null }) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!deadline) return;
    const calc = () => {
      const diff = new Date(deadline).getTime() - Date.now();
      setTimeLeft(Math.max(0, Math.floor(diff / 1000)));
    };
    calc();
    const t = setInterval(calc, 1000);
    return () => clearInterval(t);
  }, [deadline]);

  if (timeLeft === null) return null;
  const m = Math.floor(timeLeft / 60).toString().padStart(2, "0");
  const s = (timeLeft % 60).toString().padStart(2, "0");
  const isUrgent = timeLeft < 120;

  return (
    <div className={`flex items-center gap-1.5 text-sm font-mono font-bold ${isUrgent ? "text-red-400" : "text-[#3ab368]"}`}>
      <Clock className="w-4 h-4" />
      {m}:{s}
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  created: "Создана",
  waiting_payment: "Ожидание оплаты",
  paid: "Оплачено",
  released: "Завершена",
  cancelled: "Отменена",
  dispute: "Спор",
  refunded: "Возвращена",
  expired: "Истекла",
};

const STATUS_COLOR: Record<string, string> = {
  created: "text-white/60",
  waiting_payment: "text-yellow-400",
  paid: "text-blue-400",
  released: "text-[#3ab368]",
  cancelled: "text-red-400",
  dispute: "text-orange-400",
  refunded: "text-white/60",
  expired: "text-red-400",
};

export default function P2POrderScreen() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const chatRef = useRef<HTMLDivElement>(null);
  const [msgText, setMsgText] = useState("");
  const [showDispute, setShowDispute] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [showReview, setShowReview] = useState(true);

  const { data: order, isLoading } = useQuery<any>({
    queryKey: ["/api/p2p/orders", id],
    queryFn: () => fetch(`/api/p2p/orders/${id}`, {
      headers: { "x-api-key": localStorage.getItem("userApiKey") || "" }
    }).then(r => r.json()),
    refetchInterval: 5000,
  });

  const { data: messages = [] } = useQuery<any[]>({
    queryKey: ["/api/p2p/orders", id, "messages"],
    queryFn: () => fetch(`/api/p2p/orders/${id}/messages`, {
      headers: { "x-api-key": localStorage.getItem("userApiKey") || "" }
    }).then(r => r.json()),
    refetchInterval: 3000,
    enabled: !!order,
  });

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  const markPaid = useMutation({
    mutationFn: () => apiRequest("POST", `/api/p2p/orders/${id}/mark-paid`),
    onSuccess: () => {
      toast({ title: "Оплата подтверждена" });
      qc.invalidateQueries({ queryKey: ["/api/p2p/orders", id] });
    },
    onError: (err: any) => toast({ title: "Ошибка", description: err.message, variant: "destructive" }),
  });

  const release = useMutation({
    mutationFn: () => apiRequest("POST", `/api/p2p/orders/${id}/release`),
    onSuccess: () => {
      toast({ title: "Криптовалюта отправлена покупателю" });
      qc.invalidateQueries({ queryKey: ["/api/p2p/orders", id] });
    },
    onError: (err: any) => toast({ title: "Ошибка", description: err.message, variant: "destructive" }),
  });

  const cancel = useMutation({
    mutationFn: () => apiRequest("POST", `/api/p2p/orders/${id}/cancel`),
    onSuccess: () => {
      toast({ title: "Сделка отменена" });
      setLocation("/p2p");
    },
    onError: (err: any) => toast({ title: "Ошибка", description: err.message, variant: "destructive" }),
  });

  const openDispute = useMutation({
    mutationFn: () => apiRequest("POST", `/api/p2p/orders/${id}/dispute`, { reason: disputeReason }),
    onSuccess: () => {
      toast({ title: "Спор открыт" });
      setShowDispute(false);
      qc.invalidateQueries({ queryKey: ["/api/p2p/orders", id] });
    },
    onError: (err: any) => toast({ title: "Ошибка", description: err.message, variant: "destructive" }),
  });

  const sendMsg = useMutation({
    mutationFn: () => apiRequest("POST", `/api/p2p/orders/${id}/messages`, { message: msgText }),
    onSuccess: () => {
      setMsgText("");
      qc.invalidateQueries({ queryKey: ["/api/p2p/orders", id, "messages"] });
    },
  });

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Скопировано" });
  };

  if (isLoading) {
    return <UnifiedPreloader label="Загрузка сделки..." />;
  }

  if (!order || order.message) {
    return (
      <div className="min-h-screen bg-[#0B0C10] flex items-center justify-center flex-col gap-4">
        <p className="text-white/50">Сделка не найдена</p>
        <button onClick={() => setLocation("/p2p")} className="text-[#3ab368] text-sm">← Назад</button>
      </div>
    );
  }

  const isBuyer  = order.isCurrentUserBuyer;
  const isSeller = order.isCurrentUserSeller;
  const status   = order.status;
  const isDone   = ["released", "cancelled", "refunded", "expired"].includes(status);

  const partnerName = isBuyer ? order.sellerName : order.buyerName;
  const partnerInitial = (partnerName || "?").substring(0, 2).toUpperCase();

  const COLORS = ["#e63946","#2a9d8f","#e9c46a","#f4a261","#3ab368","#4361ee","#7209b7"];
  const avatarColor = COLORS[(order.isCurrentUserBuyer ? order.sellerId : order.buyerId) % COLORS.length];

  return (
    <div className="min-h-screen bg-[#0B0C10] text-[#E2E8F0] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-6 pb-4 shrink-0">
        <button
          onClick={() => setLocation("/p2p")}
          className="w-10 h-10 rounded-full bg-white/5 border border-white/5 flex items-center justify-center"
        >
          <ChevronLeft className="w-5 h-5 text-white/70" />
        </button>
        <div className="flex flex-col items-center">
          <span className="text-[15px] font-semibold text-white">Сделка #{order.id}</span>
          <span className={`text-xs font-medium mt-0.5 ${STATUS_COLOR[status] || "text-white/50"}`}>
            {STATUS_LABEL[status] || status}
          </span>
        </div>
        <Timer deadline={status === "waiting_payment" ? order.paymentDeadline : null} />
      </div>

      <div className="flex-1 overflow-y-auto px-5 space-y-4 pb-6">
        {/* Partner card */}
        <button
          className="w-full bg-[#13151A] border border-white/5 rounded-3xl p-4 text-left active:opacity-80 transition-opacity"
          onClick={() => {
            const partnerId = isBuyer ? order.sellerId : order.buyerId;
            if (partnerId) setLocation(`/p2p/user/${partnerId}`);
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
              style={{ backgroundColor: avatarColor }}
            >
              {partnerInitial}
            </div>
            <div className="flex-1">
              <div className="font-semibold text-white text-sm">{partnerName || "Пользователь"}</div>
              <div className="text-xs text-white/40 mt-0.5">{isBuyer ? "Продавец" : "Покупатель"}</div>
            </div>
            <ChevronLeft className="w-4 h-4 text-white/20 rotate-180" />
          </div>
        </button>

        {/* Amounts */}
        <div className="bg-[#13151A] border border-white/5 rounded-3xl p-4 space-y-3">
          <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider">Детали сделки</h3>
          <div className="flex justify-between text-sm">
            <span className="text-white/50">Криптовалюта</span>
            <span className="font-semibold text-white">{parseFloat(order.assetAmount).toFixed(2)} {order.assetCurrency}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-white/50">Сумма (фиат)</span>
            <span className="font-semibold text-[#3ab368]">{parseFloat(order.fiatAmount).toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ₽</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-white/50">Курс</span>
            <span className="font-semibold text-white">{parseFloat(order.price).toFixed(2)} ₽</span>
          </div>
          {order.paymentMethodTitle && (
            <div className="flex justify-between text-sm">
              <span className="text-white/50">Метод оплаты</span>
              <span className="font-semibold text-white">{order.paymentMethodTitle}</span>
            </div>
          )}
        </div>

        {/* Seller payment details (for buyer) */}
        {isBuyer && status === "waiting_payment" && order.sellerPaymentDetails?.length > 0 && (
          <div className="bg-[#13151A] border border-white/5 rounded-3xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#3ab368]" />
              <h3 className="text-xs font-semibold text-white/70 uppercase tracking-wider">Реквизиты продавца</h3>
            </div>
            {order.sellerPaymentDetails.map((pd: any, i: number) => (
              <div key={i} className="bg-[#1A1D24] rounded-2xl p-3 space-y-2">
                <div className="text-xs font-semibold text-[#3ab368]">{pd.methodTitle}</div>
                {pd.accountNumber && (
                  <div className="flex items-center justify-between">
                    <span className="text-white font-mono text-sm">{pd.accountNumber}</span>
                    <button onClick={() => copyText(pd.accountNumber)} className="text-white/30 hover:text-white/70">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                {pd.accountName && <div className="text-xs text-white/50">{pd.accountName}</div>}
                {pd.bankName && <div className="text-xs text-white/40">{pd.bankName}</div>}
              </div>
            ))}
            <p className="text-[11px] text-white/30 leading-relaxed">
              Переведите ровно <span className="text-white font-semibold">{parseFloat(order.fiatAmount).toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ₽</span> по указанным реквизитам, затем нажмите «Я оплатил»
            </p>
          </div>
        )}

        {/* Ad terms */}
        {order.adTerms && (
          <div className="bg-[#13151A] border border-white/5 rounded-3xl p-4">
            <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Условия сделки</h3>
            <p className="text-sm text-white/70 leading-relaxed">{order.adTerms}</p>
          </div>
        )}

        {/* Chat */}
        <div className="bg-[#13151A] border border-white/5 rounded-3xl p-4">
          <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Чат сделки</h3>
          <div ref={chatRef} className="space-y-2 max-h-64 overflow-y-auto mb-3 pr-1">
            {messages.length === 0 && (
              <p className="text-center text-white/30 text-xs py-4">Нет сообщений</p>
            )}
            {messages.map((msg: any) => {
              const isSystem = msg.type === "system";
              return (
                <div key={msg.id} className={`flex ${isSystem ? "justify-center" : msg.senderId === (isBuyer ? order.buyerId : order.sellerId) ? "justify-end" : "justify-start"}`}>
                  {isSystem ? (
                    <div className="text-[10px] text-white/30 bg-white/5 rounded-full px-3 py-1">{msg.message}</div>
                  ) : (
                    <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${
                      msg.senderId === (isBuyer ? order.buyerId : order.sellerId)
                        ? "bg-[#3ab368]/20 text-white rounded-br-md"
                        : "bg-[#1A1D24] text-white/80 rounded-bl-md"
                    }`}>
                      {msg.message}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {!isDone && (
            <div className="flex gap-2">
              <input
                value={msgText}
                onChange={e => setMsgText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && msgText.trim()) sendMsg.mutate(); }}
                placeholder="Сообщение..."
                className="flex-1 bg-[#1A1D24] border border-white/5 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 outline-none"
              />
              <button
                onClick={() => msgText.trim() && sendMsg.mutate()}
                disabled={!msgText.trim() || sendMsg.isPending}
                className="w-10 h-10 rounded-xl bg-[#3ab368] flex items-center justify-center shrink-0 disabled:opacity-40"
              >
                <Send className="w-4 h-4 text-[#0B0C10]" />
              </button>
            </div>
          )}
        </div>

        {/* Dispute form */}
        {showDispute && (
          <div className="bg-[#13151A] border border-orange-500/20 rounded-3xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-orange-400">Открыть спор</h3>
            <input
              value={disputeReason}
              onChange={e => setDisputeReason(e.target.value)}
              placeholder="Причина спора..."
              className="w-full bg-[#1A1D24] border border-white/5 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowDispute(false)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/60 text-sm"
              >Отмена</button>
              <button
                onClick={() => disputeReason.trim() && openDispute.mutate()}
                disabled={!disputeReason.trim() || openDispute.isPending}
                className="flex-1 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-semibold disabled:opacity-40"
              >Подтвердить</button>
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      {!isDone && (
        <div className="px-5 pb-8 pt-3 space-y-3 border-t border-white/5 bg-[#0B0C10] shrink-0">
          {/* Buyer actions */}
          {isBuyer && status === "waiting_payment" && (
            <div className="flex gap-3">
              <button
                onClick={() => cancel.mutate()}
                disabled={cancel.isPending}
                className="flex-1 py-3 rounded-2xl border border-white/10 text-white/60 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <XCircle className="w-4 h-4" /> Отменить
              </button>
              <button
                onClick={() => markPaid.mutate()}
                disabled={markPaid.isPending}
                className="flex-1 py-3 rounded-2xl bg-[#3ab368] text-[#0B0C10] text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#3ab368]/20 disabled:opacity-40"
              >
                <CheckCircle2 className="w-4 h-4" /> Я оплатил
              </button>
            </div>
          )}

          {/* Buyer paid — can open dispute */}
          {isBuyer && status === "paid" && !showDispute && (
            <button
              onClick={() => setShowDispute(true)}
              className="w-full py-3 rounded-2xl border border-orange-500/30 text-orange-400 text-sm font-semibold flex items-center justify-center gap-2"
            >
              <AlertTriangle className="w-4 h-4" /> Открыть спор
            </button>
          )}

          {/* Seller actions */}
          {isSeller && status === "paid" && (
            <div className="flex gap-3">
              {!showDispute && (
                <button
                  onClick={() => setShowDispute(true)}
                  className="flex-1 py-3 rounded-2xl border border-orange-500/30 text-orange-400 text-sm font-semibold"
                >
                  Спор
                </button>
              )}
              <button
                onClick={() => release.mutate()}
                disabled={release.isPending}
                className="flex-1 py-3 rounded-2xl bg-[#3ab368] text-[#0B0C10] text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#3ab368]/20 disabled:opacity-40"
              >
                <CheckCircle2 className="w-4 h-4" /> Подтвердить получение
              </button>
            </div>
          )}

          {/* Dispute status */}
          {status === "dispute" && (
            <div className="py-3 text-center text-orange-400 text-sm font-medium">
              Спор на рассмотрении у модератора
            </div>
          )}
        </div>
      )}

      {isDone && (
        <div className="px-5 pb-8 pt-3 border-t border-white/5 bg-[#0B0C10] shrink-0 space-y-3">
          {status === "released" && showReview && (
            <ReviewForm orderId={id!} onDone={() => setShowReview(false)} />
          )}
          <button
            onClick={() => setLocation("/p2p")}
            className="w-full py-3 rounded-2xl bg-white/5 border border-white/5 text-white/60 text-sm font-semibold"
          >
            ← Вернуться к P2P
          </button>
        </div>
      )}
    </div>
  );
}
