import { useState, useEffect, useRef, useCallback } from "react";
import { gsap } from "gsap";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft, Plus, Store, Copy, Check, RefreshCw, Settings,
  ArrowDownLeft, ArrowUpRight, Clock, CheckCircle2, XCircle, X,
  Eye, EyeOff, Loader2, AlertCircle, ExternalLink, Zap, Wallet, Timer,
  FileText, Activity, AlertTriangle, TrendingUp, CreditCard, Building2,
  Globe, Webhook, Network, BarChart3, Shield, Sparkles, Ban
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// ── Network definitions ───────────────────────────────────────────────────────

interface NetworkDef {
  id: string;
  label: string;
  sub: string;
  icon: string;
  apiNode?: string;
  apiMode?: string;
  selectable: boolean;
  badge?: string;
}

const NETWORKS: NetworkDef[] = [
  { id: "TRON",     label: "TRON",         sub: "TRC20 · USDT",      icon: "tron.svg",      apiNode: "TRON",     apiMode: "standard", selectable: true },
  { id: "TRON_GF",  label: "TRON GasFree", sub: "без комиссии TRX",  icon: "tron.svg",      apiNode: "TRON",     apiMode: "gasfree",  selectable: true, badge: "GasFree" },
  { id: "BSC",      label: "BNB Chain",    sub: "BEP20 · USDT",      icon: "bnb.svg",       apiNode: "BSC",      apiMode: "standard", selectable: true },
  { id: "TON",      label: "TON",          sub: "Jetton · USDT",     icon: "ton.svg",       apiNode: "TON",      apiMode: "standard", selectable: true },
  { id: "ETH",      label: "Ethereum",     sub: "ERC20 · USDT",      icon: "ethereum.svg",  apiNode: "ETH",      apiMode: "standard", selectable: true },
  { id: "POLYGON",  label: "Polygon",      sub: "ERC20 · USDT",      icon: "polygon.svg",   apiNode: "POLYGON",  apiMode: "standard", selectable: true },
  { id: "SOLANA",   label: "Solana",       sub: "SPL · USDT",        icon: "solana.svg",    apiNode: "SOLANA",   apiMode: "standard", selectable: true },
  { id: "ARBITRUM", label: "Arbitrum",     sub: "ERC20 · USDT",      icon: "arbitrum.svg",  apiNode: "ARBITRUM", apiMode: "standard", selectable: true },
  { id: "AVAX",     label: "Avalanche",    sub: "Скоро",             icon: "avalanche.svg", selectable: false },
  { id: "DOT",      label: "Polkadot",     sub: "Скоро",             icon: "polkadot.svg",  selectable: false },
  { id: "XRP",      label: "XRP",          sub: "Скоро",             icon: "xrp.svg",       selectable: false },
  { id: "DOGE",     label: "Dogecoin",     sub: "Скоро",             icon: "dogecoin.svg",  selectable: false },
  { id: "ADA",      label: "Cardano",      sub: "Скоро",             icon: "cardano.svg",   selectable: false },
  { id: "XMR",      label: "Monero",       sub: "Скоро",             icon: "monero.svg",    selectable: false },
  { id: "XTZ",      label: "Tezos",        sub: "Скоро",             icon: "tezos.svg",     selectable: false },
];

const NET_BY_ID: Record<string, NetworkDef> = Object.fromEntries(NETWORKS.map(n => [n.id, n]));

// ── Types ─────────────────────────────────────────────────────────────────────

type ShopStatus = "pending" | "active" | "rejected" | "suspended";
interface Shop {
  id: number;
  userId: number;
  name: string;
  domain: string;
  apiKey: string;
  status: ShopStatus;
  addressMode: string;
  permanentMonitorMinutes: number;
  temporaryMinutes: number;
  invoiceMinutes: number;
  enabledNetworks: string | null;
  webhookUrl: string | null;
  balanceUsdt: string;
  totalReceived: string;
  totalPaidOut: string;
  walletBalanceSum?: string;
  adminNote: string | null;
  createdAt: string;
}

interface Payment {
  id: number;
  shopId: number;
  orderId: string | null;
  externalUserId: string | null;
  walletAddress: string | null;
  network: string;
  currency: string;
  amount: string | null;
  amountReceived: string | null;
  txHash: string | null;
  status: string;
  addressType: string;
  paymentMode: string | null;
  expiresAt: string | null;
  confirmedAt: string | null;
  createdAt: string;
}

interface Payout {
  id: number;
  shopId: number;
  toAddress: string;
  network: string;
  currency: string;
  amount: string;
  txHash: string | null;
  status: string;
  source: string;
  externalOrderId: string | null;
  fromWalletId: number | null;
  reference: string | null;
  note: string | null;
  processedAt: string | null;
  createdAt: string;
}

interface MerchantWallet {
  id: number;
  shopId: number;
  address: string;
  network: string;
  mode: string;
  gasfreeAddress: string | null;
  externalUserId: string | null;
  orderId: string | null;
  reservedUntil: string | null;
  monitoringUntil: string | null;
  status: string;
  balanceUsdt: string | null;
  balanceUpdatedAt: string | null;
  createdAt: string;
  // Invoice reservation (injected by wallets endpoint)
  invoiceReservedUntil?: string;
  invoiceNumber?: string;
  invoiceAmount?: string;
  invoiceCurrency?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function userApiKey() {
  return localStorage.getItem("userApiKey") || "";
}

function fetchBusiness(path: string) {
  return fetch(path, { headers: { "x-api-key": userApiKey() } }).then(r => {
    if (!r.ok) throw new Error("Request failed");
    return r.json();
  });
}

function parseNetworks(raw: string | null): string[] {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    pending:    { label: "Ожидает проверки", color: "#e9c46a" },
    active:     { label: "Активен",          color: "#3ab368" },
    rejected:   { label: "Отклонён",         color: "#ef4444" },
    suspended:  { label: "Приостановлен",    color: "#f97316" },
    confirmed:  { label: "Подтверждён",      color: "#3ab368" },
    processing: { label: "В обработке",      color: "#e9c46a" },
    completed:  { label: "Выполнен",         color: "#3ab368" },
    cancelled:  { label: "Отменён",          color: "#ef4444" },
    reserved:   { label: "Зарезервирован",   color: "#6366f1" },
    permanent:  { label: "Постоянный",       color: "#3ab368" },
    excluded:   { label: "Исключён",         color: "#94a3b8" },
  };
  const s = map[status] ?? { label: status, color: "#ffffff55" };
  return (
    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: s.color + "20", color: s.color }}>
      {s.label}
    </span>
  );
}

function walletStatus(w: MerchantWallet) {
  if (w.status === "permanent") return "permanent";
  if (w.status === "reserved") return "reserved";
  if (w.status === "excluded") return "excluded";
  return "active";
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button onClick={copy} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-white/40" />}
    </button>
  );
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function truncate(s: string, n = 16) {
  if (!s) return "—";
  if (s.length <= n) return s;
  return s.slice(0, 8) + "..." + s.slice(-6);
}

function PaymentTimer({ expiresAt }: { expiresAt: string | null }) {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const id = setInterval(() => forceUpdate(n => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  if (!expiresAt) {
    // Permanent mode — no timer, just a static label
    return (
      <div className="flex items-center gap-1 text-[10px] text-white/30">
        <Clock className="w-3 h-3" />
        <span>постоянный адрес · мониторинг</span>
      </div>
    );
  }

  const remaining = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  const expired = remaining === 0;

  return (
    <div className={`flex items-center gap-1 text-[10px] ${expired ? "text-red-400/70" : remaining < 120 ? "text-orange-400/80" : "text-[#e9c46a]/70"}`}>
      <Timer className="w-3 h-3" />
      {expired
        ? <span>Время проверки истекло</span>
        : <span>Проверяется ещё {m}:{String(s).padStart(2, "0")}</span>
      }
    </div>
  );
}

function WalletCountdown({ reservedUntil, onExpired, mode = "reserved" }: { reservedUntil: string; onExpired: () => void; mode?: "reserved" | "monitoring" | "invoice" }) {
  const [, forceUpdate] = useState(0);
  const notifiedRef = useRef(false);

  useEffect(() => {
    const id = setInterval(() => {
      forceUpdate(n => n + 1);
      const rem = new Date(reservedUntil).getTime() - Date.now();
      if (rem <= 0 && !notifiedRef.current) {
        notifiedRef.current = true;
        onExpired();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [reservedUntil, onExpired]);

  const remaining = Math.max(0, Math.floor((new Date(reservedUntil).getTime() - Date.now()) / 1000));
  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;

  if (remaining === 0) {
    return (
      <div className="flex items-center gap-1 text-[10px] text-white/30">
        <Clock className="w-3 h-3" />
        <span>Освобождается...</span>
      </div>
    );
  }

  const timeStr = h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;

  const isUrgent = remaining < 300; // < 5 min

  const label = mode === "monitoring"
    ? `На мониторинге ещё ${timeStr}`
    : mode === "invoice"
    ? `Инвойс освободит через ${timeStr}`
    : `Зарезервирован ещё ${timeStr}`;

  return (
    <div className={`flex items-center gap-1 text-[10px] ${isUrgent ? "text-orange-400/80" : "text-[#e9c46a]/70"}`}>
      <Clock className="w-3 h-3" />
      <span>{label}</span>
    </div>
  );
}

function NetworkIcon({ iconFile, size = 28 }: { iconFile: string; size?: number }) {
  return (
    <img
      src={`/uploads/icons/cryptocurrency/${iconFile}`}
      width={size} height={size}
      className="rounded-full object-cover flex-shrink-0"
      onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
    />
  );
}

// ── Create shop form ──────────────────────────────────────────────────────────

function CreateShopForm({ onSuccess }: { onSuccess: () => void }) {
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/business/shops", { name, domain }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/business/shops"] });
      toast({ title: "Магазин создан", description: "Ожидайте проверки администратором." });
      onSuccess();
    },
    onError: (e: any) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-white/50 mb-1.5 block">Название магазина</label>
        <input
          value={name} onChange={e => setName(e.target.value)}
          placeholder="Мой интернет-магазин"
          className="w-full bg-[#1A1D24] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#3ab368]/50"
        />
      </div>
      <div>
        <label className="text-xs text-white/50 mb-1.5 block">Домен сайта</label>
        <input
          value={domain} onChange={e => setDomain(e.target.value)}
          placeholder="example.com"
          className="w-full bg-[#1A1D24] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#3ab368]/50"
        />
      </div>
      <p className="text-xs text-white/30 leading-relaxed">
        После создания магазин отправляется на проверку администратором. Обычно это занимает до 24 часов.
      </p>
      <button
        onClick={() => mutation.mutate()}
        disabled={!name || !domain || mutation.isPending}
        className="w-full py-3.5 rounded-2xl font-semibold text-sm text-white bg-[#3ab368] hover:bg-[#2ea058] disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
      >
        {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        Создать магазин
      </button>
    </div>
  );
}

// ── API Documentation ─────────────────────────────────────────────────────────

function CodeBlock({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative group">
      <pre className="bg-[#080A0E] rounded-xl p-3 font-mono text-[10px] text-white/60 leading-relaxed overflow-x-auto whitespace-pre">
        {children}
      </pre>
      <button
        onClick={() => { navigator.clipboard.writeText(children); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg bg-white/10 hover:bg-white/20"
      >
        {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-white/50" />}
      </button>
    </div>
  );
}

function EndpointTag({ method }: { method: "POST" | "GET" | "PATCH" }) {
  const colors: Record<string, string> = {
    POST: "bg-[#3ab368]/20 text-[#3ab368]",
    GET: "bg-blue-500/20 text-blue-400",
    PATCH: "bg-[#e9c46a]/20 text-[#e9c46a]",
  };
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md font-mono ${colors[method]}`}>{method}</span>;
}

interface DocSection {
  id: string;
  label: string;
}

function ApiDocs({ apiKey, showKey }: { apiKey: string; showKey: boolean }) {
  const [open, setOpen] = useState<string | null>("address");
  const key = showKey ? apiKey : apiKey.slice(0, 8) + "••••••••••••••••••••••••";

  const toggle = (id: string) => setOpen(prev => prev === id ? null : id);

  const baseUrl = window.location.origin;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 px-1">
        <Zap className="w-4 h-4 text-[#3ab368]" />
        <span className="text-sm font-semibold text-white">API-документация</span>
      </div>

      {/* Auth block */}
      <div className="bg-[#0D1117] border border-white/8 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1.5 h-1.5 rounded-full bg-[#3ab368]" />
          <span className="text-xs font-semibold text-white">Аутентификация</span>
        </div>
        <p className="text-[11px] text-white/50 mb-3 leading-relaxed">
          Все запросы к публичному API магазина требуют заголовок <code className="text-white/80 bg-white/10 px-1 py-0.5 rounded">x-shop-key</code> с вашим API-ключом магазина.
        </p>
        <CodeBlock>{`x-shop-key: ${key}`}</CodeBlock>
        <p className="text-[10px] text-white/30 mt-2 leading-relaxed">
          Базовый URL всех запросов: <code className="text-white/50">{baseUrl}</code>
        </p>
      </div>

      {/* Endpoint 1: GET address */}
      <div className="bg-[#0D1117] border border-white/8 rounded-2xl overflow-hidden">
        <button onClick={() => toggle("address")} className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/3 transition-colors">
          <EndpointTag method="POST" />
          <code className="text-xs text-white/80 flex-1">/api/merchant/address</code>
          <ChevronLeft className={`w-4 h-4 text-white/30 transition-transform ${open === "address" ? "-rotate-90" : "rotate-90"}`} />
        </button>
        {open === "address" && (
          <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
            <p className="text-[11px] text-white/50 leading-relaxed">
              Генерирует адрес для приёма оплаты. Режим указывается в каждом запросе через поле <strong className="text-white/70">payment_mode</strong>:<br/>
              <strong className="text-white/70">permanent</strong> — постоянный адрес на пользователя, вебхук на каждый входящий платёж.<br/>
              <strong className="text-white/70">temporary</strong> — временный адрес на заказ (30 мин), накопление до нужной суммы.<br/>
              <strong className="text-white/70">invoice</strong> — ссылка /pay/... для покупателя, сеть выбирается им.
            </p>

            <div>
              <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">Заголовки</div>
              <CodeBlock>{`x-shop-key: ${key}\nContent-Type: application/json`}</CodeBlock>
            </div>

            <div>
              <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">Тело запроса (permanent)</div>
              <CodeBlock>{`{
  "payment_mode": "permanent",   // "permanent" | "temporary" | "invoice"
  "network":      "BSC",         // TRON, BSC, TON, ETH, POLYGON, SOLANA, ARBITRUM
  "mode":         "standard",    // опционально: "standard" | "gasfree" (TRON only)
  "user_id":      "user_123",    // ID пользователя — привязывает постоянный адрес
  "order_id":     "order_456",   // опционально
  "currency":     "USDT"         // опционально, по умолчанию USDT
}`}</CodeBlock>
            </div>

            <div>
              <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">Тело запроса (temporary)</div>
              <CodeBlock>{`{
  "payment_mode": "temporary",
  "network":      "TRON",
  "amount":       10.00,         // обязательно для temporary
  "order_id":     "order_456",
  "currency":     "USDT"
}`}</CodeBlock>
            </div>

            <div>
              <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">Ответ</div>
              <CodeBlock>{`{
  "address":       "TXxxx...yyy",
  "network":       "TRON",
  "wallet_mode":   "standard",
  "payment_mode":  "permanent",  // режим, применённый к этому платежу
  "currency":      "USDT",
  "payment_id":    42,
  "expires_at":    null,
  "monitor_until": "2025-01-15T10:20:00.000Z"  // только для permanent
}`}</CodeBlock>
            </div>

            <div className="bg-[#3ab368]/5 border border-[#3ab368]/15 rounded-xl p-3">
              <div className="text-[10px] text-[#3ab368] font-semibold mb-1">GasFree (TRON)</div>
              <p className="text-[10px] text-white/40 leading-relaxed">
                Режим GasFree позволяет клиенту платить без TRX на балансе. Передайте <code className="text-white/60">"mode": "gasfree"</code> — в ответе будет специальный GasFree-адрес.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Endpoint 2: payment status */}
      <div className="bg-[#0D1117] border border-white/8 rounded-2xl overflow-hidden">
        <button onClick={() => toggle("status")} className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/3 transition-colors">
          <EndpointTag method="GET" />
          <code className="text-xs text-white/80 flex-1">/api/merchant/payment/:id</code>
          <ChevronLeft className={`w-4 h-4 text-white/30 transition-transform ${open === "status" ? "-rotate-90" : "rotate-90"}`} />
        </button>
        {open === "status" && (
          <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
            <p className="text-[11px] text-white/50 leading-relaxed">
              Возвращает текущий статус платежа по <code className="text-white/70">payment_id</code>, полученному из <code className="text-white/70">/api/merchant/address</code>.
            </p>

            <div>
              <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">Пример запроса</div>
              <CodeBlock>{`GET /api/merchant/payment/42\nx-shop-key: ${key}`}</CodeBlock>
            </div>

            <div>
              <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">Ответ</div>
              <CodeBlock>{`{
  "status":          "confirmed",
  "payment_mode":    "temporary",        // "permanent" | "temporary" | "invoice"
  "tx_hash":         "abc123...",        // хэш последней транзакции
  "amount_received": "10.050000",        // фактически получено
  "amount":          "10.000000",        // требуемая сумма
  "confirmed_at":    "2025-01-15T10:00:00.000Z"
}`}</CodeBlock>
            </div>

            <div className="bg-white/3 rounded-xl p-3">
              <div className="text-[10px] text-white/40 leading-relaxed space-y-0.5">
                <div className="font-semibold text-white/60 mb-1.5">Все возможные статусы:</div>
                <div><span className="text-[#e9c46a] font-mono">pending</span> — ожидаем оплату</div>
                <div><span className="text-blue-400 font-mono">partially_paid</span> — часть суммы получена (temporary/invoice)</div>
                <div><span className="text-[#3ab368] font-mono">confirmed</span> — полностью оплачен</div>
                <div><span className="text-white/40 font-mono">closed</span> — окно мониторинга закрыто (permanent)</div>
                <div><span className="text-red-400 font-mono">expired</span> — время истекло (temporary/invoice)</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Endpoint 3: check payment */}
      <div className="bg-[#0D1117] border border-white/8 rounded-2xl overflow-hidden">
        <button onClick={() => toggle("check")} className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/3 transition-colors">
          <EndpointTag method="POST" />
          <code className="text-xs text-white/80 flex-1">/api/merchant/check-payment</code>
          <ChevronLeft className={`w-4 h-4 text-white/30 transition-transform ${open === "check" ? "-rotate-90" : "rotate-90"}`} />
        </button>
        {open === "check" && (
          <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
            <p className="text-[11px] text-white/50 leading-relaxed">
              Принудительно сканирует блокчейн для платежа прямо сейчас и возвращает актуальный статус. Используйте, если клиент утверждает, что оплатил, но статус не обновился. Для permanent-режима также возвращает количество новых транзакций.
            </p>

            <div>
              <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">Тело запроса</div>
              <CodeBlock>{`{
  "payment_id": 42   // ID платежа из /api/merchant/address
}`}</CodeBlock>
            </div>

            <div>
              <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">Ответ (temporary)</div>
              <CodeBlock>{`{
  "status":          "confirmed",   // актуальный статус после проверки
  "amount_received": "10.000000",
  "tx_hash":         "abc123..."
}`}</CodeBlock>
            </div>

            <div>
              <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">Ответ (permanent)</div>
              <CodeBlock>{`{
  "status":      "pending",
  "new_tx_count": 1   // кол-во новых транзакций, найденных при проверке
}`}</CodeBlock>
            </div>
          </div>
        )}
      </div>

      {/* Endpoint 3b: invoice status */}
      <div className="bg-[#0D1117] border border-white/8 rounded-2xl overflow-hidden">
        <button onClick={() => toggle("invoice")} className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/3 transition-colors">
          <EndpointTag method="GET" />
          <code className="text-xs text-white/80 flex-1">/api/merchant/invoice/:number</code>
          <ChevronLeft className={`w-4 h-4 text-white/30 transition-transform ${open === "invoice" ? "-rotate-90" : "rotate-90"}`} />
        </button>
        {open === "invoice" && (
          <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
            <p className="text-[11px] text-white/50 leading-relaxed">
              Публичный эндпоинт (без shop-key) для проверки статуса инвойса по его номеру. Инвойс создаётся через <code className="text-white/70">/api/merchant/address</code> с <code className="text-white/70">payment_mode: "invoice"</code> — покупатель сам выбирает сеть.
            </p>

            <div>
              <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">Создание инвойса</div>
              <CodeBlock>{`POST /api/merchant/address
x-shop-key: ${key}

{
  "payment_mode": "invoice",
  "amount":       10.00,
  "currency":     "USDT",
  "order_id":     "order_789",
  "user_id":      "user_123"
}`}</CodeBlock>
            </div>

            <div>
              <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">Ответ создания</div>
              <CodeBlock>{`{
  "payment_mode":   "invoice",
  "invoice_number": "INV-2025-00042",
  "invoice_url":    "https://mypay.casa/pay/INV-2025-00042",
  "payment_id":     42,
  "amount":         10.00,
  "currency":       "USDT",
  "expires_at":     "2025-01-15T11:00:00.000Z"
}`}</CodeBlock>
            </div>

            <div>
              <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">Проверка статуса инвойса (публичный)</div>
              <CodeBlock>{`GET /api/merchant/invoice/INV-2025-00042`}</CodeBlock>
            </div>

            <div>
              <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">Ответ статуса</div>
              <CodeBlock>{`{
  "status":          "confirmed",
  "invoice_number":  "INV-2025-00042",
  "amount":          10.00,
  "amount_received": 10.05,
  "network":         "TRON",
  "tx_hash":         "abc123..."
}`}</CodeBlock>
            </div>

            <div className="bg-[#3ab368]/5 border border-[#3ab368]/15 rounded-xl p-3">
              <p className="text-[10px] text-white/40 leading-relaxed">
                <strong className="text-[#3ab368]">UX-сценарий:</strong> выдайте покупателю ссылку <code className="text-white/60">invoice_url</code> — он откроет страницу оплаты, выберет нужную сеть и отправит. Вебхук <code className="text-white/60">payment.confirmed</code> придёт автоматически.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Endpoint 4: verify tx */}
      <div className="bg-[#0D1117] border border-white/8 rounded-2xl overflow-hidden">
        <button onClick={() => toggle("verify")} className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/3 transition-colors">
          <EndpointTag method="POST" />
          <code className="text-xs text-white/80 flex-1">/api/merchant/verify-tx</code>
          <ChevronLeft className={`w-4 h-4 text-white/30 transition-transform ${open === "verify" ? "-rotate-90" : "rotate-90"}`} />
        </button>
        {open === "verify" && (
          <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
            <p className="text-[11px] text-white/50 leading-relaxed">
              Верифицирует конкретный TX-хэш транзакции в блокчейне и вручную подтверждает платёж. Полезно, если клиент прислал хэш транзакции.
            </p>

            <div>
              <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">Тело запроса</div>
              <CodeBlock>{`{
  "payment_id": 42,
  "tx_hash":    "abc123def456..."   // хэш транзакции в блокчейне
}`}</CodeBlock>
            </div>

            <div>
              <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">Ответ (успех)</div>
              <CodeBlock>{`{
  "confirmed":       true,
  "amount_received": "10.000000"
}`}</CodeBlock>
            </div>

            <div>
              <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">Ответ (не найдено)</div>
              <CodeBlock>{`{
  "confirmed": false,
  "message":   "Transaction not confirmed on chain"
}`}</CodeBlock>
            </div>
          </div>
        )}
      </div>

      {/* Networks reference */}
      <div className="bg-[#0D1117] border border-white/8 rounded-2xl overflow-hidden">
        <button onClick={() => toggle("networks")} className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/3 transition-colors">
          <div className="w-14 flex-shrink-0">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md font-mono bg-white/10 text-white/50">INFO</span>
          </div>
          <code className="text-xs text-white/80 flex-1">Доступные сети и параметры</code>
          <ChevronLeft className={`w-4 h-4 text-white/30 transition-transform ${open === "networks" ? "-rotate-90" : "rotate-90"}`} />
        </button>
        {open === "networks" && (
          <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
            <div>
              <div className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Значения поля network</div>
              <div className="space-y-1.5">
                {[
                  ["TRON",     "TRC20",     "USDT",       "standard / gasfree"],
                  ["BSC",      "BEP20",     "USDT",       "standard"],
                  ["TON",      "Jetton",    "USDT",       "standard"],
                  ["ETH",      "ERC20",     "USDT",       "standard"],
                  ["POLYGON",  "ERC20",     "USDT",       "standard"],
                  ["SOLANA",   "SPL",       "USDT",       "standard"],
                  ["ARBITRUM", "ERC20",     "USDT",       "standard"],
                ].map(([net, std, cur, modes]) => (
                  <div key={net} className="flex items-center gap-2 bg-[#080A0E] rounded-lg px-3 py-2">
                    <code className="text-[#3ab368] text-[10px] font-mono w-20 flex-shrink-0">{net}</code>
                    <span className="text-[10px] text-white/30 w-12">{std}</span>
                    <span className="text-[10px] text-white/50 flex-1">{cur}</span>
                    <span className="text-[9px] text-white/20">{modes}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Пример: TRON GasFree</div>
              <CodeBlock>{`POST /api/merchant/address
{
  "payment_mode": "permanent",  // обязательно указывать в каждом запросе
  "network":      "TRON",
  "mode":         "gasfree",    // transport mode: gasfree | standard
  "user_id":      "user_123"
}`}</CodeBlock>
            </div>
          </div>
        )}
      </div>

      {/* Webhook section */}
      <div className="bg-[#0D1117] border border-white/8 rounded-2xl overflow-hidden">
        <button onClick={() => toggle("webhook")} className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/3 transition-colors">
          <div className="w-14 flex-shrink-0">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md font-mono bg-white/10 text-white/50">INFO</span>
          </div>
          <code className="text-xs text-white/80 flex-1">Webhook-уведомления</code>
          <ChevronLeft className={`w-4 h-4 text-white/30 transition-transform ${open === "webhook" ? "-rotate-90" : "rotate-90"}`} />
        </button>
        {open === "webhook" && (
          <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
            <p className="text-[11px] text-white/50 leading-relaxed">
              Система отправляет POST-запрос на Webhook URL при каждом событии. Событие зависит от <strong className="text-white/70">payment_mode</strong>.
            </p>
            <div>
              <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">permanent — payment.received (любой входящий платёж)</div>
              <CodeBlock>{`{
  "event":           "payment.received",
  "payment_id":      42,
  "order_id":        "order_456",
  "external_user_id": "user_123",
  "amount":          10.00,
  "currency":        "USDT",
  "network":         "BSC",
  "tx_hash":         "0xabc123..."
}`}</CodeBlock>
            </div>
            <div>
              <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">temporary/invoice — payment.partial (накопление)</div>
              <CodeBlock>{`{
  "event":            "payment.partial",
  "payment_id":       42,
  "amount_required":  10.00,
  "amount_received":  6.00,
  "amount_remaining": 4.00,
  "currency":         "USDT",
  "network":          "TRON",
  "tx_hash":          "abc123..."
}`}</CodeBlock>
            </div>
            <div>
              <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">temporary/invoice — payment.confirmed (полная оплата)</div>
              <CodeBlock>{`{
  "event":           "payment.confirmed",
  "payment_id":      42,
  "order_id":        "order_456",
  "amount_required": 10.00,
  "amount_received": 10.05,
  "currency":        "USDT",
  "network":         "TRON",
  "tx_hash":         "abc123..."
}`}</CodeBlock>
            </div>
            <div className="bg-[#e9c46a]/5 border border-[#e9c46a]/15 rounded-xl p-3">
              <p className="text-[10px] text-white/40 leading-relaxed">
                <strong className="text-[#e9c46a]">Важно:</strong> Ваш сервер должен ответить кодом <code className="text-white/60">200 OK</code>. Настройте Webhook URL в разделе <strong className="text-white/60">Настройки</strong> магазина.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Quick example */}
      <div className="bg-[#0D1117] border border-white/8 rounded-2xl overflow-hidden">
        <button onClick={() => toggle("example")} className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/3 transition-colors">
          <div className="w-14 flex-shrink-0">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md font-mono bg-white/10 text-white/50">CODE</span>
          </div>
          <code className="text-xs text-white/80 flex-1">Пример на JavaScript</code>
          <ChevronLeft className={`w-4 h-4 text-white/30 transition-transform ${open === "example" ? "-rotate-90" : "rotate-90"}`} />
        </button>
        {open === "example" && (
          <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
            <CodeBlock>{`// 1. Получить адрес для оплаты
const res = await fetch('${baseUrl}/api/merchant/address', {
  method: 'POST',
  headers: {
    'x-shop-key': '${showKey ? apiKey : apiKey.slice(0, 8) + "..."}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    payment_mode: 'temporary',  // 'permanent' | 'temporary' | 'invoice'
    network:      'TRON',
    user_id:      String(userId),
    order_id:     String(orderId),
    amount:       9.99             // обязательно для temporary
  })
});
const { address, payment_id } = await res.json();

// 2. Показать адрес клиенту, затем проверять статус
const poll = setInterval(async () => {
  const s = await fetch(
    \`${baseUrl}/api/merchant/payment/\${payment_id}\`,
    { headers: { 'x-shop-key': '${showKey ? apiKey : apiKey.slice(0, 8) + "..."}' } }
  ).then(r => r.json());

  if (s.status === 'confirmed') {
    clearInterval(poll);
    console.log('Оплачено!', s.amount_received);
  }
}, 15000); // каждые 15 секунд`}</CodeBlock>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Shop card (list view) ─────────────────────────────────────────────────────

function ShopCard({ shop, onSelect }: { shop: Shop; onSelect: () => void }) {
  const nets = parseNetworks(shop.enabledNetworks);
  return (
    <button
      onClick={onSelect}
      className="w-full bg-[#13151A] border border-white/5 rounded-2xl p-4 text-left hover:border-[#3ab368]/20 transition-all"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-[#3ab368]/10 flex items-center justify-center flex-shrink-0">
          <Store className="w-5 h-5 text-[#3ab368]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white truncate">{shop.name}</span>
            <StatusBadge status={shop.status} />
          </div>
          <span className="text-xs text-white/40">{shop.domain}</span>
        </div>
        <ChevronLeft className="w-4 h-4 text-white/20 rotate-180" />
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-[#0E1014] rounded-xl p-3">
          <div className="text-[10px] text-white/40 mb-0.5">Баланс кошельков</div>
          <div className="text-sm font-bold text-white">{parseFloat(shop.walletBalanceSum ?? "0").toFixed(2)} <span className="text-white/40 text-xs">USDT</span></div>
        </div>
        <div className="bg-[#0E1014] rounded-xl p-3">
          <div className="text-[10px] text-white/40 mb-0.5">Получено</div>
          <div className="text-sm font-bold text-white">{parseFloat(shop.totalReceived).toFixed(2)} <span className="text-white/40 text-xs">USDT</span></div>
        </div>
      </div>
      {nets.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {nets.map(n => {
            const def = NET_BY_ID[n];
            if (!def) return null;
            return (
              <div key={n} className="flex items-center gap-1 bg-white/5 rounded-full px-2 py-0.5">
                <NetworkIcon iconFile={def.icon} size={14} />
                <span className="text-[10px] text-white/60">{def.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </button>
  );
}

// ── Shop detail view ──────────────────────────────────────────────────────────

type ShopTab = "overview" | "payments" | "payouts" | "wallets" | "settings";

function ShopDetail({ shop: initialShop, onBack }: { shop: Shop; onBack: () => void }) {
  const [tab, setTab] = useState<ShopTab>("overview");
  const [showKey, setShowKey] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: shopData } = useQuery<Shop>({
    queryKey: ["/api/business/shops", initialShop.id],
    queryFn: () => fetchBusiness(`/api/business/shops/${initialShop.id}`),
    refetchInterval: 30000,
  });
  // Merge: preserve walletBalanceSum from list data so detail-query refetch can't reset it to 0
  const shop: Shop = shopData
    ? { ...shopData, walletBalanceSum: shopData.walletBalanceSum ?? initialShop.walletBalanceSum }
    : initialShop;

  const { data: payments = [] } = useQuery<Payment[]>({
    queryKey: ["/api/business/payments", shop.id],
    queryFn: () => fetchBusiness(`/api/business/shops/${shop.id}/payments`),
    enabled: tab === "payments",
    refetchInterval: tab === "payments" ? 30000 : false,
  });

  const { data: payouts = [] } = useQuery<Payout[]>({
    queryKey: ["/api/business/payouts", shop.id],
    queryFn: () => fetchBusiness(`/api/business/shops/${shop.id}/payouts`),
    enabled: tab === "payouts",
  });

  const { data: wallets = [], refetch: refetchWallets } = useQuery<MerchantWallet[]>({
    queryKey: ["/api/business/wallets", shop.id],
    queryFn: () => fetchBusiness(`/api/business/shops/${shop.id}/wallets`),
    enabled: tab === "wallets" || tab === "payouts",
  });

  const regenKey = useMutation({
    mutationFn: () => apiRequest("POST", `/api/business/shops/${shop.id}/regenerate-key`).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/business/shops", shop.id] });
      qc.invalidateQueries({ queryKey: ["/api/business/shops"] });
      toast({ title: "API-ключ обновлён" });
    },
    onError: (e: any) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  const TABS: { id: ShopTab; label: string; color: string }[] = [
    { id: "overview",  label: "Обзор",     color: "#3b82f6" },
    { id: "payments",  label: "Платежи",   color: "#f59e0b" },
    { id: "payouts",   label: "Выплаты",   color: "#8b5cf6" },
    { id: "wallets",   label: "Кошельки",  color: "#3ab368" },
    { id: "settings",  label: "Настройки", color: "#64748b" },
  ];

  const enabledNets = parseNetworks(shop.enabledNetworks);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-3">
        <button onClick={onBack} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white truncate">{shop.name}</span>
            <StatusBadge status={shop.status} />
          </div>
          <span className="text-xs text-white/40">{shop.domain}</span>
        </div>
      </div>

      {shop.status === "pending" && (
        <div className="mx-4 mb-3 bg-[#e9c46a]/10 border border-[#e9c46a]/20 rounded-xl p-3 flex gap-2">
          <AlertCircle className="w-4 h-4 text-[#e9c46a] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-[#e9c46a]">Магазин ожидает проверки администратором. После одобрения вы получите доступ ко всем функциям.</p>
        </div>
      )}
      {shop.status === "rejected" && (
        <div className="mx-4 mb-3 bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex gap-2">
          <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-400">{shop.adminNote || "Магазин отклонён. Обратитесь в поддержку."}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="px-4 pb-3">
        <div className="bg-[#0E1014] rounded-2xl p-1 flex gap-0.5 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id} onClick={() => setTab(t.id)}
              className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-medium transition-all ${tab === t.id ? "text-white" : "text-white/40 hover:text-white/70"}`}
              style={tab === t.id ? { background: t.color, boxShadow: `0 0 10px ${t.color}40` } : undefined}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-3">

        {/* ── Overview ── */}
        {tab === "overview" && (
          <>
            {/* Stats — 2 cols mobile, 4 cols desktop */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Wallet balance */}
              <div
                className="relative bg-[#0D0F14] border border-white/8 rounded-2xl p-4 overflow-hidden group hover:border-white/15 transition-all"
                style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }}
              >
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center mb-3">
                  <Wallet className="w-4 h-4 text-white/50" />
                </div>
                <div className="text-[10px] text-white/35 uppercase tracking-widest mb-1.5">Баланс</div>
                <div className="text-2xl font-bold text-white tracking-tight">
                  {parseFloat(shop.walletBalanceSum ?? shop.balanceUsdt).toFixed(2)}
                </div>
                <div className="text-[11px] text-white/35 mt-0.5 font-medium">USDT</div>
              </div>

              {/* Total received */}
              <div
                className="relative bg-[#0D0F14] border border-[#3ab368]/15 rounded-2xl p-4 overflow-hidden group hover:border-[#3ab368]/30 transition-all"
                style={{ boxShadow: "inset 0 1px 0 rgba(58,179,104,0.08), 0 0 30px rgba(58,179,104,0.04)" }}
              >
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#3ab368]/40 to-transparent" />
                <div className="w-8 h-8 rounded-xl bg-[#3ab368]/10 flex items-center justify-center mb-3">
                  <TrendingUp className="w-4 h-4 text-[#3ab368]" />
                </div>
                <div className="text-[10px] text-white/35 uppercase tracking-widest mb-1.5">Получено</div>
                <div className="text-2xl font-bold text-[#3ab368] tracking-tight">
                  {parseFloat(shop.totalReceived).toFixed(2)}
                </div>
                <div className="text-[11px] text-[#3ab368]/60 mt-0.5 font-medium">USDT</div>
              </div>

              {/* Paid out */}
              <div
                className="relative bg-[#0D0F14] border border-white/8 rounded-2xl p-4 overflow-hidden hover:border-white/15 transition-all"
                style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }}
              >
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center mb-3">
                  <ArrowUpRight className="w-4 h-4 text-white/50" />
                </div>
                <div className="text-[10px] text-white/35 uppercase tracking-widest mb-1.5">Выведено</div>
                <div className="text-2xl font-bold text-white tracking-tight">
                  {parseFloat(shop.totalPaidOut).toFixed(2)}
                </div>
                <div className="text-[11px] text-white/35 mt-0.5 font-medium">USDT</div>
              </div>

              {/* Mode */}
              <div
                className="relative bg-[#0D0F14] border border-white/8 rounded-2xl p-4 overflow-hidden hover:border-white/15 transition-all"
                style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }}
              >
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center mb-3">
                  <Zap className="w-4 h-4 text-white/50" />
                </div>
                <div className="text-[10px] text-white/35 uppercase tracking-widest mb-1.5">Режим</div>
                <div className="text-sm font-bold text-white tracking-tight">Per-request</div>
                <div className="text-[10px] text-white/30 mt-0.5">payment_mode</div>
              </div>
            </div>

            {/* Networks + API Key — side by side on desktop */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {/* Networks */}
              {enabledNets.length > 0 ? (
                <div
                  className="relative bg-[#0D0F14] border border-white/8 rounded-2xl p-4 overflow-hidden"
                  style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }}
                >
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#3ab368]" />
                    <span className="text-[10px] text-white/40 uppercase tracking-widest font-semibold">Активные сети</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {enabledNets.map(n => {
                      const def = NET_BY_ID[n];
                      if (!def) return null;
                      return (
                        <div
                          key={n}
                          className="flex items-center gap-2 rounded-xl px-3 py-2 border border-[#3ab368]/20 bg-[#3ab368]/8 hover:bg-[#3ab368]/12 transition-colors"
                        >
                          <NetworkIcon iconFile={def.icon} size={18} />
                          <div>
                            <div className="text-xs font-semibold text-white leading-none">{def.label}</div>
                            {def.badge && <div className="text-[9px] text-[#3ab368] leading-none mt-0.5 font-medium">{def.badge}</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div
                  className="relative bg-[#0D0F14] border border-dashed border-white/8 rounded-2xl p-4 flex items-center justify-center"
                >
                  <div className="text-center">
                    <Network className="w-6 h-6 text-white/20 mx-auto mb-2" />
                    <p className="text-xs text-white/30">Нет активных сетей</p>
                    <p className="text-[10px] text-white/20 mt-0.5">Включите сети в настройках</p>
                  </div>
                </div>
              )}

              {/* API Key */}
              <div
                className="relative bg-[#0D0F14] border border-white/8 rounded-2xl p-4 overflow-hidden"
                style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }}
              >
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
                    <span className="text-[10px] text-white/40 uppercase tracking-widest font-semibold">API-ключ</span>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => setShowKey(v => !v)} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                      {showKey ? <EyeOff className="w-3.5 h-3.5 text-white/40" /> : <Eye className="w-3.5 h-3.5 text-white/40" />}
                    </button>
                    <CopyButton text={shop.apiKey} />
                    <button
                      onClick={() => regenKey.mutate()}
                      disabled={regenKey.isPending}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                      title="Перегенерировать"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-white/40 ${regenKey.isPending ? "animate-spin" : ""}`} />
                    </button>
                  </div>
                </div>
                <div className="font-mono text-xs text-white/70 bg-black/30 border border-white/5 rounded-xl px-3 py-2.5 break-all leading-relaxed">
                  {showKey ? shop.apiKey : "•".repeat(32)}
                </div>
                <p className="text-[10px] text-white/25 mt-2.5 leading-relaxed">
                  Используйте в заголовке <code className="text-white/40 bg-white/5 px-1 rounded">x-shop-key</code> при запросах к API
                </p>
              </div>
            </div>

            {/* API Docs */}
            <ApiDocs apiKey={shop.apiKey} showKey={showKey} />
          </>
        )}

        {/* ── Payments ── */}
        {tab === "payments" && (
          <PaymentsTab shop={shop} payments={payments} />
        )}

        {/* ── Payouts ── */}
        {tab === "payouts" && <PayoutsTab shop={shop} payouts={payouts} wallets={wallets} />}

        {/* ── Wallets ── */}
        {tab === "wallets" && <WalletsTab shop={shop} wallets={wallets} onRefresh={() => refetchWallets()} />}

        {/* ── Settings ── */}
        {tab === "settings" && <SettingsTab shop={shop} />}
      </div>
    </div>
  );
}

// ── Shared premium modal ──────────────────────────────────────────────────────

function PremiumModal({
  show, onClose, title, subtitle, Icon, children, maxWidth = "max-w-md",
}: {
  show: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  Icon?: React.ElementType;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const closingRef = useRef(false);

  useEffect(() => {
    if (!show || !backdropRef.current || !modalRef.current) return;
    closingRef.current = false;
    gsap.set(backdropRef.current, { autoAlpha: 0 });
    gsap.set(modalRef.current, { y: 60, scale: 0.94, autoAlpha: 0 });
    const tl = gsap.timeline();
    tl.to(backdropRef.current, { autoAlpha: 1, duration: 0.22, ease: "power2.out" })
      .to(modalRef.current, { y: 0, scale: 1, autoAlpha: 1, duration: 0.4, ease: "back.out(1.1)" }, "<0.05");
  }, [show]);

  const handleClose = useCallback(() => {
    if (closingRef.current || !backdropRef.current || !modalRef.current) { onClose(); return; }
    closingRef.current = true;
    const tl = gsap.timeline({ onComplete: onClose });
    tl.to(modalRef.current, { y: 30, scale: 0.95, autoAlpha: 0, duration: 0.24, ease: "power2.in" })
      .to(backdropRef.current, { autoAlpha: 0, duration: 0.18 }, "<0.06");
  }, [onClose]);

  if (!show) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div ref={backdropRef} className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={handleClose} />
      <div ref={modalRef} className={`relative z-10 w-full ${maxWidth} mx-4 mb-4 sm:mb-0`}>
        <div
          className="relative bg-[#0A0C10] border border-white/10 rounded-3xl p-6 overflow-hidden"
          style={{ boxShadow: "0 0 80px rgba(58,179,104,0.07), 0 25px 60px rgba(0,0,0,0.7)" }}
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-px bg-gradient-to-r from-transparent via-[#3ab368]/60 to-transparent" />
          <div className="absolute -top-20 -right-20 w-48 h-48 bg-[#3ab368]/5 rounded-full blur-3xl pointer-events-none" />
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              {Icon && (
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "linear-gradient(135deg, rgba(58,179,104,0.2), rgba(58,179,104,0.05))", border: "1px solid rgba(58,179,104,0.25)" }}
                >
                  <Icon className="w-5 h-5 text-[#3ab368]" />
                </div>
              )}
              <div>
                <h2 className="text-base font-bold text-white">{title}</h2>
                {subtitle && <p className="text-xs text-white/40 mt-0.5">{subtitle}</p>}
              </div>
            </div>
            <button onClick={handleClose} className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors flex-shrink-0">
              <X className="w-4 h-4 text-white/50" />
            </button>
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-white/8 to-transparent mb-5" />
          {children}
        </div>
      </div>
    </div>
  );
}

// ── Filter pills ──────────────────────────────────────────────────────────────

function FilterPills<T extends string>({
  options, value, onChange,
}: {
  options: { id: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
      {options.map(o => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
            value === o.id
              ? "bg-[#3ab368] text-white shadow-[0_0_12px_rgba(58,179,104,0.3)]"
              : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/70"
          }`}
        >
          {o.label}
          {o.count !== undefined && o.count > 0 && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
              value === o.id ? "bg-white/25 text-white" : "bg-white/10 text-white/50"
            }`}>
              {o.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ── Premium card wrapper ───────────────────────────────────────────────────────

function PremiumCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`relative bg-[#0D0F14] border border-white/8 rounded-2xl p-4 overflow-hidden hover:border-white/14 transition-all ${className}`}
      style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }}
    >
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />
      {children}
    </div>
  );
}

// ── Payments tab ──────────────────────────────────────────────────────────────

function PaymentsTab({ shop, payments }: { shop: Shop; payments: Payment[] }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [checking, setChecking] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "confirmed" | "expired" | "failed">("all");

  const checkPayment = async (paymentId: number) => {
    setChecking(paymentId);
    try {
      const res = await fetch("/api/merchant/check-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-shop-key": shop.apiKey },
        body: JSON.stringify({ payment_id: paymentId }),
      });
      const data = await res.json();
      if (data.status === "confirmed") {
        toast({ title: "Платёж подтверждён ✓", description: `#${paymentId} успешно зачислен` });
        qc.invalidateQueries({ queryKey: ["/api/business/payments", shop.id] });
      } else {
        toast({ title: "Пока не поступил", description: data.message ?? "Транзакция ещё не найдена в блокчейне" });
      }
    } catch {
      toast({ title: "Ошибка проверки", variant: "destructive" });
    } finally {
      setChecking(null);
    }
  };

  const filtered = filter === "all" ? payments : payments.filter(p => p.status === filter);
  const counts = {
    pending: payments.filter(p => p.status === "pending").length,
    confirmed: payments.filter(p => p.status === "confirmed").length,
    expired: payments.filter(p => p.status === "expired").length,
    failed: payments.filter(p => p.status === "failed").length,
  };

  return (
    <div className="space-y-3">
      {/* Filter pills */}
      <FilterPills
        options={[
          { id: "all" as const, label: "Все", count: payments.length },
          { id: "pending" as const, label: "Ожидание", count: counts.pending },
          { id: "confirmed" as const, label: "Подтверждено", count: counts.confirmed },
          { id: "expired" as const, label: "Истекло", count: counts.expired },
          { id: "failed" as const, label: "Ошибка", count: counts.failed },
        ]}
        value={filter}
        onChange={setFilter}
      />

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-white/30">
          <ArrowDownLeft className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm">{filter === "all" ? "Платежей пока нет" : "Нет платежей в этой категории"}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map(p => (
            <PremiumCard key={p.id}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-white/50 font-mono">#{p.id}</span>
                    <StatusBadge status={p.status} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-white/35 font-medium">{p.network}</span>
                    <span className="text-white/20">·</span>
                    <span className="text-[10px] text-white/35">{p.currency}</span>
                    {p.paymentMode && (
                      <>
                        <span className="text-white/20">·</span>
                        <span className="text-[9px] text-white/25">{p.paymentMode}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-base font-bold text-[#3ab368]">
                    {p.amountReceived ? parseFloat(p.amountReceived).toFixed(4) : (p.amount ? parseFloat(p.amount).toFixed(4) : "—")}
                  </div>
                  <div className="text-[10px] text-white/30 mt-0.5">{formatDate(p.createdAt)}</div>
                </div>
              </div>

              {p.status === "pending" && p.paymentMode !== "permanent" && (
                <div className="flex items-center justify-between mb-2 bg-white/3 rounded-xl px-2.5 py-1.5">
                  <PaymentTimer expiresAt={p.expiresAt ?? null} />
                  <button
                    onClick={() => checkPayment(p.id)}
                    disabled={checking === p.id}
                    className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-[#3ab368]/15 text-[#3ab368] hover:bg-[#3ab368]/25 transition-colors disabled:opacity-50"
                  >
                    {checking === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    Проверить
                  </button>
                </div>
              )}
              {p.status === "pending" && p.paymentMode === "permanent" && (
                <div className="flex items-center gap-1.5 text-[10px] text-white/25 mb-2 bg-white/3 rounded-xl px-2.5 py-1.5">
                  <Clock className="w-3 h-3 flex-shrink-0" />
                  <span>постоянный адрес · фиксирует входящие</span>
                </div>
              )}

              {p.walletAddress && (
                <div className="text-[10px] text-white/30 font-mono bg-black/30 border border-white/5 rounded-lg px-2.5 py-1.5 flex justify-between items-center">
                  <span className="truncate">{truncate(p.walletAddress, 20)}</span>
                  <CopyButton text={p.walletAddress} />
                </div>
              )}
              {p.txHash && (
                <div className="text-[10px] text-[#3ab368]/60 font-mono mt-1.5 truncate flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
                  {truncate(p.txHash, 24)}
                </div>
              )}
              {p.confirmedAt && (
                <div className="text-[10px] text-white/30 mt-1">✓ {formatDate(p.confirmedAt)}</div>
              )}
              {(p.externalUserId || p.orderId) && (
                <div className="text-[9px] text-white/20 mt-1.5 flex gap-2">
                  {p.externalUserId && <span>uid: {p.externalUserId}</span>}
                  {p.orderId && <span>order: {p.orderId}</span>}
                </div>
              )}
            </PremiumCard>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Wallet card with balance refresh ─────────────────────────────────────────

function WalletCard({ wallet: w, shopId, onRefresh }: { wallet: MerchantWallet; shopId: number; onRefresh: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [checking, setChecking] = useState(false);
  const [monitoring, setMonitoring] = useState(false);
  const [excluding, setExcluding] = useState(false);
  const def = NETWORKS.find(n => n.apiNode === w.network && n.apiMode === w.mode) ?? NETWORKS.find(n => n.apiNode === w.network);

  const startMonitoring = async () => {
    setMonitoring(true);
    try {
      const r = await fetch(`/api/business/shops/${shopId}/wallets/${w.id}/start-monitoring`, {
        method: "POST",
        headers: { "x-api-key": userApiKey() },
      });
      const data = await r.json();
      if (r.ok) {
        toast({ title: `Мониторинг запущен на ${data.minutes} мин` });
        qc.invalidateQueries({ queryKey: ["/api/business/wallets", shopId] });
        onRefresh();
      } else {
        toast({ title: "Ошибка", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Ошибка мониторинга", variant: "destructive" });
    } finally {
      setMonitoring(false);
    }
  };

  const checkBalance = async () => {
    setChecking(true);
    try {
      const r = await fetch(`/api/business/shops/${shopId}/wallets/${w.id}/check-balance`, {
        method: "POST",
        headers: { "x-api-key": userApiKey() },
      });
      const data = await r.json();
      if (r.ok) {
        toast({ title: `Баланс: ${parseFloat(data.balance_usdt).toFixed(4)} USDT` });
        onRefresh();
      } else {
        toast({ title: "Не удалось проверить", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Ошибка проверки баланса", variant: "destructive" });
    } finally {
      setChecking(false);
    }
  };

  const excludeWallet = async () => {
    if (!confirm(`Исключить кошелёк #${w.id} из пула?${w.status === "permanent" ? "\n\nКошелёк будет отвязан от пользователя." : ""}`)) return;
    setExcluding(true);
    try {
      const r = await fetch(`/api/business/shops/${shopId}/wallets/${w.id}/exclude`, {
        method: "POST",
        headers: { "x-api-key": userApiKey() },
      });
      const data = await r.json();
      if (r.ok) {
        toast({ title: "Кошелёк исключён из пула" });
        qc.invalidateQueries({ queryKey: ["/api/business/wallets", shopId] });
        onRefresh();
      } else {
        toast({ title: "Ошибка", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Ошибка исключения", variant: "destructive" });
    } finally {
      setExcluding(false);
    }
  };

  return (
    <div className="bg-[#13151A] border border-white/5 rounded-2xl p-3.5">
      <div className="flex items-start gap-3">
        {def && <NetworkIcon iconFile={def.icon} size={32} />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-white">{def?.label ?? w.network}</span>
            {w.mode === "gasfree" && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#3ab368]/20 text-[#3ab368]">GasFree</span>}
            <StatusBadge status={walletStatus(w)} />
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-white/40 font-mono">
            <span>{truncate(w.address, 22)}</span>
            <CopyButton text={w.address} />
          </div>
          {w.gasfreeAddress && (
            <div className="text-[9px] text-white/30 font-mono mt-0.5">GF: {truncate(w.gasfreeAddress, 22)}</div>
          )}
          {(w.externalUserId || w.orderId) && (
            <div className="text-[10px] text-white/30 mt-1">
              {w.externalUserId && <span>user: <span className="text-white/50">{w.externalUserId}</span></span>}
              {w.orderId && <span className="ml-2">order: <span className="text-white/50">{w.orderId}</span></span>}
            </div>
          )}
          {w.reservedUntil && w.status === "reserved" && (
            <div className="mt-0.5">
              <WalletCountdown reservedUntil={w.reservedUntil} onExpired={onRefresh} mode="reserved" />
            </div>
          )}
          {w.monitoringUntil && new Date(w.monitoringUntil) > new Date() && (
            <div className="mt-0.5">
              <WalletCountdown reservedUntil={w.monitoringUntil} onExpired={onRefresh} mode="monitoring" />
            </div>
          )}
          {/* Invoice reservation timer */}
          {w.invoiceReservedUntil && new Date(w.invoiceReservedUntil) > new Date() && (
            <div className="mt-1.5 flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2 py-1.5">
              <div className="flex items-center gap-1 flex-1 min-w-0">
                <span className="text-[9px] text-amber-400/60 uppercase tracking-wide font-semibold shrink-0">Инвойс</span>
                <span className="text-[10px] text-white/50 font-mono truncate">{w.invoiceNumber}</span>
              </div>
              <div className="shrink-0">
                <WalletCountdown reservedUntil={w.invoiceReservedUntil} onExpired={onRefresh} mode="invoice" />
              </div>
            </div>
          )}
          {/* Balance row */}
          <div className="mt-2 pt-2 border-t border-white/5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Activity className="w-3 h-3 text-white/20" />
                {w.balanceUsdt !== null && w.balanceUsdt !== undefined ? (
                  <span className="text-[10px] text-[#3ab368] font-mono">{parseFloat(w.balanceUsdt).toFixed(4)} USDT</span>
                ) : (
                  <span className="text-[10px] text-white/20">Баланс не проверен</span>
                )}
                {w.balanceUpdatedAt && (
                  <span className="text-[9px] text-white/20 ml-1">{formatDate(w.balanceUpdatedAt)}</span>
                )}
              </div>
              {w.status !== "excluded" && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={startMonitoring}
                    disabled={monitoring}
                    className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-[#3ab368]/10 text-[#3ab368] hover:bg-[#3ab368]/20 transition-colors disabled:opacity-50"
                  >
                    {monitoring ? <Loader2 className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
                    Мониторинг
                  </button>
                  <button
                    onClick={checkBalance}
                    disabled={checking}
                    className="flex items-center gap-1 text-[10px] text-white/30 hover:text-[#3ab368] transition-colors"
                  >
                    {checking ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    Проверить
                  </button>
                </div>
              )}
            </div>
            {(w.status === "active" || w.status === "permanent") && (
              <button
                onClick={excludeWallet}
                disabled={excluding}
                className="w-full flex items-center justify-center gap-1.5 text-[10px] py-1.5 rounded-lg bg-white/4 border border-white/6 text-white/30 hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400 transition-all disabled:opacity-50"
              >
                {excluding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Ban className="w-3 h-3" />}
                Исключить кошелёк
              </button>
            )}
          </div>
        </div>
        <div className="text-[10px] text-white/20 flex-shrink-0">#{w.id}</div>
      </div>
    </div>
  );
}

// ── Wallets tab ───────────────────────────────────────────────────────────────

function WalletsTab({ shop, wallets, onRefresh }: { shop: Shop; wallets: MerchantWallet[]; onRefresh: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [genNetwork, setGenNetwork] = useState("");
  const [genMode, setGenMode] = useState("standard");
  const [showModal, setShowModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "reserved" | "permanent" | "excluded">("all");
  const [filterNet, setFilterNet] = useState<string>("all");
  const enabledNets = parseNetworks(shop.enabledNetworks);

  const generate = useMutation({
    mutationFn: () => apiRequest("POST", `/api/business/shops/${shop.id}/wallets/generate`, {
      network: genNetwork, mode: genMode
    }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/business/wallets", shop.id] });
      toast({ title: "Кошелёк добавлен в пул" });
      setShowModal(false);
      setGenNetwork(""); setGenMode("standard");
    },
    onError: (e: any) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  const activeNets = NETWORKS.filter(n => n.selectable && enabledNets.includes(n.id));
  const uniqueNetworks = [...new Set(wallets.map(w => w.network))];

  const filtered = wallets.filter(w => {
    const st = walletStatus(w);
    if (filterStatus !== "all" && st !== filterStatus) return false;
    if (filterNet !== "all" && w.network !== filterNet) return false;
    return true;
  });

  const statusCounts = {
    active: wallets.filter(w => walletStatus(w) === "active").length,
    reserved: wallets.filter(w => walletStatus(w) === "reserved").length,
    permanent: wallets.filter(w => walletStatus(w) === "permanent").length,
    excluded: wallets.filter(w => walletStatus(w) === "excluded").length,
  };

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {shop.status === "active" && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-xs font-semibold transition-all hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #8b5cf6, #7c3aed)", boxShadow: "0 0 12px rgba(139,92,246,0.3)" }}
            >
              <Plus className="w-3.5 h-3.5" />
              Добавить кошелёк
            </button>
          )}
          <span className="text-xs text-white/30">Всего: {wallets.length}</span>
        </div>
        <button onClick={onRefresh} className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
          <RefreshCw className="w-3.5 h-3.5 text-white/40" />
        </button>
      </div>

      {/* Status filter */}
      <FilterPills
        options={[
          { id: "all" as const, label: "Все", count: wallets.length },
          { id: "active" as const, label: "Свободные", count: statusCounts.active },
          { id: "reserved" as const, label: "Зарезервированные", count: statusCounts.reserved },
          { id: "permanent" as const, label: "Постоянные", count: statusCounts.permanent },
          { id: "excluded" as const, label: "Исключённые", count: statusCounts.excluded },
        ]}
        value={filterStatus}
        onChange={setFilterStatus}
      />

      {/* Network filter */}
      {uniqueNetworks.length > 1 && (
        <FilterPills
          options={[
            { id: "all", label: "Все сети" },
            ...uniqueNetworks.map(n => {
              const def = NETWORKS.find(nd => nd.apiNode === n);
              return { id: n, label: def?.label ?? n };
            }),
          ]}
          value={filterNet}
          onChange={setFilterNet}
        />
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-white/30">
          <Wallet className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm">{wallets.length === 0 ? "Кошельков нет" : "Нет кошельков по фильтру"}</p>
          {wallets.length === 0 && <p className="text-xs mt-1 text-center">Добавьте кошельки в пул для приёма платежей</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-2">
          {filtered.map(w => (
            <WalletCard key={w.id} wallet={w} shopId={shop.id} onRefresh={onRefresh} />
          ))}
        </div>
      )}

      {/* Generate wallet modal */}
      <PremiumModal
        show={showModal}
        onClose={() => setShowModal(false)}
        title="Добавить кошелёк"
        subtitle="Генерация нового кошелька в пул"
        Icon={Wallet}
      >
        {enabledNets.length === 0 ? (
          <div className="flex items-start gap-2 bg-[#e9c46a]/8 border border-[#e9c46a]/20 rounded-xl p-3">
            <AlertCircle className="w-4 h-4 text-[#e9c46a] flex-shrink-0 mt-0.5" />
            <p className="text-xs text-[#e9c46a]/80 leading-relaxed">Сначала выберите активные сети в Настройках магазина.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-white/40 mb-2.5 block font-medium">Выберите сеть</label>
              <div className="grid grid-cols-2 gap-2">
                {activeNets.map(n => (
                  <button
                    key={n.id}
                    onClick={() => { setGenNetwork(n.apiNode!); setGenMode(n.apiMode!); }}
                    className={`relative flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                      genNetwork === n.apiNode && genMode === n.apiMode
                        ? "border-[#3ab368]/50 bg-[#3ab368]/8 shadow-[0_0_16px_rgba(58,179,104,0.08)]"
                        : "border-white/8 bg-white/2 hover:border-white/15 hover:bg-white/5"
                    }`}
                  >
                    {genNetwork === n.apiNode && genMode === n.apiMode && (
                      <div className="absolute top-2 right-2 w-3.5 h-3.5 rounded-full bg-[#3ab368] flex items-center justify-center">
                        <Check className="w-2 h-2 text-white" />
                      </div>
                    )}
                    <NetworkIcon iconFile={n.icon} size={26} />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate">{n.label}</div>
                      {n.badge && <div className="text-[9px] text-[#3ab368] font-medium mt-0.5">{n.badge}</div>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => generate.mutate()}
              disabled={!genNetwork || generate.isPending}
              className="relative w-full py-3.5 rounded-2xl font-semibold text-sm overflow-hidden disabled:opacity-40 transition-opacity"
              style={{ background: "linear-gradient(135deg, #3ab368, #2ea058)" }}
            >
              <span className="relative flex items-center justify-center gap-2 text-white">
                {generate.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Сгенерировать кошелёк
              </span>
            </button>
          </div>
        )}
      </PremiumModal>
    </div>
  );
}

// ── Payouts tab ───────────────────────────────────────────────────────────────

function PayoutsTab({ shop, payouts, wallets }: { shop: Shop; payouts: Payout[]; wallets: MerchantWallet[] }) {
  const [showModal, setShowModal] = useState(false);
  const [toAddress, setToAddress] = useState("");
  const [network, setNetwork] = useState("TRON");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [fromWalletId, setFromWalletId] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "processing" | "completed" | "cancelled">("all");
  const { toast } = useToast();
  const qc = useQueryClient();

  const createPayout = useMutation({
    mutationFn: () => apiRequest("POST", `/api/business/shops/${shop.id}/payouts`, {
      toAddress, network, currency: "USDT", amount: parseFloat(amount), note,
      ...(fromWalletId ? { fromWalletId } : {})
    }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/business/payouts", shop.id] });
      qc.invalidateQueries({ queryKey: ["/api/business/shops", shop.id] });
      toast({ title: "Заявка на выплату создана" });
      setShowModal(false);
      setToAddress(""); setAmount(""); setNote(""); setFromWalletId(null);
    },
    onError: (e: any) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  const updatePayout = useMutation({
    mutationFn: ({ payoutId, status, txHash }: { payoutId: number; status: string; txHash?: string }) =>
      apiRequest("PATCH", `/api/business/shops/${shop.id}/payouts/${payoutId}`, { status, txHash }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/business/payouts", shop.id] });
      qc.invalidateQueries({ queryKey: ["/api/business/shops", shop.id] });
      toast({ title: "Статус обновлён" });
    },
    onError: (e: any) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  const filtered = filter === "all" ? payouts : payouts.filter(p => p.status === filter);
  const counts = {
    pending: payouts.filter(p => p.status === "pending").length,
    processing: payouts.filter(p => p.status === "processing").length,
    completed: payouts.filter(p => p.status === "completed").length,
    cancelled: payouts.filter(p => p.status === "cancelled").length,
  };

  const inputCls = "w-full bg-[#0A0C10] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#3ab368]/50 transition-all";

  return (
    <div className="space-y-3">
      {/* Header row */}
      {shop.status === "active" && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#3ab368] text-white text-xs font-semibold hover:bg-[#2ea058] transition-colors"
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            Новая заявка
          </button>
          <span className="text-xs text-white/30">Всего: {payouts.length}</span>
        </div>
      )}

      {/* Filter pills */}
      <FilterPills
        options={[
          { id: "all" as const, label: "Все", count: payouts.length },
          { id: "pending" as const, label: "Ожидание", count: counts.pending },
          { id: "processing" as const, label: "В обработке", count: counts.processing },
          { id: "completed" as const, label: "Выполнено", count: counts.completed },
          { id: "cancelled" as const, label: "Отменено", count: counts.cancelled },
        ]}
        value={filter}
        onChange={setFilter}
      />

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-white/30">
          <ArrowUpRight className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm">{payouts.length === 0 ? "Заявок на выплату нет" : "Нет заявок в этой категории"}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map(p => (
            <PayoutCard key={p.id} payout={p} shopId={shop.id} wallets={wallets} onUpdate={(status, txHash) => updatePayout.mutate({ payoutId: p.id, status, txHash })} />
          ))}
        </div>
      )}

      {/* Create payout modal */}
      <PremiumModal
        show={showModal}
        onClose={() => setShowModal(false)}
        title="Новая заявка"
        subtitle={`Баланс: ${parseFloat(shop.balanceUsdt).toFixed(4)} USDT`}
        Icon={ArrowUpRight}
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs text-white/40 mb-1.5 block">Сеть</label>
            <select
              value={network}
              onChange={e => { setNetwork(e.target.value); setFromWalletId(null); }}
              className={inputCls}
              style={{ appearance: "none", backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' fill='none'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23ffffff40' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center" }}
            >
              <option value="TRON">TRON (TRC20)</option>
              <option value="BSC">BNB Chain (BEP20)</option>
              <option value="TON">TON</option>
              <option value="POLYGON">Polygon</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-white/40 mb-1.5 block">Адрес получателя</label>
            <input
              value={toAddress}
              onChange={e => setToAddress(e.target.value)}
              placeholder={network === "TRON" ? "T..." : network === "TON" ? "EQ..." : "0x..."}
              className={inputCls}
            />
          </div>

          <div>
            <label className="text-xs text-white/40 mb-1.5 block">Сумма USDT</label>
            <input
              value={amount}
              onChange={e => setAmount(e.target.value)}
              type="number"
              placeholder="0.00"
              className={inputCls}
            />
          </div>

          {wallets.filter(w => w.network === network).length > 0 && (
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Кошелёк-источник <span className="text-white/25">(необязательно)</span></label>
              <select
                value={fromWalletId ?? ""}
                onChange={e => setFromWalletId(e.target.value ? parseInt(e.target.value) : null)}
                className={inputCls}
                style={{ appearance: "none", backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' fill='none'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23ffffff40' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center" }}
              >
                <option value="">— Автоматически —</option>
                {wallets.filter(w => w.network === network).map(w => (
                  <option key={w.id} value={w.id}>
                    {truncate(w.address, 14)} · {parseFloat(w.balanceUsdt ?? "0").toFixed(4)} USDT
                  </option>
                ))}
              </select>
              {fromWalletId && (() => {
                const sel = wallets.find(w => w.id === fromWalletId);
                return sel ? (
                  <div className="mt-2 flex items-center justify-between bg-[#3ab368]/8 border border-[#3ab368]/20 rounded-xl px-3 py-2">
                    <span className="text-xs text-white/50">Баланс выбранного кошелька</span>
                    <span className="text-sm font-bold text-[#3ab368]">{parseFloat(sel.balanceUsdt ?? "0").toFixed(4)} USDT</span>
                  </div>
                ) : null;
              })()}
            </div>
          )}

          <div>
            <label className="text-xs text-white/40 mb-1.5 block">Комментарий <span className="text-white/25">(необязательно)</span></label>
            <input
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Вывод прибыли"
              className={inputCls}
            />
          </div>

          <button
            onClick={() => createPayout.mutate()}
            disabled={!toAddress || !amount || createPayout.isPending}
            className="relative w-full py-3.5 rounded-2xl font-semibold text-sm overflow-hidden disabled:opacity-40 transition-opacity"
            style={{ background: "linear-gradient(135deg, #3ab368, #2ea058)" }}
          >
            <span className="relative flex items-center justify-center gap-2 text-white">
              {createPayout.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpRight className="w-4 h-4" />}
              {fromWalletId ? "Перевести с кошелька" : "Создать заявку"}
            </span>
          </button>
        </div>
      </PremiumModal>
    </div>
  );
}

type GasInfo = {
  hasEnoughGas: boolean;
  currentGas: number;
  gasNeeded: number;
  gasCurrency: string;
  walletAddress: string;
  shortfall: number;
};

function PayoutCard({ payout, shopId, wallets, onUpdate }: {
  payout: Payout;
  shopId: number;
  wallets: MerchantWallet[];
  onUpdate: (status: string, txHash?: string) => void;
}) {
  const [txHash, setTxHash] = useState(payout.txHash ?? "");
  const [mode, setMode] = useState<null | "choose" | "manual" | "semiauto">(null);
  const [selectedWalletId, setSelectedWalletId] = useState("");
  const [gasInfo, setGasInfo] = useState<GasInfo | null>(null);
  const [gasChecking, setGasChecking] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();
  const isPending = payout.status === "pending" || payout.status === "processing";
  const compatibleWallets = wallets.filter(w => w.network === payout.network);

  // GSAP refs
  const singleBtnRef = useRef<HTMLButtonElement>(null);
  const splitRowRef = useRef<HTMLDivElement>(null);
  const manualBtnRef = useRef<HTMLButtonElement>(null);
  const semiBtnRef = useRef<HTMLButtonElement>(null);
  const animatingRef = useRef(false);
  const ctxRef = useRef<gsap.Context | null>(null);

  useEffect(() => {
    if (!isPending) return;
    ctxRef.current = gsap.context(() => {
      // Initial state: split row hidden, single btn visible
      gsap.set(splitRowRef.current, { autoAlpha: 0, scaleY: 0.8, transformOrigin: "top center", pointerEvents: "none" });
      gsap.set(manualBtnRef.current, { autoAlpha: 0, x: 12, scaleX: 0.7, transformOrigin: "left center" });
      gsap.set(semiBtnRef.current, { autoAlpha: 0, x: -12, scaleX: 0.7, transformOrigin: "right center" });
      gsap.set(singleBtnRef.current, { autoAlpha: 1, scale: 1 });
    });
    return () => { ctxRef.current?.revert(); };
  }, [isPending]);

  const expandToSplit = useCallback(() => {
    if (animatingRef.current) return;
    animatingRef.current = true;
    const tl = gsap.timeline({
      onComplete: () => {
        animatingRef.current = false;
        setMode("choose");
        gsap.set(splitRowRef.current, { pointerEvents: "auto" });
      }
    });
    tl.to(singleBtnRef.current, { autoAlpha: 0, scale: 0.88, y: -4, duration: 0.16, ease: "power2.in" })
      .set(singleBtnRef.current, { pointerEvents: "none" })
      .to(splitRowRef.current, { autoAlpha: 1, scaleY: 1, duration: 0.2, ease: "power2.out" }, "<0.04")
      .to([manualBtnRef.current, semiBtnRef.current], { autoAlpha: 1, x: 0, scaleX: 1, duration: 0.28, ease: "power3.out", stagger: 0.04 }, "<0.04");
  }, []);

  const collapseToSingle = useCallback(() => {
    if (animatingRef.current) return;
    animatingRef.current = true;
    gsap.set(splitRowRef.current, { pointerEvents: "none" });
    const tl = gsap.timeline({
      onComplete: () => {
        animatingRef.current = false;
        setMode(null);
        setSelectedWalletId("");
        setGasInfo(null);
        gsap.set(singleBtnRef.current, { pointerEvents: "auto" });
      }
    });
    tl.to([semiBtnRef.current, manualBtnRef.current], { autoAlpha: 0, x: (i) => i === 0 ? -10 : 10, scaleX: 0.7, duration: 0.18, ease: "power2.in", stagger: 0.03 })
      .to(splitRowRef.current, { autoAlpha: 0, scaleY: 0.85, duration: 0.16, ease: "power2.in" }, "<0.05")
      .to(singleBtnRef.current, { autoAlpha: 1, scale: 1, y: 0, duration: 0.22, ease: "back.out(1.4)" }, "<0.08");
  }, []);

  const checkGas = async (walletId: string) => {
    if (!walletId) { setGasInfo(null); return; }
    setGasChecking(true);
    setGasInfo(null);
    try {
      const r = await apiRequest("POST", `/api/business/shops/${shopId}/payouts/${payout.id}/check-gas`, { fromWalletId: parseInt(walletId) });
      const d = await r.json();
      if (d.error) toast({ title: "Ошибка проверки газа", description: d.error, variant: "destructive" });
      else setGasInfo(d as GasInfo);
    } catch (e: any) {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    } finally {
      setGasChecking(false);
    }
  };

  const executePayout = useMutation({
    mutationFn: () => apiRequest("POST", `/api/business/shops/${shopId}/payouts/${payout.id}/execute`, { fromWalletId: parseInt(selectedWalletId) }).then(r => r.json()),
    onSuccess: (d: any) => {
      if (d.error) { toast({ title: "Ошибка выплаты", description: d.error, variant: "destructive" }); return; }
      qc.invalidateQueries({ queryKey: ["/api/business/payouts", shopId] });
      qc.invalidateQueries({ queryKey: ["/api/business/shops", shopId] });
      toast({ title: "Выплата отправлена", description: `TX: ${d.txHash?.slice(0, 20)}…` });
      collapseToSingle();
    },
    onError: (e: any) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  const handleWalletChange = (v: string) => {
    setSelectedWalletId(v);
    checkGas(v);
  };

  const handleBack = () => {
    if (mode === "manual" || mode === "semiauto") {
      setMode("choose");
    } else {
      collapseToSingle();
    }
  };

  return (
    <div className="bg-[#13151A] border border-white/5 rounded-2xl p-4">
      {/* Header row */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-semibold text-white">#{payout.id}</span>
            <StatusBadge status={payout.status} />
            {payout.source === "api" ? (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 font-medium">API</span>
            ) : (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/40 font-medium">Ручная</span>
            )}
          </div>
          <div className="text-xs text-white/40">{payout.network} · {payout.currency}</div>
          {payout.reference && <div className="text-[10px] text-white/25 font-mono">{payout.reference}</div>}
        </div>
        <div className="text-right">
          <div className="text-sm font-bold text-white">{parseFloat(payout.amount).toFixed(4)}</div>
          <div className="text-[10px] text-white/30">{formatDate(payout.createdAt)}</div>
        </div>
      </div>

      {/* Address row */}
      <div className="text-[10px] text-white/30 font-mono bg-[#0E1014] rounded-lg px-2 py-1.5 flex justify-between items-center mb-2">
        <span>{truncate(payout.toAddress, 20)}</span>
        <CopyButton text={payout.toAddress} />
      </div>
      {payout.note && <div className="text-xs text-white/40 mb-2">{payout.note}</div>}

      {/* Process controls */}
      {isPending && (
        <div className="mt-3 space-y-3">
          {/* ── Animated chooser: single pill → two pills ── */}
          <div className="relative" style={{ minHeight: 38 }}>
            {/* Single "Обработать" pill */}
            <button
              ref={singleBtnRef}
              onClick={expandToSplit}
              className="absolute inset-0 flex items-center justify-center gap-1.5 w-full rounded-xl text-xs font-semibold text-white shadow-lg"
              style={{
                background: "linear-gradient(135deg, #3ab368 0%, #2a9951 60%, #1e7a40 100%)",
                boxShadow: "0 0 18px rgba(58,179,104,0.22), inset 0 1px 0 rgba(255,255,255,0.12)",
                border: "1px solid rgba(58,179,104,0.4)",
              }}
            >
              <Zap className="w-3 h-3 opacity-90" />
              Обработать
            </button>

            {/* Split row: two pills side by side */}
            <div ref={splitRowRef} className="flex gap-2 w-full" style={{ pointerEvents: "none" }}>
              <button
                ref={manualBtnRef}
                onClick={() => setMode("manual")}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-colors"
                style={{
                  background: "linear-gradient(135deg, #1a1e26 0%, #131720 100%)",
                  border: "1px solid rgba(255,255,255,0.13)",
                  color: "rgba(255,255,255,0.75)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
                }}
              >
                В ручную
              </button>
              <button
                ref={semiBtnRef}
                onClick={() => setMode("semiauto")}
                disabled={compatibleWallets.length === 0}
                title={compatibleWallets.length === 0 ? `Нет кошельков ${payout.network}` : ""}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                style={{
                  background: "linear-gradient(135deg, rgba(58,179,104,0.18) 0%, rgba(42,153,81,0.12) 100%)",
                  border: "1px solid rgba(58,179,104,0.35)",
                  color: "#4fd47a",
                  boxShadow: "inset 0 1px 0 rgba(58,179,104,0.1)",
                }}
              >
                Полуавтомат
              </button>
            </div>
          </div>

          {/* ── Manual mode panel ── */}
          {mode === "manual" && (
            <div className="space-y-2 pt-1">
              <button onClick={handleBack} className="text-[10px] text-white/40 hover:text-white/60 transition-colors">← Назад</button>
              <input
                value={txHash} onChange={e => setTxHash(e.target.value)}
                placeholder="TX Hash (необязательно)"
                className="w-full bg-[#0E1014] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/20 focus:outline-none font-mono"
              />
              <div className="flex gap-2">
                <button onClick={() => onUpdate("processing")} className="flex-1 py-2 rounded-xl bg-[#e9c46a]/20 text-[#e9c46a] text-xs font-medium">В обработке</button>
                <button onClick={() => onUpdate("completed", txHash || undefined)} className="flex-1 py-2 rounded-xl bg-[#3ab368]/20 text-[#3ab368] text-xs font-medium">Выполнено</button>
                <button onClick={() => onUpdate("cancelled")} className="flex-1 py-2 rounded-xl bg-red-500/20 text-red-400 text-xs font-medium">Отменить</button>
              </div>
            </div>
          )}

          {/* ── Semi-auto mode panel ── */}
          {mode === "semiauto" && (
            <div className="space-y-2.5 pt-1">
              <button onClick={handleBack} className="text-[10px] text-white/40 hover:text-white/60 transition-colors">← Назад</button>
              <div>
                <label className="text-[10px] text-white/40 mb-1 block">Кошелёк-источник ({payout.network})</label>
                <select
                  value={selectedWalletId}
                  onChange={e => handleWalletChange(e.target.value)}
                  className="w-full bg-[#0E1014] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none"
                >
                  <option value="">— Выбрать кошелёк —</option>
                  {compatibleWallets.map(w => {
                    const bal = parseFloat(w.balanceUsdt ?? "0").toFixed(4);
                    return (
                      <option key={w.id} value={w.id}>
                        {truncate(w.address, 16)} · {bal} USDT
                      </option>
                    );
                  })}
                </select>
              </div>

              {gasChecking && (
                <div className="flex items-center gap-2 text-xs text-white/40 py-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Проверяю баланс комиссии…
                </div>
              )}

              {gasInfo && !gasChecking && (
                <div className={`rounded-xl px-3 py-2.5 text-xs ${gasInfo.hasEnoughGas ? "bg-[#3ab368]/10 border border-[#3ab368]/20" : "bg-orange-500/10 border border-orange-500/20"}`}>
                  {gasInfo.hasEnoughGas ? (
                    <div className="flex items-center gap-2 text-[#3ab368]">
                      <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>Достаточно {gasInfo.gasCurrency} · баланс: {gasInfo.currentGas.toFixed(6)} {gasInfo.gasCurrency}</span>
                    </div>
                  ) : (
                    <div className="text-orange-400 space-y-1">
                      <div className="flex items-center gap-2 font-medium">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                        Недостаточно {gasInfo.gasCurrency} для комиссии
                      </div>
                      <div className="pl-5 leading-relaxed text-orange-400/80">
                        Текущий: {gasInfo.currentGas.toFixed(6)} {gasInfo.gasCurrency}<br />
                        Нужно минимум: {gasInfo.gasNeeded.toFixed(6)} {gasInfo.gasCurrency}<br />
                        Пополнить на: <span className="font-bold text-orange-300">{gasInfo.shortfall.toFixed(6)} {gasInfo.gasCurrency}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={() => executePayout.mutate()}
                disabled={!selectedWalletId || gasChecking || !gasInfo || !gasInfo.hasEnoughGas || executePayout.isPending}
                className="w-full py-2.5 rounded-xl text-white text-xs font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
                style={{
                  background: "linear-gradient(135deg, #3ab368 0%, #2a9951 100%)",
                  boxShadow: "0 0 16px rgba(58,179,104,0.2)",
                }}
              >
                {executePayout.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Выплатить {parseFloat(payout.amount).toFixed(4)} {payout.currency}
              </button>
            </div>
          )}
        </div>
      )}

      {payout.txHash && payout.status === "completed" && (
        <div className="text-[10px] text-[#3ab368]/70 font-mono mt-1 truncate">TX: {truncate(payout.txHash, 24)}</div>
      )}
    </div>
  );
}

// ── Settings tab ──────────────────────────────────────────────────────────────

function SettingsTab({ shop }: { shop: Shop }) {
  const [name, setName] = useState(shop.name);
  const [domain, setDomain] = useState(shop.domain);
  const [webhookUrl, setWebhookUrl] = useState(shop.webhookUrl ?? "");
  const [permanentMonitorMinutes, setPermanentMonitorMinutes] = useState<number>(shop.permanentMonitorMinutes ?? 20);
  const [temporaryMinutes, setTemporaryMinutes] = useState<number>(shop.temporaryMinutes ?? 30);
  const [invoiceMinutes, setInvoiceMinutes] = useState<number>(shop.invoiceMinutes ?? 60);
  const [selectedNets, setSelectedNets] = useState<string[]>(parseNetworks(shop.enabledNetworks));
  const { toast } = useToast();
  const qc = useQueryClient();

  const toggleNet = (id: string) => {
    setSelectedNets(prev =>
      prev.includes(id) ? prev.filter(n => n !== id) : [...prev, id]
    );
  };

  const save = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/business/shops/${shop.id}`, {
      name, domain, webhookUrl, permanentMonitorMinutes, temporaryMinutes, invoiceMinutes, enabledNetworks: selectedNets
    }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/business/shops", shop.id] });
      qc.invalidateQueries({ queryKey: ["/api/business/shops"] });
      toast({ title: "Настройки сохранены" });
    },
    onError: (e: any) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  const selectableNets = NETWORKS.filter(n => n.selectable);
  const disabledNets = NETWORKS.filter(n => !n.selectable);

  const inputCls = "w-full bg-[#0A0C10] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#3ab368]/50 focus:bg-[#0D1018] transition-all";

  return (
    <div className="space-y-4">

      {/* ── Desktop 2-column grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Left column — basic info + webhook */}
        <div className="space-y-4">
          {/* Basic info card */}
          <div
            className="relative bg-[#0D0F14] border border-white/8 rounded-2xl p-5 overflow-hidden"
            style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }}
          >
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center">
                <Building2 className="w-3.5 h-3.5 text-white/50" />
              </div>
              <span className="text-xs font-semibold text-white/60 uppercase tracking-widest">Основное</span>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Название магазина</label>
                <input value={name} onChange={e => setName(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Домен сайта</label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25 pointer-events-none" />
                  <input value={domain} onChange={e => setDomain(e.target.value)} className={`${inputCls} pl-9`} />
                </div>
              </div>
            </div>
          </div>

          {/* Webhook card */}
          <div
            className="relative bg-[#0D0F14] border border-white/8 rounded-2xl p-5 overflow-hidden"
            style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }}
          >
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-white/50" />
              </div>
              <span className="text-xs font-semibold text-white/60 uppercase tracking-widest">Webhook</span>
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">URL для уведомлений</label>
              <input
                value={webhookUrl}
                onChange={e => setWebhookUrl(e.target.value)}
                placeholder="https://yoursite.com/webhook"
                className={inputCls}
              />
            </div>
            <div className="mt-3 bg-[#3ab368]/5 border border-[#3ab368]/15 rounded-xl p-3">
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#3ab368] mt-1.5 flex-shrink-0" />
                <div>
                  <div className="text-[11px] font-semibold text-[#3ab368] mb-0.5">Режим — per-request</div>
                  <p className="text-[10px] text-white/40 leading-relaxed">
                    Режим (<code className="text-white/60 bg-white/5 px-0.5 rounded">payment_mode</code>) указывается в каждом запросе —
                    <span className="text-white/55"> permanent</span>, <span className="text-white/55">temporary</span> или <span className="text-white/55">invoice</span>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right column — timing + networks */}
        <div className="space-y-4">
          {/* Timing card */}
          <div
            className="relative bg-[#0D0F14] border border-white/8 rounded-2xl p-5 overflow-hidden"
            style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }}
          >
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center">
                <Timer className="w-3.5 h-3.5 text-white/50" />
              </div>
              <span className="text-xs font-semibold text-white/60 uppercase tracking-widest">Тайм-ауты (мин)</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Постоянный", hint: "Мониторинг", val: permanentMonitorMinutes, set: setPermanentMonitorMinutes, def: 20 },
                { label: "Временный", hint: "Резерв адреса", val: temporaryMinutes, set: setTemporaryMinutes, def: 30 },
                { label: "Инвойс", hint: "Резерв адреса", val: invoiceMinutes, set: setInvoiceMinutes, def: 60 },
              ].map(({ label, hint, val, set, def }) => (
                <div key={label}>
                  <label className="text-[10px] text-white/35 mb-1.5 block font-medium">{label}</label>
                  <input
                    type="number" min={1} max={1440}
                    value={val}
                    onChange={e => set(parseInt(e.target.value) || def)}
                    className="w-full bg-[#0A0C10] border border-white/8 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#3ab368]/50 transition-all text-center font-mono"
                  />
                  <div className="text-[9px] text-white/25 mt-1 text-center">{hint}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Networks card */}
          <div
            className="relative bg-[#0D0F14] border border-white/8 rounded-2xl p-5 overflow-hidden"
            style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }}
          >
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center">
                  <Network className="w-3.5 h-3.5 text-white/50" />
                </div>
                <span className="text-xs font-semibold text-white/60 uppercase tracking-widest">Сети</span>
              </div>
              <span className="text-xs font-semibold text-[#3ab368] bg-[#3ab368]/10 px-2.5 py-1 rounded-full">
                {selectedNets.length} активно
              </span>
            </div>

            {/* Selectable nets — 2 cols */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              {selectableNets.map(n => {
                const isOn = selectedNets.includes(n.id);
                return (
                  <button
                    key={n.id}
                    onClick={() => toggleNet(n.id)}
                    className={`relative flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                      isOn
                        ? "border-[#3ab368]/50 bg-[#3ab368]/8 shadow-[0_0_20px_rgba(58,179,104,0.06)]"
                        : "border-white/6 bg-[#0A0C10] hover:border-white/15 hover:bg-white/3"
                    }`}
                  >
                    <div className={`absolute top-2 right-2 w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                      isOn ? "bg-[#3ab368] border-[#3ab368]" : "border-white/15"
                    }`}>
                      {isOn && <Check className="w-2.5 h-2.5 text-white" />}
                    </div>
                    <NetworkIcon iconFile={n.icon} size={28} />
                    <div className="min-w-0 flex-1 pr-4">
                      <div className="text-xs font-semibold text-white leading-tight">{n.label}</div>
                      <div className="text-[9px] text-white/35 mt-0.5 leading-tight">{n.sub}</div>
                      {n.badge && (
                        <span className="inline-block mt-1 text-[8px] px-1.5 py-0.5 rounded-full bg-[#3ab368]/20 text-[#3ab368] font-medium">
                          {n.badge}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Coming soon */}
            {disabledNets.length > 0 && (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 h-px bg-white/5" />
                  <span className="text-[9px] text-white/20 uppercase tracking-widest">Скоро</span>
                  <div className="flex-1 h-px bg-white/5" />
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {disabledNets.map(n => (
                    <div
                      key={n.id}
                      className="flex flex-col items-center gap-1 p-2 rounded-xl border border-white/4 bg-[#0A0C10]/50 opacity-35"
                    >
                      <NetworkIcon iconFile={n.icon} size={20} />
                      <span className="text-[8px] text-white/40 text-center leading-tight">{n.label}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Save button — full width */}
      <button
        onClick={() => save.mutate()}
        disabled={save.isPending}
        className="relative w-full py-3.5 rounded-2xl font-semibold text-sm overflow-hidden group disabled:opacity-40 transition-opacity"
        style={{ background: "linear-gradient(135deg, #3ab368, #2ea058)" }}
      >
        <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors" />
        <span className="relative flex items-center justify-center gap-2 text-white">
          {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Сохранить настройки
        </span>
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function BusinessPage() {
  const [, setLocation] = useLocation();
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [showModal, setShowModal] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const { data: shops = [], isLoading } = useQuery<Shop[]>({
    queryKey: ["/api/business/shops"],
    queryFn: () => fetchBusiness("/api/business/shops"),
  });

  // Open animation
  useEffect(() => {
    if (!showModal || !backdropRef.current || !modalRef.current) return;
    gsap.set(backdropRef.current, { autoAlpha: 0 });
    gsap.set(modalRef.current, { y: 60, scale: 0.94, autoAlpha: 0 });
    const tl = gsap.timeline();
    tl.to(backdropRef.current, { autoAlpha: 1, duration: 0.22, ease: "power2.out" })
      .to(modalRef.current, { y: 0, scale: 1, autoAlpha: 1, duration: 0.4, ease: "back.out(1.1)" }, "<0.05");
  }, [showModal]);

  const closeModal = useCallback(() => {
    if (!backdropRef.current || !modalRef.current) { setShowModal(false); return; }
    const tl = gsap.timeline({ onComplete: () => setShowModal(false) });
    tl.to(modalRef.current, { y: 30, scale: 0.95, autoAlpha: 0, duration: 0.24, ease: "power2.in" })
      .to(backdropRef.current, { autoAlpha: 0, duration: 0.18 }, "<0.06");
  }, []);

  if (selectedShop) {
    const current = shops.find(s => s.id === selectedShop.id) ?? selectedShop;
    return (
      <div className="mobile-screen gradient-bg text-white flex flex-col">
        <ShopDetail shop={current} onBack={() => setSelectedShop(null)} />
      </div>
    );
  }

  return (
    <div className="mobile-screen gradient-bg text-white flex flex-col">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center gap-3">
        <button onClick={() => setLocation("/home")} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-white">Business</h1>
          <p className="text-xs text-white/40">Приём криптовалюты на вашем сайте</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#3ab368] text-white text-sm font-semibold hover:bg-[#2ea058] transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Подключить</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 pt-2">

        {/* Mobile connect button */}
        <div className="sm:hidden mb-3">
          <button
            onClick={() => setShowModal(true)}
            className="w-full py-4 rounded-2xl border border-dashed border-[#3ab368]/40 text-[#3ab368] font-medium flex items-center justify-center gap-2 hover:bg-[#3ab368]/5 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Подключить магазин
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 text-[#3ab368] animate-spin" />
          </div>
        ) : shops.length === 0 ? (
          <div className="space-y-3">
            <div className="flex flex-col items-center justify-center py-16 text-white/30">
              <Store className="w-12 h-12 mb-4 opacity-30" />
              <p className="text-sm font-medium mb-1">Нет подключённых магазинов</p>
              <p className="text-xs text-center">Добавьте первый магазин, чтобы начать принимать криптовалюту</p>
            </div>
            <div className="bg-[#0D1117] border border-white/5 rounded-2xl p-4 space-y-3">
              <p className="text-xs font-semibold text-white/60 uppercase tracking-wide">Как это работает</p>
              {[
                ["1", "Создайте магазин", "Укажите название и домен сайта"],
                ["2", "Пройдите проверку", "Администратор проверит сайт (до 24ч)"],
                ["3", "Выберите сети", "Настройте методы оплаты в настройках"],
                ["4", "Принимайте платежи", "Средства зачисляются на баланс магазина"],
              ].map(([n, title, desc]) => (
                <div key={n} className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#3ab368]/20 text-[#3ab368] text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{n}</div>
                  <div>
                    <div className="text-sm text-white">{title}</div>
                    <div className="text-xs text-white/40">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {shops.map(shop => (
              <ShopCard key={shop.id} shop={shop} onSelect={() => setSelectedShop(shop)} />
            ))}
          </div>
        )}
      </div>

      {/* Premium Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <div
            ref={backdropRef}
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            onClick={closeModal}
          />
          {/* Modal */}
          <div ref={modalRef} className="relative z-10 w-full max-w-md mx-4 mb-4 sm:mb-0">
            <div
              className="relative bg-[#0A0C10] border border-white/10 rounded-3xl p-6 overflow-hidden"
              style={{ boxShadow: "0 0 80px rgba(58,179,104,0.07), 0 25px 60px rgba(0,0,0,0.7)" }}
            >
              {/* Green glow top border */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-px bg-gradient-to-r from-transparent via-[#3ab368]/60 to-transparent" />
              {/* Subtle corner glow */}
              <div className="absolute -top-20 -right-20 w-48 h-48 bg-[#3ab368]/5 rounded-full blur-3xl pointer-events-none" />

              {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "linear-gradient(135deg, rgba(58,179,104,0.2), rgba(58,179,104,0.05))", border: "1px solid rgba(58,179,104,0.25)" }}
                  >
                    <Building2 className="w-5 h-5 text-[#3ab368]" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">Новый магазин</h2>
                    <p className="text-xs text-white/40 mt-0.5">Заполните данные для подключения</p>
                  </div>
                </div>
                <button
                  onClick={closeModal}
                  className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors flex-shrink-0"
                >
                  <X className="w-4 h-4 text-white/50" />
                </button>
              </div>

              {/* Divider */}
              <div className="h-px bg-gradient-to-r from-transparent via-white/8 to-transparent mb-6" />

              <CreateShopForm onSuccess={closeModal} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
