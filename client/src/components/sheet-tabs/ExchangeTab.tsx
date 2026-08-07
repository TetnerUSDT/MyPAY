import { useState, useEffect } from "react";
import { useSearch } from "wouter";
import { ChevronDown, ArrowRight, CreditCard, Copy, Check, ArrowDownUp, Zap, Leaf, Sparkles } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { getBalanceIcon } from "@/lib/balanceIcons";

interface UserCard {
  id: number; name: string; numberCard: string; accountNumber?: string; country: string;
  firstName: string; lastName: string; phone: string; idUser: number; idCard: number;
  idBank?: number | null; bankName?: string | null;
}
interface Balance { id: number; currency: string; network?: string; pattern?: string | null; type?: string; }
interface CountryCard {
  id: number; title: string; country: string; lang: string | null; timeExchange: number;
  commission: string; idBalance: string | null; status: string | null;
}
interface Bank { id: number; cardId: number; bankName: string; timeExchange: number | null; commission: string | null; status: string | null; }

const FIAT_CURRENCIES = ['RUB', 'USD', 'EUR', 'TRY', 'KZT', 'UAH'];
type SpeedMode = 'fast' | 'cheap' | 'smart';

const SPEED_MODES: { id: SpeedMode; icon: React.ReactNode; labelKey: string; eta: string }[] = [
  { id: 'fast',  icon: <Zap className="w-4 h-4" />,      labelKey: 'exchange.mode.fast',  eta: '~1 мин' },
  { id: 'cheap', icon: <Leaf className="w-4 h-4" />,     labelKey: 'exchange.mode.cheap', eta: '~5 мин' },
  { id: 'smart', icon: <Sparkles className="w-4 h-4" />, labelKey: 'exchange.mode.smart', eta: '~2 мин' },
];

function CurrencyBadge({ balance }: { balance: Balance | undefined }) {
  if (!balance) return null;
  return (
    <div className="flex items-center gap-2.5 bg-white/5 hover:bg-white/10 transition-colors py-1.5 pl-1.5 pr-3 rounded-full border border-white/10">
      <div className="w-7 h-7 rounded-full overflow-hidden bg-black/40 flex-shrink-0 flex items-center justify-center border border-white/5">
        <img src={getBalanceIcon(balance.id)} alt={balance.currency} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      </div>
      <div className="flex flex-col items-start justify-center">
        <div className="font-semibold text-white text-sm leading-none tracking-tight">{balance.currency}</div>
        {balance.network && <div className="text-[10px] text-white/40 leading-none mt-0.5 font-medium uppercase tracking-wider">{balance.network}</div>}
      </div>
      <ChevronDown className="w-3.5 h-3.5 text-white/40 ml-0.5" />
    </div>
  );
}

interface ExchangeTabProps {
  onSuccess?: () => void;
}

export default function ExchangeTab({ onSuccess }: ExchangeTabProps) {
  const { t } = useTranslation();
  const searchParams = new URLSearchParams(useSearch());
  const selectedCountryId = searchParams.get('country');
  const exchangeMode = searchParams.get('mode') || 'crypto';
  const fromBalanceParam = searchParams.get('from');
  const toBalanceParam = searchParams.get('to');

  const [payAmount, setPayAmount] = useState("100");
  const [receiveAmount, setReceiveAmount] = useState("0.00");
  const [payBalanceId, setPayBalanceId] = useState<number | null>(fromBalanceParam ? parseInt(fromBalanceParam) : null);
  const [receiveBalanceId, setReceiveBalanceId] = useState<number | null>(toBalanceParam ? parseInt(toBalanceParam) : null);
  const [selectedCard, setSelectedCard] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<'blockchain' | 'balance'>('blockchain');
  const [speedMode, setSpeedMode] = useState<SpeedMode>('smart');
  const { toast } = useToast();

  const isCryptoMode = exchangeMode === 'crypto';

  const [isAddCardModalOpen, setIsAddCardModalOpen] = useState(false);
  const [isCardDetailsModalOpen, setIsCardDetailsModalOpen] = useState(false);
  const [selectedCardIdForBank, setSelectedCardIdForBank] = useState<string>("");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [cardFormData, setCardFormData] = useState({
    name: "", country: "", number: "", accountNumber: "",
    firstName: "", lastName: "", phone: "", idCard: "", idBank: ""
  });

  const { data: receiveBalances = [] } = useQuery<Balance[]>({
    queryKey: ['/api/exchange/receive-balances', selectedCountryId, isCryptoMode],
    queryFn: async () => {
      if (isCryptoMode) {
        const response = await fetch('/api/exchange/crypto/receive-balances', { credentials: 'include' });
        if (!response.ok) throw new Error('Failed to fetch');
        return response.json();
      }
      if (!selectedCountryId) return [];
      const response = await fetch(`/api/exchange/receive-balances/${selectedCountryId}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch');
      return response.json();
    },
    enabled: isCryptoMode || !!selectedCountryId
  });

  const { data: paymentBalances = [] } = useQuery<Balance[]>({
    queryKey: ['/api/exchange/payment-balances', receiveBalanceId, isCryptoMode],
    queryFn: async () => {
      if (!receiveBalanceId) return [];
      const response = await fetch(`/api/exchange/payment-balances/${receiveBalanceId}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch');
      return response.json();
    },
    enabled: !!receiveBalanceId
  });

  const { data: userCards = [] } = useQuery<UserCard[]>({ queryKey: ['/api/user-cards'] });
  const { data: activeCards = [] } = useQuery<CountryCard[]>({ queryKey: ['/api/cards/active'] });

  const { data: banks = [] } = useQuery<Bank[]>({
    queryKey: ['/api/banks', selectedCardIdForBank],
    queryFn: async () => {
      const response = await fetch(`/api/banks/${selectedCardIdForBank}`);
      if (!response.ok) throw new Error('Failed to fetch banks');
      return response.json();
    },
    enabled: !!selectedCardIdForBank && selectedCardIdForBank !== ""
  });

  const { data: userBalance } = useQuery<{ sum: string }>({
    queryKey: ['/api/user-balance', payBalanceId],
    queryFn: async () => {
      if (!payBalanceId) return null;
      const response = await fetch(`/api/user-balance/${payBalanceId}`, { credentials: 'include' });
      if (!response.ok) return { sum: '0' };
      return response.json();
    },
    enabled: !!payBalanceId && paymentMethod === 'balance'
  });

  const { data: exchangeRate } = useQuery<{ rate: number; fromCurrency: string; toCurrency: string; fromNetwork: string; toNetwork: string }>({
    queryKey: ['/api/exchange/rate', payBalanceId, receiveBalanceId],
    queryFn: async () => {
      if (!payBalanceId || !receiveBalanceId) return null;
      const response = await fetch(`/api/exchange/rate/${payBalanceId}/${receiveBalanceId}`);
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!payBalanceId && !!receiveBalanceId
  });

  const filteredReceiveBalances = isCryptoMode
    ? receiveBalances.filter(b => !FIAT_CURRENCIES.includes(b.currency))
    : receiveBalances;

  const filteredPaymentBalances = isCryptoMode
    ? paymentBalances.filter(b => !FIAT_CURRENCIES.includes(b.currency))
    : paymentBalances;

  useEffect(() => {
    if (filteredReceiveBalances.length > 0 && !receiveBalanceId) {
      setReceiveBalanceId(filteredReceiveBalances[0].id);
    }
  }, [filteredReceiveBalances, receiveBalanceId]);

  useEffect(() => {
    if (filteredPaymentBalances.length === 0 && payBalanceId !== null) return;
    if (filteredPaymentBalances.length > 0) {
      const isAvailable = filteredPaymentBalances.some(b => b.id === payBalanceId);
      if (!isAvailable) setPayBalanceId(filteredPaymentBalances[0].id);
    } else {
      setPayBalanceId(null);
    }
  }, [filteredPaymentBalances, payBalanceId]);

  useEffect(() => {
    const calculate = async () => {
      if (!payBalanceId || !receiveBalanceId || !payAmount) return;
      try {
        const response = await fetch('/api/exchange/quote', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fromBalanceId: payBalanceId, toBalanceId: receiveBalanceId, amount: payAmount })
        });
        if (response.ok) {
          const data = await response.json();
          setReceiveAmount(data.toAmount.toFixed(2));
        }
      } catch {}
    };
    const debounce = setTimeout(calculate, 300);
    return () => clearTimeout(debounce);
  }, [payAmount, payBalanceId, receiveBalanceId]);

  const handleSwap = () => {
    const oldPay = payBalanceId; const oldReceive = receiveBalanceId;
    const oldPayAmt = payAmount; const oldReceiveAmt = receiveAmount;
    setReceiveBalanceId(oldPay); setPayBalanceId(oldReceive);
    setPayAmount(oldReceiveAmt); setReceiveAmount(oldPayAmt);
  };

  const cardOptions = userCards
    .filter(card => selectedCountryId && card.idCard === parseInt(selectedCountryId))
    .map(card => {
      const parts = [];
      if (card.numberCard) parts.push(`****${card.numberCard.slice(-4)}`);
      if (card.accountNumber) parts.push(`****${card.accountNumber.slice(-4)}`);
      return { value: card.id.toString(), label: `${card.name} (${parts.join(', ')})` };
    });

  const formatCardNumber = (value: string) => value.replace(/(\d{4})(?=\d)/g, '$1 ');
  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCardFormData({ ...cardFormData, number: e.target.value.replace(/\D/g, '').slice(0, 16) });
  };
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCardFormData({ ...cardFormData, phone: '+' + e.target.value.replace(/\D/g, '').slice(0, 15) });
  };
  const handleNameChange = (field: 'firstName' | 'lastName') => (e: React.ChangeEvent<HTMLInputElement>) => {
    setCardFormData({ ...cardFormData, [field]: e.target.value.replace(/[^a-zA-Z\s]/g, '') });
  };
  const handleAccountNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCardFormData({ ...cardFormData, accountNumber: e.target.value.replace(/\D/g, '').slice(0, 20) });
  };

  const createCardMutation = useMutation({
    mutationFn: async (cardData: any) => {
      const response = await fetch('/api/user-cards', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cardData) });
      if (!response.ok) throw new Error('Failed to create card');
      return response.json();
    },
    onSuccess: (newCard) => {
      queryClient.invalidateQueries({ queryKey: ['/api/user-cards'] });
      setCardFormData({ name: "", country: "", number: "", accountNumber: "", firstName: "", lastName: "", phone: "", idCard: "", idBank: "" });
      setSelectedCardIdForBank("");
      setIsAddCardModalOpen(false);
      setSelectedCard(newCard.id.toString());
      toast({ title: t('exchange.cardAddedSuccess') });
    },
    onError: () => toast({ title: t('exchange.cardAddError'), variant: "destructive" })
  });

  const handleAddCard = () => {
    if (!cardFormData.name || !cardFormData.country || !cardFormData.firstName || !cardFormData.lastName || !cardFormData.phone || !cardFormData.idCard) {
      toast({ title: t('common.fillAllFields'), variant: "destructive" }); return;
    }
    if (!cardFormData.number && !cardFormData.accountNumber) {
      toast({ title: t('exchange.fillCardOrAccount'), variant: "destructive" }); return;
    }
    const dataToSend: any = { name: cardFormData.name, country: cardFormData.country, firstName: cardFormData.firstName, lastName: cardFormData.lastName, phone: cardFormData.phone, idCard: cardFormData.idCard };
    if (cardFormData.number) dataToSend.number = cardFormData.number;
    if (cardFormData.accountNumber) dataToSend.accountNumber = cardFormData.accountNumber;
    if (cardFormData.idBank) dataToSend.idBank = parseInt(cardFormData.idBank);
    createCardMutation.mutate(dataToSend);
  };

  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch { toast({ title: t('common.copyError'), variant: "destructive" }); }
  };

  const createExchangeMutation = useMutation({
    mutationFn: async (exchangeData: any) => {
      const response = await apiRequest("POST", "/api/exchange/create", exchangeData);
      return response.json();
    },
    onSuccess: (data) => {
      onSuccess?.();
      // Navigate to payment page after closing sheet
      window.location.href = `/payment?order=${data.numberOrder}`;
    },
    onError: (error: any) => toast({ title: t('common.error'), description: error.message || t('exchange.exchangeError'), variant: "destructive" })
  });

  const handleExchange = async () => {
    if (!payBalanceId || !receiveBalanceId) { toast({ title: t('common.error'), description: t('exchange.selectCurrencies'), variant: "destructive" }); return; }
    if (!payAmount || parseFloat(payAmount) <= 0) { toast({ title: t('common.error'), description: t('exchange.enterValidAmount'), variant: "destructive" }); return; }
    if (paymentMethod === 'balance') {
      const available = userBalance ? parseFloat(userBalance.sum) : 0;
      if (parseFloat(payAmount) > available) {
        const bal = paymentBalances.find(b => b.id === payBalanceId);
        toast({ title: t('exchange.insufficientBalance'), description: `${t('common.available')}: ${available.toFixed(2)} ${bal?.currency}`, variant: "destructive" }); return;
      }
    }
    if (!isCryptoMode && !selectedCard) { toast({ title: t('common.error'), description: t('exchange.selectOrEnterCard'), variant: "destructive" }); return; }
    if (isCryptoMode && paymentMethod === 'blockchain' && !walletAddress) { toast({ title: t('common.error'), description: t('exchange.enterWalletAddress'), variant: "destructive" }); return; }
    const selectedPaymentBalance = paymentBalances.find(b => b.id === payBalanceId);
    if (!selectedPaymentBalance) { toast({ title: t('common.error'), description: t('exchange.cannotDetectPayCurrency'), variant: "destructive" }); return; }
    const network = selectedPaymentBalance.network;
    if (!network) { toast({ title: t('common.error'), description: t('exchange.cannotDetectNetwork'), variant: "destructive" }); return; }
    const fromCurrency = selectedPaymentBalance.currency;
    const toCurrency = filteredReceiveBalances.find(b => b.id === receiveBalanceId)?.currency || 'USDT';
    const rate = receiveAmount && payAmount ? (parseFloat(receiveAmount) / parseFloat(payAmount)).toString() : "0";
    createExchangeMutation.mutate({
      fromBalanceId: payBalanceId, toBalanceId: receiveBalanceId, fromCurrency, toCurrency,
      amountFrom: payAmount, amountTo: receiveAmount, rate, commission: "0.0",
      cardId: selectedCard ? parseInt(selectedCard) : null,
      manualCardNumber: isCryptoMode && walletAddress ? walletAddress : null,
      network, paymentMethod
    });
  };

  const currentPayBalance = filteredPaymentBalances.find(b => b.id === payBalanceId);
  const currentReceiveBalance = filteredReceiveBalances.find(b => b.id === receiveBalanceId);
  const currentSpeedMode = SPEED_MODES.find(m => m.id === speedMode)!;

  const walletPlaceholder = (() => {
    const net = currentReceiveBalance?.network;
    if (net === 'TRC20') return 'T...';
    if (net === 'BEP20' || net === 'Polygon') return '0x...';
    if (net === 'TON') return 'EQ...';
    return t('exchange.enterWalletAddress');
  })();

  // ── Original exchange.tsx JSX (header removed, onSuccess wired) ──
  return (
    <div className="text-[#E2E8F0] pb-6 font-sans">
      <div className="space-y-3 mt-2">

        {/* Trading Panel */}
        <div className="relative">
          {/* FROM block */}
          <div className="rounded-3xl bg-[#13151A] border border-white/5 p-5 shadow-2xl shadow-black/40 relative z-0">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[11px] text-white/40 font-bold uppercase tracking-wider">{t('exchange.youPay')}</span>
              <div className="flex bg-black/40 rounded-full p-0.5 border border-white/5">
                <button onClick={() => setPaymentMethod('blockchain')} className={`px-3 py-1 text-[11px] font-medium rounded-full transition-all ${paymentMethod === 'blockchain' ? 'bg-[#2A2E37] text-white shadow-sm' : 'text-white/40 hover:text-white/70'}`} data-testid="button-payment-blockchain">Blockchain</button>
                <button onClick={() => setPaymentMethod('balance')} className={`px-3 py-1 text-[11px] font-medium rounded-full transition-all ${paymentMethod === 'balance' ? 'bg-[#2A2E37] text-white shadow-sm' : 'text-white/40 hover:text-white/70'}`} data-testid="button-payment-balance">{t('exchange.balance')}</button>
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="w-full bg-transparent text-4xl font-semibold tracking-tight text-white outline-none placeholder-white/20" placeholder="0.00" data-testid="input-pay-amount" />
              <div className="flex items-center justify-between">
                <Select value={payBalanceId?.toString()} onValueChange={(v) => setPayBalanceId(parseInt(v))}>
                  <SelectTrigger className="w-auto min-w-0 bg-transparent border-0 p-0 h-auto focus:ring-0 [&>svg]:hidden" data-testid="select-pay-currency">
                    <CurrencyBadge balance={currentPayBalance} />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1A1D24] border-white/10 text-white rounded-xl">
                    {filteredPaymentBalances.map((b) => (
                      <SelectItem key={b.id} value={b.id.toString()} className="focus:bg-white/5 focus:text-white rounded-lg cursor-pointer">{b.currency}{b.network ? ` • ${b.network}` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {paymentMethod === 'balance' && userBalance && (
                  <div className="text-[11px] font-medium text-white/30 uppercase tracking-wider">
                    {t('common.available')}: <span className="text-white/70 ml-1">{parseFloat(userBalance.sum).toFixed(2)} {currentPayBalance?.currency}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Swap button */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center">
            <div className="w-2 h-2 bg-[#0B0C10] absolute -top-2 rounded-b-full"></div>
            <button onClick={handleSwap} className="w-12 h-12 rounded-full bg-[#1A1D24] border-[4px] border-[#0B0C10] flex items-center justify-center hover:bg-[#2A2E37] hover:scale-105 active:scale-95 transition-all shadow-xl group" data-testid="button-swap">
              <ArrowDownUp className="w-4 h-4 text-accent group-hover:text-accent/80 transition-colors" />
            </button>
            <div className="w-2 h-2 bg-[#0B0C10] absolute -bottom-2 rounded-t-full"></div>
          </div>

          {/* TO block */}
          <div className="rounded-3xl bg-[#13151A] border border-white/5 p-5 shadow-2xl shadow-black/40 mt-1 relative z-0">
            <span className="text-[11px] text-white/40 font-bold uppercase tracking-wider block mb-4">{t('exchange.youReceive')}</span>
            <div className="flex flex-col gap-4">
              <div className="w-full text-4xl font-semibold tracking-tight text-white/90 truncate">{receiveAmount}</div>
              <Select value={receiveBalanceId?.toString()} onValueChange={(v) => setReceiveBalanceId(parseInt(v))}>
                <SelectTrigger className="w-auto min-w-0 bg-transparent border-0 p-0 h-auto focus:ring-0 [&>svg]:hidden" data-testid="select-receive-currency">
                  <CurrencyBadge balance={currentReceiveBalance} />
                </SelectTrigger>
                <SelectContent className="bg-[#1A1D24] border-white/10 text-white rounded-xl">
                  {filteredReceiveBalances.map((b) => (
                    <SelectItem key={b.id} value={b.id.toString()} className="focus:bg-white/5 focus:text-white rounded-lg cursor-pointer">{b.currency}{b.network ? ` • ${b.network}` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Rate info */}
        {exchangeRate && (
          <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-4 space-y-3 mt-4">
            <div className="flex items-center justify-between">
              <div className="text-[13px] text-white/50 font-medium">{t('exchange.rate')}</div>
              <div className="text-[13px] text-white/90 font-medium font-mono bg-white/5 px-2 py-0.5 rounded-md" data-testid="exchange-rate-display">
                1 {exchangeRate.fromCurrency} = {exchangeRate.rate.toFixed(4)} {exchangeRate.toCurrency}
              </div>
            </div>
            <div className="h-px w-full bg-white/5"></div>
            <div className="flex items-center justify-between">
              <div className="text-[13px] text-white/50 font-medium">{t('exchange.commission')}</div>
              <div className="text-[13px] text-[#3ab368] font-medium">Free</div>
            </div>
          </div>
        )}

        {/* Speed mode — temporarily hidden */}
        {/* <div className="pt-1">
          <div className="text-[11px] text-white/40 font-bold uppercase tracking-wider mb-2 px-1">Processing Speed</div>
          <div className="flex gap-1.5">
            {SPEED_MODES.map((mode) => (
              <button
                key={mode.id}
                onClick={() => setSpeedMode(mode.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl border transition-all duration-200 relative overflow-hidden ${
                  speedMode === mode.id
                    ? 'bg-[#1A2E22] border-[#3ab368]/30'
                    : 'bg-[#13151A] border-white/5 text-white/40 hover:bg-white/5 hover:text-white/60'
                }`}
                data-testid={`speed-mode-${mode.id}`}
              >
                {speedMode === mode.id && <div className="absolute inset-0 bg-gradient-to-b from-[#3ab368]/10 to-transparent opacity-50 pointer-events-none" />}
                <span className={`relative z-10 transition-colors ${speedMode === mode.id ? 'text-[#3ab368]' : ''}`}
                  style={{ display: 'contents' }}>
                  {mode.icon}
                </span>
                <span className={`text-[11px] font-semibold relative z-10 ${speedMode === mode.id ? 'text-white' : ''}`}>{t(mode.labelKey)}</span>
                <span className={`text-[10px] relative z-10 ${speedMode === mode.id ? 'text-[#3ab368]/80' : 'text-white/25'}`}>{mode.eta}</span>
              </button>
            ))}
          </div>
        </div> */}

        {/* Card selection — bank mode only */}
        {!isCryptoMode && (
          <div className="rounded-2xl bg-[#13151A] border border-white/5 p-4 mt-2">
            <div className="text-[11px] text-white/40 font-bold uppercase tracking-wider mb-3">{t('exchange.selectCard')}</div>
            <Select value={selectedCard} onValueChange={(value) => { if (value === 'add_card') setIsAddCardModalOpen(true); else setSelectedCard(value); }}>
              <SelectTrigger className="w-full bg-[#1A1D24] border border-white/5 text-white h-12 rounded-xl focus:ring-1 focus:ring-[#3ab368]/50" data-testid="select-card"><SelectValue placeholder={t('exchange.selectCard')} /></SelectTrigger>
              <SelectContent className="bg-[#1A1D24] border-white/10 text-white rounded-xl">
                {cardOptions.map((option) => (<SelectItem key={option.value} value={option.value} className="focus:bg-white/5 rounded-lg cursor-pointer my-1">{option.label}</SelectItem>))}
                <div className="h-px bg-white/10 my-1 mx-2"></div>
                <SelectItem value="add_card" className="focus:bg-[#3ab368]/10 focus:text-[#3ab368] rounded-lg cursor-pointer my-1 font-medium">+ {t('exchange.addCard')}</SelectItem>
              </SelectContent>
            </Select>
            {selectedCard && selectedCard !== 'add_card' && (() => {
              const card = userCards.find(c => c.id.toString() === selectedCard);
              if (!card) return null;
              const parts = [];
              if (card.numberCard) parts.push(formatCardNumber(card.numberCard));
              if (card.accountNumber) parts.push(card.accountNumber);
              return (
                <button onClick={() => setIsCardDetailsModalOpen(true)} className="w-full mt-3 bg-[#1A1D24] border border-white/5 rounded-xl px-4 py-3.5 text-left hover:bg-white/5 transition-all group" data-testid="button-card-details">
                  <div className="text-white/90 font-medium text-[13px] mb-1 group-hover:text-[#3ab368] transition-colors">{card.name}</div>
                  <div className="text-white/50 font-mono text-[12px] tracking-wide">{parts.join(' • ')}</div>
                </button>
              );
            })()}
          </div>
        )}

        {/* Wallet address — crypto + blockchain */}
        {isCryptoMode && paymentMethod === 'blockchain' && (
          <div className="rounded-2xl bg-[#13151A] border border-white/5 p-4 mt-2">
            <div className="text-[11px] text-white/40 font-bold uppercase tracking-wider mb-3 flex items-center justify-between">
              <span>{t('exchange.walletAddress')}</span>
              {currentReceiveBalance?.network && (
                <span className="text-[#3ab368]/80 bg-[#3ab368]/10 px-1.5 py-0.5 rounded text-[9px]">{currentReceiveBalance.network}</span>
              )}
            </div>
            <Input value={walletAddress} onChange={(e) => setWalletAddress(e.target.value)} placeholder={walletPlaceholder} className="w-full bg-[#1A1D24] border border-white/5 text-white h-12 rounded-xl focus:ring-1 focus:ring-[#3ab368]/50 focus:border-transparent font-mono text-[13px] placeholder:text-white/20 placeholder:font-sans" data-testid="input-wallet-address" />
          </div>
        )}

        {/* CTA */}
        <div className="pt-4 pb-6">
          <button className="w-full relative group overflow-hidden rounded-2xl" onClick={handleExchange} disabled={createExchangeMutation.isPending} data-testid="button-continue-payment">
            <div className="absolute inset-0 bg-[#3ab368] transition-transform group-hover:scale-[1.02] group-active:scale-[0.98]"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent mix-blend-overlay"></div>
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-white/10 mix-blend-overlay"></div>
            <div className="relative flex items-center justify-center gap-2 py-4 font-semibold text-[15px] text-white tracking-wide">
              {createExchangeMutation.isPending ? (
                <div className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div><span>{t('common.creating')}</span></div>
              ) : (
                <>{t('exchange.exchangeNow')}<ArrowRight className="w-4 h-4 ml-1 opacity-80 group-hover:translate-x-1 transition-transform" /></>
              )}
            </div>
          </button>
        </div>
      </div>

      {/* Add Card Modal */}
      <Dialog open={isAddCardModalOpen} onOpenChange={setIsAddCardModalOpen}>
        <DialogContent className="w-[92vw] max-w-md rounded-3xl bg-[#13151A] border border-white/10 text-white max-h-[85vh] overflow-y-auto p-0">
          <div className="px-6 pt-6 pb-4 border-b border-white/5 sticky top-0 bg-[#13151A]/90 backdrop-blur-md z-10">
            <DialogTitle className="text-lg font-semibold tracking-tight text-white">{t('exchange.addCard')}</DialogTitle>
          </div>
          <div className="p-6">
            <div className="flex justify-center mb-8">
              <div className="w-20 h-20 rounded-full bg-gradient-to-b from-[#1A2E22] to-[#13151A] border border-[#3ab368]/20 flex items-center justify-center shadow-[0_0_30px_rgba(58,179,104,0.15)] relative">
                <div className="absolute inset-0 rounded-full bg-[#3ab368] blur-xl opacity-10"></div>
                <CreditCard className="w-8 h-8 text-[#3ab368] relative z-10" strokeWidth={1.5} />
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5"><Label className="text-[11px] font-medium text-white/50 uppercase tracking-wider ml-1">{t('exchange.cardName')}</Label><Input placeholder="Зарплатная карта" value={cardFormData.name} onChange={(e) => setCardFormData({ ...cardFormData, name: e.target.value })} className="h-12 bg-[#1A1D24] border-white/5 focus:ring-1 focus:ring-[#3ab368]/50 rounded-xl text-sm" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label className="text-[11px] font-medium text-white/50 uppercase tracking-wider ml-1">{t('exchange.firstName')}</Label><Input placeholder="Ivan" value={cardFormData.firstName} onChange={handleNameChange('firstName')} className="h-12 bg-[#1A1D24] border-white/5 focus:ring-1 focus:ring-[#3ab368]/50 rounded-xl text-sm" /></div>
                <div className="space-y-1.5"><Label className="text-[11px] font-medium text-white/50 uppercase tracking-wider ml-1">{t('exchange.lastName')}</Label><Input placeholder="Petrov" value={cardFormData.lastName} onChange={handleNameChange('lastName')} className="h-12 bg-[#1A1D24] border-white/5 focus:ring-1 focus:ring-[#3ab368]/50 rounded-xl text-sm" /></div>
              </div>
              <div className="space-y-1.5"><Label className="text-[11px] font-medium text-white/50 uppercase tracking-wider ml-1">{t('exchange.phone')}</Label><Input placeholder="+79991234567" value={cardFormData.phone} onChange={handlePhoneChange} className="h-12 bg-[#1A1D24] border-white/5 focus:ring-1 focus:ring-[#3ab368]/50 rounded-xl text-sm font-mono" /></div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-medium text-white/50 uppercase tracking-wider ml-1">{t('exchange.country')}</Label>
                <Select value={cardFormData.idCard} onValueChange={(value) => { const c = activeCards.find(c => c.id.toString() === value); setSelectedCardIdForBank(value); setCardFormData({ ...cardFormData, idCard: value, country: c?.country || "", idBank: "" }); }}>
                  <SelectTrigger className="h-12 bg-[#1A1D24] border-white/5 rounded-xl text-sm"><SelectValue placeholder={t('exchange.selectCountryCard')} /></SelectTrigger>
                  <SelectContent className="bg-[#1A1D24] border-white/10 text-white rounded-xl">{activeCards.map(card => (<SelectItem key={card.id} value={card.id.toString()} className="focus:bg-white/5 rounded-lg my-1">{card.country}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              {banks.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-medium text-white/50 uppercase tracking-wider ml-1">{t('exchange.selectBank')}</Label>
                  <Select value={cardFormData.idBank} onValueChange={(value) => setCardFormData({ ...cardFormData, idBank: value })}>
                    <SelectTrigger className="h-12 bg-[#1A1D24] border-white/5 rounded-xl text-sm"><SelectValue placeholder={t('exchange.selectBank')} /></SelectTrigger>
                    <SelectContent className="bg-[#1A1D24] border-white/10 text-white rounded-xl">{banks.map(bank => (<SelectItem key={bank.id} value={bank.id.toString()} className="focus:bg-white/5 rounded-lg my-1">{bank.bankName}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5 pt-2"><Label className="text-[11px] font-medium text-white/50 uppercase tracking-wider ml-1 flex justify-between"><span>{t('exchange.cardNumber')}</span><span className="text-white/30">{t('exchange.optional')}</span></Label><Input placeholder="4373 8349 9348 7328" value={formatCardNumber(cardFormData.number)} onChange={handleCardNumberChange} className="h-12 bg-[#1A1D24] border-white/5 focus:ring-1 focus:ring-[#3ab368]/50 rounded-xl text-sm font-mono tracking-widest" /></div>
              <div className="space-y-1.5"><Label className="text-[11px] font-medium text-white/50 uppercase tracking-wider ml-1 flex justify-between"><span>{t('exchange.accountNumber')}</span><span className="text-white/30">{t('exchange.optional')}</span></Label><Input placeholder="12345678901234567890" value={cardFormData.accountNumber} onChange={handleAccountNumberChange} className="h-12 bg-[#1A1D24] border-white/5 focus:ring-1 focus:ring-[#3ab368]/50 rounded-xl text-sm font-mono" /><p className="text-[10px] text-[#3ab368]/80 mt-1 ml-1">{t('exchange.fillCardOrAccount')}</p></div>
            </div>
            <div className="mt-8 mb-2"><button className="w-full bg-[#3ab368] hover:bg-[#329D5B] text-white py-4 rounded-xl font-semibold transition-colors active:scale-[0.98]" onClick={handleAddCard}>{t('common.save')}</button></div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Card Details Modal */}
      <Dialog open={isCardDetailsModalOpen} onOpenChange={setIsCardDetailsModalOpen}>
        <DialogContent className="w-[92vw] max-w-md rounded-3xl bg-[#13151A] border border-white/10 text-white p-0">
          <div className="px-6 pt-6 pb-4 border-b border-white/5"><DialogTitle className="text-lg font-semibold tracking-tight text-white">{t('exchange.cardDetails')}</DialogTitle></div>
          <div className="p-6">
            {selectedCard && selectedCard !== 'add_card' && (() => {
              const card = userCards.find(c => c.id.toString() === selectedCard);
              if (!card) return null;
              const fields = [
                { label: 'Название', value: card.name, key: 'name' },
                { label: 'Имя и Фамилия', value: `${card.firstName} ${card.lastName}`, key: 'fullName' },
                { label: 'Телефон', value: card.phone, key: 'phone' },
                ...(card.bankName ? [{ label: 'Банк', value: card.bankName, key: 'bank' }] : []),
                ...(card.numberCard ? [{ label: 'Номер карты', value: formatCardNumber(card.numberCard), key: 'cardNumber' }] : []),
                ...(card.accountNumber ? [{ label: 'Номер счёта', value: card.accountNumber, key: 'accountNumber' }] : []),
              ];
              return (
                <div className="space-y-2">
                  {fields.map(f => (
                    <div key={f.key} className="bg-[#1A1D24] border border-white/5 rounded-2xl p-4 flex items-center justify-between group">
                      <div><div className="text-[10px] text-white/40 font-semibold uppercase tracking-wider mb-1">{f.label}</div><div className="text-[13px] text-white font-medium font-mono">{f.value}</div></div>
                      <button onClick={() => copyToClipboard(f.value, f.key)} className="w-10 h-10 flex items-center justify-center hover:bg-white/5 rounded-full transition-colors">
                        {copiedField === f.key ? <Check className="w-4 h-4 text-[#3ab368]" /> : <Copy className="w-4 h-4 text-white/30 group-hover:text-white/70" />}
                      </button>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
