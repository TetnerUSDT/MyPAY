import { useState, useEffect } from "react";
import { Settings, ArrowDownLeft, ArrowUpRight, RotateCcw, CreditCard, Plus, ArrowRightLeft, X, ChevronDown } from "lucide-react";
import { Link, useSearch, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User } from "@/lib/schema";
import { formatBalance } from "@/lib/utils";
import { getBalanceIcon } from "@/lib/balanceIcons";
import { Skeleton } from "@/components/ui/skeleton";
import WalletBottomSheet from "@/components/WalletBottomSheet";

const catImage = "/uploads/icons/cat-logo.png?v=2";

const RefreshIcon = ({ className = "w-6 h-6", ...props }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className={className} {...props}>
    <path fill="none" d="M0 0h24v24H0z"/>
    <path d="m22.69 18.37 1.14-1-1-1.73-1.45.49q-.48-.405-1.08-.63L20 14h-2l-.3 1.49q-.6.225-1.08.63l-1.45-.49-1 1.73 1.14 1c-.08.5-.08.76 0 1.26l-1.14 1 1 1.73 1.45-.49q.48.405 1.08.63L18 24h2l.3-1.49q.6-.225 1.08-.63l1.45.49 1-1.73-1.14-1c.08-.51.08-.77 0-1.27M19 21c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2M11 7v5.41l2.36 2.36 1.04-1.79-1.4-1.39V7zm10 5a9 9 0 0 0-9-9C9.17 3 6.65 4.32 5 6.36V4H3v6h6V8H6.26A7.01 7.01 0 0 1 12 5c3.86 0 7 3.14 7 7zm-10.14 6.91c-2.99-.49-5.35-2.9-5.78-5.91H3.06c.5 4.5 4.31 8 8.94 8h.07z"/>
  </svg>
);

export default function WalletScreen() {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [blockedBalanceId, setBlockedBalanceId] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetTab, setSheetTab] = useState<'topup'|'transfer'|'exchange'>('topup');
  const [sheetNetwork, setSheetNetwork] = useState<string>();
  const [sheetCurrency, setSheetCurrency] = useState<string>();
  const openSheet = (tab: 'topup'|'transfer'|'exchange', network?: string, currency?: string) => {
    setSheetTab(tab); setSheetNetwork(network); setSheetCurrency(currency); setSheetOpen(true);
  };

  // Open sheet from URL param (e.g. /wallet?sheet=exchange from bottom nav)
  const search = useSearch();
  const [, setLocation] = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(search);
    const sheet = params.get('sheet');
    if (sheet === 'exchange' || sheet === 'transfer' || sheet === 'topup') {
      openSheet(sheet as 'topup'|'transfer'|'exchange');
      setLocation('/wallet', { replace: true });
    }
  }, [search]);

  const { toast } = useToast();

  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });

  const { data: cryptoBalances = [], isLoading: cryptoLoading } = useQuery<any[]>({
    queryKey: ["/api/user/crypto-balances"],
  });

  const { data: unreadCount } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    refetchInterval: 60000,
  });

  const { data: availableNetworks = [], isLoading: networksLoading } = useQuery<any[]>({
    queryKey: ["/api/user/available-networks"],
    enabled: isModalOpen,
  });

  const addNetworkMutation = useMutation({
    mutationFn: async (balanceId: number) => {
      const response = await apiRequest("POST", "/api/user/add-network", { balanceId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/crypto-balances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/available-networks"] });
      toast({
        title: t('common.success'),
        description: t('wallet.networkAdded'),
      });
      setIsModalOpen(false);
    },
    onError: () => {
      toast({
        title: t('common.error'),
        description: t('wallet.networkAddError'),
        variant: "destructive",
      });
    },
  });

  const wallets = cryptoBalances.map(balance => ({
    id: balance.id,
    name: balance.title,
    amount: balance.sum || "0.000000",
    currency: balance.currency,
    icon: getBalanceIcon(balance.id),
    network: balance.network,
    status: balance.status,
    balanceStatus: balance.balanceStatus,
    isBlocked: balance.status === 'blocked',
    isFrozen: balance.balanceStatus === 'frozen'
  }));

  const actions = [
    { icon: ArrowDownLeft, label: t('wallet.deposit'), testId: "action-deposit" },
    { icon: ArrowUpRight, label: t('wallet.send'), testId: "action-send" },
    { icon: ArrowRightLeft, label: t('wallet.exchange'), testId: "action-exchange" },
  ];

  return (
    <div className="mobile-screen gradient-bg text-white overflow-y-auto pb-20">
      <div className="flex flex-col min-h-full">
        {/* Header with Profile */}
        <div className="flex items-center justify-center px-6 pt-4 pb-3">
          <div className="flex items-center">
            <Link href="/history">
              <button 
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center mr-4"
                data-testid="button-history"
              >
                <RefreshIcon className="w-5 h-5 text-white" />
              </button>
            </Link>
            
            <Link href="/notifications">
              <div className="relative">
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/20">
                  <img 
                    src={user?.img || catImage} 
                    alt="Profile Avatar" 
                    className="w-full h-full object-cover"
                    data-testid="profile-avatar"
                  />
                </div>
                {unreadCount && unreadCount.count > 0 && (
                  <>
                    <div className="absolute inset-0 rounded-full animate-ping bg-red-500/50" />
                    <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center z-10" data-testid="notification-badge">
                      {unreadCount.count > 9 ? '9+' : unreadCount.count}
                    </div>
                  </>
                )}
              </div>
            </Link>
          </div>
          
          <Link href="/settings">
            <button 
              className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center ml-4"
              data-testid="button-settings"
            >
              <Settings className="w-5 h-5 text-white" />
            </button>
          </Link>
        </div>

        {/* Action Buttons */}
        <div className="px-5 mb-5">
          <div className="grid grid-cols-3 bg-[#13151A] border border-white/5 rounded-2xl overflow-hidden">
              {[
               { icon: ArrowDownLeft, label: t('wallet.deposit'), testId: "action-deposit", tab: 'topup' as const },
               { icon: ArrowUpRight, label: t('wallet.send'), testId: "action-send", tab: 'transfer' as const },
               { icon: ArrowRightLeft, label: t('wallet.exchange'), testId: "action-exchange", tab: 'exchange' as const },
            ].map((action, idx, arr) => {
              const Icon = action.icon;
              return (
                  <button
                    onClick={() => openSheet(action.tab)}
                    className={`w-full flex flex-col items-center justify-center gap-1.5 py-4 hover:bg-white/5 transition-colors ${idx < arr.length - 1 ? 'border-r border-white/5' : ''}`}
                    data-testid={action.testId}
                  >
                    <Icon className="w-5 h-5 text-[#3ab368]" />
                    <span className="text-xs text-white/70 font-medium">{action.label}</span>
                  </button>
              );
            })}
          </div>
        </div>

        {/* Wallets List */}
        <div className="flex-1 px-6">
          <div className="space-y-2">
            {cryptoLoading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <div 
                  key={`skeleton-${index}`}
                  className="crypto-card flex items-center justify-between !p-3"
                  data-testid={`wallet-skeleton-${index}`}
                >
                  <div className="flex items-center flex-1">
                    <Skeleton className="w-10 h-10 rounded-full mr-3 bg-white/10" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-28 mb-1.5 bg-white/10" />
                      <Skeleton className="h-3 w-20 bg-white/10" />
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Skeleton className="w-8 h-8 rounded-lg bg-white/10" />
                    <Skeleton className="w-8 h-8 rounded-lg bg-white/10" />
                  </div>
                </div>
              ))
            ) : (
              wallets.map((wallet) => (
              <div 
                key={wallet.id}
                className={`crypto-card flex items-center justify-between relative !p-3 ${(wallet.isBlocked || wallet.isFrozen) ? 'opacity-70 cursor-pointer' : ''}`}
                data-testid={`wallet-${wallet.id}`}
                onClick={() => {
                  if (wallet.isBlocked || wallet.isFrozen) {
                    setBlockedBalanceId(wallet.id);
                  }
                }}
              >
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center mr-3 overflow-hidden">
                    <img 
                      src={wallet.icon} 
                      alt={wallet.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-sm leading-tight" data-testid={`wallet-name-${wallet.id}`}>
                      {wallet.name}
                    </h3>
                    <p className="text-muted-foreground text-xs mt-0.5" data-testid={`wallet-amount-${wallet.id}`}>
                      {formatBalance(wallet.amount)} {wallet.currency}
                    </p>
                  </div>
                </div>
                
                <div className="flex space-x-2">
                    <button 
                      className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={wallet.isBlocked || wallet.isFrozen}
                      data-testid={`button-deposit-${wallet.id}`}
                       onClick={() => !(wallet.isBlocked || wallet.isFrozen) && openSheet('topup', wallet.network || 'TRC20', wallet.currency || 'USDT')}
                    >
                      <ArrowDownLeft className="w-4 h-4 text-accent-foreground" />
                    </button>
                    <button 
                      className="w-8 h-8 bg-yellow-400 rounded-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={wallet.isBlocked || wallet.isFrozen}
                      data-testid={`button-send-${wallet.id}`}
                       onClick={() => !(wallet.isBlocked || wallet.isFrozen) && openSheet('transfer', wallet.network || 'TRC20', wallet.currency || 'USDT')}
                    >
                      <ArrowUpRight className="w-4 h-4 text-black" />
                    </button>
                </div>

                {(wallet.isBlocked || wallet.isFrozen) && blockedBalanceId === wallet.id && (
                  <div 
                    className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-2xl"
                    onClick={(e) => {
                      e.stopPropagation();
                      setBlockedBalanceId(null);
                    }}
                  >
                    <div className={`${wallet.isBlocked ? 'bg-red-900/90 border-red-700' : 'bg-blue-900/90 border-blue-700'} border text-white px-4 py-2 rounded-lg backdrop-blur-sm`}>
                      <p className="font-medium text-sm">{wallet.isBlocked ? `🔒 ${t('wallet.balanceBlocked')}` : `❄️ ${t('wallet.balanceInactive')}`}</p>
                    </div>
                  </div>
                )}
              </div>
            ))
            )}
          </div>
        </div>

        {/* Add Wallet Button */}
        <div className="px-5 pb-4 mt-[15px]">
          <button
            className="w-full flex items-center justify-center gap-2 bg-[#13151A] border border-white/5 hover:border-[#3ab368]/30 hover:bg-[#3ab368]/5 text-white/70 hover:text-white rounded-2xl py-3 text-sm font-medium transition-all active:scale-[0.98]"
            onClick={() => setIsModalOpen(true)}
            data-testid="button-add-network"
          >
            <Plus className="w-4 h-4 text-[#3ab368]" />
            {t('wallet.addNetwork')}
          </button>
        </div>
      </div>

      <WalletBottomSheet isOpen={sheetOpen} onClose={() => setSheetOpen(false)} defaultTab={sheetTab} network={sheetNetwork} currency={sheetCurrency} />

      {/* Add Network Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setIsModalOpen(false)}
          />
          
          <div className="relative bg-gradient-to-b from-gray-900 to-gray-800 rounded-2xl border border-gray-700 shadow-2xl max-w-sm w-full mx-4 overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h2 className="text-xl font-semibold text-white">{t('wallet.addNetwork')}</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-700/50 flex items-center justify-center hover:bg-gray-600/50 transition-colors"
                data-testid="button-close-modal"
              >
                <X className="w-4 h-4 text-gray-300" />
              </button>
            </div>

            <div className="p-6">
              <p className="text-gray-300 text-sm mb-6 text-center">
                {t('wallet.selectNetwork')}
              </p>
              
              <div className="space-y-4 max-h-80 overflow-y-auto">
                {networksLoading ? (
                  Array.from({ length: 3 }).map((_, index) => (
                    <div key={`skeleton-${index}`} className="w-full crypto-card p-4 border border-gray-600">
                      <div className="flex items-center">
                        <Skeleton className="w-12 h-12 rounded-full mr-4 bg-white/10" />
                        <div>
                          <Skeleton className="h-5 w-32 mb-2 bg-white/10" />
                          <Skeleton className="h-4 w-24 bg-white/10" />
                        </div>
                      </div>
                    </div>
                  ))
                ) : availableNetworks.length > 0 ? (
                  availableNetworks.map((network: any) => (
                    <div
                      key={network.id}
                      className="w-full crypto-card p-4 border border-gray-600 opacity-60"
                      data-testid={`network-coming-soon-${network.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="w-12 h-12 rounded-full overflow-hidden mr-4 grayscale">
                            <img 
                              src={getBalanceIcon(network.id)} 
                              alt={network.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="text-left">
                            <h3 className="font-semibold text-white">{network.title}</h3>
                            <p className="text-sm text-gray-400">{network.network} • {network.currency}</p>
                          </div>
                        </div>
                        <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full">
                          {t('common.comingSoon')}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-400">{t('wallet.newNetworksSoon')}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
