import { useState } from "react";
import { Settings, ArrowDownLeft, ArrowUpRight, RotateCcw, CreditCard, Plus, ArrowRightLeft, X } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import catImage from "@assets/Image_1758366163369.png";
import tronImage from "@assets/tron_1758481649917.png";
import bnbImage from "@assets/bnb_1758481660380.png";
import tonImage from "@assets/ton_1758481672408.png";
import ethereumImage from "@assets/ethereum_1758481901648.png";
import solanaImage from "@assets/solana_1758481901649.png";

// Custom SVG icon components
const RefreshIcon = ({ className = "w-6 h-6", ...props }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className={className} {...props}>
    <path fill="none" d="M0 0h24v24H0z"/>
    <path d="m22.69 18.37 1.14-1-1-1.73-1.45.49q-.48-.405-1.08-.63L20 14h-2l-.3 1.49q-.6.225-1.08.63l-1.45-.49-1 1.73 1.14 1c-.08.5-.08.76 0 1.26l-1.14 1 1 1.73 1.45-.49q.48.405 1.08.63L18 24h2l.3-1.49q.6-.225 1.08-.63l1.45.49 1-1.73-1.14-1c.08-.51.08-.77 0-1.27M19 21c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2M11 7v5.41l2.36 2.36 1.04-1.79-1.4-1.39V7zm10 5a9 9 0 0 0-9-9C9.17 3 6.65 4.32 5 6.36V4H3v6h6V8H6.26A7.01 7.01 0 0 1 12 5c3.86 0 7 3.14 7 7zm-10.14 6.91c-2.99-.49-5.35-2.9-5.78-5.91H3.06c.5 4.5 4.31 8 8.94 8h.07z"/>
  </svg>
);

const UploadIcon = ({ className = "w-6 h-6", ...props }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" className={className} {...props}>
    <circle cx="12" cy="12" r="12" fill="#93e01f" />
    <path fill="#fff" d="M12 19c-.4 0-.7-.3-.7-.7V8.5c0-.4.3-.7.7-.7s.7.3.7.7v9.8c0 .4-.3.7-.7.7" />
    <path fill="#fff" d="M16.2 13.4c-.2 0-.4-.1-.5-.2L12 9.5l-3.7 3.7c-.3.3-.7.3-1 0s-.3-.7 0-1L11.5 8c.3-.3.7-.3 1 0l4.2 4.2c.3.3.3.7 0 1-.2.1-.3.2-.5.2m0-7H7.8c-.4 0-.7-.3-.7-.7s.3-.7.7-.7h8.4c.4 0 .7.3.7.7s-.3.7-.7.7" />
  </svg>
);

const SendIcon = ({ className = "w-6 h-6", ...props }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" className={className} {...props}>
    <circle cx="12" cy="12" r="12" fill="#facc15" />
    <path fill="#fff" d="m13.8 18.2 5.5-5.9c.3-.3.3-.7 0-.9l-5.5-5.6c-.2-.2-.5-.3-.7-.1-.3.1-.4.3-.4.6V9c-2 .2-3.8 1-5.3 2.5-1.6 1.6-2.5 3.7-2.8 6.1-.1.3.1.5.4.7.3.1.6 0 .8-.2 1.6-1.9 2.9-2.9 4.1-3.2.9-.2 2-.3 2.8-.2v3.1c0 1.3 1.1.4 1.1.4M14 16v-1.9c0-.3-.2-.6-.5-.7-.5-.1-1-.1-1.6-.1-.7 0-1.6.1-2.4.2-.9.2-2 .8-3.1 1.8.5-1.1 1.1-2.1 1.9-2.9 1.4-1.4 3.1-2.1 5-2.1.4 0 .7-.3.7-.7V7.9l3.9 3.9z" />
  </svg>
);

export default function HomeScreen() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { toast } = useToast();
  const wallets = [
    {
      id: 1,
      name: "Tether TRC20",
      amount: "0.000000",
      currency: "USDT",
      icon: tronImage
    },
    {
      id: 2,
      name: "Tether BEP20",
      amount: "0.000000", 
      currency: "USDT",
      icon: bnbImage
    },
    {
      id: 3,
      name: "Tether TON",
      amount: "0.000000",
      currency: "USDT", 
      icon: tonImage
    }
  ];

  const actions = [
    { icon: ArrowDownLeft, label: "Пополнить", testId: "action-deposit" },
    { icon: ArrowUpRight, label: "Отправить", testId: "action-send" },
    { icon: ArrowRightLeft, label: "Обмен", testId: "action-exchange" },
    { icon: CreditCard, label: "Карты", testId: "action-cards" }
  ];

  return (
    <div className="mobile-screen gradient-bg text-white">
      <div className="flex flex-col h-full">
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
            <div className="w-16 h-16 rounded-full overflow-hidden">
              <img 
                src={catImage} 
                alt="Profile Avatar" 
                className="w-full h-full object-cover"
                data-testid="profile-avatar"
              />
            </div>
          </div>
          
            {/* Settings Icon */}
            <button 
              className="w-10 h-10 rounded-full bg-black/20 flex items-center justify-center ml-4"
              data-testid="button-settings"
            >
              <Settings className="w-5 h-5 text-white" />
            </button>
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

        {/* Wallets List */}
        <div className="flex-1 px-6">
          <div className="space-y-4">
            {wallets.map((wallet) => (
              <div 
                key={wallet.id}
                className="crypto-card flex items-center justify-between"
                data-testid={`wallet-${wallet.id}`}
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
                      {wallet.amount} {wallet.currency}
                    </p>
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex space-x-2">
                  <button 
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    data-testid={`button-deposit-${wallet.id}`}
                  >
                    <UploadIcon className="w-10 h-10" />
                  </button>
                  <button 
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    data-testid={`button-send-${wallet.id}`}
                  >
                    <SendIcon className="w-10 h-10" />
                  </button>
                </div>
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
    </div>
  );
}