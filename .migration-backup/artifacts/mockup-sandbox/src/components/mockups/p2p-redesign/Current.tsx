import { useMemo, useState } from "react";
import {
  BarChart3, CheckCircle2, ChevronLeft, Clock, CreditCard, HelpCircle,
  History, Megaphone, Plus, SlidersHorizontal, Star, TrendingUp, X,
} from "lucide-react";
import "./_group.css";

type Side = "buy" | "sell";

type Ad = {
  id: number; traderId: number; traderName: string; isMerchant: boolean;
  rating: number; totalOrders: number; successfulPercent: number;
  paymentTimeMinutes: number; price: number; availableAmount: number;
  minAmount: number; maxAmount: number; assetCurrency: string;
  paymentMethods: string[]; side: "buy" | "sell";
};

const AVATAR_COLORS = ["#e63946", "#2a9d8f", "#e9c46a", "#f4a261", "#3ab368", "#4361ee", "#7209b7", "#e76f51"];
const avatarColor = (id: number) => AVATAR_COLORS[id % AVATAR_COLORS.length];

const ADS: Ad[] = [
  { id: 1, traderId: 17, traderName: "CryptoMaks", isMerchant: true, rating: 4.9, totalOrders: 1248, successfulPercent: 99.7, paymentTimeMinutes: 15, price: 92.48, availableAmount: 1850, minAmount: 1000, maxAmount: 100000, assetCurrency: "USDT TRC20", paymentMethods: ["Сбербанк", "Т-Банк", "СБП"], side: "sell" },
  { id: 2, traderId: 28, traderName: "Алексей P2P", isMerchant: true, rating: 5, totalOrders: 642, successfulPercent: 99.2, paymentTimeMinutes: 20, price: 92.62, availableAmount: 740.5, minAmount: 3000, maxAmount: 50000, assetCurrency: "USDT BEP20", paymentMethods: ["Т-Банк", "Райффайзен"], side: "sell" },
  { id: 3, traderId: 41, traderName: "NorthStar", isMerchant: false, rating: 4.8, totalOrders: 218, successfulPercent: 98.6, paymentTimeMinutes: 30, price: 92.78, availableAmount: 350, minAmount: 5000, maxAmount: 30000, assetCurrency: "USDT TRC20", paymentMethods: ["Сбербанк", "СБП", "Альфа-Банк"], side: "sell" },
  { id: 4, traderId: 9, traderName: "RUB Exchange", isMerchant: true, rating: 4.9, totalOrders: 3011, successfulPercent: 99.8, paymentTimeMinutes: 15, price: 91.85, availableAmount: 2200, minAmount: 1000, maxAmount: 150000, assetCurrency: "USDT TRC20", paymentMethods: ["Сбербанк", "Т-Банк"], side: "buy" },
  { id: 5, traderId: 64, traderName: "Марина", isMerchant: false, rating: 4.7, totalOrders: 89, successfulPercent: 97.9, paymentTimeMinutes: 30, price: 91.61, availableAmount: 492, minAmount: 2000, maxAmount: 40000, assetCurrency: "USDT BEP20", paymentMethods: ["СБП", "Альфа-Банк"], side: "buy" },
];

const money = (value: number) => value.toLocaleString("ru-RU", { maximumFractionDigits: 2 });

function OrderSheet({ ad, tab, onClose }: { ad: Ad; tab: Side; onClose: () => void }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [created, setCreated] = useState(false);
  const value = Number(amount) || 0;
  const valid = value >= ad.minAmount / ad.price && value <= ad.maxAmount / ad.price && value <= ad.availableAmount;
  const quickAmounts = [ad.minAmount, Math.round((ad.minAmount + ad.maxAmount) / 3), Math.round((ad.minAmount + ad.maxAmount) * 2 / 3), ad.maxAmount];

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-black/90">
      <div className="relative flex h-full w-full max-w-[460px] flex-col bg-[#0B0C10]">
        <div className="flex items-center justify-between border-b border-white/5 px-5 pb-4 pt-5">
          <div><h2 className="text-lg font-bold text-white">{tab === "buy" ? "Купить" : "Продать"} {ad.assetCurrency}</h2><p className="mt-0.5 text-xs text-white/40">у {ad.traderName}</p></div>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5"><X className="h-4 w-4 text-white/60" /></button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {created ? (
            <div className="rounded-2xl border border-[#3ab368]/25 bg-[#3ab368]/10 p-5 text-center">
              <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-[#3ab368]" /><p className="font-bold text-white">Заявка создана</p><p className="mt-1 text-xs text-white/45">Средства будут заблокированы до завершения сделки.</p>
            </div>
          ) : <>
            <div className="flex items-center justify-between rounded-2xl bg-[#13151A] p-4"><span className="text-sm text-white/40">Курс</span><span className="text-base font-bold text-[#3ab368]">{ad.price.toFixed(2)} ₽</span></div>
            <div className="space-y-2"><label className="text-sm font-medium text-white/50">Количество {ad.assetCurrency}</label><div className="relative"><input value={amount} onChange={e => setAmount(e.target.value)} type="number" placeholder={`${(ad.minAmount / ad.price).toFixed(2)} – ${(ad.maxAmount / ad.price).toFixed(2)}`} className="w-full rounded-2xl border border-white/5 bg-[#13151A] px-4 py-4 pr-24 text-base text-white placeholder:text-white/20" /><span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-white/40">USDT</span></div><div className="flex flex-wrap gap-2">{quickAmounts.map(item => <button key={item} onClick={() => setAmount((item / ad.price).toFixed(2))} className="rounded-xl border border-white/5 bg-[#13151A] px-3 py-2 text-xs text-white/60 hover:border-[#3ab368]/30 hover:text-white">{money(item)}</button>)}</div></div>
            {value > 0 && <div className="flex items-center justify-between rounded-2xl bg-[#13151A] p-4"><span className="text-sm text-white/40">Вы {tab === "buy" ? "платите" : "получаете"}</span><span className="text-lg font-bold text-white">{money(value * ad.price)} ₽</span></div>}
            <div className="space-y-2"><label className="text-sm font-medium text-white/50">Метод оплаты</label><div className="flex flex-wrap gap-2">{ad.paymentMethods.map(item => <button key={item} onClick={() => setMethod(method === item ? "" : item)} className={`rounded-xl border px-4 py-2 text-sm ${method === item ? "border-[#3ab368]/50 bg-[#3ab368]/20 text-[#3ab368]" : "border-white/5 bg-[#13151A] text-white/60"}`}>{item}</button>)}</div></div>
            <div className="rounded-xl bg-[#13151A] p-3 text-xs text-white/30">Доступно: <span className="text-white/50">{ad.availableAmount.toFixed(2)} {ad.assetCurrency}</span> · Лимиты: <span className="text-white/50">{money(ad.minAmount)} – {money(ad.maxAmount)} ₽</span></div>
          </>}
        </div>
        <div className="border-t border-white/5 px-5 pb-8 pt-4"><button disabled={!valid && !created} onClick={() => created ? onClose() : setCreated(true)} className={`w-full rounded-2xl py-4 text-base font-bold shadow-lg disabled:opacity-40 ${tab === "buy" ? "bg-[#3ab368] text-[#0B0C10]" : "bg-[#f97316] text-white"}`}>{created ? "Закрыть" : `${tab === "buy" ? "Купить" : "Продать"} ${ad.assetCurrency}`}</button></div>
      </div>
    </div>
  );
}

function AdCard({ ad, tab, onSelect }: { ad: Ad; tab: Side; onSelect: () => void }) {
  const [expanded, setExpanded] = useState(false);
  return <div className="mb-3 rounded-3xl border border-white/5 bg-[#13151A] p-4 shadow-2xl shadow-black/40 transition hover:border-white/10">
    <div className="mb-3 flex items-center gap-3">
      <button title={`Профиль ${ad.traderName}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ backgroundColor: avatarColor(ad.traderId) }}>{ad.traderName.substring(0, 2).toUpperCase()}</button>
      <div className="min-w-0 flex-1"><div className="flex items-center gap-1.5"><button className="truncate text-sm font-semibold text-white hover:text-[#3ab368]">{ad.traderName}</button>{ad.isMerchant && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#3ab368]" />}</div><div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-white/50"><span className="flex items-center"><Star className="mr-0.5 h-2.5 w-2.5 fill-current text-[#e9c46a]" />{ad.rating.toFixed(1)}</span><i className="h-0.5 w-0.5 rounded-full bg-white/10" /><span>{ad.totalOrders} сделок</span><i className="h-0.5 w-0.5 rounded-full bg-white/10" /><span className="flex items-center gap-1">{ad.successfulPercent.toFixed(1)}% <b className="h-1 w-8 overflow-hidden rounded-full bg-white/5"><b className="block h-full bg-[#3ab368]" style={{ width: `${ad.successfulPercent}%` }} /></b></span></div></div>
      <span className="flex shrink-0 items-center gap-1 text-[10px] text-white/30"><Clock className="h-3 w-3" />{ad.paymentTimeMinutes}м</span>
    </div>
    <div className="mb-2 text-2xl font-bold tracking-tight text-[#3ab368]">{ad.price.toFixed(2)}<span className="ml-1 text-xs font-semibold text-[#3ab368]/60">₽</span></div>
    <div className="mb-3 space-y-1 text-[11px]"><div className="flex justify-between"><span className="text-white/40">Доступно</span><b className="text-white/80">{ad.availableAmount.toFixed(2)} {ad.assetCurrency}</b></div><div className="flex justify-between"><span className="text-white/40">Лимиты</span><b className="text-white/80">{money(ad.minAmount)} – {money(ad.maxAmount)} ₽</b></div></div>
    <div className="flex items-center justify-between gap-3 border-t border-white/5 pt-3"><div className="flex min-w-0 flex-1 flex-wrap gap-1.5">{(expanded ? ad.paymentMethods : ad.paymentMethods.slice(0, 2)).map(item => <span key={item} className="rounded-full border border-white/5 bg-[#1A1D24] px-2 py-0.5 text-[10px] font-medium text-white/60">{item}</span>)}{ad.paymentMethods.length > 2 && <button onClick={() => setExpanded(!expanded)} className="rounded-full border border-[#3ab368]/30 bg-[#1A1D24] px-2 py-0.5 text-[10px] font-semibold text-[#3ab368]">{expanded ? "Скрыть" : `+${ad.paymentMethods.length - 2}`}</button>}</div><button onClick={onSelect} className={`shrink-0 rounded-xl px-5 py-2 text-sm font-bold shadow-lg transition active:scale-95 ${tab === "buy" ? "bg-[#3ab368] text-[#0B0C10]" : "bg-[#f97316] text-white"}`}>{tab === "buy" ? "Купить" : "Продать"}</button></div>
  </div>;
}

export function Current() {
  const [tab, setTab] = useState<Side>("buy");
  const [currency, setCurrency] = useState("any");
  const [amount, setAmount] = useState("any");
  const [payment, setPayment] = useState("any");
  const [selected, setSelected] = useState<Ad | null>(null);
  const [notice, setNotice] = useState("");
  const ads = useMemo(() => ADS.filter(ad => ad.side === (tab === "buy" ? "sell" : "buy")).filter(ad => currency === "any" || ad.assetCurrency.includes(currency)).filter(ad => payment === "any" || ad.paymentMethods.includes(payment)).filter(ad => amount === "any" || ad.maxAmount >= Number(amount)), [tab, currency, payment, amount]);
  const navigate = (label: string) => setNotice(`${label}: переход доступен в приложении`);
  return <div className="p2p-current"><main className="p2p-phone-frame pb-8">
    <header className="flex items-center justify-between px-5 pb-4 pt-6"><button onClick={() => navigate("Главная")} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/5 bg-white/5"><ChevronLeft className="h-5 w-5 text-white/70" /></button><h1 className="text-[17px] font-semibold tracking-tight text-white">P2P Exchange</h1><div className="flex items-center gap-1"><button onClick={() => navigate("Кабинет мерчанта")} title="Кабинет мерчанта" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/5"><BarChart3 className="h-4 w-4 text-white/40" /></button><button onClick={() => navigate("Мои объявления")} title="Мои объявления" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/5"><TrendingUp className="h-4 w-4 text-white/40" /></button><button onClick={() => setNotice("Прямая торговля крипто без комиссий. Безопасная сделка с блокировкой средств.")} title="Помощь" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/5"><HelpCircle className="h-4 w-4 text-white/40" /></button></div></header>
    {notice && <button onClick={() => setNotice("")} className="mx-5 mb-3 block w-[calc(100%-2.5rem)] rounded-xl border border-[#3ab368]/20 bg-[#3ab368]/10 px-3 py-2 text-left text-xs text-[#9cddb2]">{notice}</button>}
    <section className="mx-5 mb-4 mt-1 flex rounded-2xl border border-white/5 bg-[#13151A] p-1 shadow-lg">{(["buy", "sell"] as Side[]).map(item => <button key={item} onClick={() => setTab(item)} className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${tab === item ? "border border-white/10 bg-[#1A1D24] text-white" : "text-white/40 hover:text-white/70"}`}>{item === "buy" ? "Купить" : "Продать"}</button>)}</section>
    <div className="p2p-scroll-row mb-5 flex gap-2 overflow-x-auto px-5 py-1"><select aria-label="Валюта" value={currency} onChange={e => setCurrency(e.target.value)} className="h-9 shrink-0 rounded-xl border border-white/5 bg-[#1A1D24] px-3 text-xs font-medium text-white"><option value="any">Все валюты</option><option value="TRC20">USDT TRC20</option><option value="BEP20">USDT BEP20</option></select><select aria-label="Сумма" value={amount} onChange={e => setAmount(e.target.value)} className="h-9 shrink-0 rounded-xl border border-white/5 bg-[#1A1D24] px-3 text-xs font-medium text-white"><option value="any">Любая сумма</option><option value="1000">1 000 ₽</option><option value="5000">5 000 ₽</option><option value="10000">10 000 ₽</option><option value="50000">50 000 ₽</option></select><select aria-label="Оплата" value={payment} onChange={e => setPayment(e.target.value)} className="h-9 shrink-0 rounded-xl border border-white/5 bg-[#1A1D24] px-3 text-xs font-medium text-white"><option value="any">Все методы</option><option>Сбербанк</option><option>Т-Банк</option><option>СБП</option><option>Альфа-Банк</option></select><button onClick={() => setNotice("Расширенные фильтры доступны в приложении")} title="Фильтры" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/5 bg-[#1A1D24]"><SlidersHorizontal className="h-4 w-4 text-white/70" /></button></div>
    <div className="mx-5 mb-4 grid grid-cols-3 gap-2">{[[History, "Сделки"], [Megaphone, "Объявления"], [CreditCard, "Реквизиты"]].map(([Icon, label]) => { const Glyph = Icon as typeof History; return <button key={label as string} onClick={() => navigate(label as string)} className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/5 bg-[#13151A] py-3 transition hover:border-white/10"><Glyph className="h-4 w-4 text-white/50" /><span className="text-[10px] font-medium text-white/40">{label as string}</span></button>; })}</div>
    <div className="mx-5 mb-4"><button onClick={() => navigate("Создать объявление")} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#3ab368]/20 bg-[#3ab368]/10 py-2.5 text-sm font-semibold text-[#3ab368] transition hover:bg-[#3ab368]/15"><Plus className="h-4 w-4" />Создать объявление</button></div>
    <section className="px-5">{ads.length ? ads.map(ad => <AdCard key={ad.id} ad={ad} tab={tab} onSelect={() => setSelected(ad)} />) : <div className="flex flex-col items-center py-16 text-center"><div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5"><SlidersHorizontal className="h-6 w-6 text-white/20" /></div><p className="text-sm font-medium text-white/40">Объявлений не найдено</p><p className="mt-1 text-xs text-white/25">Попробуйте изменить фильтры</p></div>}</section>
  </main>{selected && <OrderSheet ad={selected} tab={tab} onClose={() => setSelected(null)} />}</div>;
}