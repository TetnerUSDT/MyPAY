import { useState, useEffect } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { X, ArrowDown, ArrowRight, Settings as SettingsIcon, RefreshCw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";

export default function ExchangeScreen() {
  const searchParams = new URLSearchParams(useSearch());
  const selectedCountryId = searchParams.get('country');
  
  const [activeTab, setActiveTab] = useState("exchange");
  const [payAmount, setPayAmount] = useState("100");
  const [receiveAmount, setReceiveAmount] = useState("0.00");
  const [payBalanceId, setPayBalanceId] = useState<number | null>(null);
  const [receiveBalanceId, setReceiveBalanceId] = useState<number | null>(null);
  const [selectedCard, setSelectedCard] = useState("");
  const [cardInputMode, setCardInputMode] = useState<'select' | 'manual'>('select');
  const [manualCardInput, setManualCardInput] = useState("");
  const [, setLocation] = useLocation();

  const { data: paymentBalance } = useQuery({
    queryKey: ['/api/exchange/payment-balance'],
    enabled: true
  });

  const { data: receiveBalances = [] } = useQuery({
    queryKey: ['/api/exchange/receive-balances', selectedCountryId],
    queryFn: async () => {
      if (!selectedCountryId) return [];
      const response = await fetch(`/api/exchange/receive-balances/${selectedCountryId}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch receive balances');
      return response.json();
    },
    enabled: !!selectedCountryId
  });

  const { data: userCards = [] } = useQuery<any[]>({
    queryKey: ['/api/user-cards']
  });

  useEffect(() => {
    if (paymentBalance) {
      setPayBalanceId(paymentBalance.id);
    }
  }, [paymentBalance]);

  useEffect(() => {
    if (receiveBalances.length > 0 && !receiveBalanceId) {
      setReceiveBalanceId(receiveBalances[0].id);
    }
  }, [receiveBalances]);

  useEffect(() => {
    const calculateExchange = async () => {
      if (!payBalanceId || !receiveBalanceId || !payAmount) return;
      
      try {
        const response = await fetch('/api/exchange/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
    .map(card => ({
      value: card.id,
      label: `${card.name} (${card.number.slice(-4)})`
    }));

  // Card mask helper function
  const formatCardNumber = (value: string) => {
    // Remove all non-digit characters
    const digits = value.replace(/\D/g, '');
    // Apply card mask: xxxx xxxx xxxx xxxx
    const formatted = digits.replace(/(\d{4})(?=\d)/g, '$1 ');
    // Limit to 16 digits (4 groups of 4)
    return formatted.substring(0, 19);
  };

  const handleCardInputChange = (value: string) => {
    const formatted = formatCardNumber(value);
    setManualCardInput(formatted);
    setSelectedCard(formatted);
  };

  const handleExchange = () => {
    // Navigation to payment flow using router
    setLocation("/payment");
  };

  return (
    <div className="mobile-screen gradient-bg text-white">
      <div className="flex flex-col h-full">
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
              <div className="text-sm text-muted-foreground mb-3">Платите</div>
              <div className="flex items-center justify-between">
                <input
                  type="text"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="text-3xl font-bold bg-transparent text-white outline-none w-full"
                  data-testid="input-pay-amount"
                />
                <div className="min-w-36 bg-secondary border-0 text-white font-medium px-4 py-2 ml-4 rounded-md flex items-center" data-testid="select-pay-currency">
                  {paymentBalance ? `${paymentBalance.currency}${paymentBalance.network ? `.${paymentBalance.network}` : ''}` : 'Loading...'}
                </div>
              </div>
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
                    {receiveBalances.map((balance: any) => (
                      <SelectItem key={balance.id} value={balance.id.toString()}>
                        {balance.currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Arrow Down */}
            <div className="flex justify-center" style={{position: 'relative', marginTop: '-20px', marginBottom: '-30px', zIndex: 2}}>
              <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center border-[6px]" style={{borderColor: '#2a4c3b'}}>
                <ArrowDown className="w-6 h-6 text-accent-foreground" />
              </div>
            </div>

            {/* Card Selection */}
            <div className="crypto-card">
              <div className="text-sm text-muted-foreground mb-3">Выберите карту</div>
              {cardInputMode === 'select' ? (
                <div className="space-y-3">
                  <Select 
                    value={selectedCard} 
                    onValueChange={(value) => {
                      if (value === 'manual') {
                        setCardInputMode('manual');
                        setManualCardInput('');
                      } else {
                        setSelectedCard(value);
                      }
                    }}
                  >
                    <SelectTrigger className="w-full bg-secondary border-0 text-white font-medium" data-testid="select-card">
                      <SelectValue placeholder="Выберите карту или введите вручную" />
                    </SelectTrigger>
                    <SelectContent>
                      {cardOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                      <SelectItem value="manual">
                        ✏️ Ввести номер карты вручную
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {selectedCard && selectedCard !== 'manual' && (
                    <div className="text-white font-mono text-lg" data-testid="text-selected-card">
                      {selectedCard}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={manualCardInput}
                    onChange={(e) => handleCardInputChange(e.target.value)}
                    placeholder="xxxx xxxx xxxx xxxx"
                    className="w-full bg-secondary border-0 text-white font-mono text-lg px-4 py-3 rounded-lg outline-none"
                    maxLength={19}
                    data-testid="input-manual-card"
                  />
                  <button
                    onClick={() => {
                      setCardInputMode('select');
                      if (cardOptions.length > 0) {
                        setSelectedCard(cardOptions[0].value);
                      }
                    }}
                    className="text-accent text-sm underline"
                    data-testid="button-back-to-select"
                  >
                    ← Вернуться к выбору из списка
                  </button>
                </div>
              )}
            </div>
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
          <button 
            className="action-button"
            onClick={handleExchange}
            data-testid="button-continue-payment"
          >
            Перейти к оплате
            <ArrowRight className="w-5 h-5 ml-2" />
          </button>
        </div>
      </div>
    </div>
  );
}