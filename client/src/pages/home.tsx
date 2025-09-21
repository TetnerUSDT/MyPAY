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

const UploadIcon = ({ className = "w-full h-5", ...props }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" fill="currentColor" className={className} {...props}>
    <path fillRule="evenodd" d="M1 254.956c0 107.01 66.496 198.497 160.559 235.887v-32.911C85.605 422.34 32.876 345.423 32.876 256c0-123.227 99.897-223.124 223.126-223.124 123.227 0 223.125 99.896 223.125 223.124 0 88.178-51.28 164.183-125.529 200.414v33.191C445.995 451.446 511 360.777 511 254.956 511 114.701 396.835 1 256.004 1S1 114.701 1 254.956m308.129 8.72 16.604 15.666c17.129 17.83 44.81 17.83 61.947 0 17.073-17.813 17.073-46.716 0-64.546l-97.722-94.926c-9.293-9.717-21.777-13.946-33.967-13.069-12.181-.878-24.63 3.351-33.981 13.069l-97.68 94.926c-17.078 17.83-17.078 46.733 0 64.546 17.099 17.83 44.808 17.83 61.883 0l16.666-15.714v193.335c0 29.845 23.781 54.038 53.126 54.038 29.337 0 53.125-24.192 53.125-54.038V263.676z" clipRule="evenodd" />
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
                    className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center"
                    data-testid={`button-deposit-${wallet.id}`}
                  >
                    <span className="text-accent-foreground font-bold">T</span>
                  </button>
                  <button 
                    className="w-10 h-10 bg-yellow-400 rounded-lg flex items-center justify-center"
                    data-testid={`button-send-${wallet.id}`}
                  >
                    <ArrowUpRight className="w-4 h-4 text-black" />
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
            <UploadIcon className="w-full h-5 mr-2" />
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