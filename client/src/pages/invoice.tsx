import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Clock, Copy, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Link, useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface Invoice {
  id: number;
  orderNumber: string;
  userId: number;
  walletId?: number;
  balanceId?: number;
  amount: string;
  currency: string;
  network?: string;
  description?: string;
  paymentMethod?: 'blockchain' | 'balance';
  status: 'pending' | 'paid' | 'expired' | 'canceled';
  expiresAt?: string;
  paidAt?: string;
  paymentHash?: string;
  createdAt: string;
}

export default function InvoicePage() {
  const [, params] = useRoute("/invoice/:id");
  const [, setLocation] = useLocation();
  const [showPaymentDrawer, setShowPaymentDrawer] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'blockchain' | 'balance'>('balance');
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const { toast } = useToast();

  const invoiceId = params?.id;

  // Get invoice details
  const { data: invoice, isLoading } = useQuery<Invoice>({
    queryKey: ["/api/invoices/by-id", invoiceId],
    enabled: !!invoiceId,
  });

  // Get user balance
  const { data: userBalance } = useQuery<any>({
    queryKey: ["/api/user-balance", invoice?.balanceId],
    enabled: !!invoice?.balanceId,
  });

  // Timer effect
  useEffect(() => {
    if (!invoice?.expiresAt || invoice.status !== 'pending') return;

    const updateTimer = () => {
      const now = new Date();
      const expires = new Date(invoice.expiresAt!);
      const diff = expires.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining("Истек");
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeRemaining(`${hours}ч ${minutes}м ${seconds}с`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [invoice]);

  // Pay invoice mutation
  const payInvoiceMutation = useMutation({
    mutationFn: async (data: { paymentMethod: 'blockchain' | 'balance'; paymentHash?: string }) => {
      await apiRequest("PATCH", `/api/invoices/${invoiceId}/pay`, data);
    },
    onSuccess: () => {
      toast({
        title: "Успешно!",
        description: "Счет успешно оплачен",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      setShowPaymentDrawer(false);
      setLocation("/notifications");
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось оплатить счет",
        variant: "destructive",
      });
    },
  });

  const handleCopyOrderNumber = () => {
    if (invoice?.orderNumber) {
      navigator.clipboard.writeText(invoice.orderNumber);
      toast({
        title: "Скопировано",
        description: "Номер заказа скопирован в буфер обмена",
      });
    }
  };

  const handlePayment = () => {
    if (selectedPaymentMethod === 'balance') {
      // Check if user has enough balance
      const invoiceAmount = parseFloat(invoice?.amount || '0');
      const userBalanceAmount = parseFloat(userBalance?.sum || '0');

      if (userBalanceAmount < invoiceAmount) {
        toast({
          title: "Недостаточно средств",
          description: `Требуется ${invoiceAmount} ${invoice?.currency}, доступно ${userBalanceAmount}`,
          variant: "destructive",
        });
        return;
      }

      payInvoiceMutation.mutate({ paymentMethod: 'balance' });
    } else {
      // For blockchain payment, admin needs to verify manually
      toast({
        title: "Ожидание подтверждения",
        description: "Отправьте средства на указанный адрес. Оплата будет подтверждена администратором.",
      });
      setShowPaymentDrawer(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle2 className="w-6 h-6 text-green-400" />;
      case 'expired':
      case 'canceled':
        return <XCircle className="w-6 h-6 text-red-400" />;
      default:
        return <Clock className="w-6 h-6 text-yellow-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'paid':
        return 'Оплачено';
      case 'expired':
        return 'Истек';
      case 'canceled':
        return 'Отменено';
      default:
        return 'Ожидает оплаты';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'text-green-400';
      case 'expired':
      case 'canceled':
        return 'text-red-400';
      default:
        return 'text-yellow-400';
    }
  };

  if (isLoading) {
    return (
      <div className="mobile-screen gradient-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="mobile-screen gradient-bg flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="w-16 h-16 text-red-400 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Счет не найден</h2>
        <Link href="/notifications">
          <Button variant="outline" className="mt-4">Вернуться к уведомлениям</Button>
        </Link>
      </div>
    );
  }

  const canPay = invoice.status === 'pending' && (!invoice.expiresAt || new Date(invoice.expiresAt) > new Date());

  return (
    <div className="mobile-screen gradient-bg text-white overflow-y-auto pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-green-700/95 to-green-800/95 backdrop-blur-sm border-b border-green-600/30">
        <div className="flex items-center gap-3 p-4">
          <Link href="/notifications">
            <button className="w-10 h-10 rounded-full bg-black/20 flex items-center justify-center" data-testid="button-back">
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">Счет #{invoice.orderNumber}</h1>
            <p className="text-xs text-green-200">
              Создан {format(new Date(invoice.createdAt), "dd.MM.yyyy 'в' HH:mm", { locale: ru })}
            </p>
          </div>
        </div>
      </div>

      {/* Invoice Details */}
      <div className="p-4 space-y-4">
        {/* Status Card */}
        <div className="bg-gradient-to-r from-green-700/40 to-green-800/40 rounded-xl p-6 border border-green-600/30 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {getStatusIcon(invoice.status)}
              <div>
                <p className="text-sm text-green-200">Статус</p>
                <p className={`text-lg font-semibold ${getStatusColor(invoice.status)}`}>
                  {getStatusText(invoice.status)}
                </p>
              </div>
            </div>
            {invoice.status === 'pending' && invoice.expiresAt && (
              <div className="text-right">
                <p className="text-sm text-green-200">Осталось</p>
                <p className="text-lg font-semibold text-yellow-400">{timeRemaining}</p>
              </div>
            )}
          </div>

          {/* Amount */}
          <div className="border-t border-green-600/30 pt-4">
            <p className="text-sm text-green-200 mb-1">Сумма к оплате</p>
            <p className="text-3xl font-bold text-white">
              {invoice.amount} {invoice.currency}
            </p>
            {invoice.network && (
              <p className="text-sm text-green-200 mt-1">Сеть: {invoice.network}</p>
            )}
          </div>
        </div>

        {/* Order Number */}
        <div className="bg-gradient-to-r from-green-700/40 to-green-800/40 rounded-xl p-4 border border-green-600/30 backdrop-blur-sm">
          <p className="text-sm text-green-200 mb-2">Номер заказа</p>
          <div className="flex items-center justify-between">
            <p className="text-lg font-mono text-white">{invoice.orderNumber}</p>
            <button
              onClick={handleCopyOrderNumber}
              className="p-2 rounded-lg bg-black/20 hover:bg-black/30 transition-colors"
              data-testid="button-copy-order"
            >
              <Copy className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Description */}
        {invoice.description && (
          <div className="bg-gradient-to-r from-green-700/40 to-green-800/40 rounded-xl p-4 border border-green-600/30 backdrop-blur-sm">
            <p className="text-sm text-green-200 mb-2">Описание</p>
            <p className="text-white">{invoice.description}</p>
          </div>
        )}

        {/* Balance Info */}
        {userBalance && canPay && (
          <div className="bg-gradient-to-r from-green-700/40 to-green-800/40 rounded-xl p-4 border border-green-600/30 backdrop-blur-sm">
            <p className="text-sm text-green-200 mb-2">Ваш баланс</p>
            <p className="text-2xl font-bold text-white">
              {userBalance.sum} {userBalance.currency}
            </p>
          </div>
        )}

        {/* Payment Button */}
        {canPay && (
          <Button
            onClick={() => setShowPaymentDrawer(true)}
            className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-6 text-lg"
            data-testid="button-pay-invoice"
          >
            Оплатить счет
          </Button>
        )}
      </div>

      {/* Payment Method Drawer */}
      <Drawer open={showPaymentDrawer} onOpenChange={setShowPaymentDrawer}>
        <DrawerContent className="bg-gradient-to-b from-green-800 to-green-900 border-green-600/30">
          <DrawerHeader>
            <DrawerTitle className="text-white">Способ оплаты</DrawerTitle>
            <DrawerDescription className="text-green-200">
              Выберите как вы хотите оплатить счет
            </DrawerDescription>
          </DrawerHeader>
          
          <div className="p-4 space-y-3">
            {/* Balance Payment */}
            {invoice.balanceId && (
              <button
                onClick={() => setSelectedPaymentMethod('balance')}
                className={`w-full p-4 rounded-xl border-2 transition-all ${
                  selectedPaymentMethod === 'balance'
                    ? 'border-yellow-400 bg-yellow-400/20'
                    : 'border-green-600/30 bg-green-700/40'
                }`}
                data-testid="payment-method-balance"
              >
                <div className="flex items-center justify-between">
                  <div className="text-left">
                    <p className="font-semibold text-white">Оплата балансом</p>
                    <p className="text-sm text-green-200">
                      Доступно: {userBalance?.sum || '0'} {invoice.currency}
                    </p>
                  </div>
                  {selectedPaymentMethod === 'balance' && (
                    <CheckCircle2 className="w-6 h-6 text-yellow-400" />
                  )}
                </div>
              </button>
            )}

            {/* Blockchain Payment */}
            {invoice.walletId && (
              <button
                onClick={() => setSelectedPaymentMethod('blockchain')}
                className={`w-full p-4 rounded-xl border-2 transition-all ${
                  selectedPaymentMethod === 'blockchain'
                    ? 'border-yellow-400 bg-yellow-400/20'
                    : 'border-green-600/30 bg-green-700/40'
                }`}
                data-testid="payment-method-blockchain"
              >
                <div className="flex items-center justify-between">
                  <div className="text-left">
                    <p className="font-semibold text-white">Оплата блокчейном</p>
                    <p className="text-sm text-green-200">
                      {invoice.network || 'Криптовалюта'}
                    </p>
                  </div>
                  {selectedPaymentMethod === 'blockchain' && (
                    <CheckCircle2 className="w-6 h-6 text-yellow-400" />
                  )}
                </div>
              </button>
            )}

            {/* Confirm Payment Button */}
            <Button
              onClick={handlePayment}
              disabled={payInvoiceMutation.isPending}
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-6 text-lg"
              data-testid="button-confirm-payment"
            >
              {payInvoiceMutation.isPending ? "Обработка..." : "Подтвердить оплату"}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
