import { useState } from "react";
import { Link } from "wouter";
import { X, Copy, Check } from "lucide-react";
import { copyToClipboard } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type OperationStatus = "pending" | "completed" | "cancelled";

interface Operation {
  id: string;
  type: string;
  date: string;
  amount: string;
  applicationNumber: string;
  walletAddress: string;
  cardNumber: string;
  status: OperationStatus;
  cancelReason?: string;
}

export default function HistoryScreen() {
  const [operations] = useState<Operation[]>([
    {
      id: "1",
      type: "Обмен средств",
      date: "9/15/2025 12:13",
      amount: "872342833",
      applicationNumber: "872342833",
      walletAddress: "TW6LqMKykCfsgkMkLxd92HGbp...",
      cardNumber: "4373 8349 9348 7328",
      status: "completed"
    },
    {
      id: "2", 
      type: "Обмен средств",
      date: "9/14/2025 15:30",
      amount: "123456789",
      applicationNumber: "123456789",
      walletAddress: "TW6LqMKykCfsgkMkLxd92HGbp...",
      cardNumber: "4373 8349 9348 7328",
      status: "pending"
    },
    {
      id: "3",
      type: "Обмен средств", 
      date: "9/13/2025 09:45",
      amount: "987654321",
      applicationNumber: "987654321",
      walletAddress: "TW6LqMKykCfsgkMkLxd92HGbp...",
      cardNumber: "4373 8349 9348 7328",
      status: "cancelled",
      cancelReason: "Время ожидания платежа истекло"
    }
  ]);

  const [copiedItems, setCopiedItems] = useState<{ [key: string]: boolean }>({});
  const { toast } = useToast();

  const handleCopy = async (text: string, itemId: string, type: string) => {
    try {
      await copyToClipboard(text);
      setCopiedItems(prev => ({ ...prev, [`${itemId}-${type}`]: true }));
      toast({
        title: "Copied!",
        description: `${type} copied to clipboard`,
      });
      setTimeout(() => {
        setCopiedItems(prev => ({ ...prev, [`${itemId}-${type}`]: false }));
      }, 2000);
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to copy ${type}`,
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: OperationStatus) => {
    switch (status) {
      case "completed":
        return (
          <div className="flex items-center text-green-400">
            <div className="w-6 h-6 rounded-full bg-green-400 flex items-center justify-center mr-2">
              <Check className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm">Заявка выполнена успешно</span>
          </div>
        );
      case "pending":
        return (
          <div className="flex items-center text-yellow-400">
            <div className="w-6 h-6 rounded-full bg-yellow-400 flex items-center justify-center mr-2">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            </div>
            <span className="text-sm">В ожидании</span>
          </div>
        );
      case "cancelled":
        return (
          <div className="flex items-center text-red-400">
            <div className="w-6 h-6 rounded-full bg-red-400 flex items-center justify-center mr-2">
              <X className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm">Отменена</span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <TooltipProvider>
      <div className="mobile-screen gradient-bg text-white">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6">
            <h1 className="text-xl font-semibold" data-testid="text-history-title">
              История операций
            </h1>
            <Link href="/home">
              <button 
                className="w-8 h-8 rounded-full bg-black/20 flex items-center justify-center"
                data-testid="button-close"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </Link>
          </div>

          {/* Operations List */}
          <div className="flex-1 px-6 pb-4">
            <div className="space-y-4">
              {operations.map((operation) => (
                <div 
                  key={operation.id}
                  className="crypto-card"
                  data-testid={`operation-${operation.id}`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-sm text-muted-foreground">
                        {operation.type}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {operation.date}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center justify-end">
                        <span 
                          className="text-xl font-bold text-yellow-400 cursor-pointer"
                          onClick={() => handleCopy(operation.applicationNumber, operation.id, 'applicationNumber')}
                          data-testid={`operation-amount-${operation.id}`}
                        >
                          {operation.applicationNumber}
                        </span>
                        <button 
                          className="ml-2 p-1 hover:bg-white/10 rounded"
                          onClick={() => handleCopy(operation.applicationNumber, operation.id, 'applicationNumber')}
                          data-testid={`button-copy-application-${operation.id}`}
                        >
                          {copiedItems[`${operation.id}-applicationNumber`] ? (
                            <Check className="w-4 h-4 text-green-400" />
                          ) : (
                            <Copy className="w-4 h-4 text-accent" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Wallet Address */}
                  <div className="mb-3">
                    <div className="bg-secondary rounded-lg p-3 flex items-center justify-between">
                      <span 
                        className="font-mono text-sm flex-1"
                        data-testid={`operation-wallet-${operation.id}`}
                      >
                        {operation.walletAddress}
                      </span>
                      <button 
                        className="ml-2 p-1 hover:bg-white/10 rounded"
                        onClick={() => handleCopy(operation.walletAddress, operation.id, 'wallet')}
                        data-testid={`button-copy-wallet-${operation.id}`}
                      >
                        {copiedItems[`${operation.id}-wallet`] ? (
                          <Check className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4 text-accent" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Card Number */}
                  <div className="mb-4">
                    <div className="text-xs text-muted-foreground mb-1">На номер карты</div>
                    <div className="bg-secondary rounded-lg p-3 flex items-center justify-between">
                      <span 
                        className="font-mono text-sm"
                        data-testid={`operation-card-${operation.id}`}
                      >
                        {operation.cardNumber}
                      </span>
                      <button 
                        className="ml-2 p-1 hover:bg-white/10 rounded"
                        onClick={() => handleCopy(operation.cardNumber, operation.id, 'card')}
                        data-testid={`button-copy-card-${operation.id}`}
                      >
                        {copiedItems[`${operation.id}-card`] ? (
                          <Check className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4 text-accent" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Status */}
                  <div data-testid={`operation-status-${operation.id}`}>
                    {operation.status === "cancelled" && operation.cancelReason ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="cursor-pointer">
                            {getStatusIcon(operation.status)}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{operation.cancelReason}</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      getStatusIcon(operation.status)
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Show More Button */}
          <div className="p-6">
            <button 
              className="action-button"
              data-testid="button-show-more"
            >
              Показать больше
            </button>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}