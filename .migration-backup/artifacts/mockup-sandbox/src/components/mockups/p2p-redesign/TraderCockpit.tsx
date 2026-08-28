import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  BarChart3,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Clock3,
  CreditCard,
  History,
  LayoutDashboard,
  Megaphone,
  Plus,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  WalletCards,
  X,
} from "lucide-react";

type Side = "buy" | "sell";
type Ad = {
  id: number;
  trader: string;
  initials: string;
  avatar: string;
  merchant?: boolean;
  rating: string;
  deals: string;
  completion: string;
  price: string;
  available: string;
  limits: string;
  methods: string[];
  time: string;
};

const ADS: Ad[] = [
  { id: 1, trader: "Kryptonika", initials: "KR", avatar: "#2f8d69", merchant: true, rating: "4.98", deals: "1 284", completion: "99.7%", price: "92.84", available: "18 540.00", limits: "5 000 – 250 000 ₽", methods: ["СБП", "Тинькофф", "Сбербанк"], time: "15 мин" },
  { id: 2, trader: "Илья_обмен", initials: "ИО", avatar: "#4267a7", rating: "4.94", deals: "643", completion: "98.9%", price: "92.91", available: "7 280.00", limits: "1 500 – 100 000 ₽", methods: ["Тинькофф", "СБП"], time: "20 мин" },
  { id: 3, trader: "NorthStar OTC", initials: "NS", avatar: "#9a6b43", merchant: true, rating: "4.97", deals: "2 031", completion: "99.4%", price: "93.06", available: "42 000.00", limits: "10 000 – 500 000 ₽", methods: ["Сбербанк", "Альфа-Банк"], time: "10 мин" },
  { id: 4, trader: "Мария P2P", initials: "MP", avatar: "#7b558b", rating: "4.91", deals: "318", completion: "97.8%", price: "93.18", available: "3 960.00", limits: "1 000 – 75 000 ₽", methods: ["СБП", "Райффайзен"], time: "30 мин" },
];

const activity = [
  { title: "Покупка USDT", person: "Kryptonika", amount: "24 580 ₽", status: "Ожидает оплаты", tone: "amber" },
  { title: "Продажа USDT", person: "Илья_обмен", amount: "8 210 ₽", status: "Средства заблокированы", tone: "green" },
  { title: "Платёж подтверждён", person: "NorthStar OTC", amount: "51 400 ₽", status: "Завершено", tone: "slate" },
];

function MiniIcon({ children, active = false }: { children: ReactNode; active?: boolean }) {
  return <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${active ? "bg-[#3ab368]/15 text-[#59d17e]" : "bg-[#171a20] text-white/45"}`}>{children}</span>;
}

function OrderSheet({ ad, side, onClose }: { ad: Ad; side: Side; onClose: () => void }) {
  const [amount, setAmount] = useState("");
  const value = Number(amount || 0) * Number(ad.price);
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#050609]/80 p-8 backdrop-blur-sm">
      <div className="w-[450px] overflow-hidden rounded-[26px] border border-white/10 bg-[#101318] shadow-2xl shadow-black/60">
        <div className="flex items-start justify-between border-b border-white/[.06] px-6 py-5">
          <div><div className="text-[11px] font-bold uppercase tracking-[.18em] text-[#59d17e]">Новая сделка</div><h2 className="mt-1 text-xl font-semibold text-white">{side === "buy" ? "Купить" : "Продать"} USDT</h2><p className="mt-1 text-sm text-white/40">объявление {ad.trader} · курс {ad.price} ₽</p></div>
          <button onClick={onClose} className="rounded-xl p-2 text-white/45 transition hover:bg-white/5 hover:text-white"><X size={18} /></button>
        </div>
        <div className="space-y-5 px-6 py-6">
          <label className="block"><span className="mb-2 block text-xs font-medium text-white/45">Количество USDT</span><div className="flex items-center rounded-2xl border border-white/10 bg-[#171a20] px-4 focus-within:border-[#3ab368]/60"><input autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-transparent py-4 text-lg text-white outline-none" placeholder="0.00" /><span className="text-sm font-semibold text-white/40">USDT</span></div></label>
          <div className="flex items-center justify-between rounded-2xl bg-[#171a20] px-4 py-3"><span className="text-sm text-white/45">{side === "buy" ? "Вы платите" : "Вы получаете"}</span><strong className="text-white">{value ? value.toLocaleString("ru-RU", { maximumFractionDigits: 2 }) : "0"} ₽</strong></div>
          <div className="rounded-2xl border border-white/[.06] bg-[#0c0f13] p-4 text-xs text-white/45"><div className="flex justify-between"><span>Доступно</span><b className="text-white/75">{ad.available} USDT</b></div><div className="mt-2 flex justify-between"><span>Лимит</span><b className="text-white/75">{ad.limits}</b></div><div className="mt-2 flex justify-between"><span>Метод</span><b className="text-white/75">{ad.methods[0]}</b></div></div>
          <button onClick={onClose} disabled={!amount} className={`w-full rounded-2xl py-3.5 text-sm font-bold transition hover:-translate-y-0.5 disabled:opacity-35 ${side === "buy" ? "bg-[#3ab368] text-[#08110b]" : "bg-[#f97316] text-white"}`}>{side === "buy" ? "Продолжить покупку" : "Продолжить продажу"}</button>
          <p className="text-center text-[11px] text-white/25"><ShieldCheck className="mr-1 inline-block" size={13} />Средства блокируются до подтверждения сделки</p>
        </div>
      </div>
    </div>
  );
}

export default function TraderCockpit() {
  const [side, setSide] = useState<Side>("buy");
  const [asset, setAsset] = useState("USDT TRC20");
  const [payment, setPayment] = useState("Все методы");
  const [amount, setAmount] = useState("Любая сумма");
  const [railTab, setRailTab] = useState("Активные сделки");
  const [selected, setSelected] = useState<Ad | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [notice, setNotice] = useState("Объявления обновляются каждые 15 секунд");

  const filtered = useMemo(() => ADS.filter((ad) => payment === "Все методы" || ad.methods.includes(payment)).filter((ad) => amount === "Любая сумма" || Number(ad.limits.split("–")[1].replace(/\D/g, "")) >= Number(amount.replace(/\D/g, ""))), [amount, payment]);
  const toast = (text: string) => { setNotice(text); window.setTimeout(() => setNotice("Объявления обновляются каждые 15 секунд"), 2600); };

  return (
    <div className="min-h-[720px] min-w-[1080px] bg-[#0b0d11] font-sans text-[#e8edf1]">
      <div className="flex h-[720px]">
        <aside className="flex w-[76px] flex-col items-center border-r border-white/[.055] bg-[#090b0e] py-5">
          <div className="mb-10 flex h-10 w-10 items-center justify-center rounded-2xl bg-[#3ab368] text-[17px] font-black text-[#08110b]">S</div>
          <div className="flex flex-1 flex-col items-center gap-3">
            <button onClick={() => toast("Раздел P2P Exchange")}><MiniIcon active><LayoutDashboard size={17} /></MiniIcon></button>
            <button onClick={() => toast("История сделок открыта")}><MiniIcon><History size={17} /></MiniIcon></button>
            <button onClick={() => toast("Ваши объявления открыты")}><MiniIcon><Megaphone size={17} /></MiniIcon></button>
            <button onClick={() => toast("Реквизиты открыты")}><MiniIcon><CreditCard size={17} /></MiniIcon></button>
          </div>
          <button onClick={() => toast("Справка SwiftX")}><MiniIcon><Sparkles size={17} /></MiniIcon></button>
        </aside>

        <main className="min-w-0 flex-1 overflow-hidden">
          <header className="flex h-[72px] items-center justify-between border-b border-white/[.055] px-8">
            <div className="flex items-center gap-5"><button onClick={() => toast("Возврат на главную")} className="text-white/35 transition hover:text-white"><ChevronLeft size={19} /></button><div><div className="flex items-center gap-2"><h1 className="text-[20px] font-semibold tracking-tight">P2P Exchange</h1><span className="rounded-md bg-[#3ab368]/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#59d17e]">Desk</span></div><p className="mt-0.5 text-[11px] text-white/35">Торговый кабинет · RUB / USDT</p></div></div>
            <div className="flex items-center gap-4"><div className="flex items-center gap-2 text-[11px] text-white/40"><span className="h-2 w-2 animate-pulse rounded-full bg-[#3ab368]" />Сеть стабильна</div><button onClick={() => toast("Профиль мерчанта")} className="flex items-center gap-2 rounded-xl border border-white/[.07] bg-[#13161b] px-3 py-2 text-left transition hover:border-white/15"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#73548c] text-[10px] font-bold">АК</span><span><b className="block text-xs text-white">Алексей К.</b><small className="block text-[10px] text-white/35">Мерчант</small></span><ChevronDown size={14} className="text-white/30" /></button></div>
          </header>

          <div className="h-[648px] overflow-y-auto px-8 py-7">
            <div className="mb-6 flex items-end justify-between"><div><div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.18em] text-[#59d17e]"><span className="h-1.5 w-1.5 rounded-full bg-[#59d17e]" />Рынок в реальном времени</div><h2 className="text-[27px] font-semibold tracking-tight text-white">Найдите лучшее предложение</h2><p className="mt-1 text-sm text-white/40">Откликайтесь на сделки быстро — лучшие цены уже в ленте.</p></div><button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-xl border border-[#3ab368]/30 bg-[#3ab368]/10 px-4 py-2.5 text-xs font-bold text-[#59d17e] transition hover:bg-[#3ab368]/20"><Plus size={15} />Создать объявление</button></div>

            <div className="mb-5 flex items-center justify-between rounded-2xl border border-white/[.06] bg-[#101318] p-1.5">
              <div className="flex items-center gap-1"><button onClick={() => setSide("buy")} className={`rounded-xl px-7 py-2.5 text-sm font-bold transition ${side === "buy" ? "bg-[#3ab368] text-[#07100a] shadow-lg shadow-[#3ab368]/10" : "text-white/40 hover:text-white"}`}>Купить</button><button onClick={() => setSide("sell")} className={`rounded-xl px-7 py-2.5 text-sm font-bold transition ${side === "sell" ? "bg-[#f97316] text-white shadow-lg shadow-[#f97316]/10" : "text-white/40 hover:text-white"}`}>Продать</button></div>
              <div className="flex items-center gap-2 pr-2 text-[11px] text-white/35"><RefreshCw size={13} className="text-[#59d17e]" />Обновлено только что</div>
            </div>

            <div className="mb-6 grid grid-cols-[1.2fr_1fr_1fr_auto] gap-2">
              {[{ label: "Актив", value: asset, set: setAsset, options: ["USDT TRC20", "USDT BEP20", "TON USDT"] }, { label: "Сумма", value: amount, set: setAmount, options: ["Любая сумма", "5 000 ₽", "25 000 ₽", "100 000 ₽"] }, { label: "Оплата", value: payment, set: setPayment, options: ["Все методы", "СБП", "Тинькофф", "Сбербанк"] }].map((filter) => <label key={filter.label} className="rounded-xl border border-white/[.06] bg-[#13161b] px-3 py-2"><span className="block text-[10px] uppercase tracking-wider text-white/30">{filter.label}</span><select value={filter.value} onChange={(e) => filter.set(e.target.value)} className="mt-1 w-full bg-transparent text-xs font-semibold text-white outline-none">{filter.options.map((option) => <option className="bg-[#13161b]" key={option}>{option}</option>)}</select></label>)}
              <button onClick={() => toast("Расширенные фильтры уже применены")} className="flex items-center justify-center rounded-xl border border-white/[.06] bg-[#13161b] px-3 text-white/45 transition hover:border-[#3ab368]/40 hover:text-[#59d17e]"><SlidersHorizontal size={16} /></button>
            </div>

            <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-3"><h3 className="text-sm font-semibold text-white">{side === "buy" ? "Объявления на продажу" : "Заявки на покупку"}</h3><span className="rounded-full bg-white/[.06] px-2 py-0.5 text-[10px] text-white/40">{filtered.length} найдено</span></div><button onClick={() => toast("Сортировка: по лучшей цене")} className="flex items-center gap-1 text-[11px] text-white/35 hover:text-white">Лучшая цена <ChevronDown size={13} /></button></div>
            <div className="space-y-2.5">{filtered.map((ad) => <div key={ad.id} className="group grid grid-cols-[1.35fr_.8fr_.85fr_1fr_112px] items-center gap-4 rounded-2xl border border-white/[.06] bg-[#111419] px-4 py-3.5 transition hover:-translate-y-0.5 hover:border-[#3ab368]/30 hover:bg-[#14181d]">
              <div className="flex items-center gap-3"><span style={{ background: ad.avatar }} className="flex h-9 w-9 items-center justify-center rounded-xl text-[10px] font-bold text-white">{ad.initials}</span><div className="min-w-0"><div className="flex items-center gap-1.5 text-sm font-semibold text-white">{ad.trader}{ad.merchant && <CheckCircle2 size={13} className="text-[#59d17e]" />}</div><div className="mt-1 flex items-center gap-2 text-[10px] text-white/35"><Star size={10} className="fill-[#e9c46a] text-[#e9c46a]" />{ad.rating}<span className="text-white/15">·</span>{ad.deals} сделок</div></div></div>
              <div><span className="block text-[10px] text-white/30">Курс</span><strong className={`mt-1 block text-lg ${side === "buy" ? "text-[#59d17e]" : "text-[#ff9c59]"}`}>{ad.price} <small className="text-[11px] opacity-60">₽</small></strong></div>
              <div><span className="block text-[10px] text-white/30">Доступно</span><strong className="mt-1 block text-xs text-white/80">{ad.available} <small className="text-[10px] text-white/35">USDT</small></strong><span className="mt-1 block text-[10px] text-white/30">лимит {ad.limits}</span></div>
              <div><div className="mb-1 flex items-center justify-between text-[10px]"><span className="text-white/35">Надёжность</span><span className="font-semibold text-[#59d17e]">{ad.completion}</span></div><div className="h-1 overflow-hidden rounded-full bg-white/[.07]"><div className="h-full rounded-full bg-[#3ab368]" style={{ width: ad.completion }} /></div><div className="mt-2 flex items-center gap-1.5 text-[10px] text-white/35"><Clock3 size={11} />{ad.time} · {ad.methods.slice(0, 2).join(", ")}</div></div>
              <button onClick={() => setSelected(ad)} className={`rounded-xl py-2.5 text-xs font-bold transition group-hover:shadow-lg ${side === "buy" ? "bg-[#3ab368] text-[#07100a] hover:bg-[#59d17e]" : "bg-[#f97316] text-white hover:bg-[#ff914d]"}`}>{side === "buy" ? "Купить" : "Продать"}</button>
            </div>)}</div>
            {filtered.length === 0 && <div className="rounded-2xl border border-dashed border-white/10 py-14 text-center text-sm text-white/35">По этим фильтрам объявлений нет</div>}
          </div>
        </main>

        <aside className="w-[342px] shrink-0 border-l border-white/[.055] bg-[#0d1014] px-5 py-6">
          <div className="mb-5 flex items-center justify-between"><div><h2 className="text-sm font-semibold text-white">Рабочая панель</h2><p className="mt-1 text-[11px] text-white/35">Ваши операции и быстрый доступ</p></div><button onClick={() => toast("Синхронизация завершена")} className="rounded-lg p-2 text-white/30 hover:bg-white/5 hover:text-[#59d17e]"><RefreshCw size={15} /></button></div>
          <div className="mb-5 grid grid-cols-3 gap-1 rounded-xl border border-white/[.06] bg-[#13161b] p-1">{[{ n: "Сделки", icon: History, count: "2" }, { n: "Объявления", icon: Megaphone, count: "" }, { n: "Реквизиты", icon: WalletCards, count: "" }].map((item) => <button key={item.n} onClick={() => { setRailTab(item.n); toast(`${item.n}: раздел открыт`); }} className={`relative rounded-lg px-1 py-2 text-[10px] font-medium transition ${railTab === item.n || (railTab === "Активные сделки" && item.n === "Сделки") ? "bg-[#20252c] text-white" : "text-white/35 hover:text-white"}`}><item.icon size={14} className="mx-auto mb-1" />{item.n}{item.count && <span className="absolute right-1 top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[#f97316] px-1 text-[8px] text-white">{item.count}</span>}</button>)}</div>
          <div className="mb-5 rounded-2xl border border-[#3ab368]/15 bg-[#112019] p-4"><div className="flex items-center justify-between"><span className="flex items-center gap-2 text-xs font-semibold text-white"><span className="h-2 w-2 animate-pulse rounded-full bg-[#59d17e]" />Активные сделки</span><span className="text-[10px] text-[#59d17e]">2 сейчас</span></div><div className="mt-4 flex items-end gap-1"><strong className="text-2xl text-white">32 790</strong><span className="mb-1 text-xs text-white/40">₽ в работе</span></div><div className="mt-3 flex items-center gap-2 text-[10px] text-white/40"><BarChart3 size={12} className="text-[#59d17e]" />+12.4% к прошлому часу</div></div>
          <div className="mb-2 flex items-center justify-between"><h3 className="text-xs font-semibold text-white">Последняя активность</h3><button onClick={() => toast("Открыта полная история")} className="text-[10px] text-[#59d17e] hover:underline">Вся история</button></div>
          <div className="space-y-2">{activity.map((item) => <button key={item.person} onClick={() => toast(`Сделка с ${item.person}`)} className="w-full rounded-xl border border-white/[.05] bg-[#13161b] p-3 text-left transition hover:border-white/15"><div className="flex items-start justify-between"><div><div className="text-xs font-semibold text-white">{item.title}</div><div className="mt-1 text-[10px] text-white/35">{item.person} · {item.amount}</div></div><span className={`mt-0.5 h-2 w-2 rounded-full ${item.tone === "green" ? "bg-[#3ab368]" : item.tone === "amber" ? "bg-[#e9b44c]" : "bg-white/25"}`} /></div><div className="mt-2 text-[10px] text-white/45">{item.status}</div></button>)}</div>
          <div className="mt-5 border-t border-white/[.06] pt-5"><div className="mb-3 flex items-center gap-2 text-xs font-semibold text-white"><ShieldCheck size={15} className="text-[#59d17e]" />Защита сделки</div><p className="text-[11px] leading-relaxed text-white/35">Средства блокируются в SwiftX до подтверждения оплаты обеими сторонами.</p></div>
        </aside>
      </div>
      {notice && <div className="absolute bottom-5 left-1/2 z-20 -translate-x-1/2 rounded-full border border-white/10 bg-[#1a1e24] px-4 py-2 text-[11px] text-white/55 shadow-xl"><Check size={13} className="mr-2 inline text-[#59d17e]" />{notice}</div>}
      {selected && <OrderSheet ad={selected} side={side} onClose={() => setSelected(null)} />}
      {showCreate && <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#050609]/80 backdrop-blur-sm"><div className="w-[400px] rounded-[26px] border border-white/10 bg-[#101318] p-6 shadow-2xl"><div className="flex justify-between"><div><div className="text-[11px] font-bold uppercase tracking-[.18em] text-[#59d17e]">Новый оффер</div><h2 className="mt-1 text-xl font-semibold text-white">Создать объявление</h2></div><button onClick={() => setShowCreate(false)} className="text-white/40 hover:text-white"><X size={18} /></button></div><p className="mt-5 text-sm leading-relaxed text-white/45">Откройте форму объявления, чтобы настроить курс, лимиты и доступные методы оплаты.</p><button onClick={() => { setShowCreate(false); toast("Форма создания объявления открыта"); }} className="mt-6 w-full rounded-xl bg-[#3ab368] py-3 text-sm font-bold text-[#07100a] hover:bg-[#59d17e]">Продолжить</button></div></div>}
    </div>
  );
}