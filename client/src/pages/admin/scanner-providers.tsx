import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { adminRequest } from "@/lib/adminApi";
import {
  RefreshCw, KeyRound, Trash2, Plus, RotateCcw, AlertTriangle,
  GripVertical, ChevronUp, ChevronDown, Settings, Wifi, WifiOff, ExternalLink
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ScannerProvider {
  code: string;
  name: string;
  adapter_type: "evm_jsonrpc" | "solana_jsonrpc" | "tron_rest" | "ton_rest";
  auth_mode: "none" | "header" | "path" | "optional_header";
  endpoint_template: string;
  header_name: string | null;
  supported_networks: string[];
  docs_url: string | null;
  is_builtin: number;
}

interface NetworkProviderConfig {
  id: number;
  network: string;
  provider_code: string;
  enabled: number;
  priority: number;
  endpoint_override: string | null;
  max_block_range: number | null;
  rps_limit: number | null;
  name: string;
  adapter_type: string;
  auth_mode: string;
  endpoint_template: string;
  docs_url: string | null;
}

interface ScannerKey {
  id: number;
  provider: string;
  provider_code: string | null;
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

interface ProvidersData {
  providers: ScannerProvider[];
  networkConfigs: NetworkProviderConfig[];
  keys: ScannerKey[];
}

// ── Constants ──────────────────────────────────────────────────────────────────

const NETWORKS = [
  { id: "BSC",      label: "BSC",      icon: "/uploads/icons/cryptocurrency/bnb.png",      color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200" },
  { id: "ETH",      label: "ETH",      icon: "/uploads/icons/cryptocurrency/ethereum.png",  color: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200" },
  { id: "TRON",     label: "TRON",     icon: "/uploads/icons/cryptocurrency/tron.png",      color: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200" },
  { id: "TON",      label: "TON",      icon: "/uploads/icons/cryptocurrency/ton.png",       color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200" },
  { id: "SOL",      label: "Solana",   icon: "/uploads/icons/cryptocurrency/solana.png",    color: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200" },
  { id: "ARBITRUM", label: "Arbitrum", icon: "/uploads/icons/cryptocurrency/arbitrum.png",  color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200" },
  { id: "POLYGON",  label: "Polygon",  icon: "/uploads/icons/cryptocurrency/polygon.png",   color: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200" },
];

const AUTH_MODE_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  none:             { label: "Free",       variant: "secondary" },
  optional_header:  { label: "Free/Key",   variant: "outline" },
  header:           { label: "Keyed",      variant: "default" },
  path:             { label: "Keyed (URL)", variant: "default" },
};

const fmtDate = (d: string | null) => d
  ? new Date(d).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })
  : "—";

// ── Sortable Provider Row ──────────────────────────────────────────────────────

function SortableProviderRow({
  cfg, keys, onToggle, onEditKeys,
}: {
  cfg: NetworkProviderConfig;
  keys: ScannerKey[];
  onToggle: (id: number, enabled: boolean) => void;
  onEditKeys: (cfg: NetworkProviderConfig) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cfg.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  const isEnabled = cfg.enabled === 1;
  const authInfo = AUTH_MODE_LABELS[cfg.auth_mode] ?? { label: cfg.auth_mode, variant: "outline" as const };
  const providerKeys = keys.filter(k => k.provider_code === cfg.provider_code);
  const activeKeys = providerKeys.filter(k => k.is_active === 1 || k.is_active === true).length;
  const requiresKey = cfg.auth_mode === "header" || cfg.auth_mode === "path";
  const hasOptionalKey = cfg.auth_mode === "optional_header";
  const canWork = !requiresKey || activeKeys > 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
        isEnabled && canWork
          ? "border-border bg-card"
          : isEnabled && !canWork
            ? "border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30"
            : "border-border bg-muted/30 opacity-60"
      }`}
    >
      {/* Drag handle */}
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none">
        <GripVertical className="w-4 h-4" />
      </button>

      {/* Priority badge */}
      <span className="w-6 h-6 rounded-full bg-muted text-muted-foreground text-xs font-bold flex items-center justify-center flex-shrink-0">
        {cfg.priority}
      </span>

      {/* Enable toggle */}
      <button
        onClick={() => onToggle(cfg.id, !isEnabled)}
        className={`flex-shrink-0 transition-colors ${isEnabled ? "text-green-500 hover:text-red-500" : "text-muted-foreground hover:text-green-500"}`}
        title={isEnabled ? "Отключить" : "Включить"}
      >
        {isEnabled ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
      </button>

      {/* Provider info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`font-medium text-sm ${!isEnabled ? "text-muted-foreground" : ""}`}>{cfg.name}</span>
          <Badge variant={authInfo.variant} className="text-xs py-0">{authInfo.label}</Badge>
          {cfg.rps_limit && (
            <span className="text-xs text-muted-foreground">{cfg.rps_limit} req/s</span>
          )}
          {cfg.max_block_range && (
            <span className="text-xs text-muted-foreground">{cfg.max_block_range} блоков/запрос</span>
          )}
          {cfg.docs_url && (
            <a href={cfg.docs_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
        <div className="text-xs text-muted-foreground truncate mt-0.5">
          {cfg.endpoint_override || cfg.endpoint_template}
        </div>
      </div>

      {/* Keys section for keyed/optional providers */}
      {(requiresKey || hasOptionalKey) && (
        <button
          onClick={() => onEditKeys(cfg)}
          className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-colors flex-shrink-0 ${
            activeKeys > 0
              ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-950/50"
              : requiresKey
                ? "border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 hover:bg-orange-100"
                : "border-border text-muted-foreground hover:border-primary hover:text-foreground"
          }`}
        >
          <KeyRound className="w-3 h-3" />
          {activeKeys > 0 ? `${activeKeys}/${providerKeys.length} ключ${activeKeys === 1 ? "" : "а"}` : "Ключей нет"}
        </button>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AdminScannerProviders() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedNetwork, setSelectedNetwork] = useState("BSC");
  const [keysPanelProvider, setKeysPanelProvider] = useState<NetworkProviderConfig | null>(null);
  const [newKeyForm, setNewKeyForm] = useState({ label: "", api_key: "", monthly_limit: "0" });
  const [localOrder, setLocalOrder] = useState<NetworkProviderConfig[]>([]);

  const { data, isLoading, refetch } = useQuery<ProvidersData>({
    queryKey: ["/admin-business/scanner-providers"],
    queryFn: () => adminRequest("/business/scanner-providers"),
  });

  const networkConfigs = data?.networkConfigs ?? [];
  const keys = data?.keys ?? [];

  // Get configs for selected network
  const filteredConfigs = networkConfigs
    .filter(c => c.network === selectedNetwork)
    .sort((a, b) => a.priority - b.priority);

  useEffect(() => {
    setLocalOrder(filteredConfigs);
  }, [selectedNetwork, networkConfigs.length, JSON.stringify(filteredConfigs.map(c => c.id))]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const patchNetworkProvider = useMutation({
    mutationFn: ({ id, ...data }: { id: number; enabled?: boolean; priority?: number; endpoint_override?: string }) =>
      adminRequest(`/business/scanner-providers/network/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/admin-business/scanner-providers"] }),
    onError: (e: any) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  const bulkReorder = useMutation({
    mutationFn: (items: Array<{ id: number; priority: number }>) =>
      adminRequest("/business/scanner-providers/network-bulk", { method: "PATCH", body: JSON.stringify({ items }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/admin-business/scanner-providers"] }),
    onError: (e: any) => toast({ title: "Ошибка при сохранении порядка", description: e.message, variant: "destructive" }),
  });

  const addKey = useMutation({
    mutationFn: (data: { provider: string; provider_code: string; networks: string[]; api_key: string; label: string; monthly_limit: number }) =>
      adminRequest("/business/scanner-keys", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/admin-business/scanner-providers"] });
      setNewKeyForm({ label: "", api_key: "", monthly_limit: "0" });
      toast({ title: "Ключ добавлен" });
    },
    onError: (e: any) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  const deleteKey = useMutation({
    mutationFn: (id: number) => adminRequest(`/business/scanner-keys/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/admin-business/scanner-providers"] });
      toast({ title: "Ключ удалён" });
    },
    onError: (e: any) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  const patchKey = useMutation({
    mutationFn: ({ id, ...data }: { id: number; is_active?: boolean; monthly_limit?: number; reset_usage?: boolean }) =>
      adminRequest(`/business/scanner-keys/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/admin-business/scanner-providers"] }),
    onError: (e: any) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = localOrder.findIndex(c => c.id === active.id);
    const newIndex = localOrder.findIndex(c => c.id === over.id);
    const reordered = arrayMove(localOrder, oldIndex, newIndex);
    setLocalOrder(reordered);

    const items = reordered.map((c, i) => ({ id: c.id, priority: i + 1 }));
    bulkReorder.mutate(items);
  };

  const handleToggle = (id: number, enabled: boolean) => {
    patchNetworkProvider.mutate({ id, enabled });
    setLocalOrder(prev => prev.map(c => c.id === id ? { ...c, enabled: enabled ? 1 : 0 } : c));
  };

  const handleAddKey = () => {
    if (!newKeyForm.api_key.trim() || !keysPanelProvider) {
      toast({ title: "Введите API ключ", variant: "destructive" });
      return;
    }
    addKey.mutate({
      provider: keysPanelProvider.provider_code,
      provider_code: keysPanelProvider.provider_code,
      networks: [keysPanelProvider.network],
      api_key: newKeyForm.api_key.trim(),
      label: newKeyForm.label.trim() || `${keysPanelProvider.name} #${Date.now()}`,
      monthly_limit: parseInt(newKeyForm.monthly_limit) || 0,
    });
  };

  const netInfo = NETWORKS.find(n => n.id === selectedNetwork);
  const providerKeys = keysPanelProvider
    ? keys.filter(k => k.provider_code === keysPanelProvider.provider_code)
    : [];

  // Network stats
  const getNetStats = (netId: string) => {
    const cfgs = networkConfigs.filter(c => c.network === netId);
    const enabled = cfgs.filter(c => c.enabled === 1).length;
    const needsKey = cfgs.filter(c => (c.auth_mode === "header" || c.auth_mode === "path") && c.enabled === 1);
    const missingKeys = needsKey.filter(c => !keys.some(k => k.provider_code === c.provider_code && (k.is_active === 1 || k.is_active === true)));
    return { total: cfgs.length, enabled, warnings: missingKeys.length };
  };

  return (
    <AdminLayout title="Провайдеры сканера" description="Управление источниками данных блокчейн-сканеров по каждой сети">

      {/* Network selector */}
      <div className="flex flex-wrap gap-2 mb-6">
        {NETWORKS.map(net => {
          const stats = getNetStats(net.id);
          const isSelected = selectedNetwork === net.id;
          return (
            <button
              key={net.id}
              onClick={() => setSelectedNetwork(net.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all ${
                isSelected
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-card border-border hover:border-primary/50 hover:bg-muted/50"
              }`}
            >
              <img src={net.icon} alt={net.label} className="w-5 h-5 rounded-full object-cover" onError={e => (e.currentTarget.style.display = "none")} />
              <span className="font-medium text-sm">{net.label}</span>
              {stats.total > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                  isSelected ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}>
                  {stats.enabled}/{stats.total}
                </span>
              )}
              {stats.warnings > 0 && (
                <AlertTriangle className={`w-3.5 h-3.5 ${isSelected ? "text-primary-foreground/70" : "text-orange-500"}`} />
              )}
            </button>
          );
        })}
        <Button variant="outline" size="sm" className="ml-auto gap-1.5" onClick={() => refetch()}>
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          Обновить
        </Button>
      </div>

      {/* Network header */}
      {netInfo && (
        <div className="flex items-center gap-3 mb-4">
          <img src={netInfo.icon} alt={netInfo.label} className="w-7 h-7 rounded-full object-cover" onError={e => (e.currentTarget.style.display = "none")} />
          <div>
            <h2 className="text-base font-semibold">Сеть {netInfo.label}</h2>
            <p className="text-xs text-muted-foreground">Перетащите строки для изменения порядка приоритетов. Первый в списке — основной, остальные — резервные.</p>
          </div>
        </div>
      )}

      {/* Providers list with DnD */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <RefreshCw className="w-5 h-5 animate-spin" />
          Загрузка...
        </div>
      ) : localOrder.length === 0 ? (
        <div className="border rounded-xl p-12 text-center text-muted-foreground">
          <Settings className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Провайдеры для сети {selectedNetwork} не настроены</p>
          <p className="text-xs mt-1">Миграции ещё не запущены или сеть не поддерживается</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={localOrder.map(c => c.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {localOrder.map(cfg => (
                <SortableProviderRow
                  key={cfg.id}
                  cfg={cfg}
                  keys={keys}
                  onToggle={handleToggle}
                  onEditKeys={c => { setKeysPanelProvider(c); setNewKeyForm({ label: "", api_key: "", monthly_limit: "0" }); }}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Legend */}
      <div className="mt-6 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5"><Wifi className="w-3.5 h-3.5 text-green-500" />Включён</div>
        <div className="flex items-center gap-1.5"><WifiOff className="w-3.5 h-3.5 text-muted-foreground" />Отключён</div>
        <div className="flex items-center gap-1.5"><GripVertical className="w-3.5 h-3.5" />Перетащить для изменения порядка</div>
        <div className="flex items-center gap-1.5"><Badge variant="secondary" className="py-0 text-xs">Free</Badge>Без ключа</div>
        <div className="flex items-center gap-1.5"><Badge variant="outline" className="py-0 text-xs">Free/Key</Badge>Работает и без ключа, и с ключом</div>
        <div className="flex items-center gap-1.5"><Badge variant="default" className="py-0 text-xs">Keyed</Badge>Требует API ключ</div>
      </div>

      {/* Keys management dialog */}
      <Dialog open={!!keysPanelProvider} onOpenChange={open => !open && setKeysPanelProvider(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <KeyRound className="w-5 h-5 text-primary" />
              Ключи: {keysPanelProvider?.name}
              {keysPanelProvider && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${NETWORKS.find(n => n.id === keysPanelProvider.network)?.color ?? ""}`}>
                  {keysPanelProvider.network}
                </span>
              )}
              <span className="text-xs text-muted-foreground font-normal ml-1">round-robin · лимит по месяцам</span>
              {keysPanelProvider?.auth_mode === "optional_header" && (
                <Badge variant="outline" className="text-xs ml-auto">Опциональный ключ — работает и без него</Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-auto px-6 py-4 space-y-4">
            {/* Keys table */}
            {providerKeys.length === 0 ? (
              <div className="border rounded-xl p-8 text-center text-muted-foreground text-sm">
                <KeyRound className="w-8 h-8 mx-auto mb-2 opacity-30" />
                {keysPanelProvider?.auth_mode === "optional_header"
                  ? "Ключей нет. Провайдер работает без ключа (с пониженным лимитом)."
                  : "Ключей нет. Добавьте первый ключ ниже."}
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
                      <TableHead>Последнее исп.</TableHead>
                      <TableHead className="w-20 text-center">Статус</TableHead>
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
                            <div className="font-medium text-sm">{key.label || `${keysPanelProvider?.name} #${key.id}`}</div>
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
                                  <div className={`h-full rounded-full ${pct >= 100 ? "bg-red-500" : pct > 80 ? "bg-yellow-500" : "bg-green-500"}`}
                                    style={{ width: `${Math.min(pct, 100)}%` }} />
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
                          <TableCell className="text-xs text-muted-foreground">{fmtDate(key.last_used_at)}</TableCell>
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
                              <Button variant="ghost" size="icon" title="Сбросить счётчик"
                                onClick={() => patchKey.mutate({ id: key.id, reset_usage: true })}
                                className="h-7 w-7 text-muted-foreground hover:text-foreground">
                                <RotateCcw className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" title="Удалить ключ"
                                onClick={() => { if (confirm("Удалить ключ?")) deleteKey.mutate(key.id); }}
                                className="h-7 w-7 text-muted-foreground hover:text-red-500">
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
                <Plus className="w-4 h-4" /> Добавить ключ {keysPanelProvider?.name}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Метка (необязательно)</label>
                  <Input value={newKeyForm.label}
                    onChange={e => setNewKeyForm(f => ({ ...f, label: e.target.value }))}
                    placeholder={`${keysPanelProvider?.name ?? ""} #1`}
                    className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">API ключ *</label>
                  <Input value={newKeyForm.api_key}
                    onChange={e => setNewKeyForm(f => ({ ...f, api_key: e.target.value }))}
                    placeholder="Вставьте API ключ..."
                    className="h-8 text-sm font-mono" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Лимит в месяц (0 = ∞)</label>
                  <Input value={newKeyForm.monthly_limit}
                    onChange={e => setNewKeyForm(f => ({ ...f, monthly_limit: e.target.value }))}
                    type="number" min="0" placeholder="0"
                    className="h-8 text-sm" />
                </div>
              </div>
              <Button size="sm" onClick={handleAddKey}
                disabled={addKey.isPending || !newKeyForm.api_key.trim()}
                className="gap-1.5">
                <Plus className="w-4 h-4" />
                {addKey.isPending ? "Добавление..." : "Добавить ключ"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </AdminLayout>
  );
}
