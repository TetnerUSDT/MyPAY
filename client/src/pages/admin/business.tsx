import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { adminRequest } from "@/lib/adminApi";
import {
  RefreshCw, Store, CheckCircle, XCircle, Clock, Eye,
  ExternalLink, KeyRound, Trash2, Plus, RotateCcw, AlertTriangle
} from "lucide-react";

const fmtDate = (d: string) => d
  ? new Date(d).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })
  : "—";
const fmt = (v: any) => parseFloat(v || 0).toFixed(4);

const SHOP_STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending:   { label: "Ожидает",        variant: "secondary" },
  active:    { label: "Активен",        variant: "default" },
  rejected:  { label: "Отклонён",      variant: "destructive" },
  suspended: { label: "Приостановлен", variant: "outline" },
};

interface Shop {
  id: number;
  user_id: number;
  name: string;
  domain: string;
  api_key: string;
  status: string;
  address_mode: string;
  balance_usdt: string;
  total_received: string;
  total_paid_out: string;
  admin_note: string | null;
  created_at: string;
  user_name: string | null;
  tg_username: string | null;
  tg_id: string | null;
}

interface ScannerKey {
  id: number;
  provider: string;
  networks: string[];
  label: string | null;
  monthly_limit: number;
  usage_this_month: number;
  reset_month: string | null;
  is_active: number | boolean;
  error_count: number;
  last_used_at: string | null;
  last_error_at: string | null;
  created_at: string;
}

const PROVIDERS = [
  { id: "TronGrid",  label: "TronGrid",       networks: ["TRON", "TRC20"],                              color: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",     note: "Fallback для TRON при ошибке TronScan" },
  { id: "TronScan",  label: "TronScan",        networks: ["TRON", "TRC20"],                              color: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300", note: "Резерв (основной — бесплатный публичный)" },
  { id: "TonCenter", label: "TonCenter",       networks: ["TON"],                                        color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",  note: "Fallback для TON при ошибке публичного API" },
  { id: "BscScan",   label: "BscScan",         networks: ["BSC", "BEP20"],                               color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300", note: "Резерв (BSC сканируется через публичный RPC)" },
  { id: "Etherscan", label: "Etherscan (EVM)", networks: ["BSC", "ETH", "POLYGON", "ARBITRUM"],          color: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",  note: "Резерв (EVM сети сканируются через публичный RPC)" },
  { id: "Helius",    label: "Helius (Solana)", networks: ["SOLANA"],                                      color: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300", note: "Расширенный лимит для Solana RPC" },
];

export default function AdminBusiness() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Shop | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  // API Keys modal state
  const [showApiKeys, setShowApiKeys] = useState(false);
  const [activeProvider, setActiveProvider] = useState("TronGrid");
  const [newKeyForm, setNewKeyForm] = useState({ label: "", api_key: "", monthly_limit: "0" });

  const { data: shops = [], isLoading, refetch } = useQuery<Shop[]>({
    queryKey: ["/admin-business/shops"],
    queryFn: () => adminRequest("/business/shops"),
  });

  const { data: scannerKeys = [], refetch: refetchKeys } = useQuery<ScannerKey[]>({
    queryKey: ["/admin-business/scanner-keys"],
    queryFn: () => adminRequest("/business/scanner-keys"),
    enabled: showApiKeys,
  });

  const addKey = useMutation({
    mutationFn: (data: { provider: string; networks: string[]; api_key: string; label: string; monthly_limit: number }) =>
      adminRequest("/business/scanner-keys", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/admin-business/scanner-keys"] });
      setNewKeyForm({ label: "", api_key: "", monthly_limit: "0" });
      toast({ title: "Ключ добавлен" });
    },
    onError: (e: any) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  const deleteKey = useMutation({
    mutationFn: (id: number) => adminRequest(`/business/scanner-keys/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/admin-business/scanner-keys"] });
      toast({ title: "Ключ удалён" });
    },
    onError: (e: any) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  const patchKey = useMutation({
    mutationFn: ({ id, ...data }: { id: number; is_active?: boolean; monthly_limit?: number; reset_usage?: boolean }) =>
      adminRequest(`/business/scanner-keys/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/admin-business/scanner-keys"] }),
    onError: (e: any) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  const handleAddKey = (provider: typeof PROVIDERS[0]) => {
    if (!newKeyForm.api_key.trim()) {
      toast({ title: "Введите API ключ", variant: "destructive" });
      return;
    }
    addKey.mutate({
      provider: provider.id,
      networks: provider.networks,
      api_key: newKeyForm.api_key.trim(),
      label: newKeyForm.label.trim() || `${provider.label} #${Date.now()}`,
      monthly_limit: parseInt(newKeyForm.monthly_limit) || 0,
    });
  };

  const updateShop = useMutation({
    mutationFn: ({ id, status, note }: { id: number; status: string; note: string }) =>
      adminRequest(`/business/shops/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, adminNote: note }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/admin-business/shops"] });
      toast({ title: "Статус обновлён" });
      setSelected(null);
    },
    onError: (e: any) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  const openShop = (shop: Shop) => {
    setSelected(shop);
    setNewStatus(shop.status);
    setAdminNote(shop.admin_note ?? "");
  };

  const handleSave = (overrideStatus?: string) => {
    if (!selected) return;
    const status = overrideStatus ?? newStatus;
    updateShop.mutate({ id: selected.id, status, note: adminNote });
  };

  const filtered = filterStatus === "all" ? shops : shops.filter(s => s.status === filterStatus);
  const counts = {
    all: shops.length,
    pending: shops.filter(s => s.status === "pending").length,
    active: shops.filter(s => s.status === "active").length,
    rejected: shops.filter(s => s.status === "rejected").length,
  };

  return (
    <AdminLayout title="Business — Магазины" description="Управление мерчантами и их магазинами">

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Всего магазинов", value: shops.length, icon: Store, color: "text-blue-500" },
          { label: "Ожидают проверки", value: counts.pending, icon: Clock, color: "text-yellow-500" },
          { label: "Активных", value: counts.active, icon: CheckCircle, color: "text-green-500" },
          { label: "Отклонённых", value: counts.rejected, icon: XCircle, color: "text-red-500" },
        ].map(s => (
          <div key={s.label} className="bg-card border rounded-xl p-4 flex items-center gap-3">
            <s.icon className={`w-8 h-8 ${s.color} flex-shrink-0`} />
            <div>
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters + Refresh */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {[
          { id: "all", label: "Все", count: counts.all },
          { id: "pending", label: "Ожидают", count: counts.pending },
          { id: "active", label: "Активные", count: counts.active },
          { id: "rejected", label: "Отклонённые", count: counts.rejected },
        ].map(f => (
          <Button
            key={f.id}
            variant={filterStatus === f.id ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterStatus(f.id)}
            className="gap-1.5"
          >
            {f.label}
            {f.count > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">{f.count}</Badge>
            )}
          </Button>
        ))}
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setShowApiKeys(true); }} className="gap-1.5">
            <KeyRound className="w-4 h-4" /> API Ключи
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
            <RefreshCw className="w-4 h-4" /> Обновить
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Магазин</TableHead>
              <TableHead>Владелец</TableHead>
              <TableHead>Баланс</TableHead>
              <TableHead>Получено</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Дата</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                  Загрузка...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  <Store className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  Магазинов нет
                </TableCell>
              </TableRow>
            ) : filtered.map(shop => {
              const st = SHOP_STATUS[shop.status] ?? { label: shop.status, variant: "outline" as const };
              return (
                <TableRow key={shop.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openShop(shop)}>
                  <TableCell>
                    <div className="font-medium">{shop.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      {shop.domain}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{shop.user_name || `#${shop.user_id}`}</div>
                    {shop.tg_username && <div className="text-xs text-muted-foreground">@{shop.tg_username}</div>}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{fmt(shop.balance_usdt)} USDT</TableCell>
                  <TableCell className="font-mono text-sm text-green-600">{fmt(shop.total_received)} USDT</TableCell>
                  <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{fmtDate(shop.created_at)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); openShop(shop); }}>
                      <Eye className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={open => !open && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Store className="w-5 h-5" />
              {selected?.name}
            </DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              {/* Info grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-muted rounded-xl p-3 text-center">
                  <div className="text-xs text-muted-foreground mb-1">Баланс</div>
                  <div className="font-bold text-sm">{fmt(selected.balance_usdt)}</div>
                  <div className="text-xs text-muted-foreground">USDT</div>
                </div>
                <div className="bg-muted rounded-xl p-3 text-center">
                  <div className="text-xs text-muted-foreground mb-1">Получено</div>
                  <div className="font-bold text-sm text-green-600">{fmt(selected.total_received)}</div>
                  <div className="text-xs text-muted-foreground">USDT</div>
                </div>
                <div className="bg-muted rounded-xl p-3 text-center">
                  <div className="text-xs text-muted-foreground mb-1">Выведено</div>
                  <div className="font-bold text-sm">{fmt(selected.total_paid_out)}</div>
                  <div className="text-xs text-muted-foreground">USDT</div>
                </div>
              </div>

              {/* Meta */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Домен</span>
                  <a href={`https://${selected.domain}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-500 hover:underline">
                    {selected.domain} <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Пользователь</span>
                  <span>{selected.user_name || `ID: ${selected.user_id}`}{selected.tg_username ? ` (@${selected.tg_username})` : ""}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Режим адресов</span>
                  <span>{selected.address_mode === "permanent" ? "Постоянный" : "Временный"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Дата создания</span>
                  <span>{fmtDate(selected.created_at)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">API-ключ</span>
                  <span className="font-mono text-xs">{selected.api_key.slice(0, 12)}…</span>
                </div>
              </div>

              {/* Status change */}
              <div className="border-t pt-4 space-y-3">
                <div>
                  <label className="text-sm font-medium block mb-1.5">Статус</label>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Ожидает проверки</SelectItem>
                      <SelectItem value="active">Активен</SelectItem>
                      <SelectItem value="rejected">Отклонить</SelectItem>
                      <SelectItem value="suspended">Приостановить</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5">Примечание для мерчанта</label>
                  <Textarea
                    value={adminNote}
                    onChange={e => setAdminNote(e.target.value)}
                    placeholder="Причина отклонения или другая информация..."
                    rows={2}
                  />
                </div>

                {/* Action buttons */}
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleSave()}
                    disabled={updateShop.isPending}
                    className="flex-1"
                  >
                    {updateShop.isPending ? "Сохранение..." : "Сохранить"}
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-1.5 border-green-500 text-green-600 hover:bg-green-50 hover:text-green-600 dark:hover:bg-green-950 dark:hover:text-green-400"
                    disabled={updateShop.isPending || selected.status === "active"}
                    onClick={() => handleSave("active")}
                  >
                    <CheckCircle className="w-4 h-4" /> Одобрить
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-1.5 border-red-500 text-red-600 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
                    disabled={updateShop.isPending || selected.status === "rejected"}
                    onClick={() => handleSave("rejected")}
                  >
                    <XCircle className="w-4 h-4" /> Отклонить
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* ── API Keys Dialog ──────────────────────────────────────────────── */}
      <Dialog open={showApiKeys} onOpenChange={open => { setShowApiKeys(open); if (open) setNewKeyForm({ label: "", api_key: "", monthly_limit: "0" }); }}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <KeyRound className="w-5 h-5 text-primary" />
              Управление API ключами сканера
              <Button variant="ghost" size="icon" className="ml-auto" onClick={() => refetchKeys()}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-auto px-6 py-4">
            <Tabs value={activeProvider} onValueChange={v => { setActiveProvider(v); setNewKeyForm({ label: "", api_key: "", monthly_limit: "0" }); }}>
              <TabsList className="mb-4">
                {PROVIDERS.map(p => {
                  const cnt = scannerKeys.filter(k => k.provider === p.id).length;
                  const active = scannerKeys.filter(k => k.provider === p.id && (k.is_active === 1 || k.is_active === true)).length;
                  return (
                    <TabsTrigger key={p.id} value={p.id} className="gap-1.5">
                      {p.label}
                      {cnt > 0 && (
                        <span className="bg-secondary text-secondary-foreground text-xs rounded-full px-1.5 py-0.5 leading-none">
                          {active}/{cnt}
                        </span>
                      )}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {PROVIDERS.map(provider => {
                const providerKeys = scannerKeys.filter(k => k.provider === provider.id);
                return (
                  <TabsContent key={provider.id} value={provider.id} className="space-y-4 mt-0">
                    {/* Info row */}
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <span>Сети:</span>
                      {provider.networks.map(n => (
                        <span key={n} className={`text-xs px-2 py-0.5 rounded-full font-medium ${provider.color}`}>{n}</span>
                      ))}
                      <span className="ml-auto text-xs">Ротация round-robin · лимит по месяцам</span>
                    </div>
                    {provider.note && (
                      <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">{provider.note}</p>
                    )}

                    {/* Keys table */}
                    {providerKeys.length === 0 ? (
                      <div className="border rounded-xl p-8 text-center text-muted-foreground text-sm">
                        <KeyRound className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        Ключей нет. Добавьте первый ключ ниже.
                      </div>
                    ) : (
                      <div className="border rounded-xl overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Метка</TableHead>
                              <TableHead className="text-center">Лимит/мес</TableHead>
                              <TableHead className="text-center">Использовано</TableHead>
                              <TableHead className="text-center">Ошибки</TableHead>
                              <TableHead>Последнее использование</TableHead>
                              <TableHead className="w-24 text-center">Статус</TableHead>
                              <TableHead className="w-20"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {providerKeys.map(key => {
                              const isActive = key.is_active === 1 || key.is_active === true;
                              const limit = key.monthly_limit ?? 0;
                              const used = key.usage_this_month ?? 0;
                              const pct = limit > 0 ? Math.round((used / limit) * 100) : 0;
                              const exhausted = limit > 0 && used >= limit;
                              const hasErrors = (key.error_count ?? 0) > 3;
                              return (
                                <TableRow key={key.id} className={!isActive ? "opacity-50" : ""}>
                                  <TableCell>
                                    <div className="font-medium text-sm">{key.label || `${provider.label} #${key.id}`}</div>
                                    <div className="text-xs text-muted-foreground">{key.reset_month || "—"}</div>
                                  </TableCell>
                                  <TableCell className="text-center font-mono text-sm">
                                    {limit === 0 ? <span className="text-muted-foreground">∞</span> : limit.toLocaleString()}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <div className="flex flex-col items-center gap-1">
                                      <span className={`font-mono text-sm ${exhausted ? "text-red-500 font-bold" : pct > 80 ? "text-yellow-500" : ""}`}>
                                        {used.toLocaleString()}
                                      </span>
                                      {limit > 0 && (
                                        <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                                          <div
                                            className={`h-full rounded-full ${pct >= 100 ? "bg-red-500" : pct > 80 ? "bg-yellow-500" : "bg-green-500"}`}
                                            style={{ width: `${Math.min(pct, 100)}%` }}
                                          />
                                        </div>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {hasErrors ? (
                                      <span className="flex items-center gap-1 justify-center text-orange-500 text-sm">
                                        <AlertTriangle className="w-3.5 h-3.5" />{key.error_count}
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground text-sm">{key.error_count}</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-xs text-muted-foreground">{fmtDate(key.last_used_at ?? "")}</TableCell>
                                  <TableCell className="text-center">
                                    <button
                                      onClick={() => patchKey.mutate({ id: key.id, is_active: !isActive })}
                                      className={`text-xs px-2 py-1 rounded-full font-medium transition-colors ${
                                        isActive
                                          ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300 hover:bg-green-200"
                                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                                      }`}
                                    >
                                      {isActive ? "Вкл" : "Выкл"}
                                    </button>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex gap-1 justify-end">
                                      <Button
                                        variant="ghost" size="icon"
                                        title="Сбросить счётчик"
                                        onClick={() => patchKey.mutate({ id: key.id, reset_usage: true })}
                                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                      >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                      </Button>
                                      <Button
                                        variant="ghost" size="icon"
                                        title="Удалить ключ"
                                        onClick={() => { if (confirm("Удалить ключ?")) deleteKey.mutate(key.id); }}
                                        className="h-7 w-7 text-muted-foreground hover:text-red-500"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}

                    {/* Add key form */}
                    <div className="border rounded-xl p-4 bg-muted/30 space-y-3">
                      <div className="text-sm font-medium flex items-center gap-1.5">
                        <Plus className="w-4 h-4" /> Добавить ключ {provider.label}
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Метка (необязательно)</label>
                          <Input
                            value={newKeyForm.label}
                            onChange={e => setNewKeyForm(f => ({ ...f, label: e.target.value }))}
                            placeholder={`${provider.label} #1`}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">API ключ *</label>
                          <Input
                            value={newKeyForm.api_key}
                            onChange={e => setNewKeyForm(f => ({ ...f, api_key: e.target.value }))}
                            placeholder="Вставьте API ключ..."
                            className="h-8 text-sm font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Лимит в месяц (0 = безлимит)</label>
                          <Input
                            value={newKeyForm.monthly_limit}
                            onChange={e => setNewKeyForm(f => ({ ...f, monthly_limit: e.target.value }))}
                            type="number"
                            min="0"
                            placeholder="0"
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleAddKey(provider)}
                        disabled={addKey.isPending || !newKeyForm.api_key.trim()}
                        className="gap-1.5"
                      >
                        <Plus className="w-4 h-4" />
                        {addKey.isPending ? "Добавление..." : "Добавить ключ"}
                      </Button>
                    </div>
                  </TabsContent>
                );
              })}
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

    </AdminLayout>
  );
}
