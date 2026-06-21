import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft, Plus, Store, Copy, Check, RefreshCw, Settings,
  ArrowDownLeft, ArrowUpRight, Clock, CheckCircle2, XCircle,
  Eye, EyeOff, Loader2, AlertCircle, ExternalLink, Zap
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type ShopStatus = "pending" | "active" | "rejected" | "suspended";
type AddressMode = "permanent" | "temporary";

interface Shop {
  id: number;
  userId: number;
  name: string;
  domain: string;
  apiKey: string;
  status: ShopStatus;
  addressMode: AddressMode;
  webhookUrl: string | null;
  balanceUsdt: string;
  totalReceived: string;
  totalPaidOut: string;
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
  note: string | null;
  processedAt: string | null;
  createdAt: string;
}

function userApiKey() {
  return localStorage.getItem("userApiKey") || "";
}

function fetchBusiness(path: string) {
  return fetch(path, { headers: { "x-api-key": userApiKey() } }).then(r => {
    if (!r.ok) throw new Error("Request failed");
    return r.json();
  });
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
  };
  const s = map[status] ?? { label: status, color: "#ffffff55" };
  return (
    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: s.color + "20", color: s.color }}>
      {s.label}
    </span>
  );
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

// ── Shop card (list view) ─────────────────────────────────────────────────────

function ShopCard({ shop, onSelect }: { shop: Shop; onSelect: () => void }) {
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
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-[#0E1014] rounded-xl p-3">
          <div className="text-[10px] text-white/40 mb-0.5">Баланс</div>
          <div className="text-sm font-bold text-white">{parseFloat(shop.balanceUsdt).toFixed(2)} <span className="text-white/40 text-xs">USDT</span></div>
        </div>
        <div className="bg-[#0E1014] rounded-xl p-3">
          <div className="text-[10px] text-white/40 mb-0.5">Получено</div>
          <div className="text-sm font-bold text-white">{parseFloat(shop.totalReceived).toFixed(2)} <span className="text-white/40 text-xs">USDT</span></div>
        </div>
      </div>
    </button>
  );
}

// ── Shop detail view ──────────────────────────────────────────────────────────

type ShopTab = "overview" | "payments" | "payouts" | "settings";

function ShopDetail({ shop: initialShop, onBack }: { shop: Shop; onBack: () => void }) {
  const [tab, setTab] = useState<ShopTab>("overview");
  const [showKey, setShowKey] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: shop = initialShop } = useQuery<Shop>({
    queryKey: ["/api/business/shops", initialShop.id],
    queryFn: () => fetchBusiness(`/api/business/shops/${initialShop.id}`),
    refetchInterval: 30000,
  });

  const { data: payments = [] } = useQuery<Payment[]>({
    queryKey: ["/api/business/payments", shop.id],
    queryFn: () => fetchBusiness(`/api/business/shops/${shop.id}/payments`),
    enabled: tab === "payments",
  });

  const { data: payouts = [] } = useQuery<Payout[]>({
    queryKey: ["/api/business/payouts", shop.id],
    queryFn: () => fetchBusiness(`/api/business/shops/${shop.id}/payouts`),
    enabled: tab === "payouts",
  });

  const regenKey = useMutation({
    mutationFn: () => apiRequest("POST", `/api/business/shops/${shop.id}/regenerate-key`).then(r => r.json()),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/business/shops", shop.id] });
      qc.invalidateQueries({ queryKey: ["/api/business/shops"] });
      toast({ title: "API-ключ обновлён" });
    },
    onError: (e: any) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  const TABS: { id: ShopTab; label: string }[] = [
    { id: "overview", label: "Обзор" },
    { id: "payments", label: "Платежи" },
    { id: "payouts", label: "Выплаты" },
    { id: "settings", label: "Настройки" },
  ];

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
        <div className="bg-[#0E1014] rounded-2xl p-1 flex gap-1">
          {TABS.map(t => (
            <button
              key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors ${tab === t.id ? "bg-[#3ab368] text-white" : "text-white/40 hover:text-white/70"}`}
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
                <div className="text-[10px] text-white/40 uppercase tracking-wide mb-1">Баланс</div>
                <div className="text-xl font-bold text-white">{parseFloat(shop.balanceUsdt).toFixed(4)}</div>
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
                <div className="text-[10px] text-white/40 uppercase tracking-wide mb-1">Режим адресов</div>
                <div className="text-sm font-bold text-white capitalize">{shop.addressMode === "permanent" ? "Постоянный" : "Временный"}</div>
                <div className="text-xs text-white/40">{shop.addressMode === "permanent" ? "по user_id" : "по order_id"}</div>
              </div>
            </div>

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

            {/* API Docs hint */}
            <div className="bg-[#0D1117] border border-[#3ab368]/20 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-[#3ab368]" />
                <span className="text-sm font-semibold text-white">Быстрая интеграция</span>
              </div>
              <p className="text-xs text-white/50 mb-3">Для получения адреса оплаты отправьте POST-запрос:</p>
              <div className="bg-[#0E1014] rounded-xl p-3 font-mono text-[10px] text-white/60 space-y-1">
                <div><span className="text-[#3ab368]">POST</span> /api/merchant/address</div>
                <div className="text-white/30">x-shop-key: {showKey ? shop.apiKey : shop.apiKey.slice(0,8) + "..."}</div>
                <div className="text-white/30">{"{"} "network": "TRC20", "user_id": "123" {"}"}</div>
              </div>
            </div>
          </>
        )}

        {/* ── Payments ── */}
        {tab === "payments" && (
          <>
            {payments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-white/30">
                <ArrowDownLeft className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm">Платежей пока нет</p>
              </div>
            ) : payments.map(p => (
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
                    <div className="text-sm font-bold text-[#3ab368]">{p.amountReceived ? parseFloat(p.amountReceived).toFixed(4) : (p.amount ? parseFloat(p.amount).toFixed(4) : "—")}</div>
                    <div className="text-[10px] text-white/30">{formatDate(p.createdAt)}</div>
                  </div>
                </div>
                {p.walletAddress && (
                  <div className="text-[10px] text-white/30 font-mono bg-[#0E1014] rounded-lg px-2 py-1.5 flex justify-between items-center">
                    <span>{truncate(p.walletAddress, 20)}</span>
                    <CopyButton text={p.walletAddress} />
                  </div>
                )}
                {p.txHash && (
                  <div className="text-[10px] text-[#3ab368]/70 font-mono mt-1 truncate">TX: {truncate(p.txHash, 24)}</div>
                )}
              </div>
            ))}
          </>
        )}

        {/* ── Payouts ── */}
        {tab === "payouts" && <PayoutsTab shop={shop} payouts={payouts} />}

        {/* ── Settings ── */}
        {tab === "settings" && <SettingsTab shop={shop} />}
      </div>
    </div>
  );
}

// ── Payouts tab ───────────────────────────────────────────────────────────────

function PayoutsTab({ shop, payouts }: { shop: Shop; payouts: Payout[] }) {
  const [showCreate, setShowCreate] = useState(false);
  const [toAddress, setToAddress] = useState("");
  const [network, setNetwork] = useState("TRC20");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const createPayout = useMutation({
    mutationFn: () => apiRequest("POST", `/api/business/shops/${shop.id}/payouts`, {
      toAddress, network, currency: "USDT", amount: parseFloat(amount), note
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
          <div className="text-sm font-semibold text-white mb-1">Создать заявку</div>
          <div>
            <label className="text-xs text-white/40 mb-1 block">Сеть</label>
            <select value={network} onChange={e => setNetwork(e.target.value)} className="w-full bg-[#0E1014] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none">
              <option value="TRC20">TRC20 (TRON)</option>
              <option value="BEP20">BEP20 (BSC)</option>
              <option value="TON">TON</option>
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
            Создать заявку
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
          </div>
          <div className="text-xs text-white/40">{payout.network} · {payout.currency}</div>
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
                <button onClick={() => onUpdate("processing")} className="flex-1 py-2 rounded-xl bg-[#e9c46a]/20 text-[#e9c46a] text-xs font-medium">
                  В обработке
                </button>
                <button onClick={() => onUpdate("completed", txHash || undefined)} className="flex-1 py-2 rounded-xl bg-[#3ab368]/20 text-[#3ab368] text-xs font-medium">
                  Выполнено
                </button>
                <button onClick={() => onUpdate("cancelled")} className="flex-1 py-2 rounded-xl bg-red-500/20 text-red-400 text-xs font-medium">
                  Отменить
                </button>
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
  const [addressMode, setAddressMode] = useState<AddressMode>(shop.addressMode);
  const { toast } = useToast();
  const qc = useQueryClient();

  const save = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/business/shops/${shop.id}`, { name, domain, webhookUrl, addressMode }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/business/shops", shop.id] });
      qc.invalidateQueries({ queryKey: ["/api/business/shops"] });
      toast({ title: "Настройки сохранены" });
    },
    onError: (e: any) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
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
      <div>
        <label className="text-xs text-white/40 mb-2 block">Режим генерации адресов</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setAddressMode("permanent")}
            className={`p-3 rounded-xl border text-left transition-colors ${addressMode === "permanent" ? "border-[#3ab368] bg-[#3ab368]/10" : "border-white/10 bg-[#13151A]"}`}
          >
            <div className="text-sm font-medium text-white mb-0.5">Постоянный</div>
            <div className="text-[10px] text-white/40">Один адрес на пользователя (user_id). Для подписок.</div>
          </button>
          <button
            onClick={() => setAddressMode("temporary")}
            className={`p-3 rounded-xl border text-left transition-colors ${addressMode === "temporary" ? "border-[#3ab368] bg-[#3ab368]/10" : "border-white/10 bg-[#13151A]"}`}
          >
            <div className="text-sm font-medium text-white mb-0.5">Временный</div>
            <div className="text-[10px] text-white/40">Новый адрес на каждый заказ (order_id). 30 мин TTL.</div>
          </button>
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

        {/* Info block */}
        {!showCreate && shops.length === 0 && (
          <div className="bg-[#0D1117] border border-white/5 rounded-2xl p-4 space-y-3 mt-2">
            <p className="text-xs font-semibold text-white/60 uppercase tracking-wide">Как это работает</p>
            {[
              ["1", "Создайте магазин", "Укажите название и домен сайта"],
              ["2", "Пройдите проверку", "Администратор проверит сайт (до 24ч)"],
              ["3", "Интегрируйте API", "Используйте API-ключ в коде вашего сайта"],
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
