import { useState, useEffect } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { X, ArrowDown, ArrowRight, Settings as SettingsIcon, RefreshCw, CreditCard, Copy, Check } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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

export default function ExchangeScreen() {
  const searchParams = new URLSearchParams(useSearch());
  const selectedCountryId = searchParams.get('country');
  const exchangeMode = searchParams.get('mode') || 'bank';
  const fromBalanceParam = searchParams.get('from');
  const toBalanceParam = searchParams.get('to');
  
  const [activeTab, setActiveTab] = useState("exchange");
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
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const isCryptoMode = exchangeMode === 'crypto';
  
  // Add card modal states
  const [isAddCardModalOpen, setIsAddCardModalOpen] = useState(false);
  const [isCardDetailsModalOpen, setIsCardDetailsModalOpen] = useState(false);
  const [selectedCardIdForBank, setSelectedCardIdForBank] = useState<string>("");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [cardFormData, setCardFormData] = useState({
    name: "",
    country: "",
    number: "",
    accountNumber: "",
    firstName: "",
    lastName: "",
    phone: "",
    idCard: "",
    idBank: ""
  });

  const { data: receiveBalances = [] } = useQuery<Balance[]>({
    queryKey: ['/api/exchange/receive-balances', selectedCountryId, isCryptoMode],
    queryFn: async () => {
      if (isCryptoMode) {
        const response = await fetch('/api/exchange/crypto/receive-balances', {
          credentials: 'include'
        });
        if (!response.ok) throw new Error('Failed to fetch crypto receive balances');
        return response.json();
      }
      
      if (!selectedCountryId) return [];
      const apiKey = localStorage.getItem("userApiKey");
      const headers: Record<string, string> = {};
      if (apiKey) headers['x-api-key'] = apiKey;
      
      const response = await fetch(`/api/exchange/receive-balances/${selectedCountryId}`, {
        headers,
        credentials: 'include'
      });
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
      
      const response = await fetch(`/api/exchange/payment-balances/${receiveBalanceId}`, {
        headers,
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch payment balances');
      return response.json();
    },
    enabled: !!receiveBalanceId
  });

  const { data: userCards = [] } = useQuery<UserCard[]>({
    queryKey: ['/api/user-cards']
  });

  const { data: activeCards = [] } = useQuery<CountryCard[]>({
    queryKey: ['/api/cards/active']
  });

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
      
      const response = await fetch(`/api/user-balance/${payBalanceId}`, {
        headers,
        credentials: 'include'
      });
      if (!response.ok) return { sum: '0' };
      return response.json();
    },
    enabled: !!payBalanceId && paymentMethod === 'balance'
  });

  const { data: exchangeRate } = useQuery<{
    rate: number;
    fromCurrency: string;
    toCurrency: string;
    fromNetwork: string;
    toNetwork: string;
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
    // Skip if no balances yet and payBalanceId is already set (from URL params)
    if (filteredPaymentBalances.length === 0 && payBalanceId !== null) {
      return;
    }
    
    if (filteredPaymentBalances.length > 0) {
      // Если текущий выбранный баланс не в списке доступных, сбросить на первый
      const isCurrentBalanceAvailable = filteredPaymentBalances.some(b => b.id === payBalanceId);
      if (!isCurrentBalanceAvailable) {
        setPayBalanceId(filteredPaymentBalances[0].id);
      }
    } else {
      // Если нет доступных балансов, сбросить
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
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify({
            fromBalanceId: payBalanceId,
            toBalanceId: receiveBalanceId,
            amount: payAmount
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          setReceiveAmount(data.toAmount.toFixed(2));
        }
      } catch (error) {
        console.error('Error calculating exchange:', error);
      }
    };

    const debounce = setTimeout(calculateExchange, 300);
    return () => clearTimeout(debounce);
  }, [payAmount, payBalanceId, receiveBalanceId]);

  const cardOptions = userCards
    .filter(card => selectedCountryId && card.idCard === parseInt(selectedCountryId))
    .map(card => {
      const parts = [];
      if (card.numberCard) {
        parts.push(`****${card.numberCard.slice(-4)}`);
      }
      if (card.accountNumber) {
        parts.push(`****${card.accountNumber.slice(-4)}`);
      }
      const displayInfo = parts.join(', ');
      
      return {
        value: card.id.toString(),
        label: `${card.name} (${displayInfo})`
      };
    });

  // Card mask helper function
  const formatCardNumber = (value: string) => {
    // Remove all non-digit characters and format
    return value.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  // Handler functions for card form
  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numericValue = e.target.value.replace(/\D/g, '').slice(0, 16);
    setCardFormData({ ...cardFormData, number: numericValue });
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 15);
    const formattedPhone = '+' + digits;
    setCardFormData({ ...cardFormData, phone: formattedPhone });
  };

  const handleNameChange = (field: 'firstName' | 'lastName') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const latinValue = e.target.value.replace(/[^a-zA-Z\s]/g, '');
    setCardFormData({ ...cardFormData, [field]: latinValue });
  };

  const handleAccountNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numericValue = e.target.value.replace(/\D/g, '').slice(0, 20);
    setCardFormData({ ...cardFormData, accountNumber: numericValue });
  };

  // Create card mutation
  const createCardMutation = useMutation({
    mutationFn: async (cardData: any) => {
      const apiKey = localStorage.getItem("userApiKey");
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey) headers['x-api-key'] = apiKey;
      
      const response = await fetch('/api/user-cards', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(cardData)
      });
      if (!response.ok) throw new Error('Failed to create card');
      return response.json();
    },
    onSuccess: (newCard) => {
      queryClient.invalidateQueries({ queryKey: ['/api/user-cards'] });
      setCardFormData({ name: "", country: "", number: "", accountNumber: "", firstName: "", lastName: "", phone: "", idCard: "", idBank: "" });
      setSelectedCardIdForBank("");
      setIsAddCardModalOpen(false);
      setSelectedCard(newCard.id.toString());
      toast({ title: "Карта добавлена успешно" });
    },
    onError: () => {
      toast({ title: "Ошибка при добавлении карты", variant: "destructive" });
    }
  });

  const handleAddCard = () => {
    // Validate: обязательные поля
    if (!cardFormData.name || !cardFormData.country || !cardFormData.firstName || !cardFormData.lastName || !cardFormData.phone || !cardFormData.idCard) {
      toast({ title: "Заполните все обязательные поля", variant: "destructive" });
      return;
    }
    
    // Требуется хотя бы одно: номер карты или номер счета
    if (!cardFormData.number && !cardFormData.accountNumber) {
      toast({ title: "Заполните номер карты или номер счета", variant: "destructive" });
      return;
    }

    const dataToSend: any = {
      name: cardFormData.name,
      country: cardFormData.country,
      firstName: cardFormData.firstName,
      lastName: cardFormData.lastName,
      phone: cardFormData.phone,
      idCard: cardFormData.idCard
    };
    
    // Добавляем номер карты, если заполнен
    if (cardFormData.number) {
      dataToSend.number = cardFormData.number;
    }
    
    // Добавляем номер счета, если заполнен
    if (cardFormData.accountNumber) {
      dataToSend.accountNumber = cardFormData.accountNumber;
    }
    
    if (cardFormData.idBank) {
      dataToSend.idBank = parseInt(cardFormData.idBank);
    }
    
    createCardMutation.mutate(dataToSend);
  };

  // Copy to clipboard function
  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      toast({ title: "Ошибка копирования", variant: "destructive" });
    }
  };

  // Create exchange mutation
  const createExchangeMutation = useMutation({
    mutationFn: async (exchangeData: any) => {
      const response = await apiRequest("POST", "/api/exchange/create", exchangeData);
      return response.json();
    },
    onSuccess: (data) => {
      // Navigate to payment page with order number
      setLocation(`/payment?order=${data.numberOrder}`);
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось создать заявку на обмен",
        variant: "destructive",
      });
    }
  });

  const handleExchange = async () => {
    // Validate inputs
    if (!payBalanceId || !receiveBalanceId) {
      toast({
        title: "Ошибка",
        description: "Выберите валюты для обмена",
        variant: "destructive",
      });
      return;
    }

    if (!payAmount || parseFloat(payAmount) <= 0) {
      toast({
        title: "Ошибка",
        description: "Введите корректную сумму",
        variant: "destructive",
      });
      return;
    }

    // Check balance if paying from internal wallet
    if (paymentMethod === 'balance') {
      const selectedPaymentBalance = paymentBalances.find(b => b.id === payBalanceId);
      const availableBalance = userBalance ? parseFloat(userBalance.sum) : 0;
      if (parseFloat(payAmount) > availableBalance) {
        toast({
          title: "Недостаточно средств",
          description: `Доступно: ${availableBalance.toFixed(2)} ${selectedPaymentBalance?.currency}`,
          variant: "destructive",
        });
        return;
      }
    }

    // Card validation only for bank mode
    if (!isCryptoMode && !selectedCard) {
      toast({
        title: "Ошибка",
        description: "Выберите или введите карту для получения",
        variant: "destructive",
      });
      return;
    }

    // Wallet address validation for crypto mode with blockchain payment
    if (isCryptoMode && paymentMethod === 'blockchain') {
      if (!walletAddress) {
        toast({
          title: "Ошибка",
          description: "Введите адрес кошелька для получения",
          variant: "destructive",
        });
        return;
      }

      // Validate wallet address format using pattern from balance
      const receiveBalance = filteredReceiveBalances.find(b => b.id === receiveBalanceId);
      if (receiveBalance?.pattern) {
        try {
          const pattern = new RegExp(receiveBalance.pattern);
          if (!pattern.test(walletAddress)) {
            toast({
              title: "Неверный формат адреса",
              description: `Адрес кошелька должен соответствовать формату сети ${receiveBalance.network || receiveBalance.currency}`,
              variant: "destructive",
            });
            return;
          }
        } catch (error) {
          console.error('Invalid regex pattern:', error);
        }
      }
    }

    // Get selected payment balance
    const selectedPaymentBalance = paymentBalances.find(b => b.id === payBalanceId);
    if (!selectedPaymentBalance) {
      toast({
        title: "Ошибка",
        description: "Не удалось определить валюту для оплаты",
        variant: "destructive",
      });
      return;
    }

    // Get network from payment balance
    const network = selectedPaymentBalance.network;
    if (!network) {
      toast({
        title: "Ошибка",
        description: "Не удалось определить сеть для оплаты",
        variant: "destructive",
      });
      return;
    }

    // Get currencies
    const fromCurrency = selectedPaymentBalance.currency;
    const toCurrency = filteredReceiveBalances.find(b => b.id === receiveBalanceId)?.currency || 'USDT';

    // Calculate rate
    const rate = receiveAmount && payAmount ? (parseFloat(receiveAmount) / parseFloat(payAmount)).toString() : "0";

    // Create exchange order
    createExchangeMutation.mutate({
      fromBalanceId: payBalanceId,
      toBalanceId: receiveBalanceId,
      fromCurrency,
      toCurrency,
      amountFrom: payAmount,
      amountTo: receiveAmount,
      rate,
      commission: "0.0",
      cardId: selectedCard ? parseInt(selectedCard) : null,
      manualCardNumber: isCryptoMode && walletAddress ? walletAddress : null,
      network,
      paymentMethod
    });
  };

  return (
    <div className="mobile-screen gradient-bg text-white overflow-y-auto pb-20">
      <div className="flex flex-col min-h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6">
          <h1 className="text-xl font-semibold" data-testid="text-exchange-title">
            Произвести обмен
          </h1>
          <Link href="/select-country">
            <button 
              className="w-8 h-8 rounded-full bg-black/20 flex items-center justify-center"
              data-testid="button-close"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </Link>
        </div>

        {/* Tab Switches */}
        <div className="px-6 mb-8">
          <div className="flex rounded-full bg-black/20 p-1">
            <button
              className={`flex-1 flex items-center justify-center px-6 py-3 rounded-full transition-all ${
                activeTab === "exchange" 
                  ? "bg-accent text-accent-foreground" 
                  : "text-white"
              }`}
              onClick={() => setActiveTab("exchange")}
              data-testid="tab-exchange"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Обмен
            </button>
            <button
              className={`flex-1 flex items-center justify-center px-6 py-3 rounded-full transition-all ${
                activeTab === "settings" 
                  ? "bg-accent text-accent-foreground" 
                  : "text-white"
              }`}
              onClick={() => setActiveTab("settings")}
              data-testid="tab-settings"
            >
              <SettingsIcon className="w-4 h-4 mr-2" />
              Настройки
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 px-6">
          {activeTab === "exchange" ? (
            <div className="space-y-4">
            {/* Pay Amount */}
            <div className="crypto-card">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-muted-foreground">Платите</div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPaymentMethod('blockchain')}
                    className={`px-3 py-1 text-xs rounded transition-all ${
                      paymentMethod === 'blockchain'
                        ? 'bg-accent text-accent-foreground'
                        : 'bg-secondary/50 text-muted-foreground'
                    }`}
                    data-testid="button-payment-blockchain"
                  >
                    Blockchain
                  </button>
                  <button
                    onClick={() => setPaymentMethod('balance')}
                    className={`px-3 py-1 text-xs rounded transition-all ${
                      paymentMethod === 'balance'
                        ? 'bg-accent text-accent-foreground'
                        : 'bg-secondary/50 text-muted-foreground'
                    }`}
                    data-testid="button-payment-balance"
                  >
                    Баланс
                  </button>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <input
                  type="text"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="text-3xl font-bold bg-transparent text-white outline-none w-full"
                  data-testid="input-pay-amount"
                />
                <Select 
                  value={payBalanceId?.toString()} 
                  onValueChange={(value) => setPayBalanceId(parseInt(value))}
                >
                  <SelectTrigger className="min-w-36 bg-secondary border-0 text-white font-medium px-4 py-2 ml-4" data-testid="select-pay-currency">
                    <SelectValue placeholder="Выберите валюту" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredPaymentBalances.map((balance: any) => (
                      <SelectItem key={balance.id} value={balance.id.toString()}>
                        {balance.currency}{balance.network ? `.${balance.network}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {paymentMethod === 'balance' && userBalance && (
                <div className="mt-3 text-sm text-muted-foreground">
                  Доступно: {parseFloat(userBalance.sum).toFixed(2)} {paymentBalances.find(b => b.id === payBalanceId)?.currency}
                </div>
              )}
            </div>

            {/* Arrow Down */}
            <div className="flex justify-center" style={{position: 'relative', marginTop: '-20px', marginBottom: '-30px', zIndex: 2}}>
              <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center border-[6px]" style={{borderColor: '#2a4c3b'}}>
                <ArrowDown className="w-6 h-6 text-accent-foreground" />
              </div>
            </div>

            {/* Receive Amount */}
            <div className="crypto-card">
              <div className="text-sm text-muted-foreground mb-3">Получите</div>
              <div className="flex items-center justify-between">
                <input
                  type="text"
                  value={receiveAmount}
                  readOnly
                  className="text-3xl font-bold bg-transparent text-white outline-none w-full"
                  data-testid="input-receive-amount"
                />
                <Select 
                  value={receiveBalanceId?.toString()} 
                  onValueChange={(value) => setReceiveBalanceId(parseInt(value))}
                >
                  <SelectTrigger className="min-w-36 bg-secondary border-0 text-white font-medium px-4 py-2 ml-4" data-testid="select-receive-currency">
                    <SelectValue placeholder="Выберите валюту" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredReceiveBalances.map((balance: any) => (
                      <SelectItem key={balance.id} value={balance.id.toString()}>
                        {balance.currency}{balance.network ? `.${balance.network}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Arrow Down - Hide when crypto mode with balance payment */}
            {!(isCryptoMode && paymentMethod === 'balance') && (
              <div className="flex justify-center" style={{position: 'relative', marginTop: '-20px', marginBottom: '-30px', zIndex: 2}}>
                <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center border-[6px]" style={{borderColor: '#2a4c3b'}}>
                  <ArrowDown className="w-6 h-6 text-accent-foreground" />
                </div>
              </div>
            )}

            {/* Card Selection - Only for Bank Mode */}
            {!isCryptoMode && (
              <div className="crypto-card">
                <div className="text-sm text-muted-foreground mb-3">Выберите карту</div>
                <div className="space-y-3">
                  <Select 
                    value={selectedCard} 
                    onValueChange={(value) => {
                      if (value === 'add_card') {
                        setIsAddCardModalOpen(true);
                      } else {
                        setSelectedCard(value);
                      }
                    }}
                  >
                    <SelectTrigger className="w-full bg-secondary border-0 text-white font-medium" data-testid="select-card">
                      <SelectValue placeholder="Выберите карту" />
                    </SelectTrigger>
                    <SelectContent>
                      {cardOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                      <SelectItem value="add_card">
                        ➕ Добавить карту
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {selectedCard && selectedCard !== 'add_card' && (() => {
                    const card = userCards.find(c => c.id.toString() === selectedCard);
                    if (!card) return null;
                    
                    const parts = [];
                    if (card.numberCard) {
                      parts.push(formatCardNumber(card.numberCard));
                    }
                    if (card.accountNumber) {
                      parts.push(card.accountNumber);
                    }
                    const fullInfo = parts.join('  ');
                    
                    return (
                      <button
                        onClick={() => setIsCardDetailsModalOpen(true)}
                        className="w-full bg-secondary/50 rounded-lg px-4 py-3 text-left hover:bg-secondary/70 transition-colors"
                        data-testid="button-card-details"
                      >
                        <div className="text-accent font-medium text-sm mb-1">{card.name}</div>
                        <div className="text-white font-mono text-base">{fullInfo}</div>
                      </button>
                    );
                  })()}
                </div>
              </div>
            )}
            
            {/* Wallet Address Input - Only for Crypto Mode with Blockchain Payment */}
            {isCryptoMode && paymentMethod === 'blockchain' && (
              <div className="crypto-card">
                <div className="text-sm text-muted-foreground mb-3">Адрес кошелька для получения</div>
                <div className="space-y-3">
                  <Input
                    value={walletAddress}
                    onChange={(e) => setWalletAddress(e.target.value)}
                    placeholder={
                      filteredReceiveBalances.find(b => b.id === receiveBalanceId)?.network === 'TRC20' 
                        ? 'T...' 
                        : filteredReceiveBalances.find(b => b.id === receiveBalanceId)?.network === 'BEP20' 
                        ? '0x...' 
                        : filteredReceiveBalances.find(b => b.id === receiveBalanceId)?.network === 'TON'
                        ? 'EQ...'
                        : filteredReceiveBalances.find(b => b.id === receiveBalanceId)?.network === 'Polygon'
                        ? '0x...'
                        : 'Введите адрес кошелька'
                    }
                    className="w-full bg-secondary border-0 text-white font-medium px-4 py-3 rounded-lg"
                    data-testid="input-wallet-address"
                  />
                  {walletAddress && (
                    <div className="text-xs text-muted-foreground">
                      Убедитесь, что адрес соответствует сети {filteredReceiveBalances.find(b => b.id === receiveBalanceId)?.network}
                    </div>
                  )}
                </div>
              </div>
            )}
            </div>
          ) : (
            /* Settings Content */
            <div className="text-center py-12">
              <SettingsIcon className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Настройки</h3>
              <p className="text-muted-foreground">Здесь будут настройки обмена</p>
            </div>
          )}
        </div>

        {/* Continue Button */}
        <div className="p-6">
          {/* Exchange Rate Display */}
          {exchangeRate && (
            <div className="text-center mb-4" style={{ marginTop: '-5px' }} data-testid="exchange-rate-display">
              <span className="text-sm text-primary font-medium">
                1 {exchangeRate.fromCurrency}{exchangeRate.fromNetwork ? `.${exchangeRate.fromNetwork}` : ''} = {exchangeRate.rate.toFixed(2)} {exchangeRate.toCurrency}
              </span>
            </div>
          )}
          
          <button 
            className="action-button"
            onClick={handleExchange}
            disabled={createExchangeMutation.isPending}
            data-testid="button-continue-payment"
          >
            {createExchangeMutation.isPending ? "Создание заявки..." : "Перейти к обмену"}
            {!createExchangeMutation.isPending && <ArrowRight className="w-5 h-5 ml-2" />}
          </button>
        </div>
      </div>

      {/* Add Card Modal */}
      <Dialog open={isAddCardModalOpen} onOpenChange={setIsAddCardModalOpen}>
        <DialogContent className="mobile-screen bg-secondary border-none text-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Добавление карты</DialogTitle>
          </DialogHeader>
          
          <div className="crypto-card mt-4">
            {/* Card Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-accent rounded-xl flex items-center justify-center">
                <CreditCard className="w-8 h-8 text-accent-foreground" />
              </div>
            </div>
            
            <div className="space-y-4">
              {/* Card Name */}
              <div>
                <Label htmlFor="cardName" className="text-white mb-2 block">
                  Введите название для карты
                </Label>
                <Input
                  id="cardName"
                  placeholder="Зарплатная карта"
                  value={cardFormData.name}
                  onChange={(e) => setCardFormData({ ...cardFormData, name: e.target.value })}
                  className="input-field"
                  data-testid="input-card-name"
                />
              </div>

              {/* First Name */}
              <div>
                <Label htmlFor="firstName" className="text-white mb-2 block">
                  Имя (латинницей)
                </Label>
                <Input
                  id="firstName"
                  placeholder="Ivan"
                  value={cardFormData.firstName}
                  onChange={handleNameChange('firstName')}
                  className="input-field"
                  data-testid="input-first-name"
                />
              </div>

              {/* Last Name */}
              <div>
                <Label htmlFor="lastName" className="text-white mb-2 block">
                  Фамилия (латинницей)
                </Label>
                <Input
                  id="lastName"
                  placeholder="Petrov"
                  value={cardFormData.lastName}
                  onChange={handleNameChange('lastName')}
                  className="input-field"
                  data-testid="input-last-name"
                />
              </div>

              {/* Phone Number */}
              <div>
                <Label htmlFor="phone" className="text-white mb-2 block">
                  Номер телефона
                </Label>
                <Input
                  id="phone"
                  placeholder="+79991234567"
                  value={cardFormData.phone}
                  onChange={handlePhoneChange}
                  className="input-field"
                  data-testid="input-phone"
                />
              </div>

              {/* Country Selection */}
              <div>
                <Label className="text-white mb-2 block">
                  Выберите страну
                </Label>
                <Select
                  value={cardFormData.idCard}
                  onValueChange={(value) => {
                    const selectedCountryCard = activeCards.find(c => c.id.toString() === value);
                    setSelectedCardIdForBank(value);
                    setCardFormData({ 
                      ...cardFormData, 
                      idCard: value,
                      country: selectedCountryCard?.country || "",
                      idBank: ""
                    });
                  }}
                >
                  <SelectTrigger className="input-field" data-testid="select-country">
                    <SelectValue placeholder="Выберите страну" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeCards.map(card => (
                      <SelectItem key={card.id} value={card.id.toString()}>
                        {card.country}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Bank Selection - shown only if banks are available for selected country */}
              {banks.length > 0 && (
                <div>
                  <Label className="text-white mb-2 block">
                    Выберите банк
                  </Label>
                  <Select
                    value={cardFormData.idBank}
                    onValueChange={(value) => {
                      setCardFormData({ 
                        ...cardFormData, 
                        idBank: value
                      });
                    }}
                  >
                    <SelectTrigger className="input-field" data-testid="select-bank">
                      <SelectValue placeholder="Выберите банк" />
                    </SelectTrigger>
                    <SelectContent>
                      {banks.map(bank => (
                        <SelectItem key={bank.id} value={bank.id.toString()}>
                          {bank.bankName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Card Number */}
              <div>
                <Label htmlFor="cardNumber" className="text-white mb-2 block">
                  Введите номер карты (необязательно)
                </Label>
                <Input
                  id="cardNumber"
                  placeholder="4373 8349 9348 7328"
                  value={formatCardNumber(cardFormData.number)}
                  onChange={handleCardNumberChange}
                  className="input-field"
                  data-testid="input-card-number"
                />
              </div>

              {/* Account Number */}
              <div>
                <Label htmlFor="accountNumber" className="text-white mb-2 block">
                  Номер счета (20 цифр, необязательно)
                </Label>
                <Input
                  id="accountNumber"
                  placeholder="12345678901234567890"
                  value={cardFormData.accountNumber}
                  onChange={handleAccountNumberChange}
                  className="input-field"
                  data-testid="input-account-number"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Заполните номер карты и/или номер счета (минимум одно поле)
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <Button 
              className="action-button"
              onClick={handleAddCard}
              data-testid="button-save-card"
            >
              Сохранить карту
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Card Details Modal */}
      <Dialog open={isCardDetailsModalOpen} onOpenChange={setIsCardDetailsModalOpen}>
        <DialogContent className="mobile-screen bg-secondary border-none text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Реквизиты карты</DialogTitle>
          </DialogHeader>
          
          {selectedCard && selectedCard !== 'add_card' && (() => {
            const card = userCards.find(c => c.id.toString() === selectedCard);
            if (!card) return null;
            
            return (
              <div className="space-y-3 mt-4">
                {/* Card Name */}
                <div className="bg-secondary/50 rounded-lg p-3">
                  <div className="text-xs text-muted-foreground mb-1">Название</div>
                  <div className="flex items-center justify-between">
                    <div className="text-white font-medium">{card.name}</div>
                    <button
                      onClick={() => copyToClipboard(card.name, 'name')}
                      className="p-2 hover:bg-secondary rounded transition-colors"
                      data-testid="button-copy-name"
                    >
                      {copiedField === 'name' ? <Check className="w-4 h-4 text-accent" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
                    </button>
                  </div>
                </div>

                {/* Full Name (Compact: First + Last in one row) */}
                <div className="bg-secondary/50 rounded-lg p-3">
                  <div className="text-xs text-muted-foreground mb-1">Имя и Фамилия</div>
                  <div className="flex items-center justify-between">
                    <div className="text-white font-medium">{card.firstName} {card.lastName}</div>
                    <button
                      onClick={() => copyToClipboard(`${card.firstName} ${card.lastName}`, 'fullName')}
                      className="p-2 hover:bg-secondary rounded transition-colors"
                      data-testid="button-copy-fullname"
                    >
                      {copiedField === 'fullName' ? <Check className="w-4 h-4 text-accent" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
                    </button>
                  </div>
                </div>

                {/* Phone */}
                <div className="bg-secondary/50 rounded-lg p-3">
                  <div className="text-xs text-muted-foreground mb-1">Телефон</div>
                  <div className="flex items-center justify-between">
                    <div className="text-white font-medium">{card.phone}</div>
                    <button
                      onClick={() => copyToClipboard(card.phone, 'phone')}
                      className="p-2 hover:bg-secondary rounded transition-colors"
                      data-testid="button-copy-phone"
                    >
                      {copiedField === 'phone' ? <Check className="w-4 h-4 text-accent" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
                    </button>
                  </div>
                </div>

                {/* Bank */}
                {card.bankName && (
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <div className="text-xs text-muted-foreground mb-1">Банк</div>
                    <div className="flex items-center justify-between">
                      <div className="text-white font-medium">{card.bankName}</div>
                      <button
                        onClick={() => copyToClipboard(card.bankName || '', 'bank')}
                        className="p-2 hover:bg-secondary rounded transition-colors"
                        data-testid="button-copy-bank"
                      >
                        {copiedField === 'bank' ? <Check className="w-4 h-4 text-accent" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Card Number */}
                {card.numberCard && (
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <div className="text-xs text-muted-foreground mb-1">Номер карты</div>
                    <div className="flex items-center justify-between">
                      <div className="text-white font-mono">{formatCardNumber(card.numberCard)}</div>
                      <button
                        onClick={() => copyToClipboard(card.numberCard, 'card')}
                        className="p-2 hover:bg-secondary rounded transition-colors"
                        data-testid="button-copy-card-number"
                      >
                        {copiedField === 'card' ? <Check className="w-4 h-4 text-accent" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Account Number */}
                {card.accountNumber && (
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <div className="text-xs text-muted-foreground mb-1">Номер счета</div>
                    <div className="flex items-center justify-between">
                      <div className="text-white font-mono">{card.accountNumber}</div>
                      <button
                        onClick={() => copyToClipboard(card.accountNumber || '', 'account')}
                        className="p-2 hover:bg-secondary rounded transition-colors"
                        data-testid="button-copy-account"
                      >
                        {copiedField === 'account' ? <Check className="w-4 h-4 text-accent" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}