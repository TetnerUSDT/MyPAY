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
  AlertTriangle, Clock, BadgeCheck, Ban, User,
  CreditCard, Flag, Plus, Pencil, Trash2, CheckSquare,
  Settings, Lock, Unlock
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

  const take = useMutation({
    mutationFn: (id: number) => adminRequest(`/p2p/disputes/${id}/take`, { method: "PATCH" }),
    onSuccess: () => { toast({ title: "Спор взят в работу" }); queryClient.invalidateQueries({ queryKey: ["/admin/api/p2p/disputes"] }); },
    onError: (e: Error) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
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
                    <div className="flex gap-1">
                      {d.status === "open" && (
                        <Button size="sm" variant="secondary" className="h-7 px-2 text-xs"
                          onClick={() => take.mutate(d.id)} disabled={take.isPending} title="Взять в работу">
                          <Clock className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {(d.status === "open" || d.status === "review") && (
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs"
                          onClick={() => { setSelected(d); setWinner("buyer"); setComment(""); }} title="Вынести решение">
                          <Eye className="h-3.5 w-3.5" />
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

  const blockP2P = useMutation({
    mutationFn: ({ id, blocked }: { id: number; blocked: boolean }) =>
      adminRequest(`/p2p/merchants/${id}/p2p-block`, { method: "PATCH", body: JSON.stringify({ blocked }) }),
    onSuccess: (_: any, vars: any) => {
      toast({ title: vars.blocked ? "P2P заблокирован" : "P2P разблокирован" });
      queryClient.invalidateQueries({ queryKey: ["/admin/api/p2p/merchants"] });
    },
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
                          title={m.blocked ? "Разблокировать аккаунт" : "Заблокировать аккаунт"}
                        >
                          {m.blocked ? <ShieldCheck className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                        </Button>
                        <Button
                          size="sm"
                          variant={m.p2pBlocked ? "secondary" : "outline"}
                          className={`h-7 px-2 ${m.p2pBlocked ? "text-amber-600 border-amber-300" : ""}`}
                          onClick={() => blockP2P.mutate({ id: m.id, blocked: !m.p2pBlocked })}
                          title={m.p2pBlocked ? "Снять P2P блок" : "P2P блок"}
                          disabled={blockP2P.isPending}
                        >
                          {m.p2pBlocked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
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
                  <TableCell className="text-sm">{parseFloat(a.availableAmount || 0).toFixed(2)}</TableCell>
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
// PaymentMethodsTab
// ─────────────────────────────────────────────────────────────────────────────

function PaymentMethodsTab() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ title: "", code: "", country: "RU", currency: "RUB", status: "active" });

  const { data: methods = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/admin/api/p2p/payment-methods"],
    queryFn: () => adminRequest("/p2p/payment-methods"),
  });

  const saveMethod = useMutation({
    mutationFn: () => editId
      ? adminRequest(`/p2p/payment-methods/${editId}`, { method: "PATCH", body: JSON.stringify(form) })
      : adminRequest("/p2p/payment-methods", { method: "POST", body: JSON.stringify(form) }),
    onSuccess: () => { toast({ title: editId ? "Обновлено" : "Добавлено" }); refetch(); setShowForm(false); setEditId(null); setForm({ title: "", code: "", country: "RU", currency: "RUB", status: "active" }); },
    onError: (e: any) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  const deleteMethod = useMutation({
    mutationFn: (id: number) => adminRequest(`/p2p/payment-methods/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast({ title: "Удалено" }); refetch(); },
    onError: (e: any) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      adminRequest(`/p2p/payment-methods/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => refetch(),
    onError: (e: any) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  const startEdit = (m: any) => { setEditId(m.id); setForm({ title: m.title, code: m.code, country: m.country, currency: m.currency, status: m.status }); setShowForm(true); };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Методы оплаты P2P</h2>
        <Button size="sm" onClick={() => { setEditId(null); setForm({ title: "", code: "", country: "RU", currency: "RUB", status: "active" }); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-1" />Добавить
        </Button>
      </div>

      {showForm && (
        <div className="border rounded-lg p-4 bg-card space-y-3">
          <h3 className="font-medium">{editId ? "Редактировать" : "Новый метод оплаты"}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-muted-foreground mb-1 block">Название</label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Сбербанк" /></div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Код</label>
              <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="sberbank" /></div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Страна</label>
              <Input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} /></div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Валюта</label>
              <Input value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} /></div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => saveMethod.mutate()} disabled={saveMethod.isPending || !form.title || !form.code}>
              {saveMethod.isPending ? "..." : editId ? "Сохранить" : "Добавить"}
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Отмена</Button>
          </div>
        </div>
      )}

      {isLoading ? <div className="text-center py-8 text-muted-foreground">Загрузка...</div> : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Название</TableHead>
              <TableHead>Код</TableHead>
              <TableHead>Страна</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {methods.map((m: any) => (
              <TableRow key={m.id}>
                <TableCell className="text-muted-foreground">{m.id}</TableCell>
                <TableCell className="font-medium">{m.title}</TableCell>
                <TableCell><code className="text-xs">{m.code}</code></TableCell>
                <TableCell>{m.country} / {m.currency}</TableCell>
                <TableCell>
                  <Badge variant={m.status === "active" ? "default" : "secondary"}>
                    {m.status === "active" ? "Активен" : "Неактивен"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => startEdit(m)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => toggleStatus.mutate({ id: m.id, status: m.status === "active" ? "inactive" : "active" })}>
                      {m.status === "active" ? <XCircle className="h-3.5 w-3.5 text-destructive" /> : <CheckCircle className="h-3.5 w-3.5 text-green-600" />}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm("Удалить?")) deleteMethod.mutate(m.id); }}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VerificationsTab
// ─────────────────────────────────────────────────────────────────────────────

function VerificationsTab() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("pending");
  const [selectedVr, setSelectedVr] = useState<any>(null);
  const [comment, setComment] = useState("");

  const { data: verifications = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/admin/api/p2p/verifications", statusFilter],
    queryFn: () => adminRequest(`/p2p/verifications${statusFilter && statusFilter !== "all" ? `?status=${statusFilter}` : ""}`),
  });

  const resolveVr = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      adminRequest(`/p2p/verifications/${id}`, { method: "PATCH", body: JSON.stringify({ status, adminComment: comment }) }),
    onSuccess: (_, { status }) => { toast({ title: status === "approved" ? "Одобрено" : "Отклонено" }); refetch(); setSelectedVr(null); setComment(""); },
    onError: (e: any) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  const LEVEL_LABEL: Record<string, string> = { none: "Обычный", basic: "Мерчант", verified: "Верифицир.", pro: "Про" };
  const STATUS_COLOR: Record<string, string> = { pending: "text-yellow-600", approved: "text-green-600", rejected: "text-red-600" };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Заявки на верификацию</h2>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Ожидают</SelectItem>
            <SelectItem value="approved">Одобрены</SelectItem>
            <SelectItem value="rejected">Отклонены</SelectItem>
            <SelectItem value="all">Все</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? <div className="text-center py-8 text-muted-foreground">Загрузка...</div> :
       verifications.length === 0 ? <div className="text-center py-12 text-muted-foreground">Заявок нет</div> : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Пользователь</TableHead>
              <TableHead>Текущий уровень</TableHead>
              <TableHead>Запрошен</TableHead>
              <TableHead>Сделок / %</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {verifications.map((vr: any) => (
              <TableRow key={vr.id}>
                <TableCell>
                  <div className="font-medium">{vr.userName}</div>
                  <div className="text-xs text-muted-foreground">@{vr.tgUsername}</div>
                </TableCell>
                <TableCell><Badge variant="secondary">{LEVEL_LABEL[vr.currentLevel] || vr.currentLevel}</Badge></TableCell>
                <TableCell><Badge>{LEVEL_LABEL[vr.requestedLevel] || vr.requestedLevel}</Badge></TableCell>
                <TableCell>{vr.totalOrders ?? 0} / {parseFloat(vr.successfulPercent || 0).toFixed(1)}%</TableCell>
                <TableCell><span className={`text-sm font-semibold ${STATUS_COLOR[vr.status] || ""}`}>{vr.status}</span></TableCell>
                <TableCell>
                  {vr.status === "pending" && (
                    <Button size="sm" variant="outline" onClick={() => { setSelectedVr(vr); setComment(""); }}>
                      <Eye className="h-3.5 w-3.5 mr-1" />Рассмотреть
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={!!selectedVr} onOpenChange={() => setSelectedVr(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Заявка на верификацию</DialogTitle></DialogHeader>
          {selectedVr && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Пользователь:</span> <strong>{selectedVr.userName}</strong></div>
                <div><span className="text-muted-foreground">Уровень:</span> <strong>{LEVEL_LABEL[selectedVr.requestedLevel]}</strong></div>
                <div><span className="text-muted-foreground">Сделок:</span> <strong>{selectedVr.totalOrders ?? 0}</strong></div>
                <div><span className="text-muted-foreground">Успешность:</span> <strong>{parseFloat(selectedVr.successfulPercent || 0).toFixed(1)}%</strong></div>
                <div><span className="text-muted-foreground">Рейтинг:</span> <strong>{parseFloat(selectedVr.rating || 0).toFixed(1)}</strong></div>
                <div><span className="text-muted-foreground">Споры:</span> <strong>{selectedVr.disputesTotal ?? 0}</strong></div>
              </div>
              {selectedVr.note && <div className="text-sm bg-muted p-3 rounded"><span className="text-muted-foreground">Примечание:</span> {selectedVr.note}</div>}
              {(selectedVr.docFrontUrl || selectedVr.docBackUrl || selectedVr.selfieUrl) && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Документы KYC</div>
                  <div className="flex gap-2 flex-wrap">
                    {selectedVr.docFrontUrl && (
                      <a href={selectedVr.docFrontUrl} target="_blank" rel="noopener noreferrer" className="block">
                        <img src={selectedVr.docFrontUrl} alt="Лицевая сторона" className="h-24 w-auto rounded border object-cover cursor-pointer hover:opacity-80" />
                        <div className="text-xs text-center text-muted-foreground mt-0.5">Лицевая</div>
                      </a>
                    )}
                    {selectedVr.docBackUrl && (
                      <a href={selectedVr.docBackUrl} target="_blank" rel="noopener noreferrer" className="block">
                        <img src={selectedVr.docBackUrl} alt="Обратная сторона" className="h-24 w-auto rounded border object-cover cursor-pointer hover:opacity-80" />
                        <div className="text-xs text-center text-muted-foreground mt-0.5">Обратная</div>
                      </a>
                    )}
                    {selectedVr.selfieUrl && (
                      <a href={selectedVr.selfieUrl} target="_blank" rel="noopener noreferrer" className="block">
                        <img src={selectedVr.selfieUrl} alt="Селфи" className="h-24 w-auto rounded border object-cover cursor-pointer hover:opacity-80" />
                        <div className="text-xs text-center text-muted-foreground mt-0.5">Селфи</div>
                      </a>
                    )}
                  </div>
                </div>
              )}
              {!selectedVr.docFrontUrl && !selectedVr.docBackUrl && !selectedVr.selfieUrl && (
                <div className="text-sm text-muted-foreground bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-700 rounded p-2">
                  Документы ещё не загружены пользователем
                </div>
              )}
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Комментарий администратора</label>
                <Textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Причина решения..." rows={2} />
              </div>
              <div className="flex gap-2">
                <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => resolveVr.mutate({ id: selectedVr.id, status: "approved" })} disabled={resolveVr.isPending}>
                  <CheckCircle className="h-4 w-4 mr-1" />Одобрить
                </Button>
                <Button variant="destructive" className="flex-1" onClick={() => resolveVr.mutate({ id: selectedVr.id, status: "rejected" })} disabled={resolveVr.isPending}>
                  <XCircle className="h-4 w-4 mr-1" />Отклонить
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
// ComplaintsTab
// ─────────────────────────────────────────────────────────────────────────────

function ComplaintsTab() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("pending");

  const { data: complaints = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/admin/api/p2p/complaints", statusFilter],
    queryFn: () => adminRequest(`/p2p/complaints${statusFilter && statusFilter !== "all" ? `?status=${statusFilter}` : ""}`),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      adminRequest(`/p2p/complaints/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => { toast({ title: "Статус обновлён" }); refetch(); },
    onError: (e: any) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  const CAT_LABEL: Record<string, string> = {
    fraud: "Мошенничество", false_payment: "Ложная оплата",
    abuse: "Оскорбления", spam: "Спам", other: "Другое",
  };
  const STATUS_VARIANT: Record<string, "default"|"secondary"|"destructive"|"outline"> = {
    pending: "destructive", reviewed: "secondary", resolved: "default", dismissed: "outline",
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Жалобы</h2>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Новые</SelectItem>
            <SelectItem value="reviewed">На рассмотрении</SelectItem>
            <SelectItem value="resolved">Решены</SelectItem>
            <SelectItem value="dismissed">Отклонены</SelectItem>
            <SelectItem value="all">Все</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? <div className="text-center py-8 text-muted-foreground">Загрузка...</div> :
       complaints.length === 0 ? <div className="text-center py-12 text-muted-foreground">Жалоб нет</div> : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>От</TableHead>
              <TableHead>На</TableHead>
              <TableHead>Категория</TableHead>
              <TableHead>Описание</TableHead>
              <TableHead>Дата</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {complaints.map((c: any) => (
              <TableRow key={c.id}>
                <TableCell>
                  <div className="text-sm font-medium">{c.fromName}</div>
                  <div className="text-xs text-muted-foreground">@{c.fromUsername}</div>
                </TableCell>
                <TableCell>
                  <div className="text-sm font-medium">{c.toName}</div>
                  <div className="text-xs text-muted-foreground">@{c.toUsername}</div>
                </TableCell>
                <TableCell><Badge variant="outline">{CAT_LABEL[c.category] || c.category}</Badge></TableCell>
                <TableCell className="max-w-[200px]">
                  <span className="text-xs text-muted-foreground line-clamp-2">{c.description || "—"}</span>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{fmtDate(c.createdAt)}</TableCell>
                <TableCell><Badge variant={STATUS_VARIANT[c.status] || "outline"}>{c.status}</Badge></TableCell>
                <TableCell>
                  <Select value={c.status} onValueChange={(v) => updateStatus.mutate({ id: c.id, status: v })}>
                    <SelectTrigger className="w-32 h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="reviewed">На рассмотрении</SelectItem>
                      <SelectItem value="resolved">Решена</SelectItem>
                      <SelectItem value="dismissed">Отклонена</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Settings (T003)
// ─────────────────────────────────────────────────────────────────────────────

const SETTING_LABELS: Record<string, { label: string; hint?: string }> = {
  commission_percent:        { label: "Комиссия платформы (%)", hint: "Процент от суммы сделки, напр. 0.2 = 0.2%" },
  platform_user_id:          { label: "ID платформенного пользователя", hint: "Системный аккаунт для получения комиссий" },
  max_disputes_before_block: { label: "Споров до авто-блока", hint: "Число споров подряд до автоматической P2P-блокировки" },
  promotion_cost:            { label: "Стоимость продвижения (USDT)", hint: "Цена поднятия объявления в топ" },
  promotion_duration_hours:  { label: "Длительность продвижения (ч.)", hint: "Часов, на которые поднимается объявление" },
  auto_expire_minutes:       { label: "Авто-отмена ордера (мин.)", hint: "Через сколько минут неоплаченный ордер автоматически отменяется" },
  min_orders_for_verified:   { label: "Сделок для Верифицированного", hint: "Минимум завершённых сделок для уровня Verified" },
  min_orders_for_pro:        { label: "Сделок для Про", hint: "Минимум завершённых сделок для уровня Pro" },
};

function SettingsTab() {
  const { toast } = useToast();
  const [editing, setEditing] = useState<Record<string, string>>({});
  const { data: settings = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/admin/api/p2p/settings"],
    queryFn: () => adminRequest("/p2p/settings"),
  });

  const save = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      adminRequest(`/p2p/settings/${encodeURIComponent(key)}`, { method: "PATCH", body: JSON.stringify({ value }) }),
    onSuccess: (_: any, vars: any) => {
      toast({ title: "Сохранено", description: vars.key });
      setEditing(prev => { const n = { ...prev }; delete n[vars.key]; return n; });
      queryClient.invalidateQueries({ queryKey: ["/admin/api/p2p/settings"] });
    },
    onError: (e: Error) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="py-10 text-center text-muted-foreground">Загрузка...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h3 className="font-semibold">Настройки P2P</h3>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />Обновить
        </Button>
      </div>
      <div className="border rounded-lg overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Параметр</TableHead>
              <TableHead className="w-52">Значение</TableHead>
              <TableHead className="w-20">Действие</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {settings.map((s: any) => {
              const meta = SETTING_LABELS[s.key] ?? { label: s.key };
              const isEdited = editing[s.key] !== undefined;
              const displayVal = isEdited ? editing[s.key] : s.value;
              return (
                <TableRow key={s.key}>
                  <TableCell>
                    <div className="font-medium text-sm">{meta.label}</div>
                    {meta.hint && <div className="text-xs text-muted-foreground mt-0.5">{meta.hint}</div>}
                  </TableCell>
                  <TableCell>
                    <Input
                      className="h-8 text-sm"
                      value={displayVal ?? ""}
                      onChange={e => setEditing(prev => ({ ...prev, [s.key]: e.target.value }))}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      className="h-7 px-3 text-xs"
                      disabled={!isEdited || save.isPending}
                      onClick={() => save.mutate({ key: s.key, value: editing[s.key] })}
                    >
                      Сохранить
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {settings.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                  Настройки не найдены — перезапустите сервер для инициализации
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "disputes",       label: "Споры",         icon: AlertTriangle,   badge: "disputes" },
  { id: "orders",         label: "Сделки",        icon: ArrowRightLeft,  badge: null },
  { id: "merchants",      label: "Мерчанты",      icon: Users,           badge: null },
  { id: "ads",            label: "Объявления",    icon: Megaphone,       badge: null },
  { id: "payment-methods",label: "Методы оплаты", icon: CreditCard,      badge: null },
  { id: "verifications",  label: "Верификации",   icon: CheckSquare,     badge: "verifications" },
  { id: "complaints",     label: "Жалобы",        icon: Flag,            badge: "complaints" },
  { id: "logs",           label: "Логи",          icon: ScrollText,      badge: null },
  { id: "settings",       label: "Настройки",     icon: Settings,        badge: null },
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

  const { data: pendingVerifications = [] } = useQuery<any[]>({
    queryKey: ["/admin/api/p2p/verifications", "pending"],
    queryFn: () => adminRequest("/p2p/verifications?status=pending"),
    refetchInterval: 60000,
  });

  const { data: pendingComplaints = [] } = useQuery<any[]>({
    queryKey: ["/admin/api/p2p/complaints", "pending"],
    queryFn: () => adminRequest("/p2p/complaints?status=pending"),
    refetchInterval: 60000,
  });

  const badgeCounts: Record<string, number> = {
    disputes: openDisputes.length,
    verifications: pendingVerifications.length,
    complaints: pendingComplaints.length,
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
          {activeTab === "disputes"        && <DisputesTab />}
          {activeTab === "orders"          && <OrdersTab />}
          {activeTab === "merchants"       && <MerchantsTab />}
          {activeTab === "ads"             && <AdsTab />}
          {activeTab === "payment-methods" && <PaymentMethodsTab />}
          {activeTab === "verifications"   && <VerificationsTab />}
          {activeTab === "complaints"      && <ComplaintsTab />}
          {activeTab === "logs"            && <LogsTab />}
          {activeTab === "settings"        && <SettingsTab />}
        </div>
      </div>
    </AdminLayout>
  );
}
