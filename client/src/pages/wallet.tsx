import { useState, useEffect } from "react";
import { Settings, ArrowDownLeft, ArrowUpRight, RotateCcw, CreditCard, Plus, ArrowRightLeft, X, ChevronDown } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { User } from "@shared/schema";
import { formatBalance } from "@/lib/utils";
import { getBalanceIcon } from "@/lib/balanceIcons";
import { Skeleton } from "@/components/ui/skeleton";

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
  const { toast } = useToast();

  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });

  const { data: cryptoBalances = [], isLoading: cryptoLoading } = useQuery<any[]>({
    queryKey: ["/api/user/crypto-balances"],
  });

  const { data: unreadCount } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    refetchInterval: 30000,
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
        <div className="flex items-center justify-center p-6">
          <div className="flex items-center">
            <Link href="/history">
              <button 
                className="w-10 h-10 rounded-full bg-black/20 flex items-center justify-center mr-4"
                data-testid="button-history"
              >
                <RefreshIcon className="w-5 h-5 text-white" />
              </button>
            </Link>
            
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
              className="w-10 h-10 rounded-full bg-black/20 flex items-center justify-center ml-4"
              data-testid="button-settings"
            >
              <Settings className="w-5 h-5 text-white" />
            </button>
          </Link>
        </div>

        {/* Action Buttons */}
        <div className="px-6 mb-8">
          <div className="grid grid-cols-3 gap-4">
            {actions.map((action, index) => {
              const Icon = action.icon;
              return (
                <div key={index} className="flex flex-col items-center">
                  {action.testId === "action-exchange" ? (
                    <Link href="/select-country">
                      <button 
                        className="w-14 h-14 rounded-full bg-black/20 flex items-center justify-center mb-2"
                        data-testid={action.testId}
                      >
                        <Icon className="w-6 h-6 text-white" />
                      </button>
                    </Link>
                  ) : action.testId === "action-send" ? (
                    <Link href="/transfer">
                      <button 
                        className="w-14 h-14 rounded-full bg-black/20 flex items-center justify-center mb-2"
                        data-testid={action.testId}
                      >
                        <Icon className="w-6 h-6 text-white" />
                      </button>
                    </Link>
                  ) : action.testId === "action-deposit" ? (
                    <Link href="/top-up">
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

        {/* Wallets List */}
        <div className="flex-1 px-6">
          <div className="space-y-4">
            {cryptoLoading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <div 
                  key={`skeleton-${index}`}
                  className="crypto-card flex items-center justify-between"
                  data-testid={`wallet-skeleton-${index}`}
                >
                  <div className="flex items-center flex-1">
                    <Skeleton className="w-12 h-12 rounded-full mr-4 bg-white/10" />
                    <div className="flex-1">
                      <Skeleton className="h-5 w-32 mb-2 bg-white/10" />
                      <Skeleton className="h-4 w-24 bg-white/10" />
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Skeleton className="w-10 h-10 rounded-lg bg-white/10" />
                    <Skeleton className="w-10 h-10 rounded-lg bg-white/10" />
                  </div>
                </div>
              ))
            ) : (
              wallets.map((wallet) => (
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
                  <div className="w-12 h-12 rounded-full flex items-center justify-center mr-4 overflow-hidden">
                    <img 
                      src={wallet.icon} 
                      alt={wallet.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  
                  <div>
                    <h3 className="font-semibold text-white" data-testid={`wallet-name-${wallet.id}`}>
                      {wallet.name}
                    </h3>
                    <p className="text-muted-foreground text-sm" data-testid={`wallet-amount-${wallet.id}`}>
                      {formatBalance(wallet.amount)} {wallet.currency}
                    </p>
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  <Link href={(wallet.isBlocked || wallet.isFrozen) ? '#' : `/top-up?network=${wallet.network || 'TRC20'}&currency=${wallet.currency || 'USDT'}`}>
                    <button 
                      className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={wallet.isBlocked || wallet.isFrozen}
                      data-testid={`button-deposit-${wallet.id}`}
                      onClick={(e) => (wallet.isBlocked || wallet.isFrozen) && e.preventDefault()}
                    >
                      <ArrowDownLeft className="w-4 h-4 text-accent-foreground" />
                    </button>
                  </Link>
                  <Link href={(wallet.isBlocked || wallet.isFrozen) ? '#' : `/transfer?network=${wallet.network || 'TRC20'}&currency=${wallet.currency || 'USDT'}`}>
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

                {(wallet.isBlocked || wallet.isFrozen) && blockedBalanceId === wallet.id && (
                  <div 
                    className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-2xl"
                    onClick={(e) => {
                      e.stopPropagation();
                      setBlockedBalanceId(null);
                    }}
                  >
                    <div className={`${wallet.isBlocked ? 'bg-red-900/90 border-red-700' : 'bg-blue-900/90 border-blue-700'} border text-white px-4 py-2 rounded-lg backdrop-blur-sm`}>
                      <p className="font-medium">{wallet.isBlocked ? `🔒 ${t('wallet.balanceBlocked')}` : `❄️ ${t('wallet.balanceInactive')}`}</p>
                    </div>
                  </div>
                )}
              </div>
            ))
            )}
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
            {t('wallet.addNetwork')}
          </button>
        </div>
      </div>

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
