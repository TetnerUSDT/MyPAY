import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { adminRequest } from "@/lib/adminApi";
import { queryClient } from "@/lib/queryClient";
import {
  RefreshCw, Eye, CheckCircle, XCircle, Shield, ShieldCheck,
  ShieldOff, Users, ArrowRightLeft, Megaphone, ScrollText,
  AlertTriangle, Clock, BadgeCheck, Ban, User
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

const fmt = (v: any) => parseFloat(v || 0).toFixed(2);
const fmtDate = (d: string) => d ? new Date(d).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

const DISPUTE_STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  open:            { label: "Открыт",              variant: "destructive" },
  review:          { label: "На рассмотрении",     variant: "secondary" },
  resolved_buyer:  { label: "Решён → Покупатель",  variant: "default" },
  resolved_seller: { label: "Решён → Продавец",    variant: "default" },
  cancelled:       { label: "Отменён",             variant: "outline" },
};

const ORDER_STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  created:         { label: "Создана",             variant: "outline" },
  waiting_payment: { label: "Ожидание оплаты",     variant: "secondary" },
  paid:            { label: "Оплачено",            variant: "secondary" },
  released:        { label: "Завершена",           variant: "default" },
  cancelled:       { label: "Отменена",            variant: "destructive" },
  dispute:         { label: "Спор",                variant: "destructive" },
  refunded:        { label: "Возвращена",          variant: "outline" },
  expired:         { label: "Истекла",             variant: "outline" },
};

const MERCHANT_LEVEL: Record<string, { label: string; color: string }> = {
  none:     { label: "Обычный",        color: "text-muted-foreground" },
  basic:    { label: "Мерчант",        color: "text-blue-600" },
  verified: { label: "Верифицированный", color: "text-green-600" },
  pro:      { label: "Про",            color: "text-amber-600" },
};

const AD_STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active:    { label: "Активно",    variant: "default" },
  paused:    { label: "Пауза",      variant: "secondary" },
  blocked:   { label: "Заблокировано", variant: "destructive" },
  completed: { label: "Завершено",  variant: "outline" },
  cancelled: { label: "Отменено",   variant: "outline" },
};

function StatusBadge({ map, value }: { map: typeof DISPUTE_STATUS; value: string }) {
  const s = map[value];
  if (!s) return <Badge variant="outline">{value}</Badge>;
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Disputes
// ─────────────────────────────────────────────────────────────────────────────

function DisputesTab() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("open");
  const [selected, setSelected] = useState<any>(null);
  const [winner, setWinner] = useState<"buyer" | "seller">("buyer");
  const [comment, setComment] = useState("");

  const { data: disputes = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/admin/api/p2p/disputes", statusFilter],
    queryFn: () => adminRequest(`/p2p/disputes${statusFilter !== "all" ? `?status=${statusFilter}` : ""}`),
  });

  const resolve = useMutation({
    mutationFn: ({ id, winner, comment }: { id: number; winner: string; comment: string }) =>
      adminRequest(`/p2p/disputes/${id}/resolve`, { method: "POST", body: JSON.stringify({ winner, comment }) }),
    onSuccess: () => {
      toast({ title: "Спор решён" });
      setSelected(null);
      setComment("");
      queryClient.invalidateQueries({ queryKey: ["/admin/api/p2p/disputes"] });
    },
    onError: (e: Error) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            <SelectItem value="open">Открытые</SelectItem>
            <SelectItem value="review">На рассмотрении</SelectItem>
            <SelectItem value="resolved_buyer">Решены (покупатель)</SelectItem>
            <SelectItem value="resolved_seller">Решены (продавец)</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />Обновить
        </Button>
        <span className="text-sm text-muted-foreground ml-auto">{disputes.length} записей</span>
      </div>

      {isLoading ? (
        <div className="py-10 text-center text-muted-foreground">Загрузка...</div>
      ) : (
        <div className="border rounded-lg overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">ID</TableHead>
                <TableHead>Сделка</TableHead>
                <TableHead>Покупатель</TableHead>
                <TableHead>Продавец</TableHead>
                <TableHead>Сумма</TableHead>
                <TableHead>Причина</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Модератор</TableHead>
                <TableHead>Дата</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {disputes.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Нет записей</TableCell></TableRow>
              ) : disputes.map((d: any) => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono text-xs">{d.id}</TableCell>
                  <TableCell className="font-mono text-xs">#{d.orderId}</TableCell>
                  <TableCell className="text-sm">{d.buyerName || `#${d.buyerId}`}</TableCell>
                  <TableCell className="text-sm">{d.sellerName || `#${d.sellerId}`}</TableCell>
                  <TableCell className="text-sm font-medium">
                    {fmt(d.assetAmount)} {d.assetCurrency}
                    <div className="text-xs text-muted-foreground">{fmt(d.fiatAmount)} ₽</div>
                  </TableCell>
                  <TableCell className="text-sm max-w-32 truncate" title={d.reason}>{d.reason}</TableCell>
                  <TableCell><StatusBadge map={DISPUTE_STATUS} value={d.status} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{d.moderatorName || "—"}</TableCell>
                  <TableCell className="text-xs">{fmtDate(d.createdAt)}</TableCell>
                  <TableCell>
                    {d.status === "open" && (
                      <Button size="sm" variant="outline" onClick={() => { setSelected(d); setWinner("buyer"); setComment(""); }}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Спор #{selected?.id} — Сделка #{selected?.orderId}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="text-xs text-muted-foreground mb-1">Покупатель</div>
                  <div className="font-medium">{selected.buyerName}</div>
                  {selected.buyerUsername && <div className="text-xs text-muted-foreground">@{selected.buyerUsername}</div>}
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="text-xs text-muted-foreground mb-1">Продавец</div>
                  <div className="font-medium">{selected.sellerName}</div>
                  {selected.sellerUsername && <div className="text-xs text-muted-foreground">@{selected.sellerUsername}</div>}
                </div>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Крипто:</span>
                  <span className="font-medium">{fmt(selected.assetAmount)} {selected.assetCurrency}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Фиат:</span>
                  <span className="font-medium">{fmt(selected.fiatAmount)} ₽</span>
                </div>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm">
                <div className="text-xs text-muted-foreground mb-1">Причина спора</div>
                <div>{selected.reason}</div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Победитель</div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={winner === "buyer" ? "default" : "outline"}
                    onClick={() => setWinner("buyer")}
                    className="flex-1"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />Покупатель
                  </Button>
                  <Button
                    size="sm"
                    variant={winner === "seller" ? "default" : "outline"}
                    onClick={() => setWinner("seller")}
                    className="flex-1"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />Продавец
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-sm font-medium">Комментарий (необязательно)</div>
                <Textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="Обоснование решения..."
                  rows={3}
                />
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setSelected(null)}>Отмена</Button>
                <Button
                  className="flex-1"
                  onClick={() => resolve.mutate({ id: selected.id, winner, comment })}
                  disabled={resolve.isPending}
                >
                  {resolve.isPending ? "Сохранение..." : "Вынести решение"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Orders
// ─────────────────────────────────────────────────────────────────────────────

function OrdersTab() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<any>(null);

  const { data: orders = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/admin/api/p2p/orders", statusFilter],
    queryFn: () => adminRequest(`/p2p/orders${statusFilter !== "all" ? `?status=${statusFilter}` : "?limit=100"}`),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            <SelectItem value="waiting_payment">Ожидание оплаты</SelectItem>
            <SelectItem value="paid">Оплачено</SelectItem>
            <SelectItem value="released">Завершены</SelectItem>
            <SelectItem value="cancelled">Отменены</SelectItem>
            <SelectItem value="dispute">Споры</SelectItem>
            <SelectItem value="expired">Истекшие</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />Обновить
        </Button>
        <span className="text-sm text-muted-foreground ml-auto">{orders.length} записей</span>
      </div>

      {isLoading ? (
        <div className="py-10 text-center text-muted-foreground">Загрузка...</div>
      ) : (
        <div className="border rounded-lg overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">ID</TableHead>
                <TableHead>Покупатель</TableHead>
                <TableHead>Продавец</TableHead>
                <TableHead>Крипто</TableHead>
                <TableHead>Фиат</TableHead>
                <TableHead>Курс</TableHead>
                <TableHead>Метод</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Создана</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Нет записей</TableCell></TableRow>
              ) : orders.map((o: any) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-xs">{o.id}</TableCell>
                  <TableCell className="text-sm">
                    <div>{o.buyerName || `#${o.buyerId}`}</div>
                    {o.buyerUsername && <div className="text-xs text-muted-foreground">@{o.buyerUsername}</div>}
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>{o.sellerName || `#${o.sellerId}`}</div>
                    {o.sellerUsername && <div className="text-xs text-muted-foreground">@{o.sellerUsername}</div>}
                  </TableCell>
                  <TableCell className="font-medium text-sm">{fmt(o.assetAmount)} {o.assetCurrency}</TableCell>
                  <TableCell className="text-sm">{fmt(o.fiatAmount)} ₽</TableCell>
                  <TableCell className="text-sm">{fmt(o.price)} ₽</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{o.paymentMethodTitle || "—"}</TableCell>
                  <TableCell><StatusBadge map={ORDER_STATUS} value={o.status} /></TableCell>
                  <TableCell className="text-xs">{fmtDate(o.createdAt)}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => setSelected(o)}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Сделка #{selected?.id}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["Покупатель", selected.buyerName || `#${selected.buyerId}`],
                  ["Продавец", selected.sellerName || `#${selected.sellerId}`],
                  ["Крипто", `${fmt(selected.assetAmount)} ${selected.assetCurrency}`],
                  ["Фиат", `${fmt(selected.fiatAmount)} ₽`],
                  ["Курс", `${fmt(selected.price)} ₽`],
                  ["Метод", selected.paymentMethodTitle || "—"],
                  ["Статус", ORDER_STATUS[selected.status]?.label || selected.status],
                  ["Создана", fmtDate(selected.createdAt)],
                  ["Дедлайн", fmtDate(selected.paymentDeadline)],
                  ["Завершена", fmtDate(selected.releasedAt)],
                ].map(([k, v]) => (
                  <div key={k} className="bg-muted/50 rounded p-2">
                    <div className="text-xs text-muted-foreground">{k}</div>
                    <div className="font-medium truncate">{v}</div>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="w-full" onClick={() => setSelected(null)}>Закрыть</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Merchants
// ─────────────────────────────────────────────────────────────────────────────

function MerchantsTab() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");

  const { data: merchants = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/admin/api/p2p/merchants"],
    queryFn: () => adminRequest("/p2p/merchants"),
  });

  const setLevel = useMutation({
    mutationFn: ({ id, level }: { id: number; level: string }) =>
      adminRequest(`/p2p/merchants/${id}/set-level`, { method: "POST", body: JSON.stringify({ level }) }),
    onSuccess: () => { toast({ title: "Уровень обновлён" }); queryClient.invalidateQueries({ queryKey: ["/admin/api/p2p/merchants"] }); },
    onError: (e: Error) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  const blockUser = useMutation({
    mutationFn: ({ id, blocked }: { id: number; blocked: boolean }) =>
      adminRequest(`/p2p/merchants/${id}/block`, { method: "POST", body: JSON.stringify({ blocked }) }),
    onSuccess: () => { toast({ title: "Статус обновлён" }); queryClient.invalidateQueries({ queryKey: ["/admin/api/p2p/merchants"] }); },
    onError: (e: Error) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  const filtered = merchants.filter((m: any) => {
    if (search && !`${m.name || ""} ${m.tgUsername || ""} ${m.id}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (levelFilter !== "all" && m.merchantLevel !== levelFilter) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Input
          placeholder="Поиск по имени / @username / ID..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-64"
        />
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все уровни</SelectItem>
            <SelectItem value="none">Обычные</SelectItem>
            <SelectItem value="basic">Мерчант</SelectItem>
            <SelectItem value="verified">Верифицированный</SelectItem>
            <SelectItem value="pro">Про</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />Обновить
        </Button>
        <span className="text-sm text-muted-foreground ml-auto">{filtered.length} из {merchants.length}</span>
      </div>

      {isLoading ? (
        <div className="py-10 text-center text-muted-foreground">Загрузка...</div>
      ) : (
        <div className="border rounded-lg overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">ID</TableHead>
                <TableHead>Пользователь</TableHead>
                <TableHead>Рейтинг</TableHead>
                <TableHead>Сделки</TableHead>
                <TableHead>Успех%</TableHead>
                <TableHead>Объявл.</TableHead>
                <TableHead>Споры</TableHead>
                <TableHead>Уровень</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Нет записей</TableCell></TableRow>
              ) : filtered.map((m: any) => {
                const lvl = MERCHANT_LEVEL[m.merchantLevel] || MERCHANT_LEVEL.none;
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-xs">{m.id}</TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{m.name || `#${m.id}`}</div>
                      {m.tgUsername && <div className="text-xs text-muted-foreground">@{m.tgUsername}</div>}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{parseFloat(m.rating || 0).toFixed(1)}</span>
                      <span className="text-xs text-muted-foreground ml-1">★</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{m.totalOrders}</span>
                      <span className="text-xs text-muted-foreground ml-1">/ {m.completedOrders}</span>
                    </TableCell>
                    <TableCell>{parseFloat(m.successfulPercent || 0).toFixed(1)}%</TableCell>
                    <TableCell>{m.activeAds}</TableCell>
                    <TableCell>
                      {m.disputesTotal > 0 ? (
                        <Badge variant="destructive">{m.disputesTotal}</Badge>
                      ) : <span className="text-muted-foreground">0</span>}
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs font-semibold ${lvl.color}`}>{lvl.label}</span>
                    </TableCell>
                    <TableCell>
                      {m.blocked ? (
                        <Badge variant="destructive">Заблокирован</Badge>
                      ) : (
                        <Badge variant="outline">Активен</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Select
                          value={m.merchantLevel || "none"}
                          onValueChange={val => setLevel.mutate({ id: m.id, level: val })}
                        >
                          <SelectTrigger className="h-7 w-32 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Обычный</SelectItem>
                            <SelectItem value="basic">Мерчант</SelectItem>
                            <SelectItem value="verified">Верифицир.</SelectItem>
                            <SelectItem value="pro">Про</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant={m.blocked ? "outline" : "destructive"}
                          className="h-7 px-2"
                          onClick={() => blockUser.mutate({ id: m.id, blocked: !m.blocked })}
                          title={m.blocked ? "Разблокировать" : "Заблокировать"}
                        >
                          {m.blocked ? <ShieldCheck className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
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
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Ads
// ─────────────────────────────────────────────────────────────────────────────

function AdsTab() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: ads = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/admin/api/p2p/ads", statusFilter],
    queryFn: () => adminRequest(`/p2p/ads${statusFilter !== "all" ? `?status=${statusFilter}` : ""}`),
  });

  const setAdStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      adminRequest(`/p2p/ads/${id}/status`, { method: "POST", body: JSON.stringify({ status }) }),
    onSuccess: () => { toast({ title: "Статус обновлён" }); queryClient.invalidateQueries({ queryKey: ["/admin/api/p2p/ads"] }); },
    onError: (e: Error) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            <SelectItem value="active">Активные</SelectItem>
            <SelectItem value="paused">На паузе</SelectItem>
            <SelectItem value="blocked">Заблокированные</SelectItem>
            <SelectItem value="completed">Завершённые</SelectItem>
            <SelectItem value="cancelled">Отменённые</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />Обновить
        </Button>
        <span className="text-sm text-muted-foreground ml-auto">{ads.length} записей</span>
      </div>

      {isLoading ? (
        <div className="py-10 text-center text-muted-foreground">Загрузка...</div>
      ) : (
        <div className="border rounded-lg overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">ID</TableHead>
                <TableHead>Трейдер</TableHead>
                <TableHead>Тип</TableHead>
                <TableHead>Актив</TableHead>
                <TableHead>Курс</TableHead>
                <TableHead>Доступно</TableHead>
                <TableHead>Лимиты</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Создано</TableHead>
                <TableHead>Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ads.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Нет записей</TableCell></TableRow>
              ) : ads.map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell className="font-mono text-xs">{a.id}</TableCell>
                  <TableCell className="text-sm">
                    <div>{a.userName || `#${a.userId}`}</div>
                    {a.userUsername && <div className="text-xs text-muted-foreground">@{a.userUsername}</div>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={a.side === "sell" ? "default" : "secondary"}>
                      {a.side === "sell" ? "Продажа" : "Покупка"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm font-medium">{a.assetCurrency}</TableCell>
                  <TableCell className="text-sm">{fmt(a.price)} ₽</TableCell>
                  <TableCell className="text-sm">{parseFloat(a.availableAmount || 0).toFixed(4)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {parseFloat(a.minAmount || 0).toFixed(0)} – {parseFloat(a.maxAmount || 0).toFixed(0)}
                  </TableCell>
                  <TableCell><StatusBadge map={AD_STATUS} value={a.status} /></TableCell>
                  <TableCell className="text-xs">{fmtDate(a.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {a.status !== "active" && (
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs"
                          onClick={() => setAdStatus.mutate({ id: a.id, status: "active" })}>
                          <CheckCircle className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {a.status !== "blocked" && (
                        <Button size="sm" variant="destructive" className="h-7 px-2 text-xs"
                          onClick={() => setAdStatus.mutate({ id: a.id, status: "blocked" })}>
                          <ShieldOff className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {a.status !== "paused" && a.status === "active" && (
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs"
                          onClick={() => setAdStatus.mutate({ id: a.id, status: "paused" })}>
                          <Clock className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Logs
// ─────────────────────────────────────────────────────────────────────────────

const LOG_ACTION_LABELS: Record<string, string> = {
  create_ad: "Создание объявления",
  create_order: "Создание сделки",
  mark_paid: "Отметка оплаты",
  release: "Выпуск средств",
  cancel: "Отмена сделки",
  dispute: "Открытие спора",
  review: "Отзыв",
  admin_resolve_dispute: "Решение спора (адм.)",
  admin_block: "Блокировка",
  admin_unblock: "Разблокировка",
};

function LogsTab() {
  const [actionFilter, setActionFilter] = useState("all");
  const [userSearch, setUserSearch] = useState("");

  const { data: logs = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/admin/api/p2p/logs", actionFilter],
    queryFn: () => adminRequest(`/p2p/logs${actionFilter !== "all" ? `?action=${actionFilter}` : "?limit=200"}`),
  });

  const filtered = logs.filter((l: any) => {
    if (!userSearch) return true;
    return `${l.userName || ""} ${l.userUsername || ""} ${l.userId || ""}`.toLowerCase().includes(userSearch.toLowerCase());
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все действия</SelectItem>
            {Object.entries(LOG_ACTION_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Поиск по пользователю..."
          value={userSearch}
          onChange={e => setUserSearch(e.target.value)}
          className="w-48"
        />
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />Обновить
        </Button>
        <span className="text-sm text-muted-foreground ml-auto">{filtered.length} записей</span>
      </div>

      {isLoading ? (
        <div className="py-10 text-center text-muted-foreground">Загрузка...</div>
      ) : (
        <div className="border rounded-lg overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">ID</TableHead>
                <TableHead>Действие</TableHead>
                <TableHead>Пользователь</TableHead>
                <TableHead>Сделка</TableHead>
                <TableHead>Данные</TableHead>
                <TableHead>Дата</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Нет записей</TableCell></TableRow>
              ) : filtered.map((l: any) => (
                <TableRow key={l.id}>
                  <TableCell className="font-mono text-xs">{l.id}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs whitespace-nowrap">
                      {LOG_ACTION_LABELS[l.action] || l.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {l.userName || `#${l.userId}`}
                    {l.userUsername && <span className="text-xs text-muted-foreground ml-1">@{l.userUsername}</span>}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{l.orderId ? `#${l.orderId}` : "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-48 truncate" title={JSON.stringify(l.data)}>
                    {l.data ? JSON.stringify(l.data).slice(0, 60) : "—"}
                  </TableCell>
                  <TableCell className="text-xs">{fmtDate(l.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "disputes",  label: "Споры",         icon: AlertTriangle,   badge: "disputes" },
  { id: "orders",    label: "Сделки",        icon: ArrowRightLeft,  badge: null },
  { id: "merchants", label: "Мерчанты",      icon: Users,           badge: null },
  { id: "ads",       label: "Объявления",    icon: Megaphone,       badge: null },
  { id: "logs",      label: "Логи",          icon: ScrollText,      badge: null },
] as const;

type TabId = typeof TABS[number]["id"];

export default function AdminP2P() {
  const [activeTab, setActiveTab] = useState<TabId>("disputes");

  // Fetch open disputes count for badge
  const { data: openDisputes = [] } = useQuery<any[]>({
    queryKey: ["/admin/api/p2p/disputes", "open"],
    queryFn: () => adminRequest("/p2p/disputes?status=open"),
    refetchInterval: 30000,
  });

  const badgeCounts: Record<string, number> = {
    disputes: openDisputes.length,
  };

  return (
    <AdminLayout title="P2P Модерация" description="Управление P2P обменником: споры, сделки, мерчанты, объявления, логи">
      <div className="space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="border rounded-lg p-3 flex items-center gap-3 bg-card">
            <div className="p-2 bg-destructive/10 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Открытых споров</div>
              <div className="text-xl font-bold">{openDisputes.length}</div>
            </div>
          </div>
          <div className="border rounded-lg p-3 flex items-center gap-3 bg-card">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Shield className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">P2P модуль</div>
              <div className="text-sm font-semibold text-green-600">Активен</div>
            </div>
          </div>
          <div className="border rounded-lg p-3 flex items-center gap-3 bg-card">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <BadgeCheck className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Верификация</div>
              <div className="text-sm font-semibold">Ручная</div>
            </div>
          </div>
          <div className="border rounded-lg p-3 flex items-center gap-3 bg-card">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <User className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Эскроу</div>
              <div className="text-sm font-semibold text-green-600">Включён</div>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="border-b flex gap-1 overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon, badge }) => {
            const count = badge ? badgeCounts[badge] : 0;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap -mb-px ${
                  activeTab === id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
                {badge && count > 0 && (
                  <span className="ml-1 bg-destructive text-destructive-foreground text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div>
          {activeTab === "disputes"  && <DisputesTab />}
          {activeTab === "orders"    && <OrdersTab />}
          {activeTab === "merchants" && <MerchantsTab />}
          {activeTab === "ads"       && <AdsTab />}
          {activeTab === "logs"      && <LogsTab />}
        </div>
      </div>
    </AdminLayout>
  );
}
