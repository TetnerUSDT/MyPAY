import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useOrder, useOrderMessages, useOrderAction, useSendMessage } from "@/hooks/use-p2p";
import { Clock, AlertTriangle, CheckCircle2, Shield, Copy, XCircle, Send, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
    <div className={`flex items-center gap-1.5 text-lg font-mono font-bold bg-[#171a20] px-3 py-1.5 rounded-xl border ${isUrgent ? "text-red-400 border-red-500/20" : "text-[#e9b44c] border-[#e9b44c]/20"}`}>
      <Clock className="w-5 h-5" />
      {m}:{s}
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  created: "Создана",
  waiting_payment: "Ожидание оплаты",
  paid: "Оплачено, ожидание перевода",
  released: "Сделка завершена",
  cancelled: "Отменена",
  dispute: "Открыт спор",
  refunded: "Возвращена",
  expired: "Истекла",
};

export default function OrderDetail({ backPath = "/deals" }: { backPath?: string }) {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const { data: order, isLoading, isError, error, refetch } = useOrder(id!);
  const { data: messages = [] } = useOrderMessages(id!);
  const orderAction = useOrderAction(id!);
  const sendMessage = useSendMessage(id!);
  
  const chatRef = useRef<HTMLDivElement>(null);
  const [msgText, setMsgText] = useState("");
  const [showDispute, setShowDispute] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  const handleAction = (action: string, data?: any) => {
    orderAction.mutate(
      { action, data },
      {
        onSuccess: () => {
          if (action === "cancel") {
            toast({ title: "Сделка отменена" });
            setLocation(backPath);
          } else {
            setShowDispute(false);
          }
        },
        onError: (err: any) => toast({ title: "Ошибка", description: err.message, variant: "destructive" })
      }
    );
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Скопировано", description: text });
  };

  if (isLoading) {
    return (
      <div className="flex-1 bg-[#0b0d11] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-[#3ab368] animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex-1 bg-[#0b0d11] flex flex-col items-center justify-center text-white/50">
        <p className="text-red-300">Не удалось загрузить сделку</p>
        <p className="mt-1 text-xs text-white/35">{error.message}</p>
        <button onClick={() => refetch()} className="mt-4 rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-white">Повторить</button>
      </div>
    );
  }

  if (!order || order.message) {
    return (
      <div className="flex-1 bg-[#0b0d11] flex flex-col items-center justify-center text-white/50">
        <p>Сделка не найдена</p>
        <button onClick={() => setLocation(backPath)} className="mt-4 text-[#59d17e] hover:underline">Вернуться к сделкам</button>
      </div>
    );
  }

  const isBuy = order.isCurrentUserBuyer;
  const partnerName = isBuy ? order.sellerName : order.buyerName;
  const status = order.status;
  const isDone = ["released", "cancelled", "refunded", "expired"].includes(status);
  const msgs = Array.isArray(messages) ? messages : [];

  return (
    <div className="flex-1 flex overflow-hidden bg-[#0b0d11]">
      <div className="flex-1 overflow-y-auto px-8 py-7 border-r border-white/[.055]">
        <div className="max-w-3xl mx-auto space-y-6">
          
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[.18em] text-[#59d17e] mb-2">Ордер #{order.id}</div>
              <h2 className="text-3xl font-semibold tracking-tight text-white mb-2">
                {STATUS_LABEL[status] || status}
              </h2>
              <p className="text-sm text-white/40">
                {isBuy ? "Вы покупаете" : "Вы продаете"} <strong className="text-white/80">{parseFloat(order.assetAmount).toFixed(2)} {order.assetCurrency}</strong> за <strong className="text-white/80">{parseFloat(order.fiatAmount).toLocaleString("ru-RU")} ₽</strong>
              </p>
            </div>
            {status === "waiting_payment" && (
              <Timer deadline={order.paymentDeadline} />
            )}
            {status === "released" && (
              <div className="w-16 h-16 rounded-2xl bg-[#3ab368]/10 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-[#59d17e]" />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#111419] border border-white/[.06] rounded-2xl p-5">
              <span className="block text-[10px] uppercase tracking-wider text-white/30 mb-4">Информация о сделке</span>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/40">Курс:</span>
                  <span className="text-white font-medium">{parseFloat(order.price).toFixed(2)} ₽</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Сумма к оплате:</span>
                  <span className="text-[#59d17e] font-bold text-lg">{parseFloat(order.fiatAmount).toLocaleString("ru-RU")} ₽</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">{isBuy ? "Продавец:" : "Покупатель:"}</span>
                  <span className="text-white font-medium">{partnerName || "Неизвестно"}</span>
                </div>
              </div>
            </div>

            <div className="bg-[#111419] border border-white/[.06] rounded-2xl p-5 relative overflow-hidden">
              <Shield className="absolute -right-4 -bottom-4 w-32 h-32 text-white/[.02]" />
              <span className="block text-[10px] uppercase tracking-wider text-white/30 mb-4 relative">Безопасность</span>
              <p className="text-xs text-white/50 leading-relaxed relative">
                Криптовалюта продавца заблокирована на эскроу-счете SwiftX. Она будет переведена покупателю только после подтверждения получения фиатных средств.
              </p>
              {!isDone && (
                <div className="mt-4 text-[10px] text-[#e9b44c] bg-[#e9b44c]/10 px-3 py-2 rounded-lg relative">
                  Никогда не переводите криптовалюту до фактического поступления денег на ваш счет.
                </div>
              )}
            </div>
          </div>

          {isBuy && status === "waiting_payment" && order.sellerPaymentDetails?.length > 0 && (
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-blue-400 mb-4 uppercase tracking-wider">Реквизиты для оплаты</h3>
              <div className="space-y-4">
                {order.sellerPaymentDetails.map((pd: any, i: number) => (
                  <div key={i} className="bg-[#171a20] rounded-xl p-4 border border-white/5">
                    <div className="text-xs font-semibold text-[#59d17e] mb-2">{pd.methodTitle}</div>
                    {pd.accountNumber && (
                      <div className="flex items-center justify-between">
                        <span className="text-white font-mono text-lg tracking-wider">{pd.accountNumber}</span>
                        <button onClick={() => copy(pd.accountNumber)} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 transition">
                          <Copy size={16} />
                        </button>
                      </div>
                    )}
                    <div className="flex gap-4 mt-2 text-xs text-white/50">
                      {pd.accountName && <div>Получатель: <span className="text-white/80">{pd.accountName}</span></div>}
                      {pd.bankName && <div>Банк: <span className="text-white/80">{pd.bankName}</span></div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {order.adTerms && (
            <div className="bg-[#111419] border border-white/[.06] rounded-2xl p-5">
              <span className="block text-[10px] uppercase tracking-wider text-white/30 mb-3">Условия продавца</span>
              <p className="text-sm text-white/70 whitespace-pre-wrap">{order.adTerms}</p>
            </div>
          )}

          {!isDone && (
            <div className="bg-[#111419] border border-white/[.06] rounded-2xl p-5 space-y-4">
              <span className="block text-[10px] uppercase tracking-wider text-white/30 mb-2">Управление сделкой</span>
              
              {isBuy && status === "waiting_payment" && (
                <div className="flex gap-4">
                  <button
                    onClick={() => handleAction("mark-paid")}
                    disabled={orderAction.isPending}
                    className="flex-1 py-4 rounded-xl bg-[#3ab368] text-[#07100a] font-bold shadow-lg shadow-[#3ab368]/20 hover:bg-[#59d17e] transition active:scale-95 disabled:opacity-50 flex justify-center items-center gap-2"
                  >
                    <CheckCircle2 size={18} /> Я оплатил
                  </button>
                  <button
                    onClick={() => handleAction("cancel")}
                    disabled={orderAction.isPending}
                    className="py-4 px-6 rounded-xl border border-white/10 text-white/60 font-semibold hover:bg-white/5 transition flex items-center gap-2"
                  >
                    <XCircle size={18} /> Отменить
                  </button>
                </div>
              )}

              {isBuy && status === "paid" && !showDispute && (
                <button
                  onClick={() => setShowDispute(true)}
                  className="w-full py-4 rounded-xl border border-orange-500/30 text-orange-400 font-semibold hover:bg-orange-500/10 transition flex justify-center items-center gap-2"
                >
                  <AlertTriangle size={18} /> Продавец не отпускает крипту (Спор)
                </button>
              )}

              {!isBuy && status === "paid" && (
                <div className="flex gap-4">
                  <button
                    onClick={() => handleAction("release")}
                    disabled={orderAction.isPending}
                    className="flex-1 py-4 rounded-xl bg-[#3ab368] text-[#07100a] font-bold shadow-lg shadow-[#3ab368]/20 hover:bg-[#59d17e] transition active:scale-95 disabled:opacity-50 flex justify-center items-center gap-2"
                  >
                    <CheckCircle2 size={18} /> Платеж получил, отправить крипту
                  </button>
                  {!showDispute && (
                    <button
                      onClick={() => setShowDispute(true)}
                      className="py-4 px-6 rounded-xl border border-orange-500/30 text-orange-400 font-semibold hover:bg-orange-500/10 transition flex items-center gap-2"
                    >
                      <AlertTriangle size={18} /> Спор
                    </button>
                  )}
                </div>
              )}

              {status === "dispute" && (
                <div className="py-4 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 text-center text-sm font-semibold flex items-center justify-center gap-2">
                  <AlertTriangle size={16} /> Спор рассматривается модератором
                </div>
              )}

              {showDispute && (
                <div className="bg-[#171a20] border border-orange-500/30 rounded-xl p-5 space-y-4 animate-scaleIn-fast">
                  <h4 className="text-sm font-semibold text-orange-400">Открытие спора</h4>
                  <textarea
                    value={disputeReason}
                    onChange={e => setDisputeReason(e.target.value)}
                    placeholder="Подробно опишите проблему..."
                    rows={3}
                    className="w-full bg-[#111419] border border-white/5 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-orange-500/50 resize-none"
                  />
                  <div className="flex gap-3">
                    <button onClick={() => setShowDispute(false)} className="flex-1 py-2.5 rounded-lg border border-white/10 text-white/60 text-sm font-medium hover:bg-white/5">
                      Отмена
                    </button>
                    <button 
                      onClick={() => handleAction("dispute", { reason: disputeReason })}
                      disabled={!disputeReason.trim() || orderAction.isPending}
                      className="flex-1 py-2.5 rounded-lg bg-orange-500 text-white text-sm font-bold disabled:opacity-50 hover:bg-orange-400"
                    >
                      Отправить модератору
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      <div className="w-[400px] shrink-0 bg-[#0d1014] flex flex-col">
        <div className="p-5 border-b border-white/[.06] shrink-0 flex items-center gap-3">
          <MessageSquare className="w-5 h-5 text-white/40" />
          <div>
            <h3 className="text-sm font-semibold text-white">Чат с контрагентом</h3>
            <p className="text-[10px] text-white/35">Сообщения читаются модератором при споре</p>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-5 space-y-4" ref={chatRef}>
          {msgs.length === 0 && (
            <div className="text-center text-white/20 text-xs py-10">
              Напишите первое сообщение...
            </div>
          )}
          {msgs.map((msg: any) => {
            const isSystem = msg.type === "system";
            const isMe = msg.senderId === (isBuy ? order.buyerId : order.sellerId);
            
            if (isSystem) {
              return (
                <div key={msg.id} className="flex justify-center">
                  <div className="text-[10px] text-white/30 bg-white/5 rounded-full px-3 py-1 text-center max-w-[85%]">
                    {msg.message}
                  </div>
                </div>
              );
            }

            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] px-4 py-2.5 text-sm shadow-md ${
                  isMe 
                    ? "bg-[#3ab368]/20 border border-[#3ab368]/30 text-white rounded-2xl rounded-br-sm" 
                    : "bg-[#171a20] border border-white/5 text-white/90 rounded-2xl rounded-bl-sm"
                }`}>
                  {msg.message}
                  <div className={`text-[9px] mt-1 ${isMe ? "text-[#59d17e]/60 text-right" : "text-white/30"}`}>
                    {new Date(msg.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {!isDone && (
          <div className="p-4 border-t border-white/[.06] bg-[#0b0d11] shrink-0">
            <div className="flex gap-2 bg-[#171a20] border border-white/5 rounded-xl p-1.5 focus-within:border-[#3ab368]/50 transition-colors">
              <input
                value={msgText}
                onChange={e => setMsgText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && msgText.trim()) {
                    const message = msgText;
                    sendMessage.mutate(message, {
                      onSuccess: () => setMsgText(""),
                      onError: (error) => toast({ title: "Сообщение не отправлено", description: error.message, variant: "destructive" }),
                    });
                  }
                }}
                placeholder="Написать..."
                className="flex-1 bg-transparent px-3 text-sm text-white outline-none placeholder-white/30"
              />
              <button
                onClick={() => {
                  if (msgText.trim()) {
                    const message = msgText;
                    sendMessage.mutate(message, {
                      onSuccess: () => setMsgText(""),
                      onError: (error) => toast({ title: "Сообщение не отправлено", description: error.message, variant: "destructive" }),
                    });
                  }
                }}
                disabled={!msgText.trim() || sendMessage.isPending}
                className="w-9 h-9 rounded-lg bg-[#3ab368] flex items-center justify-center shrink-0 disabled:opacity-40 hover:bg-[#59d17e] transition-colors"
              >
                <Send className="w-4 h-4 text-[#07100a]" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
