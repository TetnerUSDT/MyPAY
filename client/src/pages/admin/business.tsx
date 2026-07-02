import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { adminRequest, getAdminPath } from "@/lib/adminApi";
import {
  RefreshCw, Store, CheckCircle, XCircle, Clock, Eye,
  ExternalLink, Radio
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

export default function AdminBusiness() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const [selected, setSelected] = useState<Shop | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const { data: shops = [], isLoading, refetch } = useQuery<Shop[]>({
    queryKey: ["/admin-business/shops"],
    queryFn: () => adminRequest("/business/shops"),
  });

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
          <Button variant="outline" size="sm" onClick={async () => { const p = await getAdminPath(); setLocation(`/${p}/scanner-providers`); }} className="gap-1.5">
            <Radio className="w-4 h-4" /> RPC Провайдеры
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
    </AdminLayout>
  );
}
