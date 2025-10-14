import { useState, useEffect } from "react";
import { Settings, ArrowDownLeft, ArrowUpRight, RotateCcw, CreditCard, Plus, ArrowRightLeft, X, ChevronDown } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { User } from "@shared/schema";
import { formatBalance } from "@/lib/utils";

// Images from public directory - use direct URLs with cache busting
const catImage = `/uploads/icons/cat-logo.png?v=${Date.now()}`;
const startBgImage = `/uploads/assets/start-bg.png?v=${Date.now()}`;
const tronImage = "/uploads/icons/cryptocurrency/tron.png";
const bnbImage = "/uploads/icons/cryptocurrency/bnb.png";
const tonImage = "/uploads/icons/cryptocurrency/ton.png";
const ethereumImage = "/uploads/icons/cryptocurrency/ethereum.png";
const solanaImage = "/uploads/icons/cryptocurrency/solana.png";

// Custom SVG icon components
const RefreshIcon = ({ className = "w-6 h-6", ...props }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className={className} {...props}>
    <path fill="none" d="M0 0h24v24H0z"/>
    <path d="m22.69 18.37 1.14-1-1-1.73-1.45.49q-.48-.405-1.08-.63L20 14h-2l-.3 1.49q-.6.225-1.08.63l-1.45-.49-1 1.73 1.14 1c-.08.5-.08.76 0 1.26l-1.14 1 1 1.73 1.45-.49q.48.405 1.08.63L18 24h2l.3-1.49q.6-.225 1.08-.63l1.45.49 1-1.73-1.14-1c.08-.51.08-.77 0-1.27M19 21c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2M11 7v5.41l2.36 2.36 1.04-1.79-1.4-1.39V7zm10 5a9 9 0 0 0-9-9C9.17 3 6.65 4.32 5 6.36V4H3v6h6V8H6.26A7.01 7.01 0 0 1 12 5c3.86 0 7 3.14 7 7zm-10.14 6.91c-2.99-.49-5.35-2.9-5.78-5.91H3.06c.5 4.5 4.31 8 8.94 8h.07z"/>
  </svg>
);

const WalletIcon = ({ className = "w-12 h-12", ...props }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 49 55" width="49" height="55" fill="none" className={className} {...props}>
    <svg xmlns="http://www.w3.org/2000/svg" height="49" width="49" viewBox="0 0 24 24" fill="#ecfa8b" y="3" opacity="100%">
      <path d="M0 0h24v24H0z" fill="none"/>
      <path d="M21 18v1c0 1.1-.9 2-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14c1.1 0 2 .9 2 2v1h-9a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2zm-9-2h10V8H12zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5"/>
    </svg>
  </svg>
);

export default function HomeScreen() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCurrencyModalOpen, setIsCurrencyModalOpen] = useState(false);
  const [selectedFiatBalanceId, setSelectedFiatBalanceId] = useState<number>(1); // Default RUB
  const [blockedBalanceId, setBlockedBalanceId] = useState<number | null>(null);
  const { toast } = useToast();

  // Get current user
  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });

  // Get fiat balances
  const { data: fiatBalances = [] } = useQuery<any[]>({
    queryKey: ["/api/fiat-balances"],
  });

  // Get user balance for selected fiat
  const { data: userBalance, refetch: refetchUserBalance } = useQuery<any>({
    queryKey: ["/api/user-balance", selectedFiatBalanceId],
    queryFn: async () => {
      const response = await fetch(`/api/user-balance/${selectedFiatBalanceId}`, {
        headers: {
          'x-api-key': localStorage.getItem('userApiKey') || '',
        },
      });
      if (!response.ok) throw new Error('Failed to fetch balance');
      return response.json();
    },
    enabled: !!selectedFiatBalanceId,
  });

  // Get user crypto balances
  const { data: cryptoBalances = [] } = useQuery<any[]>({
    queryKey: ["/api/user/crypto-balances"],
  });

  // Get unread notifications count
  const { data: unreadCount } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Update default balance mutation
  const updateDefaultBalanceMutation = useMutation({
    mutationFn: async (balanceId: number) => {
      const response = await apiRequest("PATCH", "/api/user/default-balance", {
        balanceId,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      refetchUserBalance();
    },
  });

  // Set initial balance from user's default
  useEffect(() => {
    if (user?.defaultFiatBalanceId) {
      setSelectedFiatBalanceId(user.defaultFiatBalanceId);
    }
  }, [user]);

  const handleBalanceChange = (balanceId: number) => {
    setSelectedFiatBalanceId(balanceId);
    updateDefaultBalanceMutation.mutate(balanceId);
    setIsCurrencyModalOpen(false);
  };

  const selectedBalance = fiatBalances.find(b => b.id === selectedFiatBalanceId);

  // Map crypto balances with icons
  const getNetworkIcon = (network: string) => {
    if (network?.includes('TRC20')) return tronImage;
    if (network?.includes('BEP20')) return bnbImage;
    if (network?.includes('TON')) return tonImage;
    return tronImage; // default
  };

  const wallets = cryptoBalances.map(balance => ({
    id: balance.id,
    name: balance.title,
    amount: balance.sum || "0.000000",
    currency: balance.currency,
    icon: getNetworkIcon(balance.network),
    network: balance.network,
    status: balance.status,
    balanceStatus: balance.balanceStatus,
    isBlocked: balance.status === 'blocked',
    isFrozen: balance.balanceStatus === 'frozen'
  }));

  const actions = [
    { icon: ArrowDownLeft, label: "Пополнить", testId: "action-deposit" },
    { icon: ArrowUpRight, label: "Отправить", testId: "action-send" },
    { icon: ArrowRightLeft, label: "Обмен", testId: "action-exchange" },
    { icon: CreditCard, label: "Карты", testId: "action-cards" }
  ];

  return (
    <div className="mobile-screen gradient-bg text-white overflow-y-auto pb-20">
      <div className="flex flex-col min-h-full">
        {/* Header with Profile */}
        <div className="flex items-center justify-center p-6">
          <div className="flex items-center">
            {/* History Icon */}
            <Link href="/history">
              <button 
                className="w-10 h-10 rounded-full bg-black/20 flex items-center justify-center mr-4"
                data-testid="button-history"
              >
                <RefreshIcon className="w-5 h-5 text-white" />
              </button>
            </Link>
            
            {/* Profile Avatar */}
            <Link href="/notifications">
              <div className="relative">
                <div className="w-16 h-16 rounded-full overflow-hidden">
                  <img 
                    src={user?.img || catImage} 
                    alt="Profile Avatar" 
                    className="w-full h-full object-cover"
                    data-testid="profile-avatar"
                  />
                </div>
                {unreadCount && unreadCount.count > 0 && (
                  <>
                    {/* Ripple animation */}
                    <div className="absolute inset-0 rounded-full animate-ping bg-red-500/50" />
                    {/* Badge */}
                    <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center z-10" data-testid="notification-badge">
                      {unreadCount.count > 9 ? '9+' : unreadCount.count}
                    </div>
                  </>
                )}
              </div>
            </Link>
          </div>
          
            {/* Settings Icon */}
            <Link href="/settings">
              <button 
                className="w-10 h-10 rounded-full bg-black/20 flex items-center justify-center ml-4"
                data-testid="button-settings"
              >
                <Settings className="w-5 h-5 text-white" />
              </button>
            </Link>
        </div>

        {/* SwiftX Card Banner */}
        <div className="px-6 mb-6">
          <div className="relative w-full">
            <img 
              src={startBgImage} 
              alt="SwiftX Card" 
              className="w-full h-auto rounded-2xl shadow-2xl"
              data-testid="swiftx-home-card"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-6 mb-8">
          <div className="grid grid-cols-4 gap-4">
            {actions.map((action, index) => {
              const Icon = action.icon;
              return (
                <div key={index} className="flex flex-col items-center">
                  {action.label === "Обмен" ? (
                    <Link href="/select-country">
                      <button 
                        className="w-14 h-14 rounded-full bg-black/20 flex items-center justify-center mb-2"
                        data-testid={action.testId}
                      >
                        <Icon className="w-6 h-6 text-white" />
                      </button>
                    </Link>
                  ) : action.label === "Отправить" ? (
                    <Link href="/transfer">
                      <button 
                        className="w-14 h-14 rounded-full bg-black/20 flex items-center justify-center mb-2"
                        data-testid={action.testId}
                      >
                        <Icon className="w-6 h-6 text-white" />
                      </button>
                    </Link>
                  ) : action.label === "Пополнить" ? (
                    <Link href="/top-up">
                      <button 
                        className="w-14 h-14 rounded-full bg-black/20 flex items-center justify-center mb-2"
                        data-testid={action.testId}
                      >
                        <Icon className="w-6 h-6 text-white" />
                      </button>
                    </Link>
                  ) : action.label === "Карты" ? (
                    <Link href="/cards">
                      <button 
                        className="w-14 h-14 rounded-full bg-black/20 flex items-center justify-center mb-2"
                        data-testid={action.testId}
                      >
                        <Icon className="w-6 h-6 text-white" />
                      </button>
                    </Link>
                  ) : (
                    <button 
                      className="w-14 h-14 rounded-full bg-black/20 flex items-center justify-center mb-2"
                      data-testid={action.testId}
                    >
                      <Icon className="w-6 h-6 text-white" />
                    </button>
                  )}
                  <span className="text-xs text-white">{action.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Fiat Balance Card */}
        <div className="px-6 mb-4">
          <div 
            className="bg-gradient-to-r from-green-700/40 to-green-800/40 rounded-2xl p-4 border border-green-600/30 backdrop-blur-sm shadow-[0_4px_12px_rgba(0,0,0,0.2)]"
            data-testid="fiat-balance-card"
          >
            <div className="flex items-center justify-between">
              {/* Left: Icon and Balance */}
              <div className="flex items-center">
                <div className="mr-4">
                  <WalletIcon className="w-12 h-12" />
                </div>
                <div>
                  <p className="text-sm text-white/70 mb-1">{selectedBalance?.title || 'Balance'}</p>
                  <p className="text-2xl font-bold text-white" data-testid="fiat-balance-amount">
                    {formatBalance(userBalance?.sum || '0')}
                  </p>
                </div>
              </div>

              {/* Right: Currency Selector */}
              <button
                onClick={() => setIsCurrencyModalOpen(true)}
                className="bg-black/20 hover:bg-black/30 transition-colors px-4 py-2 rounded-lg flex items-center gap-2"
                data-testid="button-select-currency"
              >
                <span className="text-accent font-semibold">{selectedBalance?.currency || 'RUB'}</span>
                <ChevronDown className="w-4 h-4 text-accent" />
              </button>
            </div>
          </div>
        </div>

        {/* Wallets List */}
        <div className="flex-1 px-6">
          <div className="space-y-4">
            {wallets.map((wallet) => (
              <div 
                key={wallet.id}
                className={`crypto-card flex items-center justify-between relative ${(wallet.isBlocked || wallet.isFrozen) ? 'opacity-70 cursor-pointer' : ''}`}
                data-testid={`wallet-${wallet.id}`}
                onClick={() => {
                  if (wallet.isBlocked || wallet.isFrozen) {
                    setBlockedBalanceId(wallet.id);
                  }
                }}
              >
                <div className="flex items-center">
                  {/* Wallet Icon */}
                  <div className="w-12 h-12 rounded-full flex items-center justify-center mr-4 overflow-hidden">
                    <img 
                      src={wallet.icon} 
                      alt={wallet.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  
                  {/* Wallet Info */}
                  <div>
                    <h3 className="font-semibold text-white" data-testid={`wallet-name-${wallet.id}`}>
                      {wallet.name}
                    </h3>
                    <p className="text-muted-foreground text-sm" data-testid={`wallet-amount-${wallet.id}`}>
                      {formatBalance(wallet.amount)} {wallet.currency}
                    </p>
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex space-x-2">
                  <Link href={(wallet.isBlocked || wallet.isFrozen) ? '#' : `/top-up?network=${wallet.network?.includes('TRC20') ? 'TRC20' : wallet.network?.includes('BEP20') ? 'BEP20' : 'TON'}`}>
                    <button 
                      className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={wallet.isBlocked || wallet.isFrozen}
                      data-testid={`button-deposit-${wallet.id}`}
                      onClick={(e) => (wallet.isBlocked || wallet.isFrozen) && e.preventDefault()}
                    >
                      <ArrowDownLeft className="w-4 h-4 text-accent-foreground" />
                    </button>
                  </Link>
                  <Link href={(wallet.isBlocked || wallet.isFrozen) ? '#' : `/transfer?network=${wallet.network?.includes('TRC20') ? 'TRC20' : wallet.network?.includes('BEP20') ? 'BEP20' : 'TON'}`}>
                    <button 
                      className="w-10 h-10 bg-yellow-400 rounded-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={wallet.isBlocked || wallet.isFrozen}
                      data-testid={`button-send-${wallet.id}`}
                      onClick={(e) => (wallet.isBlocked || wallet.isFrozen) && e.preventDefault()}
                    >
                      <ArrowUpRight className="w-4 h-4 text-black" />
                    </button>
                  </Link>
                </div>

                {/* Blocked/Frozen Overlay */}
                {(wallet.isBlocked || wallet.isFrozen) && blockedBalanceId === wallet.id && (
                  <div 
                    className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-2xl"
                    onClick={(e) => {
                      e.stopPropagation();
                      setBlockedBalanceId(null);
                    }}
                  >
                    <div className={`${wallet.isBlocked ? 'bg-red-900/90 border-red-700' : 'bg-blue-900/90 border-blue-700'} border text-white px-4 py-2 rounded-lg backdrop-blur-sm`}>
                      <p className="font-medium">{wallet.isBlocked ? '🔒 Баланс заблокирован' : '❄️ Баланс неактивный'}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Add Wallet Button */}
        <div className="p-6">
          <button 
            className="action-button"
            onClick={() => setIsModalOpen(true)}
            data-testid="button-add-network"
          >
            <Plus className="w-5 h-5 mr-2" />
            Добавить сеть
          </button>
        </div>
      </div>

      {/* Add Network Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setIsModalOpen(false)}
          />
          
          {/* Modal Content */}
          <div className="relative bg-gradient-to-b from-gray-900 to-gray-800 rounded-2xl border border-gray-700 shadow-2xl max-w-sm w-full mx-4 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h2 className="text-xl font-semibold text-white">Добавить сеть</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-700/50 flex items-center justify-center hover:bg-gray-600/50 transition-colors"
                data-testid="button-close-modal"
              >
                <X className="w-4 h-4 text-gray-300" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              <p className="text-gray-300 text-sm mb-6 text-center">
                Выберите сеть для добавления
              </p>
              
              <div className="space-y-4">
                {/* Ethereum Option */}
                <button
                  onClick={() => {
                    toast({
                      title: "Ethereum",
                      description: "Данная сеть временно недоступна",
                      variant: "destructive",
                    });
                    setIsModalOpen(false);
                  }}
                  className="w-full crypto-card p-4 hover:bg-gray-700/30 transition-all border border-gray-600 hover:border-gray-500"
                  data-testid="button-add-ethereum"
                >
                  <div className="flex items-center">
                    <div className="w-12 h-12 rounded-full overflow-hidden mr-4">
                      <img 
                        src={ethereumImage} 
                        alt="Ethereum"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-white">Ethereum</h3>
                      <p className="text-sm text-gray-400">ETH сеть</p>
                    </div>
                  </div>
                </button>

                {/* Solana Option */}
                <button
                  onClick={() => {
                    toast({
                      title: "Solana",
                      description: "Данная сеть временно недоступна",
                      variant: "destructive",
                    });
                    setIsModalOpen(false);
                  }}
                  className="w-full crypto-card p-4 hover:bg-gray-700/30 transition-all border border-gray-600 hover:border-gray-500"
                  data-testid="button-add-solana"
                >
                  <div className="flex items-center">
                    <div className="w-12 h-12 rounded-full overflow-hidden mr-4">
                      <img 
                        src={solanaImage} 
                        alt="Solana"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-white">Solana</h3>
                      <p className="text-sm text-gray-400">SOL сеть</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Currency Selection Modal */}
      {isCurrencyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setIsCurrencyModalOpen(false)}
          />
          
          {/* Modal Content */}
          <div className="relative bg-gradient-to-b from-gray-900 to-gray-800 rounded-2xl border border-gray-700 shadow-2xl max-w-sm w-full mx-4 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h2 className="text-xl font-semibold text-white">Выберите валюту</h2>
              <button
                onClick={() => setIsCurrencyModalOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-700/50 flex items-center justify-center hover:bg-gray-600/50 transition-colors"
                data-testid="button-close-currency-modal"
              >
                <X className="w-4 h-4 text-gray-300" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              <div className="space-y-3">
                {fiatBalances.map((balance) => (
                  <button
                    key={balance.id}
                    onClick={() => handleBalanceChange(balance.id)}
                    className={`w-full p-4 rounded-xl transition-all border ${
                      selectedFiatBalanceId === balance.id
                        ? 'bg-green-700/30 border-green-600/50'
                        : 'bg-gray-800/50 border-gray-600/30 hover:bg-gray-700/30 hover:border-gray-500/50'
                    }`}
                    data-testid={`button-select-${balance.currency}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-left">
                        <h3 className="font-semibold text-white">{balance.title}</h3>
                        <p className="text-sm text-gray-400">{balance.currency}</p>
                      </div>
                      {selectedFiatBalanceId === balance.id && (
                        <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center">
                          <svg className="w-4 h-4 text-accent-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}