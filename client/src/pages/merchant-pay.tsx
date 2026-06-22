import { useState, useEffect, useCallback } from "react";
import { useParams } from "wouter";
import { Loader2, CheckCircle2, XCircle, Copy, Check, Clock, RefreshCw, ShieldCheck, Info } from "lucide-react";

interface InvoiceData {
  invoice_number: string;
  shop_name: string;
  order_ref: string | null;
  amount: string;
  currency: string;
  networks: string[];
  status: string;
  wallet_address: string | null;
  network_chosen: string | null;
  expires_at: string | null;
  confirmed_at: string | null;
  tx_hash: string | null;
}

const NETWORK_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  TRON:    { label: "TRON (TRC20)", icon: "/uploads/icons/cryptocurrency/tron.svg",    color: "#ff4c3b" },
  BSC:     { label: "BNB Chain (BEP20)", icon: "/uploads/icons/cryptocurrency/bnb.svg", color: "#f0b90b" },
  TON:     { label: "TON",          icon: "/uploads/icons/cryptocurrency/ton.svg",    color: "#0088cc" },
  POLYGON: { label: "Polygon",      icon: "/uploads/icons/cryptocurrency/polygon.svg",  color: "#8247e5" },
};

const HONEYCOMB_SVG = `data:image/svg+xml,%3Csvg width='40' height='69.28203230275509' viewBox='0 0 40 69.28203230275509' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M20 69.28203230275509L0 57.73502691896258V34.64101615137754L20 23.09401076758504l20 11.547005383792504v23.09401076758504zm10-51.96152422706632L20 5.773502691896258 10 17.32050807568877v11.547005383792504l10 5.773502691896258 10-5.773502691896258z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E`;

function CopyBtn({ text, className = "" }: { text: string, className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button 
      onClick={copy} 
      className={`text-[#2EEA7F] hover:text-white transition-colors flex-shrink-0 bg-[#2EEA7F]/10 hover:bg-[#2EEA7F]/20 p-2 rounded-lg ${className}`}
      title="Скопировать"
    >
      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
    </button>
  );
}

function CountdownTimer({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const update = () => {
      const diff = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setRemaining(diff);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const isUrgent = remaining < 300;

  if (remaining === 0) return (
    <div className="flex items-center gap-1.5 text-red-400 text-sm font-medium bg-red-400/10 px-3 py-1.5 rounded-full border border-red-400/20">
      <XCircle className="w-4 h-4" /> Истёк
    </div>
  );

  return (
    <div className={`flex items-center gap-2 text-sm font-mono font-medium px-3 py-1.5 rounded-full border ${isUrgent ? "text-red-400 bg-red-400/10 border-red-400/20" : "text-[#2EEA7F] bg-[#2EEA7F]/10 border-[#2EEA7F]/20"}`}>
      <Clock className="w-4 h-4" />
      {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
    </div>
  );
}

function PremiumLogo() {
  return (
    <div className="flex flex-col items-center animate-fadeIn">
      <div className="relative w-16 h-16 mb-4">
        <div className="absolute inset-0 bg-gradient-to-tr from-[#0F5A2F] to-[#2EEA7F] rounded-2xl blur-xl opacity-40 animate-pulse"></div>
        <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-[#131A16] to-[#0A0D12] border border-[#2EEA7F]/30 flex items-center justify-center shadow-[0_0_30px_rgba(46,234,127,0.15)]">
          <span className="text-transparent bg-clip-text bg-gradient-to-br from-white to-[#2EEA7F] font-black text-2xl tracking-tighter">SX</span>
        </div>
      </div>
      <span className="text-white/60 text-sm font-medium tracking-widest uppercase">SwiftX Pay</span>
    </div>
  );
}

export default function MerchantPayPage() {
  const params = useParams<{ invoiceNumber: string }>();
  const invoiceNumber = params.invoiceNumber;

  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectingNetwork, setSelectingNetwork] = useState(false);
  const [polling, setPolling] = useState(false);

  const fetchInvoice = useCallback(async () => {
    try {
      const r = await fetch(`/api/merchant/invoice/${invoiceNumber}`);
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setError(d.error || "Инвойс не найден");
        return null;
      }
      const data = await r.json();
      setInvoice(data);
      return data;
    } catch {
      setError("Ошибка загрузки");
      return null;
    }
  }, [invoiceNumber]);

  useEffect(() => {
    fetchInvoice().finally(() => setLoading(false));
  }, [fetchInvoice]);

  // Auto-poll for payment if wallet is reserved
  useEffect(() => {
    if (!invoice || invoice.status === "confirmed" || invoice.status === "expired" || !invoice.wallet_address) return;
    const interval = setInterval(async () => {
      const updated = await fetchInvoice();
      if (updated?.status === "confirmed" || updated?.status === "expired") clearInterval(interval);
    }, 15000);
    return () => clearInterval(interval);
  }, [invoice?.wallet_address, invoice?.status, fetchInvoice]);

  const selectNetwork = async (network: string) => {
    setSelectingNetwork(true);
    try {
      const r = await fetch(`/api/merchant/invoice/${invoiceNumber}/select-network`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ network }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Ошибка");
      await fetchInvoice();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSelectingNetwork(false);
    }
  };

  const PageLayout = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen bg-[#0A0D12] text-white font-sans relative selection:bg-[#2EEA7F]/30 selection:text-white flex flex-col items-center justify-center p-4">
      <div 
        className="fixed inset-0 z-0 opacity-[0.02] pointer-events-none" 
        style={{ backgroundImage: \`url("\${HONEYCOMB_SVG}")\`, backgroundSize: '40px' }}
      ></div>
      <div className="fixed top-0 inset-x-0 h-[50vh] bg-gradient-to-b from-[#113B22]/10 to-transparent pointer-events-none z-0"></div>
      
      <div className="relative z-10 w-full max-w-md">
        {children}
      </div>
      
      <div className="mt-8 flex items-center justify-center gap-2 text-white/30 text-xs font-medium z-10 animate-fadeIn">
        <ShieldCheck className="w-3.5 h-3.5" />
        Защищено SwiftX
      </div>
    </div>
  );

  if (loading) return (
    <PageLayout>
      <div className="flex flex-col items-center justify-center py-20 animate-pulse">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 bg-[#2EEA7F] rounded-full blur-xl opacity-20"></div>
          <Loader2 className="w-16 h-16 text-[#2EEA7F] animate-spin relative z-10" />
        </div>
      </div>
    </PageLayout>
  );

  if (error) return (
    <PageLayout>
      <div className="bg-[#11141A]/80 backdrop-blur-xl border border-white/5 rounded-[2rem] p-8 text-center shadow-2xl animate-scaleIn">
        <div className="w-20 h-20 mx-auto bg-red-500/10 rounded-full flex items-center justify-center mb-6 border border-red-500/20 shadow-[0_0_30px_rgba(239,68,68,0.15)]">
          <XCircle className="w-10 h-10 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-3 tracking-tight">Ошибка</h1>
        <p className="text-white/50 text-sm leading-relaxed">{error}</p>
      </div>
    </PageLayout>
  );

  if (!invoice) return null;

  if (invoice.status === "confirmed") return (
    <PageLayout>
      <div className="bg-[#11141A]/80 backdrop-blur-xl border border-[#2EEA7F]/20 rounded-[2rem] p-8 text-center shadow-[0_0_50px_rgba(46,234,127,0.05)] animate-scaleIn overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-[#2EEA7F]/5 to-transparent pointer-events-none"></div>
        
        <div className="relative z-10">
          <div className="w-24 h-24 mx-auto bg-gradient-to-br from-[#1a3f2b] to-[#0A0D12] rounded-full flex items-center justify-center mb-6 border border-[#2EEA7F]/30 shadow-[0_0_40px_rgba(46,234,127,0.2)]">
            <CheckCircle2 className="w-12 h-12 text-[#2EEA7F]" />
          </div>
          <h1 className="text-3xl font-black text-white mb-2 tracking-tight">Оплата успешна</h1>
          <p className="text-[#2EEA7F] font-medium text-sm mb-8 bg-[#2EEA7F]/10 py-1.5 px-4 rounded-full inline-block border border-[#2EEA7F]/20">Средства зачислены</p>
          
          <div className="bg-[#0A0D12]/80 border border-white/5 rounded-2xl p-5 mb-2 text-left">
            <div className="text-white/40 text-xs mb-1 uppercase tracking-wider">Сумма</div>
            <div className="text-2xl font-bold text-white">{parseFloat(invoice.amount).toFixed(2)} <span className="text-[#2EEA7F] text-lg">USDT</span></div>
            
            <div className="h-px bg-white/5 my-4"></div>
            
            <div className="flex justify-between items-center mb-3">
              <span className="text-white/40 text-sm">Магазин</span>
              <span className="text-white font-medium">{invoice.shop_name}</span>
            </div>
            
            {invoice.order_ref && (
              <div className="flex justify-between items-center">
                <span className="text-white/40 text-sm">Заказ</span>
                <span className="text-white/80 font-mono text-sm">{invoice.order_ref}</span>
              </div>
            )}
          </div>
          
          {invoice.tx_hash && (
            <div className="flex items-center justify-between gap-3 bg-[#0A0D12]/50 border border-white/5 rounded-2xl px-4 py-3 mt-4">
              <div className="flex flex-col items-start overflow-hidden">
                <span className="text-white/30 text-[10px] uppercase tracking-wider mb-0.5">Транзакция</span>
                <span className="text-white/70 text-xs font-mono truncate w-full max-w-[200px]">{invoice.tx_hash}</span>
              </div>
              <CopyBtn text={invoice.tx_hash} className="bg-white/5 hover:bg-white/10 text-white/50" />
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );

  if (invoice.status === "expired") return (
    <PageLayout>
      <div className="bg-[#11141A]/80 backdrop-blur-xl border border-white/5 rounded-[2rem] p-8 text-center shadow-2xl animate-scaleIn relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-1 bg-red-500/50"></div>
        <div className="w-20 h-20 mx-auto bg-red-500/10 rounded-full flex items-center justify-center mb-6 border border-red-500/20 shadow-[0_0_30px_rgba(239,68,68,0.15)]">
          <XCircle className="w-10 h-10 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-3 tracking-tight">Время истекло</h1>
        <p className="text-white/50 text-sm leading-relaxed mb-6">Время, отведенное на оплату инвойса, закончилось. Пожалуйста, вернитесь в магазин и создайте новый заказ.</p>
        
        <div className="bg-[#0A0D12] border border-white/5 rounded-xl p-4 text-left">
          <div className="flex justify-between items-center">
            <span className="text-white/40 text-sm">Инвойс</span>
            <span className="text-white/80 font-mono text-sm">#{invoice.invoice_number}</span>
          </div>
        </div>
      </div>
    </PageLayout>
  );

  return (
    <PageLayout>
      <div className="flex flex-col items-center w-full animate-slideUp">
        <PremiumLogo />

        <div className="w-full bg-[#11141A]/90 backdrop-blur-2xl border border-white/5 rounded-[2rem] overflow-hidden shadow-2xl relative mt-6">
          {/* Top colored accent line */}
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-[#0F5A2F] via-[#2EEA7F] to-[#0F5A2F] opacity-80"></div>
          
          {/* Header */}
          <div className="px-6 pt-8 pb-6 border-b border-white/5 relative overflow-hidden">
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-[#2EEA7F] rounded-full blur-[80px] opacity-10 pointer-events-none"></div>
            
            <div className="flex justify-between items-start mb-6">
              <div>
                <div className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                  К оплате
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black text-white tracking-tighter">{parseFloat(invoice.amount).toFixed(2)}</span>
                  <span className="text-xl text-[#2EEA7F] font-bold">USDT</span>
                </div>
              </div>
              
              {invoice.expires_at && !invoice.wallet_address && (
                <CountdownTimer expiresAt={invoice.expires_at} />
              )}
            </div>

            <div className="bg-[#0A0D12]/50 border border-white/5 rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/40">Магазин</span>
                <span className="text-sm font-medium text-white">{invoice.shop_name}</span>
              </div>
              {invoice.order_ref && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/40">Заказ</span>
                  <span className="text-sm font-mono text-white/80">{invoice.order_ref}</span>
                </div>
              )}
            </div>
          </div>

          <div className="px-6 py-6">
            {invoice.wallet_address && invoice.network_chosen ? (
              <div className="space-y-6 animate-fadeIn">
                <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-2xl p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#0A0D12] flex items-center justify-center border border-white/5 p-2">
                      {NETWORK_LABELS[invoice.network_chosen]?.icon && (
                        <img src={NETWORK_LABELS[invoice.network_chosen].icon} alt="" className="w-full h-full object-contain" />
                      )}
                    </div>
                    <div>
                      <div className="text-[10px] text-white/40 uppercase tracking-wider mb-0.5">Сеть</div>
                      <div className="text-sm text-white font-bold">{NETWORK_LABELS[invoice.network_chosen]?.label ?? invoice.network_chosen}</div>
                    </div>
                  </div>
                  {invoice.expires_at && <CountdownTimer expiresAt={invoice.expires_at} />}
                </div>

                <div className="bg-[#0A0D12] border border-white/5 rounded-3xl p-6 flex flex-col items-center shadow-inner relative overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/[0.03] to-transparent"></div>
                  
                  <div className="bg-white p-3 rounded-2xl mb-5 shadow-[0_0_20px_rgba(255,255,255,0.1)] relative z-10">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=0&color=000000&bgcolor=ffffff&data=${encodeURIComponent(invoice.wallet_address)}`}
                      alt="QR Code"
                      className="w-44 h-44"
                      style={{ imageRendering: 'pixelated' }}
                    />
                  </div>
                  
                  <div className="w-full">
                    <div className="text-xs text-white/40 mb-2 font-medium ml-1">Адрес кошелька</div>
                    <div className="flex items-center gap-2 bg-[#11141A] border border-white/5 rounded-xl p-2 pl-4">
                      <span className="text-sm text-white/80 font-mono flex-1 break-all tracking-tight leading-relaxed">{invoice.wallet_address}</span>
                      <CopyBtn text={invoice.wallet_address} />
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-[#2EEA7F]/10 border border-[#2EEA7F]/20 rounded-2xl p-4">
                  <Info className="w-5 h-5 text-[#2EEA7F] flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-white/80 leading-relaxed">
                    Отправьте точно <span className="font-bold text-[#2EEA7F] bg-[#2EEA7F]/10 px-1.5 py-0.5 rounded">{parseFloat(invoice.amount).toFixed(6)} USDT</span> в сети <span className="font-medium text-white">{NETWORK_LABELS[invoice.network_chosen]?.label ?? invoice.network_chosen}</span>. Платеж подтвердится автоматически.
                  </p>
                </div>

                <button
                  onClick={async () => { setPolling(true); await fetchInvoice(); setPolling(false); }}
                  disabled={polling}
                  className="w-full py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 border border-white/10 hover:bg-white/5"
                >
                  {polling ? <Loader2 className="w-5 h-5 animate-spin text-[#2EEA7F]" /> : <RefreshCw className="w-5 h-5 text-[#2EEA7F]" />}
                  Проверить статус
                </button>
              </div>
            ) : (
              <div className="space-y-4 animate-fadeIn">
                <div className="flex items-center gap-2 text-sm text-white/60 mb-2 font-medium px-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#2EEA7F]"></div>
                  Выберите сеть
                </div>
                <div className="grid gap-3">
                  {invoice.networks.map(net => {
                    const info = NETWORK_LABELS[net];
                    return (
                      <button
                        key={net}
                        onClick={() => selectNetwork(net)}
                        disabled={selectingNetwork}
                        className="group w-full flex items-center gap-4 p-4 rounded-2xl bg-[#0A0D12] border border-white/5 hover:border-[#2EEA7F]/50 hover:shadow-[0_0_20px_rgba(46,234,127,0.1)] transition-all disabled:opacity-50 text-left relative overflow-hidden"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-[#2EEA7F]/0 to-[#2EEA7F]/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        
                        <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/5 p-2.5 group-hover:scale-110 group-hover:bg-white/10 transition-all">
                          {info?.icon && <img src={info.icon} alt="" className="w-full h-full object-contain drop-shadow-md" />}
                        </div>
                        
                        <div className="flex-1">
                          <div className="text-base font-bold text-white group-hover:text-[#2EEA7F] transition-colors">{info?.label ?? net}</div>
                          <div className="text-sm text-white/40 font-medium">USDT</div>
                        </div>
                        
                        {selectingNetwork ? (
                          <Loader2 className="w-5 h-5 text-[#2EEA7F] animate-spin" />
                        ) : (
                          <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center group-hover:bg-[#2EEA7F] group-hover:border-[#2EEA7F] transition-colors">
                            <div className="w-1.5 h-1.5 rounded-full bg-white/20 group-hover:bg-black transition-colors"></div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          
          {/* Footer ID */}
          <div className="bg-[#0A0D12] py-4 text-center border-t border-white/5">
            <span className="text-white/20 text-xs font-mono tracking-widest">INV-{invoice.invoice_number.slice(0, 12)}...</span>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
