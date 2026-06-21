import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { adminRequest, getAdminCredentials, getAdminPath } from "@/lib/adminApi";
import { Store, CheckCircle2, XCircle, Clock, ChevronLeft, AlertCircle, ArrowDownLeft, ArrowUpRight, Loader2, ExternalLink } from "lucide-react";

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

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    pending:   { label: "Ожидает",       color: "#e9c46a" },
    active:    { label: "Активен",       color: "#3ab368" },
    rejected:  { label: "Отклонён",     color: "#ef4444" },
    suspended: { label: "Приостановлен", color: "#f97316" },
  };
  const s = map[status] ?? { label: status, color: "#ffffff55" };
  return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: s.color + "20", color: s.color }}>
      {s.label}
    </span>
  );
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function AdminBusiness() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Shop | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("all");
  const [adminPath, setAdminPath] = useState("admin");
  const [, setLocation] = useLocation();

  useEffect(() => {
    getAdminPath().then(p => {
      setAdminPath(p);
      const creds = getAdminCredentials();
      if (!creds) { setLocation(`/${p}/login`); return; }
      load();
    });
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await adminRequest("/business/shops");
      setShops(Array.isArray(data) ? data : []);
    } catch { setShops([]); }
    setLoading(false);
  };

  const openShop = (shop: Shop) => {
    setSelected(shop);
    setNewStatus(shop.status);
    setAdminNote(shop.admin_note ?? "");
  };

  const saveStatus = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await adminRequest(`/business/shops/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus, adminNote }),
      });
      await load();
      const updated = shops.find(s => s.id === selected.id);
      if (updated) setSelected({ ...updated, status: newStatus, admin_note: adminNote });
    } catch (e: any) { alert(e.message); }
    setSaving(false);
  };

  const filtered = filter === "all" ? shops : shops.filter(s => s.status === filter);
  const counts = {
    all: shops.length,
    pending: shops.filter(s => s.status === "pending").length,
    active: shops.filter(s => s.status === "active").length,
    rejected: shops.filter(s => s.status === "rejected").length,
  };

  if (selected) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-2xl mx-auto">
          <button onClick={() => setSelected(null)} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4">
            <ChevronLeft className="w-4 h-4" /> Назад к списку
          </button>

          <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-4">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-bold text-gray-900">{selected.name}</h2>
                  <StatusBadge status={selected.status} />
                </div>
                <a href={`https://${selected.domain}`} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-500 flex items-center gap-1">
                  {selected.domain} <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="text-right text-sm text-gray-500">
                <div>ID: {selected.id}</div>
                <div>{formatDate(selected.created_at)}</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <div className="text-xs text-gray-500 mb-1">Баланс</div>
                <div className="font-bold text-gray-900">{parseFloat(selected.balance_usdt).toFixed(4)}</div>
                <div className="text-xs text-gray-400">USDT</div>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <div className="text-xs text-gray-500 mb-1">Получено</div>
                <div className="font-bold text-green-600">{parseFloat(selected.total_received).toFixed(4)}</div>
                <div className="text-xs text-gray-400">USDT</div>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <div className="text-xs text-gray-500 mb-1">Выведено</div>
                <div className="font-bold text-gray-900">{parseFloat(selected.total_paid_out).toFixed(4)}</div>
                <div className="text-xs text-gray-400">USDT</div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-3 mb-4">
              <div className="text-xs text-gray-500 mb-1">Пользователь</div>
              <div className="font-medium text-gray-900">{selected.user_name || `ID: ${selected.user_id}`}</div>
              {selected.tg_username && <div className="text-sm text-blue-500">@{selected.tg_username}</div>}
              {selected.tg_id && <div className="text-xs text-gray-400">TG ID: {selected.tg_id}</div>}
            </div>

            <div className="bg-gray-50 rounded-xl p-3 mb-4">
              <div className="text-xs text-gray-500 mb-1">API-ключ</div>
              <div className="font-mono text-xs text-gray-600 break-all">{selected.api_key}</div>
            </div>

            <div className="border-t border-gray-100 pt-4 space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Изменить статус</label>
                <select
                  value={newStatus} onChange={e => setNewStatus(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                >
                  <option value="pending">Ожидает проверки</option>
                  <option value="active">Активен</option>
                  <option value="rejected">Отклонить</option>
                  <option value="suspended">Приостановить</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Примечание для мерчанта</label>
                <textarea
                  value={adminNote} onChange={e => setAdminNote(e.target.value)}
                  placeholder="Укажите причину отклонения или другую информацию..."
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={saveStatus} disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Сохранить
                </button>
                <button
                  onClick={() => { setNewStatus("active"); setAdminNote(""); saveStatus(); }}
                  disabled={saving || selected.status === "active"}
                  className="px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold disabled:opacity-50"
                >
                  ✓ Одобрить
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setLocation(`/${adminPath}/dashboard`)} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
            <ChevronLeft className="w-4 h-4" /> Панель
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Business — Магазины</h1>
            <p className="text-sm text-gray-500">Управление мерчантами и их магазинами</p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {[
            { id: "all",      label: "Все",           count: counts.all },
            { id: "pending",  label: "Ожидают",       count: counts.pending },
            { id: "active",   label: "Активные",      count: counts.active },
            { id: "rejected", label: "Отклонённые",   count: counts.rejected },
          ].map(f => (
            <button
              key={f.id} onClick={() => setFilter(f.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${filter === f.id ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
            >
              {f.label}
              {f.count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${filter === f.id ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>{f.count}</span>
              )}
            </button>
          ))}
          <button onClick={load} className="ml-auto px-3 py-1.5 rounded-xl text-sm text-gray-500 hover:bg-white border border-gray-200">
            Обновить
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Store className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Магазинов нет</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(shop => (
              <div
                key={shop.id}
                onClick={() => openShop(shop)}
                className="bg-white border border-gray-200 rounded-2xl p-4 hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <Store className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900">{shop.name}</span>
                        <StatusBadge status={shop.status} />
                      </div>
                      <div className="text-sm text-gray-500">{shop.domain}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {shop.user_name || `User #${shop.user_id}`}
                        {shop.tg_username && ` · @${shop.tg_username}`}
                        {" · "}{formatDate(shop.created_at)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right ml-4 flex-shrink-0">
                    <div className="font-bold text-gray-900">{parseFloat(shop.balance_usdt).toFixed(2)} <span className="text-xs text-gray-400">USDT</span></div>
                    <div className="text-xs text-gray-400">↓ {parseFloat(shop.total_received).toFixed(2)} получено</div>
                    {shop.admin_note && (
                      <div className="text-xs text-orange-500 mt-1 max-w-[120px] truncate">{shop.admin_note}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
