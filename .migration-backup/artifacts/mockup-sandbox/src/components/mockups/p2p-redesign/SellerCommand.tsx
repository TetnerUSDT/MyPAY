import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowUpRight,
  Bell,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Copy,
  Filter,
  History,
  MoreHorizontal,
  Plus,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  WalletCards,
  X,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Request = {
  id: number;
  name: string;
  initials: string;
  color: string;
  amount: string;
  fiat: string;
  rate: string;
  method: string;
  age: string;
  expires: string;
  state: "new" | "waiting" | "paid";
};

const initialRequests: Request[] = [
  { id: 1, name: "Kryptonika", initials: "KR", color: "#2f8d69", amount: "1 240.00", fiat: "114 862 ₽", rate: "92.63", method: "СБП", age: "1 мин назад", expires: "14:32", state: "new" },
  { id: 2, name: "NorthStar OTC", initials: "NS", color: "#9a6b43", amount: "2 800.00", fiat: "259 084 ₽", rate: "92.53", method: "Сбербанк", age: "4 мин назад", expires: "14:28", state: "new" },
  { id: 3, name: "Илья_обмен", initials: "ИО", color: "#4267a7", amount: "480.00", fiat: "44 462 ₽", rate: "92.63", method: "Тинькофф", age: "8 мин назад", expires: "14:21", state: "waiting" },
];
const navItems: { label: string; Icon: LucideIcon; active: boolean }[] = [
  { label: "Входящие запросы", Icon: Bell, active: true },
  { label: "Мои сделки", Icon: History, active: false },
  { label: "Мои объявления", Icon: SlidersHorizontal, active: false },
  { label: "Кошелёк", Icon: WalletCards, active: false },
];

function Pill({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "green" | "amber" }) {
  const tones = { muted: "border-white/10 bg-white/[.04] text-white/55", green: "border-[#59d17e]/25 bg-[#59d17e]/10 text-[#7be697]", amber: "border-[#e6ad4a]/25 bg-[#e6ad4a]/10 text-[#f1c76e]" };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold ${tones[tone]}`}>{children}</span>;
}

function RequestCard({ request, onAccept, onDecline, onOpen }: { request: Request; onAccept: () => void; onDecline: () => void; onOpen: () => void }) {
  return (
    <div className="group rounded-[20px] border border-white/[.08] bg-[#171a20] p-4 transition hover:border-[#59d17e]/35 hover:bg-[#1a1e24]">
      <div className="flex items-start justify-between">
        <button onClick={onOpen} className="flex items-center gap-3 text-left">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl text-xs font-bold text-white" style={{ backgroundColor: request.color }}>{request.initials}</span>
          <span><span className="block text-sm font-semibold text-white">{request.name}</span><span className="mt-1 block text-[10px] text-white/40">{request.age} · {request.method}</span></span>
        </button>
        <button onClick={onOpen} className="rounded-lg p-1 text-white/30 hover:bg-white/5 hover:text-white"><MoreHorizontal size={16} /></button>
      </div>
      <div className="mt-5 flex items-end justify-between">
        <div><div className="text-[10px] uppercase tracking-[.14em] text-white/35">К получению</div><div className="mt-1 text-xl font-semibold tracking-tight text-white">{request.amount} <span className="text-xs font-medium text-white/40">USDT</span></div></div>
        <div className="text-right"><div className="text-sm font-semibold text-white">{request.fiat}</div><div className="mt-1 text-[10px] text-white/35">курс {request.rate} ₽</div></div>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-white/[.06] pt-3"><span className="flex items-center gap-1.5 text-[10px] text-white/40"><Clock3 size={12} />истекает в {request.expires}</span>{request.state === "waiting" ? <Pill tone="amber">Ожидает оплаты</Pill> : <Pill tone="green"><span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-[#7be697]" />Новый запрос</Pill>}</div>
      <div className="mt-4 flex gap-2">
        {request.state === "new" ? <><button onClick={onAccept} className="flex-1 rounded-xl bg-[#59d17e] py-2.5 text-xs font-bold text-[#09130c] transition hover:bg-[#7be697]">Принять запрос</button><button onClick={onDecline} className="rounded-xl border border-white/10 px-3 text-white/45 transition hover:border-[#f07979]/40 hover:text-[#f07979]"><X size={15} /></button></> : <button onClick={onOpen} className="flex-1 rounded-xl border border-white/10 py-2.5 text-xs font-semibold text-white/65 hover:border-white/20 hover:text-white">Открыть сделку <ChevronRight size={13} className="ml-1 inline" /></button>}
      </div>
    </div>
  );
}

export function SellerCommand() {
  const [requests, setRequests] = useState(initialRequests);
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState<"incoming" | "active">("incoming");
  const [online, setOnline] = useState(true);
  const [selected, setSelected] = useState<Request | null>(null);
  const [showOffer, setShowOffer] = useState(false);
  const [amount, setAmount] = useState("10 000");
  const [rate, setRate] = useState("92.63");
  const [copied, setCopied] = useState(false);

  const visible = useMemo(() => tab === "incoming" ? requests.filter((r) => r.state === "new") : requests.filter((r) => r.state === "waiting"), [requests, tab]);
  const toast = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2400); };
  const accept = (id: number) => { setRequests((items) => items.map((r) => r.id === id ? { ...r, state: "waiting" } : r)); toast("Запрос принят — сделка открыта"); };
  const decline = (id: number) => { setRequests((items) => items.filter((r) => r.id !== id)); toast("Запрос отклонён"); };

  return (
    <div className="min-h-[100dvh] bg-[#0b0d10] text-white" style={{ fontFamily: "'DM Sans', ui-sans-serif, sans-serif" }}>
      <div className="flex min-h-[100dvh]">
        <aside className="hidden w-[218px] shrink-0 border-r border-white/[.07] bg-[#101318] px-4 py-5 md:block">
          <div className="flex items-center gap-2 px-2"><div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#59d17e] text-[#09130c]"><Zap size={17} fill="currentColor" /></div><span className="text-base font-bold tracking-tight">Swift<span className="text-[#59d17e]">X</span></span></div>
          <div className="mt-10 px-2 text-[9px] font-bold uppercase tracking-[.2em] text-white/25">Оператор</div>
          <nav className="mt-3 space-y-1">
            {navItems.map(({ label, Icon, active }) => <button key={label} onClick={() => toast(label)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-xs font-semibold transition ${active ? "bg-[#59d17e]/12 text-[#7be697]" : "text-white/40 hover:bg-white/[.04] hover:text-white"}`}><Icon size={16} /><span>{label}</span>{active && <span className="ml-auto rounded-full bg-[#59d17e] px-1.5 py-0.5 text-[9px] font-bold text-[#09130c]">3</span>}</button>)}
          </nav>
          <div className="mt-auto pt-36"><div className="rounded-2xl border border-[#59d17e]/15 bg-[#59d17e]/[.06] p-3"><div className="flex items-center gap-2 text-[11px] font-semibold text-[#7be697]"><ShieldCheck size={14} />Защита включена</div><p className="mt-2 text-[10px] leading-relaxed text-white/35">Ваши USDT блокируются до подтверждения оплаты.</p></div><button onClick={() => toast("Настройки открыты")} className="mt-4 flex items-center gap-2 px-2 text-[11px] text-white/35 hover:text-white"><SlidersHorizontal size={14} />Настройки</button></div>
        </aside>
        <main className="min-w-0 flex-1">
          <header className="flex h-[72px] items-center justify-between border-b border-white/[.07] px-5 md:px-9"><div><div className="text-[10px] font-bold uppercase tracking-[.2em] text-[#59d17e]">Торговый пост</div><h1 className="mt-1 text-lg font-semibold tracking-tight">Входящие запросы</h1></div><div className="flex items-center gap-3"><button onClick={() => setOnline(!online)} className="flex items-center gap-2 rounded-full border border-white/10 bg-[#15181d] px-3 py-2 text-[10px] font-semibold text-white/60">{online ? <span className="h-2 w-2 rounded-full bg-[#59d17e] shadow-[0_0_0_3px_rgba(89,209,126,.12)]" /> : <span className="h-2 w-2 rounded-full bg-white/30" />}{online ? "Вы на линии" : "Не на линии"}</button><button onClick={() => toast("Уведомления обновлены")} className="relative rounded-xl border border-white/10 p-2.5 text-white/45 hover:text-white"><Bell size={16} /><span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#e6ad4a]" /></button><div className="hidden h-8 w-8 items-center justify-center rounded-xl bg-[#354a58] text-[10px] font-bold md:flex">АК</div></div></header>
          <div className="mx-auto max-w-[1220px] px-5 py-7 md:px-9">
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[["Входящие", "3", "требуют ответа", "text-[#7be697]"], ["В работе", "2", "активные сделки", "text-white"], ["Заблокировано", "3 920 USDT", "средства в эскроу", "text-white"], ["За сегодня", "+18 240 ₽", "доход от спреда", "text-[#7be697]"]].map(([title, value, sub, tone], i) => <div key={title} className={`rounded-2xl border p-4 ${i === 0 ? "border-[#59d17e]/25 bg-[#59d17e]/[.07]" : "border-white/[.07] bg-[#13161b]"}`}><div className="flex items-center justify-between text-[10px] font-semibold text-white/40"><span>{title}</span>{i === 0 ? <Bell size={13} className="text-[#7be697]" /> : <ArrowUpRight size={13} className="text-white/25" />}</div><div className={`mt-3 text-xl font-semibold ${tone}`}>{value}</div><div className="mt-1 text-[10px] text-white/35">{sub}</div></div>)}
            </section>
            <div className="mt-8 grid gap-7 xl:grid-cols-[minmax(0,1fr)_310px]">
              <section><div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-lg font-semibold">Решения ждут вас</h2><p className="mt-1 text-xs text-white/35">Отвечайте быстро — покупатели видят среднее время ответа.</p></div><div className="flex items-center gap-2"><button onClick={() => toast("Список обновлён")} className="rounded-xl border border-white/10 p-2.5 text-white/45 hover:text-white"><RefreshCw size={15} /></button><button onClick={() => toast("Фильтры открыты")} className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-white/50 hover:text-white"><Filter size={14} />Фильтр</button></div></div>
                <div className="mt-6 flex gap-6 border-b border-white/[.07]"><button onClick={() => setTab("incoming")} className={`border-b-2 pb-3 text-xs font-semibold ${tab === "incoming" ? "border-[#59d17e] text-white" : "border-transparent text-white/35"}`}>Новые <span className="ml-1.5 rounded-full bg-[#59d17e]/15 px-1.5 py-0.5 text-[9px] text-[#7be697]">3</span></button><button onClick={() => setTab("active")} className={`border-b-2 pb-3 text-xs font-semibold ${tab === "active" ? "border-[#59d17e] text-white" : "border-transparent text-white/35"}`}>В работе <span className="ml-1.5 rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] text-white/50">1</span></button></div>
                <div className="mt-5 grid gap-3 lg:grid-cols-2">{visible.map((r) => <RequestCard key={r.id} request={r} onAccept={() => accept(r.id)} onDecline={() => decline(r.id)} onOpen={() => setSelected(r)} />)}{visible.length === 0 && <div className="col-span-2 rounded-2xl border border-dashed border-white/10 py-14 text-center"><CheckCircle2 className="mx-auto text-[#59d17e]" size={25} /><p className="mt-3 text-sm font-semibold">Всё разобрано</p><p className="mt-1 text-xs text-white/35">Новые запросы появятся здесь автоматически.</p></div>}</div>
              </section>
              <aside><div className="rounded-[22px] border border-white/[.08] bg-[#13161b] p-5"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Ваш оффер</h3><button onClick={() => setShowOffer(true)} className="rounded-lg p-1.5 text-white/35 hover:bg-white/5 hover:text-white"><SlidersHorizontal size={15} /></button></div><div className="mt-5 rounded-2xl border border-[#59d17e]/20 bg-[#59d17e]/[.06] p-4"><div className="flex items-center justify-between"><span className="text-[10px] uppercase tracking-[.15em] text-[#7be697]">USDT / RUB</span><span className="flex items-center gap-1 text-[10px] text-[#7be697]"><span className="h-1.5 w-1.5 rounded-full bg-[#59d17e]" />Активен</span></div><div className="mt-3 text-2xl font-semibold">{rate} <span className="text-xs font-medium text-white/35">₽</span></div><div className="mt-2 flex justify-between text-[10px] text-white/35"><span>Лимит: {amount} – 250 000 ₽</span><button onClick={() => setShowOffer(true)} className="text-[#7be697] hover:underline">Изменить</button></div></div><div className="mt-5 space-y-3 text-xs"><div className="flex justify-between"><span className="text-white/40">Доступно</span><span className="font-semibold text-white">8 420.00 USDT</span></div><div className="flex justify-between"><span className="text-white/40">Методы</span><span className="text-white/75">СБП · Тинькофф</span></div><div className="flex justify-between"><span className="text-white/40">Среднее время</span><span className="text-[#7be697]">4 мин</span></div></div><button onClick={() => setOnline(!online)} className="mt-5 w-full rounded-xl border border-white/10 py-2.5 text-xs font-semibold text-white/60 hover:border-white/20 hover:text-white">{online ? "Приостановить оффер" : "Возобновить оффер"}</button></div><div className="mt-4 rounded-[22px] border border-white/[.08] bg-[#13161b] p-5"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Быстрые действия</h3><Plus size={15} className="text-[#7be697]" /></div><button onClick={() => setShowOffer(true)} className="mt-4 flex w-full items-center justify-between rounded-xl bg-[#1b2026] px-3 py-3 text-xs text-white/70 hover:bg-[#20262c]">Создать новое объявление <ChevronRight size={14} /></button><button onClick={() => { setCopied(true); navigator.clipboard?.writeText("swiftx.me/trader/ak"); toast("Ссылка скопирована"); setTimeout(() => setCopied(false), 1500); }} className="mt-2 flex w-full items-center justify-between rounded-xl bg-[#1b2026] px-3 py-3 text-xs text-white/70 hover:bg-[#20262c]">{copied ? "Скопировано" : "Поделиться профилем"}{copied ? <Check size={14} className="text-[#7be697]" /> : <Copy size={14} />}</button></div></aside>
            </div>
          </div>
        </main>
      </div>
      {selected && <div className="fixed inset-0 z-20 flex items-center justify-center bg-[#050609]/80 p-5 backdrop-blur-sm"><div className="w-full max-w-[420px] rounded-[24px] border border-white/10 bg-[#12151a] p-6 shadow-2xl"><div className="flex justify-between"><div><div className="text-[10px] font-bold uppercase tracking-[.18em] text-[#7be697]">Карточка запроса</div><h2 className="mt-2 text-xl font-semibold">{selected.name}</h2></div><button onClick={() => setSelected(null)} className="text-white/40 hover:text-white"><X size={18} /></button></div><div className="mt-6 grid grid-cols-2 gap-3"><div className="rounded-xl bg-white/[.04] p-3"><div className="text-[10px] text-white/35">Количество</div><div className="mt-1 font-semibold">{selected.amount} USDT</div></div><div className="rounded-xl bg-white/[.04] p-3"><div className="text-[10px] text-white/35">К оплате</div><div className="mt-1 font-semibold">{selected.fiat}</div></div></div><button onClick={() => { accept(selected.id); setSelected(null); }} className="mt-5 w-full rounded-xl bg-[#59d17e] py-3 text-xs font-bold text-[#09130c]">Принять запрос</button></div></div>}
      {showOffer && <div className="fixed inset-0 z-20 flex items-center justify-center bg-[#050609]/80 p-5 backdrop-blur-sm"><div className="w-full max-w-[410px] rounded-[24px] border border-white/10 bg-[#12151a] p-6"><div className="flex justify-between"><div><div className="text-[10px] font-bold uppercase tracking-[.18em] text-[#7be697]">Настройка оффера</div><h2 className="mt-2 text-xl font-semibold">Параметры продажи</h2></div><button onClick={() => setShowOffer(false)} className="text-white/40 hover:text-white"><X size={18} /></button></div><label className="mt-6 block text-xs text-white/45">Минимальная сумма<div className="mt-2 flex items-center rounded-xl border border-white/10 bg-[#1a1e24] px-3"><input value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-transparent py-3 text-sm text-white outline-none" /><span className="text-xs text-white/35">₽</span></div></label><label className="mt-4 block text-xs text-white/45">Курс<div className="mt-2 flex items-center rounded-xl border border-white/10 bg-[#1a1e24] px-3"><input value={rate} onChange={(e) => setRate(e.target.value)} className="w-full bg-transparent py-3 text-sm text-white outline-none" /><span className="text-xs text-white/35">₽ / USDT</span></div></label><button onClick={() => { setShowOffer(false); toast("Оффер обновлён"); }} className="mt-6 w-full rounded-xl bg-[#59d17e] py-3 text-xs font-bold text-[#09130c]">Сохранить изменения</button></div></div>}
      {notice && <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full border border-white/10 bg-[#20252c] px-4 py-2.5 text-xs text-white/75 shadow-2xl"><Check size={14} className="mr-2 inline text-[#7be697]" />{notice}</div>}
    </div>
  );
}

export default SellerCommand;