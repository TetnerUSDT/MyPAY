import { useState } from "react";
import { Link, useLocation } from "wouter";
import { X, ArrowDown, ArrowRight, Settings as SettingsIcon, RefreshCw, ChevronDown } from "lucide-react";

export default function ExchangeScreen() {
  const [activeTab, setActiveTab] = useState("exchange");
  const [payAmount, setPayAmount] = useState("100");
  const [receiveAmount, setReceiveAmount] = useState("8000.00");
  const [payCurrency, setPayCurrency] = useState("USDT");
  const [receiveCurrency, setReceiveCurrency] = useState("РУБ");
  const [selectedCard, setSelectedCard] = useState("4373 8349 9348 7328");
  const [, setLocation] = useLocation();

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
                <div className="flex items-center bg-secondary rounded-lg px-4 py-2 ml-4">
                  <span className="text-white font-medium mr-2" data-testid="text-pay-currency">
                    {payCurrency}
                  </span>
                  <ChevronDown className="w-4 h-4 text-white" />
                </div>
              </div>
            </div>

            {/* Arrow Down */}
            <div className="flex justify-center">
              <div className="w-10 h-10 bg-accent rounded-full flex items-center justify-center">
                <ArrowDown className="w-5 h-5 text-accent-foreground" />
              </div>
            </div>

            {/* Receive Amount */}
            <div className="crypto-card">
              <div className="text-sm text-muted-foreground mb-3">Получите</div>
              <div className="flex items-center justify-between">
                <input
                  type="text"
                  value={receiveAmount}
                  onChange={(e) => setReceiveAmount(e.target.value)}
                  className="text-3xl font-bold bg-transparent text-white outline-none w-full"
                  data-testid="input-receive-amount"
                />
                <div className="flex items-center bg-secondary rounded-lg px-4 py-2 ml-4">
                  <span className="text-white font-medium mr-2" data-testid="text-receive-currency">
                    {receiveCurrency}
                  </span>
                  <ChevronDown className="w-4 h-4 text-white" />
                </div>
              </div>
            </div>

            {/* Arrow Down */}
            <div className="flex justify-center">
              <div className="w-10 h-10 bg-accent rounded-full flex items-center justify-center">
                <ArrowDown className="w-5 h-5 text-accent-foreground" />
              </div>
            </div>

            {/* Card Selection */}
            <div className="crypto-card">
              <div className="text-sm text-muted-foreground mb-3">Выберите карту</div>
              <div className="flex items-center justify-between">
                <span className="text-white font-mono text-lg" data-testid="text-selected-card">
                  {selectedCard}
                </span>
                <ChevronDown className="w-4 h-4 text-white" />
              </div>
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