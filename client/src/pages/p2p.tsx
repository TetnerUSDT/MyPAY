import { useState, useMemo } from "react";
import { Link } from "wouter";
import { ChevronLeft, HelpCircle, CheckCircle2, Star, SlidersHorizontal, ChevronDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

interface P2POffer {
  id: string;
  trader: {
    name: string;
    avatarColor: string; // hex color for initials avatar
    verified: boolean;
    rating: number;
    orders: number;
    completion: number; // percentage
  };
  price: number; // price in RUB per 1 USDT
  currency: 'USDT' | 'DAI';
  available: number;
  minLimit: number;
  maxLimit: number;
  paymentMethods: string[];
  type: 'buy' | 'sell';
}

const mockOffers: P2POffer[] = [
  {
    id: "1",
    trader: { name: "CryptoMan", avatarColor: "#e63946", verified: true, rating: 4.9, orders: 1205, completion: 99.1 },
    price: 92.45,
    currency: "USDT",
    available: 5000.00,
    minLimit: 1000,
    maxLimit: 150000,
    paymentMethods: ["Тинькофф", "Сбербанк"],
    type: "buy"
  },
  {
    id: "2",
    trader: { name: "FastExchanger", avatarColor: "#2a9d8f", verified: true, rating: 5.0, orders: 342, completion: 100 },
    price: 92.50,
    currency: "USDT",
    available: 2150.50,
    minLimit: 5000,
    maxLimit: 200000,
    paymentMethods: ["Сбербанк", "QIWI"],
    type: "buy"
  },
  {
    id: "3",
    trader: { name: "RusTrader", avatarColor: "#e9c46a", verified: false, rating: 4.7, orders: 89, completion: 95.5 },
    price: 92.80,
    currency: "USDT",
    available: 800.00,
    minLimit: 500,
    maxLimit: 75000,
    paymentMethods: ["ЮMoney", "Raiffeisen"],
    type: "buy"
  },
  {
    id: "4",
    trader: { name: "CryptoKing", avatarColor: "#f4a261", verified: true, rating: 4.98, orders: 4521, completion: 99.8 },
    price: 93.10,
    currency: "USDT",
    available: 15000.00,
    minLimit: 10000,
    maxLimit: 500000,
    paymentMethods: ["Тинькофф"],
    type: "buy"
  },
  {
    id: "5",
    trader: { name: "P2PExpert", avatarColor: "#e76f51", verified: true, rating: 4.85, orders: 672, completion: 98.2 },
    price: 91.80,
    currency: "USDT",
    available: 1200.00,
    minLimit: 1000,
    maxLimit: 100000,
    paymentMethods: ["Тинькофф", "Сбербанк"],
    type: "sell"
  },
  {
    id: "6",
    trader: { name: "SwiftDealer", avatarColor: "#8ab17d", verified: false, rating: 4.6, orders: 45, completion: 92.0 },
    price: 92.50,
    currency: "USDT",
    available: 300.00,
    minLimit: 500,
    maxLimit: 25000,
    paymentMethods: ["QIWI", "ЮMoney"],
    type: "sell"
  }
];

export default function P2PScreen() {
  const { t } = useTranslation();
  const { toast } = useToast();
  
  const [tab, setTab] = useState<'buy' | 'sell'>('buy');
  const [expandedPayments, setExpandedPayments] = useState<Set<string>>(new Set());
  const [currency, setCurrency] = useState('USDT');
  const [amount, setAmount] = useState('any');
  const [payment, setPayment] = useState('any');

  const filteredOffers = useMemo(() => {
    return mockOffers.filter(offer => offer.type === tab);
  }, [tab]);

  const handleInfoClick = () => {
    toast({
      title: "P2P Exchange",
      description: "Торгуйте напрямую с другими пользователями. Без комиссий.",
    });
  };

  const handleOpenTrade = () => {
    toast({
      title: "P2P",
      description: "Открытие P2P торгов скоро",
    });
  };

  return (
    <div className="min-h-screen bg-[#0B0C10] text-[#E2E8F0] pb-28 font-sans selection:bg-[#3ab368]/30 selection:text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-6 pb-4">
        <Link href="/home">
          <button className="w-10 h-10 rounded-full bg-white/5 border border-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
            <ChevronLeft className="w-5 h-5 text-white/70" />
          </button>
        </Link>
        <h1 className="text-[17px] font-semibold tracking-tight text-white">P2P Exchange</h1>
        <button 
          onClick={handleInfoClick}
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/5 transition-colors"
        >
          <HelpCircle className="w-5 h-5 text-white/40 hover:text-white/70" />
        </button>
      </div>

      {/* Tabs */}
      <div className="px-5 mt-2 mb-4">
        <div className="flex bg-[#13151A] rounded-2xl p-1 border border-white/5 relative shadow-lg">
          {/* Animated Indicator */}
          <div 
            className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-[#1A1D24] border border-white/10 rounded-xl transition-all duration-300 ease-in-out"
            style={{ left: tab === 'buy' ? '4px' : 'calc(50%)' }}
          />
          
          <button
            onClick={() => setTab('buy')}
            className={`flex-1 relative z-10 py-2.5 text-sm font-semibold rounded-xl transition-colors duration-200 ${
              tab === 'buy' ? 'text-white' : 'text-white/40 hover:text-white/70'
            }`}
          >
            Buy
          </button>
          <button
            onClick={() => setTab('sell')}
            className={`flex-1 relative z-10 py-2.5 text-sm font-semibold rounded-xl transition-colors duration-200 ${
              tab === 'sell' ? 'text-white' : 'text-white/40 hover:text-white/70'
            }`}
          >
            Sell
          </button>
        </div>
      </div>

      {/* Filter Row */}
      <div className="px-5 mb-6 flex items-center gap-2 overflow-x-auto scrollbar-hide py-1">
        <Select value={currency} onValueChange={setCurrency}>
          <SelectTrigger className="bg-[#1A1D24] border border-white/5 rounded-xl h-9 text-xs font-medium text-white px-3 flex-shrink-0 min-w-0 w-auto focus:ring-0">
            <SelectValue placeholder="Currency" />
          </SelectTrigger>
          <SelectContent className="bg-[#1A1D24] border-white/10 text-white rounded-xl">
            <SelectItem value="USDT">USDT</SelectItem>
            <SelectItem value="DAI">DAI</SelectItem>
          </SelectContent>
        </Select>

        <Select value={amount} onValueChange={setAmount}>
          <SelectTrigger className="bg-[#1A1D24] border border-white/5 rounded-xl h-9 text-xs font-medium text-white px-3 flex-shrink-0 min-w-0 w-auto focus:ring-0">
            <SelectValue placeholder="Amount" />
          </SelectTrigger>
          <SelectContent className="bg-[#1A1D24] border-white/10 text-white rounded-xl">
            <SelectItem value="any">Any amount</SelectItem>
            <SelectItem value="1000">1,000 RUB</SelectItem>
            <SelectItem value="5000">5,000 RUB</SelectItem>
            <SelectItem value="10000">10,000 RUB</SelectItem>
          </SelectContent>
        </Select>

        <Select value={payment} onValueChange={setPayment}>
          <SelectTrigger className="bg-[#1A1D24] border border-white/5 rounded-xl h-9 text-xs font-medium text-white px-3 flex-shrink-0 min-w-0 w-auto focus:ring-0">
            <SelectValue placeholder="Payment" />
          </SelectTrigger>
          <SelectContent className="bg-[#1A1D24] border-white/10 text-white rounded-xl">
            <SelectItem value="any">All methods</SelectItem>
            <SelectItem value="tinkoff">Тинькофф</SelectItem>
            <SelectItem value="sber">Сбербанк</SelectItem>
            <SelectItem value="qiwi">QIWI</SelectItem>
          </SelectContent>
        </Select>

        <button className="h-9 w-9 bg-[#1A1D24] border border-white/5 rounded-xl flex items-center justify-center flex-shrink-0 hover:bg-white/5 transition-colors">
          <SlidersHorizontal className="w-4 h-4 text-white/70" />
        </button>
      </div>

      {/* Offers List */}
      <div className="px-5 space-y-3 flex-1">
        <div className="animate-fadeIn transition-all duration-300">
          {filteredOffers.map((offer) => (
            <div 
              key={offer.id} 
              className="bg-[#13151A] rounded-3xl border border-white/5 p-4 shadow-2xl shadow-black/40 mb-3 flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              {/* Left Column */}
              <div className="flex-1">
                {/* Trader Info */}
                <div className="flex items-center gap-3 mb-3">
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 shadow-inner"
                    style={{ backgroundColor: offer.trader.avatarColor }}
                  >
                    {offer.trader.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-white text-sm">{offer.trader.name}</span>
                      {offer.trader.verified && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#3ab368]" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex items-center text-[10px] text-white/50 font-medium">
                        <Star className="w-3 h-3 text-[#e9c46a] mr-1 fill-current" />
                        {offer.trader.rating.toFixed(2)}
                      </div>
                      <div className="w-1 h-1 rounded-full bg-white/10" />
                      <div className="text-[10px] text-white/50 font-medium">
                        {offer.trader.orders} orders
                      </div>
                      <div className="w-1 h-1 rounded-full bg-white/10" />
                      <div className="text-[10px] text-white/50 font-medium flex items-center gap-1">
                        {offer.trader.completion}%
                        <div className="w-8 h-1 bg-white/5 rounded-full overflow-hidden ml-1">
                          <div 
                            className="h-full bg-[#3ab368]" 
                            style={{ width: `${offer.trader.completion}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Price and Limits */}
                <div className="flex items-end gap-2 mb-2">
                  <div className="text-xl font-bold tracking-tight text-[#3ab368]">
                    {offer.price.toFixed(2)} <span className="text-xs font-semibold text-[#3ab368]/70">RUB</span>
                  </div>
                </div>
                
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-white/40 font-medium">Available</span>
                    <span className="text-white/90 font-semibold">{offer.available.toLocaleString('ru-RU')} {offer.currency}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-white/40 font-medium">Limits</span>
                    <span className="text-white/90 font-semibold">{offer.minLimit.toLocaleString('ru-RU')} – {offer.maxLimit.toLocaleString('ru-RU')} RUB</span>
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div className="flex flex-col justify-end items-end md:w-32 gap-3 shrink-0 border-t border-white/5 pt-3 md:border-t-0 md:pt-0">
                <div className="flex flex-wrap justify-end gap-1.5 w-full">
                  {(expandedPayments.has(offer.id)
                    ? offer.paymentMethods
                    : offer.paymentMethods.slice(0, 2)
                  ).map((method, idx) => (
                    <div
                      key={idx}
                      className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#1A1D24] border border-white/5 text-white/70 shadow-sm"
                    >
                      {method}
                    </div>
                  ))}
                  {offer.paymentMethods.length > 2 && (
                    <button
                      onClick={() =>
                        setExpandedPayments(prev => {
                          const next = new Set(prev);
                          if (next.has(offer.id)) next.delete(offer.id);
                          else next.add(offer.id);
                          return next;
                        })
                      }
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#1A1D24] border border-[#3ab368]/30 text-[#3ab368] hover:bg-[#3ab368]/10 transition-colors"
                    >
                      {expandedPayments.has(offer.id)
                        ? 'Скрыть'
                        : `+${offer.paymentMethods.length - 2} ещё`}
                    </button>
                  )}
                </div>
                <button
                  onClick={handleOpenTrade}
                  className={`w-full py-2.5 px-4 rounded-xl text-sm font-semibold transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 ${
                    tab === 'buy'
                      ? 'bg-[#3ab368] hover:bg-[#3ab368]/90 text-[#0B0C10] shadow-[#3ab368]/20'
                      : 'bg-[#f97316] hover:bg-[#f97316]/90 text-white shadow-[#f97316]/20'
                  }`}
                >
                  {tab === 'buy' ? 'Buy' : 'Sell'} {offer.currency}
                </button>
              </div>
            </div>
          ))}
          
          {filteredOffers.length === 0 && (
            <div className="py-10 text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-3">
                <SlidersHorizontal className="w-6 h-6 text-white/20" />
              </div>
              <p className="text-white/50 text-sm">No offers found.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
