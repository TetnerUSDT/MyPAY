import { useMemo, useState } from "react";
import {
  ArrowDownUp,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  CreditCard,
  History,
  Info,
  LayoutGrid,
  Megaphone,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Star,
  X,
} from "lucide-react";

type Side = "buy" | "sell";

type Ad = {
  id: number;
  name: string;
  initials: string;
  color: string;
  merchant: boolean;
  rating: number;
  orders: number;
  completion: number;
  price: number;
  available: number;
  min: number;
  max: number;
  methods: string[];
  minutes: number;
  last: string;
};

const ADS: Ad[] = [
  { id: 1, name: "Алексей Трейд", initials: "АТ", color: "#287f6a", merchant: true, rating: 4.98, orders: 1284, completion: 99.8, price: 92.41, available: 18420, min: 5000, max: 450000, methods: ["Сбербанк", "Тинькофф", "СБП"], minutes: 15, last: "только что" },
  { id: 2, name: "CryptoMoscow", initials: "CM", color: "#8b5c37", merchant: true, rating: 4.96, orders: 892, completion: 99.4, price: 92.55, available: 9850, min: 10000, max: 280000, methods: ["Тинькофф", "СБП"], minutes: 20, last: "1 мин назад" },
  { id: 3, name: "Владислав К.", initials: "ВК", color: "#4f5d91", merchant: false, rating: 4.91, orders: 347, completion: 98.7, price: 92.72, available: 6400, min: 1500, max: 120000, methods: ["Сбербанк", "Альфа-Банк"], minutes: 15, last: "2 мин назад" },
  { id: 4, name: "Neon Capital", initials: "NC", color: "#97526a", merchant: true, rating: 4.99, orders: 2416, completion: 99.9, price: 92.89, available: 32100, min: 25000, max: 900000, methods: ["СБП", "Райффайзен"], minutes: 30, last: "3 мин назад" },
];

const navItems = [
  { label: "Сделки", icon: History, count: "2", key: "deals" },
  { label: "Объявления", icon: Megaphone, count: "4", key: "ads" },
  { label: "Реквизиты", icon: CreditCard, count: "", key: "payments" },
];

function formatRub(value: number) {
  return value.toLocaleString("ru-RU", { maximumFractionDigits: 0 });
}

function SelectPill({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="group flex h-9 items-center gap-2 rounded-lg border border-white/[.07] bg-[#171a20] px-3 text-left transition hover:border-[#3ab368]/45 hover:bg-[#1b211f]">
      <span className="text-[10px] uppercase tracking-[.12em] text-white/30">{label}</span>
      <span className="text-xs font-medium text-white/75">{value}</span>
      <ChevronDown className="ml-1 h-3.5 w-3.5 text-white/30 transition group-hover:text-[#3ab368]" />
    </button>
  );
}

function AdRow({ ad, side, onSelect }: { ad: Ad; side: Side; onSelect: (ad: Ad) => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <article className="group grid grid-cols-[minmax(180px,1.25fr)_minmax(145px,.8fr)_minmax(150px,.9fr)_minmax(130px,.8fr)_106px] items-center gap-4 border-b border-white/[.06] px-5 py-4 transition hover:bg-[#171b1c]">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: ad.color }}>{ad.initials}</div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-[13px] font-semibold text-white">{ad.name}</p>
            {ad.merchant && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#3ab368]" />}
          </div>
          <div className="mt-1 flex items-center gap-2 text-[10px] text-white/38">
            <span className="flex items-center gap-1 text-[#d1a957]"><Star className="h-2.5 w-2.5 fill-current" />{ad.rating.toFixed(2)}</span>
            <span>•</span><span>{ad.orders} сделок</span>
            <span className="hidden xl:inline">• {ad.completion}%</span>
          </div>
        </div>
      </div>
      <div>
        <p className="text-[17px] font-semibold tracking-tight text-[#3ab368]">{ad.price.toFixed(2)} <span className="text-[11px] text-[#3ab368]/55">₽</span></p>
        <p className="mt-1 text-[10px] text-white/35">за 1 USDT</p>
      </div>
      <div className="text-[11px]">
        <p className="text-white/75"><span className="text-white/35">Доступно </span>{formatRub(ad.available)} USDT</p>
        <p className="mt-1 text-white/35">Лимит <span className="text-white/65">{formatRub(ad.min)} – {formatRub(ad.max)} ₽</span></p>
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap gap-1">
          {(expanded ? ad.methods : ad.methods.slice(0, 2)).map((method) => <span key={method} className="rounded bg-[#20242b] px-1.5 py-1 text-[9px] text-white/55">{method}</span>)}
          {ad.methods.length > 2 && <button onClick={() => setExpanded(!expanded)} className="rounded bg-[#20242b] px-1.5 py-1 text-[9px] text-[#3ab368]">{expanded ? "скрыть" : `+${ad.methods.length - 2}`}</button>}
        </div>
        <p className="mt-1.5 flex items-center gap-1 text-[10px] text-white/30"><Clock3 className="h-3 w-3" /> до {ad.minutes} мин</p>
      </div>
      <button onClick={() => onSelect(ad)} className={`h-9 rounded-lg px-3 text-xs font-bold transition active:scale-[.98] ${side === "buy" ? "bg-[#3ab368] text-[#0b0d0e] hover:bg-[#4bc77a]" : "bg-[#f37a27] text-white hover:bg-[#ff8a39]"}`}>
        {side === "buy" ? "Купить" : "Продать"}
      </button>
    </article>
  );
}

function OrderSheet({ ad, side, onClose }: { ad: Ad; side: Side; onClose: () => void }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState(ad.methods[0]);
  const [submitted, setSubmitted] = useState(false);
  const numeric = Number(amount) || 0;
  const fiat = numeric * ad.price;
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[470px] overflow-hidden rounded-2xl border border-white/10 bg-[#121519] shadow-2xl shadow-black/60">
        <div className="flex items-center justify-between border-b border-white/[.07] px-6 py-5">
          <div><p className="text-[10px] uppercase tracking-[.16em] text-white/35">Новая сделка</p><h2 className="mt-1 text-lg font-semibold text-white">{side === "buy" ? "Купить" : "Продать"} USDT</h2><p className="mt-1 text-xs text-white/40">объявление {ad.name}</p></div>
          <button onClick={onClose} className="rounded-lg p-2 text-white/40 transition hover:bg-white/[.06] hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        {submitted ? <div className="px-6 py-12 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#3ab368]/15 text-[#3ab368]"><Check className="h-7 w-7" /></div><h3 className="mt-4 text-lg font-semibold text-white">Сделка создана</h3><p className="mt-2 text-sm text-white/45">Откройте раздел «Сделки», чтобы продолжить оплату.</p><button onClick={onClose} className="mt-6 rounded-lg bg-[#3ab368] px-6 py-2.5 text-sm font-bold text-[#0b0d0e]">Понятно</button></div> : <div className="space-y-5 px-6 py-5">
          <div className="flex items-center justify-between rounded-xl border border-white/[.07] bg-[#191d22] px-4 py-3"><span className="text-xs text-white/40">Курс</span><span className="font-semibold text-[#3ab368]">{ad.price.toFixed(2)} ₽</span></div>
          <label className="block"><span className="text-xs font-medium text-white/55">Количество USDT</span><div className="relative mt-2"><input autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} type="number" placeholder={`${ad.min} – ${ad.max}`} className="w-full rounded-xl border border-white/[.08] bg-[#191d22] px-4 py-3.5 text-white outline-none transition placeholder:text-white/20 focus:border-[#3ab368]/60" /><span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-white/35">USDT</span></div></label>
          <div className="flex gap-2">{[ad.min, Math.round(ad.max / 3), ad.max].map((n) => <button key={n} onClick={() => setAmount(String(n))} className="flex-1 rounded-lg border border-white/[.07] py-2 text-[11px] text-white/50 transition hover:border-[#3ab368]/40 hover:text-[#3ab368]">{formatRub(n)}</button>)}</div>
          <div className="flex justify-between rounded-xl bg-[#191d22] px-4 py-3 text-xs"><span className="text-white/40">{side === "buy" ? "Вы платите" : "Вы получаете"}</span><b className="text-white">{fiat ? `${fiat.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ₽` : "—"}</b></div>
          <div><p className="mb-2 text-xs font-medium text-white/55">Метод оплаты</p><div className="flex flex-wrap gap-2">{ad.methods.map((m) => <button key={m} onClick={() => setMethod(m)} className={`rounded-lg border px-3 py-2 text-xs transition ${method === m ? "border-[#3ab368]/55 bg-[#3ab368]/10 text-[#3ab368]" : "border-white/[.07] bg-[#191d22] text-white/55"}`}>{m}</button>)}</div></div>
          <p className="text-[10px] text-white/30">Доступно {formatRub(ad.available)} USDT · лимиты {formatRub(ad.min)} – {formatRub(ad.max)} ₽</p>
          <button disabled={!numeric || numeric < ad.min || numeric > ad.max} onClick={() => setSubmitted(true)} className={`w-full rounded-xl py-3.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-35 ${side === "buy" ? "bg-[#3ab368] text-[#0b0d0e]" : "bg-[#f37a27] text-white"}`}>{side === "buy" ? "Создать заявку на покупку" : "Создать заявку на продажу"}</button>
        </div>}
      </div>
    </div>
  );
}

export default function CompactMarketplace() {
  const [side, setSide] = useState<Side>("buy");
  const [currency, setCurrency] = useState("USDT TRC20");
  const [amount, setAmount] = useState("Любая сумма");
  const [payment, setPayment] = useState("Все методы");
  const [activeNav, setActiveNav] = useState("market");
  const [selected, setSelected] = useState<Ad | null>(null);
  const [refreshed, setRefreshed] = useState(false);
  const [search, setSearch] = useState("");
  const visibleAds = useMemo(() => ADS.filter((ad) => ad.name.toLowerCase().includes(search.toLowerCase())), [search]);

  return (
    <main className="min-h-screen bg-[#0b0d0e] font-sans text-[#e8eceb] selection:bg-[#3ab368]/30">
      <div className="mx-auto flex min-h-screen max-w-[1500px]">
        <aside className="hidden w-[76px] shrink-0 flex-col items-center border-r border-white/[.06] bg-[#0d1011] py-6 lg:flex">
          <div className="mb-10 flex h-10 w-10 items-center justify-center rounded-xl bg-[#3ab368] text-lg font-black text-[#0b0d0e]">S</div>
          <div className="flex flex-1 flex-col items-center gap-3">
            <button onClick={() => setActiveNav("market")} className={`rounded-xl p-3 transition ${activeNav === "market" ? "bg-[#3ab368]/15 text-[#3ab368]" : "text-white/30 hover:bg-white/[.05] hover:text-white"}`}><LayoutGrid className="h-[18px] w-[18px]" /></button>
            <button onClick={() => setActiveNav("deals")} className={`rounded-xl p-3 transition ${activeNav === "deals" ? "bg-[#3ab368]/15 text-[#3ab368]" : "text-white/30 hover:bg-white/[.05] hover:text-white"}`}><History className="h-[18px] w-[18px]" /></button>
            <button onClick={() => setActiveNav("ads")} className={`rounded-xl p-3 transition ${activeNav === "ads" ? "bg-[#3ab368]/15 text-[#3ab368]" : "text-white/30 hover:bg-white/[.05] hover:text-white"}`}><Megaphone className="h-[18px] w-[18px]" /></button>
            <button onClick={() => setActiveNav("payments")} className={`rounded-xl p-3 transition ${activeNav === "payments" ? "bg-[#3ab368]/15 text-[#3ab368]" : "text-white/30 hover:bg-white/[.05] hover:text-white"}`}><CreditCard className="h-[18px] w-[18px]" /></button>
          </div>
          <button className="rounded-xl p-3 text-white/30 transition hover:bg-white/[.05] hover:text-white"><BarChart3 className="h-[18px] w-[18px]" /></button>
        </aside>
        <section className="min-w-0 flex-1">
          <header className="flex h-[72px] items-center justify-between border-b border-white/[.06] px-5 sm:px-8">
            <div className="flex items-center gap-3"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3ab368] text-sm font-black text-[#0b0d0e] lg:hidden">S</div><div><p className="text-[10px] uppercase tracking-[.18em] text-[#3ab368]">SwiftX / P2P</p><h1 className="mt-0.5 text-[17px] font-semibold text-white">Биржа объявлений</h1></div></div>
            <div className="flex items-center gap-3"><div className="hidden items-center gap-2 rounded-full border border-[#3ab368]/20 bg-[#3ab368]/[.06] px-3 py-1.5 text-[10px] text-[#6fce94] sm:flex"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#3ab368]" />Обновлено 14 сек назад</div><button onClick={() => setRefreshed(true)} className="rounded-lg p-2 text-white/35 transition hover:bg-white/[.06] hover:text-[#3ab368]"><RefreshCw className={`h-4 w-4 ${refreshed ? "animate-spin" : ""}`} /></button><div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#59624e] text-[10px] font-bold text-white">АК</div></div>
          </header>
          <div className="p-5 sm:p-8">
            <div className="mb-6 flex flex-col justify-between gap-4 xl:flex-row xl:items-end"><div><div className="flex items-center gap-3"><h2 className="text-2xl font-semibold tracking-[-.03em] text-white">Купить и продать крипто</h2><span className="rounded-full border border-white/[.08] bg-[#141819] px-2 py-1 text-[10px] text-white/35">RUB</span></div><p className="mt-2 text-xs text-white/35">Без комиссии. Сделка защищена блокировкой средств.</p></div><div className="flex items-center gap-2"><button onClick={() => setSide("buy")} className={`rounded-lg px-5 py-2.5 text-xs font-semibold transition ${side === "buy" ? "bg-[#3ab368] text-[#0b0d0e]" : "border border-white/[.08] text-white/45 hover:text-white"}`}>Купить</button><button onClick={() => setSide("sell")} className={`rounded-lg px-5 py-2.5 text-xs font-semibold transition ${side === "sell" ? "bg-[#f37a27] text-white" : "border border-white/[.08] text-white/45 hover:text-white"}`}>Продать</button><button onClick={() => setActiveNav("create")} className="ml-2 flex items-center gap-2 rounded-lg border border-[#3ab368]/35 bg-[#3ab368]/10 px-3.5 py-2.5 text-xs font-semibold text-[#53c77d] transition hover:bg-[#3ab368]/20"><Plus className="h-3.5 w-3.5" />Создать объявление</button></div></div>
            <div className="mb-5 flex flex-wrap items-center gap-2"><SelectPill label="Актив" value={currency} onClick={() => setCurrency(currency === "USDT TRC20" ? "USDT BEP20" : "USDT TRC20")} /><SelectPill label="Сумма" value={amount} onClick={() => setAmount(amount === "Любая сумма" ? "от 10 000 ₽" : "Любая сумма")} /><SelectPill label="Оплата" value={payment} onClick={() => setPayment(payment === "Все методы" ? "СБП" : "Все методы")} /><div className="relative ml-auto"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/25" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Найти мерчанта" className="h-9 w-[190px] rounded-lg border border-white/[.07] bg-[#171a20] pl-9 pr-3 text-xs text-white outline-none transition placeholder:text-white/25 focus:border-[#3ab368]/45" /></div></div>
            <div className="overflow-hidden rounded-xl border border-white/[.07] bg-[#111516]"><div className="flex items-center justify-between border-b border-white/[.07] bg-[#15191a] px-5 py-3"><div className="flex items-center gap-2 text-xs font-semibold text-white/75"><span className="h-1.5 w-1.5 rounded-full bg-[#3ab368]" />Лучшие предложения <span className="font-normal text-white/25">· {visibleAds.length} объявлений</span></div><div className="flex items-center gap-1 text-[10px] text-white/30"><ShieldCheck className="h-3.5 w-3.5 text-[#3ab368]/70" /> SwiftX Protected</div></div><div className="hidden grid-cols-[minmax(180px,1.25fr)_minmax(145px,.8fr)_minmax(150px,.9fr)_minmax(130px,.8fr)_106px] gap-4 border-b border-white/[.06] px-5 py-2.5 text-[9px] uppercase tracking-[.12em] text-white/25 md:grid"><span>Мерчант</span><span>Цена</span><span>Объём / лимиты</span><span>Методы оплаты</span><span /></div>{visibleAds.map((ad) => <AdRow key={ad.id} ad={ad} side={side} onSelect={setSelected} />)}</div>
            <div className="mt-3 flex items-center gap-2 text-[10px] text-white/25"><Info className="h-3.5 w-3.5" />Объявления обновляются автоматически каждые 15 секунд <span className="ml-auto hidden sm:inline">Курс может измениться до подтверждения сделки</span></div>
          </div>
        </section>
        <aside className="hidden w-[280px] shrink-0 border-l border-white/[.06] bg-[#0f1213] xl:block"><div className="border-b border-white/[.06] px-5 py-5"><p className="text-[10px] uppercase tracking-[.15em] text-white/30">Рабочая панель</p><div className="mt-4 grid grid-cols-3 gap-1 rounded-lg bg-[#181c1d] p-1">{navItems.map((item) => { const Icon = item.icon; return <button key={item.key} onClick={() => setActiveNav(item.key)} className={`relative flex flex-col items-center gap-1 rounded-md py-2 transition ${activeNav === item.key ? "bg-[#252b2b] text-[#3ab368]" : "text-white/35 hover:text-white/70"}`}><Icon className="h-4 w-4" /><span className="text-[9px]">{item.label}</span>{item.count && <span className="absolute right-1 top-1 text-[8px] text-[#f37a27]">{item.count}</span>}</button>; })}</div></div><div className="px-5 py-5"><div className="flex items-center justify-between"><h3 className="text-xs font-semibold text-white/75">Активные сделки</h3><button onClick={() => setActiveNav("deals")} className="text-[10px] text-[#3ab368] hover:underline">Все</button></div><div className="mt-4 space-y-3">{[{ name: "Покупка USDT", person: "с CryptoMoscow", status: "Ожидает оплаты", color: "#d1a957" }, { name: "Продажа USDT", person: "для Илья_1994", status: "Завершена", color: "#3ab368" }, { name: "Покупка USDT", person: "с Neon Capital", status: "Подтверждение", color: "#6da2cc" }].map((deal) => <button onClick={() => setActiveNav("deals")} key={deal.person} className="w-full rounded-lg border border-white/[.06] bg-[#15191a] p-3 text-left transition hover:border-white/[.14]"><div className="flex items-start justify-between"><div><p className="text-[11px] font-medium text-white/75">{deal.name}</p><p className="mt-1 text-[10px] text-white/30">{deal.person}</p></div><span className="mt-1 h-1.5 w-1.5 rounded-full" style={{ background: deal.color }} /></div><p className="mt-3 text-[10px]" style={{ color: deal.color }}>{deal.status}</p></button>)}</div></div><div className="mx-5 rounded-lg border border-[#3ab368]/15 bg-[#3ab368]/[.05] p-4"><div className="flex items-center gap-2 text-[11px] font-semibold text-[#64cf8a]"><ArrowDownUp className="h-3.5 w-3.5" /> Рынок стабилен</div><p className="mt-2 text-[10px] leading-relaxed text-white/35">Средняя цена USDT за час <span className="text-white/65">92.58 ₽</span></p><div className="mt-3 flex h-6 items-end gap-1">{[35, 42, 32, 55, 48, 66, 59, 76, 67, 85, 73, 91].map((height, i) => <span key={i} className="flex-1 rounded-t-sm bg-[#3ab368]/50" style={{ height: `${height}%` }} />)}</div></div></aside>
      </div>
      {selected && <OrderSheet ad={selected} side={side} onClose={() => setSelected(null)} />}
    </main>
  );
}