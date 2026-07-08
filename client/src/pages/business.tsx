import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft, Plus, Store, Copy, Check, RefreshCw, Settings,
  ArrowDownLeft, ArrowUpRight, Clock, CheckCircle2, XCircle,
  Eye, EyeOff, Loader2, AlertCircle, ExternalLink, Zap, Wallet, Timer,
  FileText, Activity
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
  status: string;
  balanceUsdt: string | null;
  balanceUpdatedAt: string | null;
  createdAt: string;
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

function PaymentTimer({ expiresAt, createdAt }: { expiresAt: string | null; createdAt: string }) {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const id = setInterval(() => forceUpdate(n => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  if (!expiresAt) {
    const elapsed = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
    const m = Math.floor(elapsed / 60);
    const s = elapsed % 60;
    return (
      <div className="flex items-center gap-1 text-[10px] text-white/30">
        <Clock className="w-3 h-3" />
        <span>Мониторинг {m}:{String(s).padStart(2, "0")} · постоянный</span>
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
              <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">Заголовки</div>
              <CodeBlock>{`x-shop-key: ${key}`}</CodeBlock>
            </div>

            <div>
              <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">Пример запроса</div>
              <CodeBlock>{`GET /api/merchant/payment/42`}</CodeBlock>
            </div>

            <div>
              <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">Ответ</div>
              <CodeBlock>{`{
  "status":          "confirmed",        // "pending" | "confirmed" | "expired"
  "tx_hash":         "abc123...",        // хэш транзакции (если подтверждён)
  "amount_received": "10.000000",        // полученная сумма
  "confirmed_at":    "2025-01-15T..."    // время подтверждения
}`}</CodeBlock>
            </div>

            <div className="bg-white/3 rounded-xl p-3">
              <div className="text-[10px] text-white/40 leading-relaxed">
                <strong className="text-white/60">Статусы:</strong><br />
                <span className="text-[#e9c46a]">pending</span> — ожидаем оплату<br />
                <span className="text-[#3ab368]">confirmed</span> — транзакция найдена и подтверждена<br />
                <span className="text-red-400">expired</span> — время истекло (только временный режим)
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
              Принудительно запускает проверку блокчейна для указанного платежа. Используйте, если клиент утверждает, что оплатил, но статус не обновился.
            </p>

            <div>
              <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">Тело запроса</div>
              <CodeBlock>{`{
  "payment_id": 42   // ID платежа из /api/merchant/address
}`}</CodeBlock>
            </div>

            <div>
              <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">Ответ</div>
              <CodeBlock>{`{
  "status":  "pending",
  "message": "Checking started"   // проверка запущена фоново
}`}</CodeBlock>
            </div>
            <p className="text-[10px] text-white/30 leading-relaxed">
              После вызова повторно запросите статус через <code className="text-white/50">GET /api/merchant/payment/:id</code> через 10–20 секунд.
            </p>
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
  "network":  "TRON",
  "mode":     "gasfree",
  "user_id":  "user_123"
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

  const TABS: { id: ShopTab; label: string }[] = [
    { id: "overview",  label: "Обзор" },
    { id: "payments",  label: "Платежи" },
    { id: "payouts",   label: "Выплаты" },
    { id: "wallets",   label: "Кошельки" },
    { id: "settings",  label: "Настройки" },
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
              className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${tab === t.id ? "bg-[#3ab368] text-white" : "text-white/40 hover:text-white/70"}`}
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
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#13151A] border border-white/5 rounded-2xl p-4">
                <div className="text-[10px] text-white/40 uppercase tracking-wide mb-1">Баланс кошельков</div>
                <div className="text-xl font-bold text-white">{parseFloat(shop.walletBalanceSum ?? shop.balanceUsdt).toFixed(4)}</div>
                <div className="text-xs text-white/40">USDT</div>
              </div>
              <div className="bg-[#13151A] border border-white/5 rounded-2xl p-4">
                <div className="text-[10px] text-white/40 uppercase tracking-wide mb-1">Всего получено</div>
                <div className="text-xl font-bold text-[#3ab368]">{parseFloat(shop.totalReceived).toFixed(4)}</div>
                <div className="text-xs text-white/40">USDT</div>
              </div>
              <div className="bg-[#13151A] border border-white/5 rounded-2xl p-4">
                <div className="text-[10px] text-white/40 uppercase tracking-wide mb-1">Выведено</div>
                <div className="text-xl font-bold text-white">{parseFloat(shop.totalPaidOut).toFixed(4)}</div>
                <div className="text-xs text-white/40">USDT</div>
              </div>
              <div className="bg-[#13151A] border border-white/5 rounded-2xl p-4">
                <div className="text-[10px] text-white/40 uppercase tracking-wide mb-1">Режим</div>
                <div className="text-sm font-bold text-white">Per-request</div>
                <div className="text-xs text-white/40">payment_mode в запросе</div>
              </div>
            </div>

            {/* Enabled networks */}
            {enabledNets.length > 0 && (
              <div className="bg-[#13151A] border border-white/5 rounded-2xl p-4">
                <div className="text-[10px] text-white/40 uppercase tracking-wide mb-3">Активные сети</div>
                <div className="flex flex-wrap gap-2">
                  {enabledNets.map(n => {
                    const def = NET_BY_ID[n];
                    if (!def) return null;
                    return (
                      <div key={n} className="flex items-center gap-2 bg-[#3ab368]/10 border border-[#3ab368]/20 rounded-xl px-3 py-2">
                        <NetworkIcon iconFile={def.icon} size={18} />
                        <div>
                          <div className="text-xs font-medium text-white leading-none">{def.label}</div>
                          {def.badge && <div className="text-[9px] text-[#3ab368] leading-none mt-0.5">{def.badge}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* API Key */}
            <div className="bg-[#13151A] border border-white/5 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-white/40 uppercase tracking-wide">API-ключ магазина</span>
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
              <div className="font-mono text-xs text-white/70 bg-[#0E1014] rounded-xl px-3 py-2.5 break-all">
                {showKey ? shop.apiKey : "•".repeat(32)}
              </div>
              <p className="text-[10px] text-white/30 mt-2">Используйте этот ключ в заголовке <code className="text-white/50">x-shop-key</code> при запросах к API</p>
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

// ── Payments tab ──────────────────────────────────────────────────────────────

function PaymentsTab({ shop, payments }: { shop: Shop; payments: Payment[] }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [checking, setChecking] = useState<number | null>(null);

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

  if (payments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-white/30">
        <ArrowDownLeft className="w-10 h-10 mb-3 opacity-30" />
        <p className="text-sm">Платежей пока нет</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {payments.map(p => (
        <div key={p.id} className="bg-[#13151A] border border-white/5 rounded-2xl p-4">
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-semibold text-white">#{p.id}</span>
                <StatusBadge status={p.status} />
              </div>
              <div className="text-xs text-white/40">{p.network} · {p.currency}</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-[#3ab368]">
                {p.amountReceived ? parseFloat(p.amountReceived).toFixed(4) : (p.amount ? parseFloat(p.amount).toFixed(4) : "—")}
              </div>
              <div className="text-[10px] text-white/30">{formatDate(p.createdAt)}</div>
            </div>
          </div>

          {/* Timer row — only for pending */}
          {p.status === "pending" && (
            <div className="flex items-center justify-between mt-1 mb-2">
              <PaymentTimer expiresAt={p.expiresAt ?? null} createdAt={p.createdAt} />
              <button
                onClick={() => checkPayment(p.id)}
                disabled={checking === p.id}
                className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-[#3ab368]/10 text-[#3ab368] hover:bg-[#3ab368]/20 transition-colors disabled:opacity-50"
              >
                {checking === p.id
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <RefreshCw className="w-3 h-3" />}
                Проверить
              </button>
            </div>
          )}

          {/* Wallet address */}
          {p.walletAddress && (
            <div className="text-[10px] text-white/30 font-mono bg-[#0E1014] rounded-lg px-2 py-1.5 flex justify-between items-center">
              <span>{truncate(p.walletAddress, 20)}</span>
              <CopyButton text={p.walletAddress} />
            </div>
          )}

          {/* TX hash */}
          {p.txHash && (
            <div className="text-[10px] text-[#3ab368]/70 font-mono mt-1 truncate">TX: {truncate(p.txHash, 24)}</div>
          )}

          {/* Confirmed time */}
          {p.confirmedAt && (
            <div className="text-[10px] text-[#3ab368]/60 mt-1">Подтверждён: {formatDate(p.confirmedAt)}</div>
          )}

          {/* External user / order */}
          {(p.externalUserId || p.orderId) && (
            <div className="text-[10px] text-white/20 mt-1">
              {p.externalUserId && <span>uid: {p.externalUserId}</span>}
              {p.orderId && <span className="ml-2">order: {p.orderId}</span>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Wallet card with balance refresh ─────────────────────────────────────────

function WalletCard({ wallet: w, shopId, onRefresh }: { wallet: MerchantWallet; shopId: number; onRefresh: () => void }) {
  const { toast } = useToast();
  const [checking, setChecking] = useState(false);
  const def = NETWORKS.find(n => n.apiNode === w.network && n.apiMode === w.mode) ?? NETWORKS.find(n => n.apiNode === w.network);

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
            <div className="text-[10px] text-[#e9c46a]/70 mt-0.5 flex items-center gap-1">
              <Clock className="w-3 h-3" /> до {formatDate(w.reservedUntil)}
            </div>
          )}
          {/* Balance row */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
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
            <button
              onClick={checkBalance}
              disabled={checking}
              className="flex items-center gap-1 text-[10px] text-white/30 hover:text-[#3ab368] transition-colors"
            >
              {checking ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              Проверить
            </button>
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
  const [showGen, setShowGen] = useState(false);
  const enabledNets = parseNetworks(shop.enabledNetworks);

  const generate = useMutation({
    mutationFn: () => apiRequest("POST", `/api/business/shops/${shop.id}/wallets/generate`, {
      network: genNetwork, mode: genMode
    }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/business/wallets", shop.id] });
      toast({ title: "Кошелёк добавлен в пул" });
      setShowGen(false);
    },
    onError: (e: any) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  const activeNets = NETWORKS.filter(n => n.selectable && enabledNets.includes(n.id));


  return (
    <div className="space-y-3">
      {shop.status === "active" && (
        <button
          onClick={() => setShowGen(v => !v)}
          className="w-full py-3 rounded-2xl border border-dashed border-[#3ab368]/40 text-[#3ab368] text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#3ab368]/5 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Добавить кошелёк в пул
        </button>
      )}

      {showGen && (
        <div className="bg-[#13151A] border border-white/5 rounded-2xl p-4 space-y-3">
          <div className="text-sm font-semibold text-white">Генерация кошелька</div>
          {enabledNets.length === 0 ? (
            <p className="text-xs text-[#e9c46a]">Сначала выберите активные сети в Настройках магазина.</p>
          ) : (
            <>
              <div>
                <label className="text-xs text-white/40 mb-2 block">Выберите сеть</label>
                <div className="grid grid-cols-2 gap-2">
                  {activeNets.map(n => (
                    <button
                      key={n.id}
                      onClick={() => { setGenNetwork(n.apiNode!); setGenMode(n.apiMode!); }}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all ${
                        genNetwork === n.apiNode && genMode === n.apiMode
                          ? "border-[#3ab368] bg-[#3ab368]/10"
                          : "border-white/10 bg-[#0E1014] hover:border-white/20"
                      }`}
                    >
                      <NetworkIcon iconFile={n.icon} size={22} />
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-white truncate">{n.label}</div>
                        {n.badge && <div className="text-[9px] text-[#3ab368]">{n.badge}</div>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={() => generate.mutate()}
                disabled={!genNetwork || generate.isPending}
                className="w-full py-3 rounded-xl bg-[#3ab368] text-white text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {generate.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Сгенерировать
              </button>
            </>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs text-white/40">Кошельков: {wallets.length}</span>
        <button onClick={onRefresh} className="text-xs text-white/40 flex items-center gap-1 hover:text-white/70">
          <RefreshCw className="w-3 h-3" /> Обновить
        </button>
      </div>

      {wallets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-white/30">
          <Wallet className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm">Кошельков нет</p>
          <p className="text-xs mt-1 text-center">Добавьте кошельки в пул для приёма платежей</p>
        </div>
      ) : (
        <div className="space-y-2">
          {wallets.map(w => (
            <WalletCard key={w.id} wallet={w} shopId={shop.id} onRefresh={onRefresh} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Payouts tab ───────────────────────────────────────────────────────────────

function PayoutsTab({ shop, payouts, wallets }: { shop: Shop; payouts: Payout[]; wallets: MerchantWallet[] }) {
  const [showCreate, setShowCreate] = useState(false);
  const [toAddress, setToAddress] = useState("");
  const [network, setNetwork] = useState("TRON");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [fromWalletId, setFromWalletId] = useState<number | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const activeWallets = wallets.filter(w => w.status === "active" || w.status === "permanent");

  const createPayout = useMutation({
    mutationFn: () => apiRequest("POST", `/api/business/shops/${shop.id}/payouts`, {
      toAddress, network, currency: "USDT", amount: parseFloat(amount), note,
      ...(fromWalletId ? { fromWalletId } : {})
    }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/business/payouts", shop.id] });
      qc.invalidateQueries({ queryKey: ["/api/business/shops", shop.id] });
      toast({ title: "Заявка на выплату создана" });
      setShowCreate(false);
      setToAddress(""); setAmount(""); setNote("");
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

  return (
    <div className="space-y-3">
      {shop.status === "active" && (
        <button
          onClick={() => setShowCreate(v => !v)}
          className="w-full py-3 rounded-2xl border border-dashed border-[#3ab368]/40 text-[#3ab368] text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#3ab368]/5 transition-colors"
        >
          <ArrowUpRight className="w-4 h-4" />
          Новая заявка на выплату
        </button>
      )}

      {showCreate && (
        <div className="bg-[#13151A] border border-white/5 rounded-2xl p-4 space-y-3">
          <div className="text-sm font-semibold text-white mb-1">Создать заявку на выплату</div>
          <div>
            <label className="text-xs text-white/40 mb-1 block">Сеть</label>
            <select value={network} onChange={e => setNetwork(e.target.value)} className="w-full bg-[#0E1014] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none">
              <option value="TRON">TRON (TRC20)</option>
              <option value="BSC">BNB Chain (BEP20)</option>
              <option value="TON">TON</option>
              <option value="POLYGON">Polygon</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-white/40 mb-1 block">Адрес получателя</label>
            <input value={toAddress} onChange={e => setToAddress(e.target.value)} placeholder="T..." className="w-full bg-[#0E1014] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none" />
          </div>
          <div>
            <label className="text-xs text-white/40 mb-1 block">Сумма USDT (баланс: {parseFloat(shop.balanceUsdt).toFixed(4)})</label>
            <input value={amount} onChange={e => setAmount(e.target.value)} type="number" placeholder="0.00" className="w-full bg-[#0E1014] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none" />
          </div>
          {wallets.length > 0 && (
            <div>
              <label className="text-xs text-white/40 mb-1 block">Кошелёк-источник (необязательно)</label>
              <select
                value={fromWalletId ?? ""}
                onChange={e => setFromWalletId(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full bg-[#0E1014] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"
              >
                <option value="">— Выбрать кошелёк —</option>
                {wallets.filter(w => w.network === network).map(w => {
                  const bal = parseFloat(w.balanceUsdt ?? "0").toFixed(4);
                  return (
                    <option key={w.id} value={w.id}>
                      {w.network} · {truncate(w.address, 14)} · {bal} USDT
                    </option>
                  );
                })}
              </select>
              {fromWalletId && (() => {
                const sel = wallets.find(w => w.id === fromWalletId);
                return sel ? (
                  <div className="mt-2 bg-[#3ab368]/10 border border-[#3ab368]/20 rounded-xl px-3 py-2 flex items-center justify-between">
                    <span className="text-xs text-white/60">Баланс кошелька</span>
                    <span className="text-sm font-bold text-[#3ab368]">{parseFloat(sel.balanceUsdt ?? "0").toFixed(4)} USDT</span>
                  </div>
                ) : null;
              })()}
              {fromWalletId && (
                <p className="text-[10px] text-[#3ab368]/70 mt-1">
                  Средства будут переведены автоматически с выбранного кошелька
                </p>
              )}
            </div>
          )}
          <div>
            <label className="text-xs text-white/40 mb-1 block">Комментарий (необязательно)</label>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="Вывод прибыли" className="w-full bg-[#0E1014] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none" />
          </div>
          <button
            onClick={() => createPayout.mutate()}
            disabled={!toAddress || !amount || createPayout.isPending}
            className="w-full py-3 rounded-xl bg-[#3ab368] text-white text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {createPayout.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {fromWalletId ? "Перевести" : "Создать заявку"}
          </button>
        </div>
      )}

      {payouts.length === 0 && !showCreate ? (
        <div className="flex flex-col items-center justify-center py-16 text-white/30">
          <ArrowUpRight className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm">Заявок на выплату нет</p>
        </div>
      ) : payouts.map(p => (
        <PayoutCard key={p.id} payout={p} shopId={shop.id} onUpdate={(status, txHash) => updatePayout.mutate({ payoutId: p.id, status, txHash })} />
      ))}
    </div>
  );
}

function PayoutCard({ payout, shopId, onUpdate }: { payout: Payout; shopId: number; onUpdate: (status: string, txHash?: string) => void }) {
  const [txHash, setTxHash] = useState(payout.txHash ?? "");
  const [expanded, setExpanded] = useState(false);
  const isPending = payout.status === "pending" || payout.status === "processing";

  return (
    <div className="bg-[#13151A] border border-white/5 rounded-2xl p-4">
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
      <div className="text-[10px] text-white/30 font-mono bg-[#0E1014] rounded-lg px-2 py-1.5 flex justify-between items-center mb-2">
        <span>{truncate(payout.toAddress, 20)}</span>
        <CopyButton text={payout.toAddress} />
      </div>
      {payout.note && <div className="text-xs text-white/40 mb-2">{payout.note}</div>}
      {isPending && (
        <div className="mt-2 space-y-2">
          <button onClick={() => setExpanded(v => !v)} className="text-xs text-[#3ab368] underline-offset-2 underline">
            {expanded ? "Скрыть" : "Обработать"}
          </button>
          {expanded && (
            <div className="space-y-2">
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
      name, domain, webhookUrl, permanentMonitorMinutes, enabledNetworks: selectedNets
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

  return (
    <div className="space-y-5">
      {/* Basic info */}
      <div className="space-y-3">
        <div>
          <label className="text-xs text-white/40 mb-1.5 block">Название</label>
          <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-[#13151A] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#3ab368]/50" />
        </div>
        <div>
          <label className="text-xs text-white/40 mb-1.5 block">Домен</label>
          <input value={domain} onChange={e => setDomain(e.target.value)} className="w-full bg-[#13151A] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#3ab368]/50" />
        </div>
        <div>
          <label className="text-xs text-white/40 mb-1.5 block">Webhook URL</label>
          <input value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} placeholder="https://yoursite.com/webhook" className="w-full bg-[#13151A] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#3ab368]/50" />
        </div>
      </div>

      {/* Permanent monitor minutes */}
      <div>
        <label className="text-xs text-white/40 mb-1.5 block">Окно мониторинга постоянного адреса (мин)</label>
        <input
          type="number" min={1} max={1440}
          value={permanentMonitorMinutes}
          onChange={e => setPermanentMonitorMinutes(parseInt(e.target.value) || 20)}
          className="w-full bg-[#13151A] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#3ab368]/50"
        />
        <div className="text-[10px] text-white/40 mt-1">Сколько минут отслеживать входящие платежи после вызова /api/merchant/address в режиме permanent. По умолчанию: 20 мин.</div>
      </div>

      {/* Network selection */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-xs text-white/40">Принимаемые сети</label>
          <span className="text-xs text-[#3ab368]">{selectedNets.length} выбрано</span>
        </div>

        {/* Active selectable networks */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {selectableNets.map(n => {
            const isOn = selectedNets.includes(n.id);
            return (
              <button
                key={n.id}
                onClick={() => toggleNet(n.id)}
                className={`relative flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                  isOn
                    ? "border-[#3ab368] bg-[#3ab368]/10"
                    : "border-white/8 bg-[#13151A] hover:border-white/20"
                }`}
              >
                {/* Checkmark */}
                <div className={`absolute top-2 right-2 w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                  isOn ? "bg-[#3ab368] border-[#3ab368]" : "border-white/20"
                }`}>
                  {isOn && <Check className="w-2.5 h-2.5 text-white" />}
                </div>

                <NetworkIcon iconFile={n.icon} size={30} />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-white leading-tight">{n.label}</div>
                  <div className="text-[9px] text-white/40 mt-0.5 leading-tight">{n.sub}</div>
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

        {/* Coming soon (disabled) */}
        <div className="text-[10px] text-white/20 mb-2 uppercase tracking-wider">Скоро</div>
        <div className="grid grid-cols-4 gap-2">
          {disabledNets.map(n => (
            <div
              key={n.id}
              className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl border border-white/5 bg-[#13151A]/50 opacity-40"
            >
              <NetworkIcon iconFile={n.icon} size={24} />
              <span className="text-[9px] text-white/40 text-center leading-tight">{n.label}</span>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={() => save.mutate()}
        disabled={save.isPending}
        className="w-full py-3.5 rounded-2xl bg-[#3ab368] text-white font-semibold text-sm disabled:opacity-40 flex items-center justify-center gap-2"
      >
        {save.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
        Сохранить
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function BusinessPage() {
  const [, setLocation] = useLocation();
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data: shops = [], isLoading } = useQuery<Shop[]>({
    queryKey: ["/api/business/shops"],
    queryFn: () => fetchBusiness("/api/business/shops"),
  });

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
        <div>
          <h1 className="text-lg font-bold text-white">Business</h1>
          <p className="text-xs text-white/40">Приём криптовалюты на вашем сайте</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-3 pt-2">

        {showCreate ? (
          <div className="bg-[#13151A] border border-white/5 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="font-semibold text-white">Новый магазин</span>
              <button onClick={() => setShowCreate(false)} className="text-white/40 hover:text-white">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <CreateShopForm onSuccess={() => setShowCreate(false)} />
          </div>
        ) : (
          <button
            onClick={() => setShowCreate(true)}
            className="w-full py-4 rounded-2xl border border-dashed border-[#3ab368]/40 text-[#3ab368] font-medium flex items-center justify-center gap-2 hover:bg-[#3ab368]/5 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Подключить магазин
          </button>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 text-[#3ab368] animate-spin" />
          </div>
        ) : shops.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-white/30">
            <Store className="w-12 h-12 mb-4 opacity-30" />
            <p className="text-sm font-medium mb-1">Нет подключённых магазинов</p>
            <p className="text-xs text-center">Добавьте первый магазин, чтобы начать принимать криптовалюту</p>
          </div>
        ) : shops.map(shop => (
          <ShopCard key={shop.id} shop={shop} onSelect={() => setSelectedShop(shop)} />
        ))}

        {!showCreate && shops.length === 0 && (
          <div className="bg-[#0D1117] border border-white/5 rounded-2xl p-4 space-y-3 mt-2">
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
        )}
      </div>
    </div>
  );
}
