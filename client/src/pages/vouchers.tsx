import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { X, Plus, Copy, Ticket, CheckCircle2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import Lottie from "lottie-react";
import voucherAnimation from "@assets/VOUCHER_1761385257411.json";
import QRScanner, { QRScannerButton } from "@/components/qr-scanner";

// Helper function to get user-friendly error messages
function getErrorMessage(error: any): string {
  const message = error?.message || '';
  
  // Common error patterns
  const errorMap: Record<string, string> = {
    'Voucher not found': 'Ваучер не найден',
    'Insufficient balance': 'Недостаточно средств',
    'Invalid voucher code': 'Неверный код ваучера',
    'Voucher already activated': 'Ваучер уже активирован',
    'Voucher expired': 'Срок действия ваучера истек',
    'Invalid security value': 'Неверный PIN-код или пароль',
    'Internal server error': 'Ошибка сервера. Попробуйте позже',
    'Unauthorized': 'Необходима авторизация',
  };
  
  // Check for exact match
  for (const [key, value] of Object.entries(errorMap)) {
    if (message.includes(key)) {
      return value;
    }
  }
  
  // Return original message if no mapping found
  return message || 'Произошла ошибка';
}

interface Voucher {
  id: number;
  code: string;
  userId: number;
  balanceId: number;
  amount: string;
  currency: string;
  securityType: 'none' | 'word' | 'pin';
  status: 'active' | 'activated' | 'expired';
  activatedBy?: number;
  createdAt: string;
  activatedAt?: string;
}

interface UserBalance {
  balanceId: number;
  balanceName: string;
  sum: string;
  currency: string;
  balanceStatus: 'active' | 'frozen';
}

interface VoucherCheckResponse {
  id: number;
  amount: string;
  currency: string;
  status: string;
  securityType: 'none' | 'word' | 'pin';
  requiresSecurity: boolean;
  createdAt: string;
}

export default function VouchersPage() {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("active");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isActivateDialogOpen, setIsActivateDialogOpen] = useState(false);
  const [selectedBalance, setSelectedBalance] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [securityType, setSecurityType] = useState<'none' | 'word' | 'pin'>('none');
  const [securityValue, setSecurityValue] = useState("");
  
  // Activation state
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherInfo, setVoucherInfo] = useState<VoucherCheckResponse | null>(null);
  const [isSecurityDialogOpen, setIsSecurityDialogOpen] = useState(false);
  const [activationSecurityValue, setActivationSecurityValue] = useState("");
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Check for activation action in URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'activate') {
      setIsActivateDialogOpen(true);
    }
  }, [location]);
  
  // Clean URL when activation dialog closes
  const handleActivateDialogChange = (open: boolean) => {
    setIsActivateDialogOpen(open);
    if (!open && window.location.search.includes('action=activate')) {
      setLocation('/vouchers', { replace: true });
    }
  };

  // Fetch user balances
  const { data: userBalances = [] } = useQuery<UserBalance[]>({
    queryKey: ['/api/user/balances'],
  });

  // Filter active balances with balance > 0
  const availableBalances = userBalances.filter(
    b => b.balanceStatus === 'active' && parseFloat(b.sum) > 0
  );

  // Fetch active vouchers
  const { data: activeVouchers = [], isLoading: activeLoading } = useQuery<Voucher[]>({
    queryKey: ['/api/vouchers/my?status=active'],
  });

  // Fetch activated vouchers
  const { data: activatedVouchers = [], isLoading: activatedLoading } = useQuery<Voucher[]>({
    queryKey: ['/api/vouchers/my?status=activated'],
  });

  const createVoucherMutation = useMutation({
    mutationFn: async (data: { balanceId: number; amount: string; securityType: string; securityValue?: string }) => {
      const response = await apiRequest("POST", "/api/vouchers/create", data);
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/vouchers/my'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/balances'] });
      setIsCreateDialogOpen(false);
      resetCreateForm();
      toast({
        title: "Ваучер создан!",
        description: "Ваучер успешно создан и средства списаны с баланса",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const checkVoucherMutation = useMutation({
    mutationFn: async (voucherCode: string) => {
      const response = await apiRequest("POST", "/api/vouchers/check", { code: voucherCode });
      return await response.json() as VoucherCheckResponse;
    },
    onSuccess: (data: VoucherCheckResponse) => {
      if (data.status !== 'active') {
        toast({
          title: "Ошибка",
          description: "Этот ваучер уже был использован или истек",
          variant: "destructive",
        });
        return;
      }

      setVoucherInfo(data);
      
      if (data.requiresSecurity) {
        setIsSecurityDialogOpen(true);
      } else {
        // Activate immediately if no security
        activateVoucherMutation.mutate({ code: voucherCode, securityValue: undefined });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const activateVoucherMutation = useMutation({
    mutationFn: async (data: { code: string; securityValue?: string }) => {
      const response = await apiRequest("POST", "/api/vouchers/activate", data);
      return await response.json() as { message: string; amount: number; currency: string; newBalance: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/balances'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vouchers/my'] });
      
      toast({
        title: "Успешно!",
        description: `Ваучер активирован. Начислено ${data.amount} ${data.currency}`,
      });
      
      setIsSecurityDialogOpen(false);
      handleActivateDialogChange(false);
      resetActivationForm();
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const resetCreateForm = () => {
    setSelectedBalance("");
    setAmount("");
    setSecurityType('none');
    setSecurityValue("");
  };

  const resetActivationForm = () => {
    setVoucherCode("");
    setVoucherInfo(null);
    setActivationSecurityValue("");
  };

  const handleCreateVoucher = () => {
    if (!selectedBalance) {
      toast({
        title: "Ошибка",
        description: "Выберите валюту",
        variant: "destructive",
      });
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: "Ошибка",
        description: "Введите корректную сумму",
        variant: "destructive",
      });
      return;
    }

    if (securityType !== 'none' && !securityValue) {
      toast({
        title: "Ошибка",
        description: securityType === 'pin' ? "Введите PIN-код" : "Введите пароль",
        variant: "destructive",
      });
      return;
    }

    if (securityType === 'pin' && !/^\d{4,6}$/.test(securityValue)) {
      toast({
        title: "Ошибка",
        description: "PIN-код должен содержать от 4 до 6 цифр",
        variant: "destructive",
      });
      return;
    }

    createVoucherMutation.mutate({
      balanceId: parseInt(selectedBalance),
      amount,
      securityType,
      securityValue: securityType !== 'none' ? securityValue : undefined,
    });
  };

  // Format voucher code input (V + 13 digits + D)
  const handleCodeChange = (value: string) => {
    // Remove all non-alphanumeric characters
    let cleaned = value.toUpperCase().replace(/[^VD0-9]/g, '');
    
    // Ensure it starts with V if user types anything
    if (cleaned && !cleaned.startsWith('V')) {
      cleaned = 'V' + cleaned.replace(/V/g, '');
    }
    
    // Limit to 15 characters (V + 13 digits + D)
    if (cleaned.length > 15) {
      cleaned = cleaned.substring(0, 15);
    }
    
    setVoucherCode(cleaned);
  };

  const handleCheckVoucher = () => {
    if (!voucherCode || voucherCode.length !== 15) {
      toast({
        title: "Ошибка",
        description: "Введите полный код ваучера (15 символов)",
        variant: "destructive",
      });
      return;
    }

    if (!voucherCode.startsWith('V') || !voucherCode.endsWith('D')) {
      toast({
        title: "Ошибка",
        description: "Неверный формат кода ваучера",
        variant: "destructive",
      });
      return;
    }

    checkVoucherMutation.mutate(voucherCode);
  };

  const handleActivateWithSecurity = () => {
    if (!activationSecurityValue) {
      toast({
        title: "Ошибка",
        description: voucherInfo?.securityType === 'pin' ? "Введите PIN-код" : "Введите пароль",
        variant: "destructive",
      });
      return;
    }

    activateVoucherMutation.mutate({
      code: voucherCode,
      securityValue: activationSecurityValue,
    });
  };

  const formatCodeDisplay = (code: string) => {
    if (code.length <= 1) return code;
    
    // V + 13 digits + D
    const v = code[0] || '';
    const digits = code.slice(1, 14);
    const d = code[14] || '';
    
    // Group digits in chunks of 4-5-4
    const chunk1 = digits.slice(0, 4);
    const chunk2 = digits.slice(4, 9);
    const chunk3 = digits.slice(9, 13);
    
    let formatted = v;
    if (chunk1) formatted += '-' + chunk1;
    if (chunk2) formatted += '-' + chunk2;
    if (chunk3) formatted += '-' + chunk3;
    if (d) formatted += '-' + d;
    
    return formatted;
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Скопировано!",
      description: "Код ваучера скопирован в буфер обмена",
    });
  };

  const getSecurityLabel = (type: string) => {
    switch (type) {
      case 'pin':
        return 'PIN-код';
      case 'word':
        return 'Пароль';
      default:
        return 'Без защиты';
    }
  };

  const renderVoucherCard = (voucher: Voucher) => {
    const isActive = voucher.status === 'active';
    
    return (
      <div
        key={voucher.id}
        className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-green-500/30 space-y-3"
        data-testid={`voucher-card-${voucher.id}`}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Ticket className={`w-5 h-5 ${isActive ? 'text-green-400' : 'text-gray-400'}`} />
            <span className={`text-xs font-medium ${isActive ? 'text-green-400' : 'text-gray-400'}`}>
              {isActive ? 'Активен' : 'Использован'}
            </span>
          </div>
          {isActive && (
            <CheckCircle2 className="w-5 h-5 text-green-400" />
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 bg-white/90 rounded-lg py-2 px-3">
            <span className="flex-1 text-secondary text-sm font-mono font-semibold" data-testid={`voucher-code-${voucher.id}`}>
              {voucher.code}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleCopyCode(voucher.code)}
              className="text-secondary hover:bg-secondary/10 h-8 w-8"
              data-testid={`button-copy-${voucher.id}`}
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-green-200 text-xs">Сумма</p>
              <p className="text-white font-semibold" data-testid={`voucher-amount-${voucher.id}`}>
                {parseFloat(voucher.amount).toFixed(2)} {voucher.currency}
              </p>
            </div>
            <div>
              <p className="text-green-200 text-xs">Защита</p>
              <p className="text-white font-semibold">
                {getSecurityLabel(voucher.securityType)}
              </p>
            </div>
          </div>

          <div className="text-xs text-green-200">
            Создан: {format(new Date(voucher.createdAt), "dd MMM yyyy, HH:mm", { locale: ru })}
          </div>
          {voucher.activatedAt && (
            <div className="text-xs text-gray-400">
              Активирован: {format(new Date(voucher.activatedAt), "dd MMM yyyy, HH:mm", { locale: ru })}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="mobile-screen gradient-bg text-white pb-24">
      {/* Header */}
      <div className="flex items-center justify-between p-6">
        <h1 className="text-xl font-semibold" data-testid="text-vouchers-title">
          Ваучеры
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

      <div className="px-4 space-y-4">
        {/* Voucher Animation */}
        <div className="flex justify-center -mt-4 mb-2">
          <Lottie 
            animationData={voucherAnimation} 
            loop={true}
            className="w-64 h-64"
          />
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={() => setIsCreateDialogOpen(true)}
            className="w-full bg-accent hover:bg-accent/90 text-secondary font-semibold py-6 rounded-xl"
            data-testid="button-create-voucher"
          >
            <Plus className="w-5 h-5 mr-2" />
            Создать ваучер
          </Button>
          <Button
            onClick={() => handleActivateDialogChange(true)}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-6 rounded-xl"
            data-testid="button-activate-voucher"
          >
            <CheckCircle2 className="w-5 h-5 mr-2" />
            Активировать
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-green-800/60 border border-green-500/40">
            <TabsTrigger 
              value="active" 
              className="data-[state=active]:bg-accent data-[state=active]:text-secondary"
              data-testid="tab-active-vouchers"
            >
              Активные
            </TabsTrigger>
            <TabsTrigger 
              value="completed" 
              className="data-[state=active]:bg-accent data-[state=active]:text-secondary"
              data-testid="tab-completed-vouchers"
            >
              Завершенные
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4 mt-4">
            {activeLoading ? (
              <div className="text-center py-8 text-green-200">Загрузка...</div>
            ) : activeVouchers.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <Ticket className="w-12 h-12 mx-auto text-green-200/50" />
                <p className="text-green-200">У вас пока нет активных ваучеров</p>
              </div>
            ) : (
              activeVouchers.map(renderVoucherCard)
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4 mt-4">
            {activatedLoading ? (
              <div className="text-center py-8 text-green-200">Загрузка...</div>
            ) : activatedVouchers.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <Ticket className="w-12 h-12 mx-auto text-green-200/50" />
                <p className="text-green-200">У вас пока нет завершенных ваучеров</p>
              </div>
            ) : (
              activatedVouchers.map(renderVoucherCard)
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Create Voucher Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="bg-gradient-to-br from-green-900 to-green-950 text-white border-green-500/30">
          <DialogHeader>
            <DialogTitle className="text-xl">Создать ваучер</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Balance Selection */}
            <div className="space-y-2">
              <Label htmlFor="balance" className="text-green-200">Валюта</Label>
              {availableBalances.length === 0 ? (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 text-center">
                  <p className="text-sm text-yellow-200">У вас нет активных балансов</p>
                  <p className="text-xs text-yellow-200/70 mt-1">Пополните баланс для создания ваучера</p>
                </div>
              ) : (
                <Select value={selectedBalance} onValueChange={setSelectedBalance}>
                  <SelectTrigger className="bg-white/10 border-green-500/30 text-white" data-testid="select-balance">
                    <SelectValue placeholder="Выберите валюту" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableBalances.map((balance) => (
                      <SelectItem key={balance.balanceId} value={balance.balanceId.toString()}>
                        {balance.balanceName} ({parseFloat(balance.sum).toFixed(2)} {balance.currency})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {availableBalances.length > 0 && (
              <>
                {/* Amount */}
                <div className="space-y-2">
                  <Label htmlFor="amount" className="text-green-200">Сумма</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="bg-white/10 border-green-500/30 text-white placeholder:text-white/50"
                    data-testid="input-amount"
                  />
                </div>

                {/* Security Type */}
                <div className="space-y-2">
                  <Label className="text-green-200">Защита</Label>
                  <RadioGroup value={securityType} onValueChange={(value: any) => {
                    setSecurityType(value);
                    setSecurityValue("");
                  }}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="none" id="none" className="border-green-500/50" data-testid="radio-security-none" />
                      <Label htmlFor="none" className="cursor-pointer">Без защиты</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="pin" id="pin" className="border-green-500/50" data-testid="radio-security-pin" />
                      <Label htmlFor="pin" className="cursor-pointer">PIN-код (4-6 цифр)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="word" id="word" className="border-green-500/50" data-testid="radio-security-word" />
                      <Label htmlFor="word" className="cursor-pointer">Пароль</Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Security Value Input */}
                {securityType !== 'none' && (
                  <div className="space-y-2">
                    <Label htmlFor="security" className="text-green-200">
                      {securityType === 'pin' ? 'PIN-код' : 'Пароль'}
                    </Label>
                    <Input
                      id="security"
                      type={securityType === 'pin' ? 'number' : 'text'}
                      value={securityValue}
                      onChange={(e) => setSecurityValue(e.target.value)}
                      placeholder={securityType === 'pin' ? '1234' : 'Введите пароль'}
                      maxLength={securityType === 'pin' ? 6 : undefined}
                      className="bg-white/10 border-green-500/30 text-white placeholder:text-white/50"
                      data-testid="input-security-value"
                    />
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateDialogOpen(false);
                resetCreateForm();
              }}
              className="flex-1 border-green-500/30 text-white hover:bg-white/10"
              data-testid="button-cancel-create"
            >
              Отмена
            </Button>
            <Button
              onClick={handleCreateVoucher}
              disabled={createVoucherMutation.isPending || availableBalances.length === 0}
              className="flex-1 bg-accent hover:bg-accent/90 text-secondary"
              data-testid="button-confirm-create"
            >
              {createVoucherMutation.isPending ? "Создание..." : "Создать"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Activate Voucher Dialog */}
      <Dialog open={isActivateDialogOpen} onOpenChange={handleActivateDialogChange}>
        <DialogContent className="bg-gradient-to-br from-green-900 to-green-950 text-white border-green-500/30">
          <DialogHeader>
            <DialogTitle className="text-xl">Активировать ваучер</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="code" className="text-green-200">Код ваучера</Label>
              <div className="flex gap-2 items-center">
                <Input
                  id="code"
                  type="text"
                  value={formatCodeDisplay(voucherCode)}
                  onChange={(e) => handleCodeChange(e.target.value.replace(/-/g, ''))}
                  placeholder="V-0000-00000-0000-D"
                  className="bg-white/90 text-secondary text-center text-lg font-mono font-semibold tracking-wider flex-1"
                  maxLength={19} // 15 chars + 4 dashes
                  data-testid="input-voucher-code"
                />
                <QRScannerButton 
                  onClick={() => setIsScannerOpen(true)}
                  className="border-green-500/30 bg-white/10 hover:bg-white/20 text-white shrink-0"
                />
              </div>
              <p className="text-xs text-green-200 text-center">
                Введено: {voucherCode.length}/15
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                handleActivateDialogChange(false);
                resetActivationForm();
              }}
              className="flex-1 border-green-500/30 text-white hover:bg-white/10"
              data-testid="button-cancel-activate"
            >
              Отмена
            </Button>
            <Button
              onClick={handleCheckVoucher}
              disabled={checkVoucherMutation.isPending || voucherCode.length !== 15}
              className="flex-1 bg-accent hover:bg-accent/90 text-secondary"
              data-testid="button-check-voucher"
            >
              {checkVoucherMutation.isPending ? "Проверка..." : "Активировать"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Security Dialog for Activation */}
      <Dialog open={isSecurityDialogOpen} onOpenChange={setIsSecurityDialogOpen}>
        <DialogContent className="bg-gradient-to-br from-green-900 to-green-950 text-white border-green-500/30">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Защищенный ваучер
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="text-center space-y-2">
              <p className="text-green-200">
                Этот ваучер защищен {voucherInfo?.securityType === 'pin' ? 'PIN-кодом' : 'паролем'}
              </p>
              <p className="text-2xl font-bold text-accent">
                {voucherInfo?.amount} {voucherInfo?.currency}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="security" className="text-green-200">
                {voucherInfo?.securityType === 'pin' ? 'PIN-код' : 'Пароль'}
              </Label>
              
              {voucherInfo?.securityType === 'pin' ? (
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={activationSecurityValue}
                    onChange={setActivationSecurityValue}
                    data-testid="input-pin-code"
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} className="bg-white/10 border-green-500/30 text-white" />
                      <InputOTPSlot index={1} className="bg-white/10 border-green-500/30 text-white" />
                      <InputOTPSlot index={2} className="bg-white/10 border-green-500/30 text-white" />
                      <InputOTPSlot index={3} className="bg-white/10 border-green-500/30 text-white" />
                      <InputOTPSlot index={4} className="bg-white/10 border-green-500/30 text-white" />
                      <InputOTPSlot index={5} className="bg-white/10 border-green-500/30 text-white" />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              ) : (
                <Input
                  id="security"
                  type="password"
                  value={activationSecurityValue}
                  onChange={(e) => setActivationSecurityValue(e.target.value)}
                  placeholder="Введите пароль"
                  className="bg-white/10 border-green-500/30 text-white placeholder:text-white/50"
                  data-testid="input-password"
                />
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsSecurityDialogOpen(false);
                setActivationSecurityValue("");
              }}
              className="flex-1 border-green-500/30 text-white hover:bg-white/10"
              data-testid="button-cancel-security"
            >
              Отмена
            </Button>
            <Button
              onClick={handleActivateWithSecurity}
              disabled={activateVoucherMutation.isPending}
              className="flex-1 bg-accent hover:bg-accent/90 text-secondary"
              data-testid="button-confirm-activate"
            >
              {activateVoucherMutation.isPending ? "Активация..." : "Активировать"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* QR Scanner */}
      <QRScanner
        open={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={(data) => {
          // Auto-fill the scanned code
          handleCodeChange(data);
          setIsScannerOpen(false);
          toast({
            title: "QR-код отсканирован",
            description: "Код ваучера успешно считан",
          });
        }}
        title="Сканирование ваучера"
        validate={(data) => {
          // Validate voucher format: V + 13 digits + D (total 15 characters)
          const voucherRegex = /^V\d{13}D$/;
          return voucherRegex.test(data);
        }}
        errorMessage="Неверный формат ваучера."
      />
    </div>
  );
}
