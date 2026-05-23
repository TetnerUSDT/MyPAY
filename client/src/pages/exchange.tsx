import { useState, useEffect } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { ChevronLeft, ArrowLeftRight, ArrowRight, CreditCard, Copy, Check, ChevronDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { getBalanceIcon } from "@/lib/balanceIcons";

interface UserCard {
  id: number;
  name: string;
  numberCard: string;
  accountNumber?: string;
  country: string;
  firstName: string;
  lastName: string;
  phone: string;
  idUser: number;
  idCard: number;
  idBank?: number | null;
  bankName?: string | null;
}

interface Balance {
  id: number;
  currency: string;
  network?: string;
  pattern?: string | null;
  type?: string;
}

const FIAT_CURRENCIES = ['RUB', 'USD', 'EUR', 'TRY', 'KZT', 'UAH'];

interface CountryCard {
  id: number;
  title: string;
  country: string;
  lang: string | null;
  timeExchange: number;
  commission: string;
  idBalance: string | null;
  status: string | null;
}

interface Bank {
  id: number;
  cardId: number;
  bankName: string;
  timeExchange: number | null;
  commission: string | null;
  status: string | null;
}

type SpeedMode = 'fast' | 'cheap' | 'smart';

const SPEED_MODES: { id: SpeedMode; icon: string; labelKey: string; etaKey: string; eta: string }[] = [
  { id: 'fast',  icon: '⚡',  labelKey: 'exchange.mode.fast',  etaKey: 'exchange.mode.etaFast',  eta: '~1 мин' },
  { id: 'cheap', icon: '🍃',  labelKey: 'exchange.mode.cheap', etaKey: 'exchange.mode.etaCheap', eta: '~5 мин' },
  { id: 'smart', icon: '✨',  labelKey: 'exchange.mode.smart', etaKey: 'exchange.mode.etaSmart', eta: '~2 мин' },
];

function CurrencyBadge({ balance }: { balance: Balance | undefined }) {
  if (!balance) return null;
  return (
    <div className="flex items-center gap-2">
      <div className="w-10 h-10 rounded-full overflow-hidden bg-white/10 flex-shrink-0">
        <img
          src={getBalanceIcon(balance.id)}
          alt={balance.currency}
          className="w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      </div>
      <div className="text-left">
        <div className="font-semibold text-white text-base leading-tight">{balance.currency}</div>
        {balance.network && (
          <div className="text-[11px] text-white/50 leading-tight">{balance.network}</div>
        )}
      </div>
      <ChevronDown className="w-4 h-4 text-white/50 ml-0.5" />
    </div>
  );
}

export default function ExchangeScreen() {
  const { t } = useTranslation();
  const searchParams = new URLSearchParams(useSearch());
  const selectedCountryId = searchParams.get('country');
  const exchangeMode = searchParams.get('mode') || 'crypto';
  const fromBalanceParam = searchParams.get('from');
  const toBalanceParam = searchParams.get('to');

  const [payAmount, setPayAmount] = useState("100");
  const [receiveAmount, setReceiveAmount] = useState("0.00");
  const [payBalanceId, setPayBalanceId] = useState<number | null>(
    fromBalanceParam ? parseInt(fromBalanceParam) : null
  );
  const [receiveBalanceId, setReceiveBalanceId] = useState<number | null>(
    toBalanceParam ? parseInt(toBalanceParam) : null
  );
  const [selectedCard, setSelectedCard] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<'blockchain' | 'balance'>('blockchain');
  const [speedMode, setSpeedMode] = useState<SpeedMode>('smart');
  const [, setLocation] = useLocation();
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
        if (!response.ok) throw new Error('Failed to fetch crypto receive balances');
        return response.json();
      }
      if (!selectedCountryId) return [];
      const apiKey = localStorage.getItem("userApiKey");
      const headers: Record<string, string> = {};
      if (apiKey) headers['x-api-key'] = apiKey;
      const response = await fetch(`/api/exchange/receive-balances/${selectedCountryId}`, { headers, credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch receive balances');
      return response.json();
    },
    enabled: isCryptoMode || !!selectedCountryId
  });

  const { data: paymentBalances = [] } = useQuery<Balance[]>({
    queryKey: ['/api/exchange/payment-balances', receiveBalanceId, isCryptoMode],
    queryFn: async () => {
      if (!receiveBalanceId) return [];
      const apiKey = localStorage.getItem("userApiKey");
      const headers: Record<string, string> = {};
      if (apiKey) headers['x-api-key'] = apiKey;
      const response = await fetch(`/api/exchange/payment-balances/${receiveBalanceId}`, { headers, credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch payment balances');
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
      const apiKey = localStorage.getItem("userApiKey");
      const headers: Record<string, string> = {};
      if (apiKey) headers['x-api-key'] = apiKey;
      const response = await fetch(`/api/user-balance/${payBalanceId}`, { headers, credentials: 'include' });
      if (!response.ok) return { sum: '0' };
      return response.json();
    },
    enabled: !!payBalanceId && paymentMethod === 'balance'
  });

  const { data: exchangeRate } = useQuery<{
    rate: number; fromCurrency: string; toCurrency: string; fromNetwork: string; toNetwork: string;
  }>({
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
      const isCurrentBalanceAvailable = filteredPaymentBalances.some(b => b.id === payBalanceId);
      if (!isCurrentBalanceAvailable) setPayBalanceId(filteredPaymentBalances[0].id);
    } else {
      setPayBalanceId(null);
    }
  }, [filteredPaymentBalances, payBalanceId]);

  useEffect(() => {
    const calculateExchange = async () => {
      if (!payBalanceId || !receiveBalanceId || !payAmount) return;
      try {
        const apiKey = localStorage.getItem("userApiKey");
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (apiKey) headers['x-api-key'] = apiKey;
        const response = await fetch('/api/exchange/quote', {
          method: 'POST', headers, credentials: 'include',
          body: JSON.stringify({ fromBalanceId: payBalanceId, toBalanceId: receiveBalanceId, amount: payAmount })
        });
        if (response.ok) {
          const data = await response.json();
          setReceiveAmount(data.toAmount.toFixed(2));
        }
      } catch {}
    };
    const debounce = setTimeout(calculateExchange, 300);
    return () => clearTimeout(debounce);
  }, [payAmount, payBalanceId, receiveBalanceId]);

  const handleSwap = () => {
    const oldPay = payBalanceId;
    const oldReceive = receiveBalanceId;
    const oldPayAmt = payAmount;
    const oldReceiveAmt = receiveAmount;
    setReceiveBalanceId(oldPay);
    setPayBalanceId(oldReceive);
    setPayAmount(oldReceiveAmt);
    setReceiveAmount(oldPayAmt);
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
      const apiKey = localStorage.getItem("userApiKey");
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey) headers['x-api-key'] = apiKey;
      const response = await fetch('/api/user-cards', { method: 'POST', headers, credentials: 'include', body: JSON.stringify(cardData) });
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
    const dataToSend: any = {
      name: cardFormData.name, country: cardFormData.country, firstName: cardFormData.firstName,
      lastName: cardFormData.lastName, phone: cardFormData.phone, idCard: cardFormData.idCard
    };
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
    onSuccess: (data) => setLocation(`/payment?order=${data.numberOrder}`),
    onError: (error: any) => toast({ title: t('common.error'), description: error.message || t('exchange.exchangeError'), variant: "destructive" })
  });

  const handleExchange = async () => {
    if (!payBalanceId || !receiveBalanceId) {
      toast({ title: t('common.error'), description: t('exchange.selectCurrencies'), variant: "destructive" }); return;
    }
    if (!payAmount || parseFloat(payAmount) <= 0) {
      toast({ title: t('common.error'), description: t('exchange.enterValidAmount'), variant: "destructive" }); return;
    }
    if (paymentMethod === 'balance') {
      const selectedPaymentBalance = paymentBalances.find(b => b.id === payBalanceId);
      const availableBalance = userBalance ? parseFloat(userBalance.sum) : 0;
      if (parseFloat(payAmount) > availableBalance) {
        toast({ title: t('exchange.insufficientBalance'), description: `${t('common.available')}: ${availableBalance.toFixed(2)} ${selectedPaymentBalance?.currency}`, variant: "destructive" }); return;
      }
    }
    if (!isCryptoMode && !selectedCard) {
      toast({ title: t('common.error'), description: t('exchange.selectOrEnterCard'), variant: "destructive" }); return;
    }
    if (isCryptoMode && paymentMethod === 'blockchain') {
      if (!walletAddress) {
        toast({ title: t('common.error'), description: t('exchange.enterWalletAddress'), variant: "destructive" }); return;
      }
      const receiveBalance = filteredReceiveBalances.find(b => b.id === receiveBalanceId);
      if (receiveBalance?.pattern) {
        try {
          if (!new RegExp(receiveBalance.pattern).test(walletAddress)) {
            toast({ title: t('exchange.invalidAddress'), description: t('exchange.addressMustMatchNetwork', { network: receiveBalance.network || receiveBalance.currency }), variant: "destructive" }); return;
          }
        } catch {}
      }
    }
    const selectedPaymentBalance = paymentBalances.find(b => b.id === payBalanceId);
    if (!selectedPaymentBalance) {
      toast({ title: t('common.error'), description: t('exchange.cannotDetectPayCurrency'), variant: "destructive" }); return;
    }
    const network = selectedPaymentBalance.network;
    if (!network) {
      toast({ title: t('common.error'), description: t('exchange.cannotDetectNetwork'), variant: "destructive" }); return;
    }
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

  return (
    <div className="mobile-screen gradient-bg text-white overflow-y-auto pb-8">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <Link href="/home">
          <button className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center" data-testid="button-back">
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
        </Link>
        <h1 className="text-lg font-semibold">{t('exchange.title')}</h1>
        <div className="w-9" />
      </div>

      <div className="px-4 space-y-2">

        {/* FROM block */}
        <div className="rounded-2xl bg-white/5 border border-white/8 px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-white/50 font-medium uppercase tracking-wide">{t('exchange.youPay')}</span>
            <div className="flex gap-1">
              <button
                onClick={() => setPaymentMethod('blockchain')}
                className={`px-3 py-1 text-xs rounded-full transition-all ${paymentMethod === 'blockchain' ? 'bg-accent text-white' : 'bg-white/8 text-white/50'}`}
                data-testid="button-payment-blockchain"
              >
                Blockchain
              </button>
              <button
                onClick={() => setPaymentMethod('balance')}
                className={`px-3 py-1 text-xs rounded-full transition-all ${paymentMethod === 'balance' ? 'bg-accent text-white' : 'bg-white/8 text-white/50'}`}
                data-testid="button-payment-balance"
              >
                {t('exchange.balance')}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Select value={payBalanceId?.toString()} onValueChange={(v) => setPayBalanceId(parseInt(v))}>
              <SelectTrigger className="w-auto min-w-0 bg-transparent border-0 p-0 h-auto focus:ring-0 hover:bg-white/5 rounded-xl px-1" data-testid="select-pay-currency">
                <CurrencyBadge balance={currentPayBalance} />
              </SelectTrigger>
              <SelectContent>
                {filteredPaymentBalances.map((b) => (
                  <SelectItem key={b.id} value={b.id.toString()}>
                    {b.currency}{b.network ? `.${b.network}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <input
              type="number"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              className="flex-1 text-right text-3xl font-bold bg-transparent text-white outline-none min-w-0"
              data-testid="input-pay-amount"
            />
          </div>

          {paymentMethod === 'balance' && userBalance && (
            <div className="mt-2 text-xs text-white/40 text-right">
              {t('common.available')}: {parseFloat(userBalance.sum).toFixed(2)} {currentPayBalance?.currency}
            </div>
          )}
        </div>

        {/* Swap button */}
        <div className="flex justify-center relative z-10 -my-0.5">
          <button
            onClick={handleSwap}
            className="w-11 h-11 rounded-full bg-[#1a3a2a] border-2 border-accent/40 flex items-center justify-center hover:bg-[#1f4530] transition-colors shadow-lg"
            data-testid="button-swap"
          >
            <ArrowLeftRight className="w-4 h-4 text-accent" />
          </button>
        </div>

        {/* TO block */}
        <div className="rounded-2xl bg-white/5 border border-white/8 px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-white/50 font-medium uppercase tracking-wide">{t('exchange.youReceive')}</span>
          </div>

          <div className="flex items-center gap-3">
            <Select value={receiveBalanceId?.toString()} onValueChange={(v) => setReceiveBalanceId(parseInt(v))}>
              <SelectTrigger className="w-auto min-w-0 bg-transparent border-0 p-0 h-auto focus:ring-0 hover:bg-white/5 rounded-xl px-1" data-testid="select-receive-currency">
                <CurrencyBadge balance={currentReceiveBalance} />
              </SelectTrigger>
              <SelectContent>
                {filteredReceiveBalances.map((b) => (
                  <SelectItem key={b.id} value={b.id.toString()}>
                    {b.currency}{b.network ? `.${b.network}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex-1 text-right">
              <div className="text-3xl font-bold text-white">≈ {receiveAmount}</div>
            </div>
          </div>
        </div>

        {/* Rate info block */}
        {exchangeRate && (
          <div className="rounded-2xl bg-white/5 border border-white/8 px-4 py-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center">
                  <span className="text-sm">⚡</span>
                </div>
                <span className="text-sm text-white/70">{t('exchange.rate')}</span>
              </div>
              <span className="text-sm text-white font-medium" data-testid="exchange-rate-display">
                1 {exchangeRate.fromCurrency} ≈ {exchangeRate.rate.toFixed(4)} {exchangeRate.toCurrency}
              </span>
            </div>
            <div className="border-t border-white/5 pt-2 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-white/50">{t('exchange.commission')}</span>
                <span className="text-white/70">0.00 {exchangeRate.fromCurrency}</span>
              </div>
            </div>
          </div>
        )}

        {/* Speed mode selector */}
        <div className="flex gap-2">
          {SPEED_MODES.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setSpeedMode(mode.id)}
              className={`flex-1 flex flex-col items-center py-3 px-2 rounded-2xl border transition-all ${
                speedMode === mode.id
                  ? 'bg-accent/15 border-accent text-white'
                  : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'
              }`}
              data-testid={`speed-mode-${mode.id}`}
            >
              <span className="text-base mb-0.5">{mode.icon}</span>
              <span className="text-xs font-semibold">{t(mode.labelKey)}</span>
              <span className="text-[11px] text-white/40">{mode.eta}</span>
            </button>
          ))}
        </div>

        {/* Estimated time */}
        <div className="flex items-center justify-between px-1">
          <span className="text-sm text-white/40">⏱ {t('exchange.estimatedTime')}</span>
          <span className="text-sm text-accent font-medium">{currentSpeedMode.eta}</span>
        </div>

        {/* Card selection — bank mode only */}
        {!isCryptoMode && (
          <div className="rounded-2xl bg-white/5 border border-white/8 px-4 py-4">
            <div className="text-xs text-white/50 font-medium uppercase tracking-wide mb-3">{t('exchange.selectCard')}</div>
            <Select value={selectedCard} onValueChange={(value) => {
              if (value === 'add_card') setIsAddCardModalOpen(true);
              else setSelectedCard(value);
            }}>
              <SelectTrigger className="w-full bg-white/8 border-0 text-white" data-testid="select-card">
                <SelectValue placeholder={t('exchange.selectCard')} />
              </SelectTrigger>
              <SelectContent>
                {cardOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
                <SelectItem value="add_card">➕ {t('exchange.addCard')}</SelectItem>
              </SelectContent>
            </Select>
            {selectedCard && selectedCard !== 'add_card' && (() => {
              const card = userCards.find(c => c.id.toString() === selectedCard);
              if (!card) return null;
              const parts = [];
              if (card.numberCard) parts.push(formatCardNumber(card.numberCard));
              if (card.accountNumber) parts.push(card.accountNumber);
              return (
                <button onClick={() => setIsCardDetailsModalOpen(true)} className="w-full mt-2 bg-white/8 rounded-xl px-4 py-3 text-left hover:bg-white/12 transition-colors" data-testid="button-card-details">
                  <div className="text-accent font-medium text-sm mb-0.5">{card.name}</div>
                  <div className="text-white font-mono text-sm">{parts.join('  ')}</div>
                </button>
              );
            })()}
          </div>
        )}

        {/* Wallet address — crypto + blockchain */}
        {isCryptoMode && paymentMethod === 'blockchain' && (
          <div className="rounded-2xl bg-white/5 border border-white/8 px-4 py-4">
            <div className="text-xs text-white/50 font-medium uppercase tracking-wide mb-3">{t('exchange.walletAddress')}</div>
            <Input
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              placeholder={walletPlaceholder}
              className="bg-white/8 border-0 text-white font-mono"
              data-testid="input-wallet-address"
            />
          </div>
        )}

        {/* CTA */}
        <button
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-semibold text-base transition-all bg-accent hover:opacity-90 disabled:opacity-50 text-white mt-2"
          onClick={handleExchange}
          disabled={createExchangeMutation.isPending}
          data-testid="button-continue-payment"
        >
          {createExchangeMutation.isPending ? t('common.creating') : t('exchange.exchangeNow')}
          {!createExchangeMutation.isPending && <ArrowRight className="w-5 h-5" />}
        </button>

      </div>

      {/* Add Card Modal */}
      <Dialog open={isAddCardModalOpen} onOpenChange={setIsAddCardModalOpen}>
        <DialogContent className="mobile-screen bg-secondary border-none text-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">{t('exchange.addCard')}</DialogTitle>
          </DialogHeader>
          <div className="crypto-card mt-4">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-accent rounded-xl flex items-center justify-center">
                <CreditCard className="w-8 h-8 text-accent-foreground" />
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="cardName" className="text-white mb-2 block">{t('exchange.cardName')}</Label>
                <Input id="cardName" placeholder="Зарплатная карта" value={cardFormData.name} onChange={(e) => setCardFormData({ ...cardFormData, name: e.target.value })} className="input-field" data-testid="input-card-name" />
              </div>
              <div>
                <Label htmlFor="firstName" className="text-white mb-2 block">{t('exchange.firstName')}</Label>
                <Input id="firstName" placeholder="Ivan" value={cardFormData.firstName} onChange={handleNameChange('firstName')} className="input-field" data-testid="input-first-name" />
              </div>
              <div>
                <Label htmlFor="lastName" className="text-white mb-2 block">{t('exchange.lastName')}</Label>
                <Input id="lastName" placeholder="Petrov" value={cardFormData.lastName} onChange={handleNameChange('lastName')} className="input-field" data-testid="input-last-name" />
              </div>
              <div>
                <Label htmlFor="phone" className="text-white mb-2 block">{t('exchange.phone')}</Label>
                <Input id="phone" placeholder="+79991234567" value={cardFormData.phone} onChange={handlePhoneChange} className="input-field" data-testid="input-phone" />
              </div>
              <div>
                <Label className="text-white mb-2 block">{t('exchange.country')}</Label>
                <Select value={cardFormData.idCard} onValueChange={(value) => {
                  const selectedCountryCard = activeCards.find(c => c.id.toString() === value);
                  setSelectedCardIdForBank(value);
                  setCardFormData({ ...cardFormData, idCard: value, country: selectedCountryCard?.country || "", idBank: "" });
                }}>
                  <SelectTrigger className="input-field" data-testid="select-country"><SelectValue placeholder={t('exchange.selectCountryCard')} /></SelectTrigger>
                  <SelectContent>
                    {activeCards.map(card => (
                      <SelectItem key={card.id} value={card.id.toString()}>{card.country}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {banks.length > 0 && (
                <div>
                  <Label className="text-white mb-2 block">{t('exchange.selectBank')}</Label>
                  <Select value={cardFormData.idBank} onValueChange={(value) => setCardFormData({ ...cardFormData, idBank: value })}>
                    <SelectTrigger className="input-field" data-testid="select-bank"><SelectValue placeholder={t('exchange.selectBank')} /></SelectTrigger>
                    <SelectContent>
                      {banks.map(bank => (
                        <SelectItem key={bank.id} value={bank.id.toString()}>{bank.bankName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label htmlFor="cardNumber" className="text-white mb-2 block">{t('exchange.cardNumber')} ({t('exchange.optional')})</Label>
                <Input id="cardNumber" placeholder="4373 8349 9348 7328" value={formatCardNumber(cardFormData.number)} onChange={handleCardNumberChange} className="input-field" data-testid="input-card-number" />
              </div>
              <div>
                <Label htmlFor="accountNumber" className="text-white mb-2 block">{t('exchange.accountNumber')} ({t('exchange.optional')})</Label>
                <Input id="accountNumber" placeholder="12345678901234567890" value={cardFormData.accountNumber} onChange={handleAccountNumberChange} className="input-field" data-testid="input-account-number" />
                <p className="text-xs text-muted-foreground mt-1">{t('exchange.fillCardOrAccount')}</p>
              </div>
            </div>
          </div>
          <div className="mt-6">
            <Button className="action-button" onClick={handleAddCard} data-testid="button-save-card">{t('common.save')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Card Details Modal */}
      <Dialog open={isCardDetailsModalOpen} onOpenChange={setIsCardDetailsModalOpen}>
        <DialogContent className="mobile-screen bg-secondary border-none text-white">
          <DialogHeader>
            <DialogTitle className="text-white">{t('exchange.cardDetails')}</DialogTitle>
          </DialogHeader>
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
              <div className="space-y-3 mt-4">
                {fields.map(f => (
                  <div key={f.key} className="bg-secondary/50 rounded-lg p-3">
                    <div className="text-xs text-muted-foreground mb-1">{f.label}</div>
                    <div className="flex items-center justify-between">
                      <div className="text-white font-medium font-mono">{f.value}</div>
                      <button onClick={() => copyToClipboard(f.value, f.key)} className="p-2 hover:bg-secondary rounded transition-colors">
                        {copiedField === f.key ? <Check className="w-4 h-4 text-accent" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
