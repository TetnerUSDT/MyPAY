import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowDownUp,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  CreditCard,
  HelpCircle,
  History,
  LayoutDashboard,
  Megaphone,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  WalletCards,
  X,
} from "lucide-react";

type Side = "buy" | "sell";
type Ad = {
  id: number;
  trader: string;
  initials: string;
  color: string;
  merchant: boolean;
  rating: number;
  orders: number;
  completion: number;
  price: string;
  available: string;
  limits: string;
  time: string;
  methods: string[];
  side: Side;
};

const ads: Ad[] = [
  { id: 1, trader: "FinBridge", initials: "FB", color: "#2f9961", merchant: true, rating: 4.9, orders: 1284, completion: 99.4, price: "92.18", available: "48 200.00 USDT", limits: "10 000 – 450 000 ₽", time: "15 мин", methods: ["СБП", "Тинькофф", "Сбербанк"], side: "buy" },
  { id: 2, trader: "Роман К.", initials: "РК", color: "#b96c42", merchant: false, rating: 4.8, orders: 416, completion: 98.8, price: "92.24", available: "12 750.00 USDT", limits: "5 000 – 120 000 ₽", time: "30 мин", methods: ["Тинькофф", "СБП"], side: "buy" },
  { id: 3, trader: "Northstar OTC", initials: "NO", color: "#7568ad", merchant: true, rating: 5.0, orders: 892, completion: 99.8, price: "92.31", available: "96 000.00 USDT", limits: "25 000 – 900 000 ₽", time: "15 мин", methods: ["Сбербанк", "Альфа-Банк", "СБП"], side: "buy" },
  { id: 4, trader: "Валерия М.", initials: "ВМ", color: "#456c82", merchant: false, rating: 4.7, orders: 198, completion: 97.9, price: "92.04", available: "8 420.00 USDT", limits: "3 000 – 85 000 ₽", time: "30 мин", methods: ["СБП", "ВТБ"], side: "buy" },
];

const recentDeals = [
  { name: "Александр Н.", amount: "18 420 ₽", status: "Оплата подтверждена", time: "2 мин назад", tone: "green" },
  { name: "Northstar OTC", amount: "72 000 ₽", status: "Ожидает оплаты", time: "8 мин назад", tone: "orange" },
  { name: "Ирина Павлова", amount: "9 800 ₽", status: "Завершено", time: "21 мин назад", tone: "muted" },
];

function Pill({ children, accent = false }: { children: ReactNode; accent?: boolean }) {
  return <span className={`rounded-md border px-2 py-1 text-[11px] font-medium ${accent ? "border-[#3ab368]/25 bg-[#3ab368]/10 text-[#67d88b]" : "border-white/[0.07] bg-[#191c22] text-white/55"}`}>{children}</span>;
}

function OrderSheet({ ad, onClose }: { ad: Ad; onClose: () => void }) {
  const [amount, setAmount] = useState("25 000");
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#060709]/80 p-5 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-[460px] rounded-2xl border border-white/10 bg-[#14171c] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-start justify-between">
          <div><p className="mb-1 text-xs uppercase tracking-[0.16em] text-white/35">Новая сделка</p><h2 className="text-xl font-semibold text-white">{ad.side === "buy" ? "Купить" : "Продать"} USDT</h2></div>
          <button onClick={onClose} className="rounded-lg p-2 text-white/45 transition hover:bg-white/5 hover:text-white"><X size={18} /></button>
        </div>
        <div className="mb-5 flex items-center justify-between rounded-xl border border-white/[0.06] bg-[#0f1115] p-4"><div><p className="text-xs text-white/40">Курс у {ad.trader}</p><p className="mt-1 text-lg font-semibold text-[#59cf7d]">{ad.price} ₽ <span className="text-xs font-normal text-white/35">за USDT</span></p></div><ShieldCheck className="text-[#3ab368]" size={22} /></div>
        <label className="mb-2 block text-xs font-medium text-white/45">Сумма в рублях</label>
        <div className="relative mb-3"><input value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0f1115] px-4 py-3 text-lg text-white outline-none transition focus:border-[#3ab368]/60" /><span className="absolute right-4 top-3.5 text-sm text-white/35">₽</span></div>
        <div className="mb-5 flex gap-2">{["10 000", "25 000", "50 000"].map((value) => <button key={value} onClick={() => setAmount(value)} className="rounded-lg border border-white/[0.07] px-3 py-1.5 text-xs text-white/50 transition hover:border-[#3ab368]/40 hover:text-white">{value} ₽</button>)}</div>
        <div className="mb-5 space-y-3 rounded-xl bg-[#0f1115] p-4 text-xs"><div className="flex justify-between"><span className="text-white/40">Вы получите</span><b className="text-white">{(Number(amount.replaceAll(" ", "")) / Number(ad.price)).toFixed(2)} USDT</b></div><div className="flex justify-between"><span className="text-white/40">Метод оплаты</span><b className="text-white">СБП</b></div></div>
        <button onClick={onClose} className={`w-full rounded-xl py-3 text-sm font-bold transition hover:brightness-110 ${ad.side === "buy" ? "bg-[#3ab368] text-[#08100b]" : "bg-[#f0782b] text-white"}`}>{ad.side === "buy" ? "Продолжить покупку" : "Продолжить продажу"}</button>
      </div>
    </div>
  );
}

export default function LiveDesk() {
  const [side, setSide] = useState<Side>("buy");
  const [asset, setAsset] = useState("USDT TRC20");
  const [payment, setPayment] = useState("Все методы");
  const [selectedAd, setSelectedAd] = useState<Ad | null>(null);
  const [utility, setUtility] = useState("Обзор");
  const [notice, setNotice] = useState("");
  const visibleAds = useMemo(() => ads.filter((ad) => ad.side === side && (payment === "Все методы" || ad.methods.includes(payment))), [side, payment]);

  const notify = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2400); };
  return (
    <div className="min-h-[100dvh] bg-[#0b0d10] font-sans text-[#e6e9ed] selection:bg-[#3ab368]/30">
      <style>{`*{box-sizing:border-box}button,input{font:inherit}.live-scroll::-webkit-scrollbar{width:5px}.live-scroll::-webkit-scrollbar-thumb{background:#30353d;border-radius:10px}`}</style>
      <div className="mx-auto flex min-h-[100dvh] max-w-[1440px]">
        <aside className="hidden w-[218px] shrink-0 border-r border-white/[0.06] bg-[#101216] px-4 py-6 lg:block">
          <div className="mb-10 flex items-center gap-2.5 px-2"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3ab368] text-sm font-black text-[#07100a]">S</div><span className="text-[17px] font-bold tracking-tight text-white">Swift<span className="text-[#55cf7b]">X</span></span></div>
          <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/25">Рабочее пространство</p>
          <nav className="space-y-1">{[["Обзор", LayoutDashboard], ["Сделки", History], ["Объявления", Megaphone], ["Реквизиты", CreditCard]].map(([label, Icon]) => <button key={label as string} onClick={() => setUtility(label as string)} className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm transition ${utility === label ? "bg-[#3ab368]/10 text-[#69d88b]" : "text-white/45 hover:bg-white/[0.04] hover:text-white/75"}`}><span className="flex items-center gap-3"><Icon size={16} />{label as string}</span>{label === "Сделки" && <span className="rounded bg-[#f0782b]/15 px-1.5 py-0.5 text-[10px] text-[#f29459]">2</span>}</button>)}</nav>
          <div className="mt-auto pt-32"><div className="rounded-xl border border-white/[0.06] bg-[#16191e] p-3"><div className="mb-2 flex items-center gap-2 text-xs text-white/45"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#3ab368]" />Система работает</div><p className="text-[11px] leading-4 text-white/25">Объявления обновлены<br />только что</p></div></div>
        </aside>
        <main className="min-w-0 flex-1">
          <header className="flex h-[72px] items-center justify-between border-b border-white/[0.06] px-5 sm:px-8"><div className="flex items-center gap-4"><div className="lg:hidden flex h-8 w-8 items-center justify-center rounded-lg bg-[#3ab368] text-sm font-black text-[#07100a]">S</div><div><p className="text-[11px] font-medium uppercase tracking-[0.17em] text-white/30">P2P Exchange</p><h1 className="text-lg font-semibold text-white">Live Desk</h1></div></div><div className="flex items-center gap-3"><span className="hidden items-center gap-2 text-xs text-white/35 sm:flex"><span className="h-2 w-2 rounded-full bg-[#3ab368] shadow-[0_0_0_3px_rgba(58,179,104,.12)]" />Обновление через 14 сек</span><button onClick={() => notify("Новых уведомлений нет")} className="relative rounded-lg p-2 text-white/45 transition hover:bg-white/5 hover:text-white"><Bell size={18} /><span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#f0782b]" /></button><button onClick={() => notify("Справка SwiftX открыта")} className="rounded-lg p-2 text-white/45 transition hover:bg-white/5 hover:text-white"><HelpCircle size={18} /></button><div className="hidden h-8 w-8 items-center justify-center rounded-full bg-[#456c82] text-[11px] font-bold sm:flex">АК</div></div></header>
          <div className="grid min-h-[calc(100dvh-72px)] grid-cols-1 xl:grid-cols-[minmax(0,1fr)_342px]">
            <section className="min-w-0 px-5 py-7 sm:px-8">
              <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 text-xs text-white/35"><span>Маркетплейс</span><span>/</span><span className="text-white/65">{side === "buy" ? "Покупка" : "Продажа"}</span></div><h2 className="text-[28px] font-semibold tracking-[-0.03em] text-white">Найти лучшее объявление</h2></div><button onClick={() => notify("Форма создания объявления готова")} className="flex items-center gap-2 rounded-lg border border-[#3ab368]/30 bg-[#3ab368]/10 px-3.5 py-2.5 text-xs font-semibold text-[#68d88a] transition hover:bg-[#3ab368]/20"><Plus size={15} />Создать объявление</button></div>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div className="flex rounded-lg border border-white/[0.07] bg-[#14171c] p-1"><button onClick={() => setSide("buy")} className={`rounded-md px-5 py-2 text-sm font-semibold transition ${side === "buy" ? "bg-[#3ab368] text-[#08100b]" : "text-white/40 hover:text-white"}`}>Купить</button><button onClick={() => setSide("sell")} className={`rounded-md px-5 py-2 text-sm font-semibold transition ${side === "sell" ? "bg-[#f0782b] text-white" : "text-white/40 hover:text-white"}`}>Продать</button></div><div className="flex items-center gap-2 text-xs text-white/35"><span className="hidden sm:inline">Найдено объявлений: {visibleAds.length}</span><button onClick={() => notify("Дополнительные фильтры")} className="rounded-lg border border-white/[0.07] bg-[#14171c] p-2 text-white/50 transition hover:text-white"><SlidersHorizontal size={15} /></button></div></div>
              <div className="mb-6 grid grid-cols-1 gap-2 sm:grid-cols-3"><label className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-white/25" /><select value={asset} onChange={(e) => setAsset(e.target.value)} className="w-full appearance-none rounded-lg border border-white/[0.07] bg-[#14171c] py-2.5 pl-9 pr-8 text-xs text-white/75 outline-none"><option>USDT TRC20</option><option>USDT BEP20</option><option>TON USDT</option></select><ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-white/25" /></label><select className="rounded-lg border border-white/[0.07] bg-[#14171c] px-3 py-2.5 text-xs text-white/55 outline-none"><option>Любая сумма</option><option>от 10 000 ₽</option><option>от 50 000 ₽</option></select><select value={payment} onChange={(e) => setPayment(e.target.value)} className="rounded-lg border border-white/[0.07] bg-[#14171c] px-3 py-2.5 text-xs text-white/55 outline-none"><option>Все методы</option><option>СБП</option><option>Тинькофф</option><option>Сбербанк</option></select></div>
              <div className="space-y-2.5">{visibleAds.map((ad, index) => <article key={ad.id} className="group rounded-xl border border-white/[0.07] bg-[#13161b] p-4 transition hover:border-[#3ab368]/30 hover:bg-[#161a1f]"><div className="grid grid-cols-[minmax(175px,1.35fr)_minmax(130px,.8fr)_minmax(130px,.9fr)_auto] items-center gap-5"><div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: ad.color }}>{ad.initials}</div><div className="min-w-0"><div className="flex items-center gap-1.5"><span className="truncate text-sm font-semibold text-white">{ad.trader}</span>{ad.merchant && <CheckCircle2 size={13} className="shrink-0 text-[#3ab368]" />}</div><div className="mt-1 flex items-center gap-2 text-[11px] text-white/38"><span className="flex items-center gap-1 text-[#d1a34d]"><Star size={11} fill="currentColor" />{ad.rating}</span><span>•</span><span>{ad.orders} сделок</span></div></div></div><div><p className="mb-1 text-[10px] uppercase tracking-wider text-white/30">Цена</p><p className={`text-[21px] font-semibold tracking-tight ${side === "buy" ? "text-[#59cf7d]" : "text-[#f28a43]"}`}>{ad.price} <span className="text-xs font-normal">₽</span></p></div><div><p className="mb-1 text-[10px] uppercase tracking-wider text-white/30">Доступно</p><p className="text-sm font-medium text-white/75">{ad.available}</p><p className="mt-1 text-[11px] text-white/35">{ad.limits}</p></div><button onClick={() => setSelectedAd(ad)} className={`rounded-lg px-5 py-2.5 text-xs font-bold transition hover:-translate-y-0.5 ${side === "buy" ? "bg-[#3ab368] text-[#08100b] hover:shadow-[0_6px_20px_rgba(58,179,104,.16)]" : "bg-[#f0782b] text-white"}`}>{side === "buy" ? "Купить" : "Продать"}</button></div><div className="mt-3 flex items-center justify-between border-t border-white/[0.05] pt-3"><div className="flex flex-wrap gap-1.5">{ad.methods.map((method) => <Pill key={method}>{method}</Pill>)}</div><span className="flex items-center gap-1 text-[11px] text-white/30"><Clock3 size={12} />Ответ обычно за {ad.time}</span></div></article>)}</div>
              <div className="mt-5 flex items-center gap-2 rounded-lg border border-white/[0.06] bg-[#111419] px-3 py-2.5 text-xs text-white/35"><ShieldCheck size={15} className="text-[#3ab368]" />Средства защищены эскроу до подтверждения сделки</div>
            </section>
            <aside className="border-t border-white/[0.06] bg-[#101216] px-5 py-6 xl:border-l xl:border-t-0">
              <div className="mb-5 flex items-center justify-between"><h3 className="text-sm font-semibold text-white">Операционный центр</h3><button onClick={() => notify("Активность обновлена")} className="rounded-md p-1.5 text-white/35 transition hover:bg-white/5 hover:text-white"><ArrowDownUp size={15} /></button></div>
              <div className="mb-5 grid grid-cols-3 rounded-lg border border-white/[0.06] bg-[#15181d] p-1">{[["Обзор", LayoutDashboard], ["Сделки", History], ["Мои объявления", Megaphone]].map(([label, Icon]) => <button key={label as string} onClick={() => setUtility(label as string)} className={`flex flex-col items-center gap-1 rounded-md px-1 py-2 text-[10px] transition ${utility === label ? "bg-[#242a2d] text-[#68d88a]" : "text-white/35 hover:text-white/70"}`}><Icon size={14} />{label === "Мои объявления" ? "Мои" : label as string}</button>)}</div>
              <div className="mb-5 rounded-xl border border-white/[0.06] bg-[#15181d] p-4"><div className="mb-3 flex items-center justify-between"><span className="text-xs font-medium text-white/65">Активные сделки</span><span className="flex items-center gap-1 text-[10px] text-[#68d88a]"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#3ab368]" />LIVE</span></div><div className="mb-4 flex items-end justify-between"><span className="text-2xl font-semibold text-white">2</span><span className="text-[11px] text-white/35">за сегодня 14</span></div><div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full w-[68%] rounded-full bg-[#3ab368]" /></div><div className="mt-2 flex justify-between text-[10px] text-white/30"><span>В работе</span><span>68% лимита</span></div></div>
              <div><div className="mb-3 flex items-center justify-between"><h3 className="text-xs font-medium text-white/65">Последняя активность</h3><button onClick={() => setUtility("Сделки")} className="text-[10px] text-[#5acc7d] hover:text-white">Все сделки</button></div><div className="space-y-2">{recentDeals.map((deal) => <button key={deal.name} onClick={() => notify(`Открыта сделка с ${deal.name}`)} className="w-full rounded-lg border border-white/[0.05] bg-[#15181d] p-3 text-left transition hover:border-white/15"><div className="mb-1 flex items-center justify-between"><span className="text-xs font-medium text-white/75">{deal.name}</span><span className={`h-1.5 w-1.5 rounded-full ${deal.tone === "green" ? "bg-[#3ab368]" : deal.tone === "orange" ? "bg-[#f0782b]" : "bg-white/25"}`} /></div><div className="flex items-center justify-between"><span className="text-[11px] text-white/35">{deal.status}</span><span className="text-[11px] font-medium text-white/55">{deal.amount}</span></div><p className="mt-2 text-[10px] text-white/25">{deal.time}</p></button>)}</div></div>
              <button onClick={() => notify("Реквизиты аккаунта открыты")} className="mt-6 flex w-full items-center justify-between rounded-lg border border-white/[0.06] bg-[#15181d] p-3 text-left transition hover:border-[#3ab368]/25"><span className="flex items-center gap-2 text-xs text-white/55"><WalletCards size={15} className="text-white/35" />Платёжные реквизиты</span><span className="text-white/25">→</span></button>
            </aside>
          </div>
        </main>
      </div>
      {notice && <div className="fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-[#3ab368]/30 bg-[#17231b] px-4 py-3 text-xs text-[#8ae0a2] shadow-xl"><Check size={15} />{notice}</div>}
      {selectedAd && <OrderSheet ad={selectedAd} onClose={() => setSelectedAd(null)} />}
    </div>
  );
}