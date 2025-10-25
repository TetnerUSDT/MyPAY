import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { X, Plus, Copy, Ticket, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

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

interface Balance {
  id: number;
  name: string;
  currency: string;
}

interface UserBalance {
  balanceId: number;
  balanceName: string;
  sum: string;
  currency: string;
  balanceStatus: 'active' | 'frozen';
}

export default function VouchersPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("active");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedBalance, setSelectedBalance] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [securityType, setSecurityType] = useState<'none' | 'word' | 'pin'>('none');
  const [securityValue, setSecurityValue] = useState("");

  // Fetch user balances
  const { data: userBalances = [] } = useQuery<UserBalance[]>({
    queryKey: ['/api/user/balances'],
  });

  // Fetch active vouchers
  const { data: activeVouchers = [], isLoading: activeLoading } = useQuery<Voucher[]>({
    queryKey: ['/api/vouchers/my', { status: 'active' }],
  });

  // Fetch activated vouchers
  const { data: activatedVouchers = [], isLoading: activatedLoading } = useQuery<Voucher[]>({
    queryKey: ['/api/vouchers/my', { status: 'activated' }],
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
      resetForm();
      toast({
        title: "Ваучер создан!",
        description: "Ваучер успешно создан и средства списаны с баланса",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось создать ваучер",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setSelectedBalance("");
    setAmount("");
    setSecurityType('none');
    setSecurityValue("");
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
        {/* Create Button */}
        <Button
          onClick={() => setIsCreateDialogOpen(true)}
          className="w-full bg-accent hover:bg-accent/90 text-secondary font-semibold py-6 rounded-xl"
          data-testid="button-create-voucher"
        >
          <Plus className="w-5 h-5 mr-2" />
          Создать ваучер
        </Button>

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
              <Select value={selectedBalance} onValueChange={setSelectedBalance}>
                <SelectTrigger className="bg-white/10 border-green-500/30 text-white" data-testid="select-balance">
                  <SelectValue placeholder="Выберите валюту" />
                </SelectTrigger>
                <SelectContent>
                  {userBalances
                    .filter(b => b.balanceStatus === 'active' && parseFloat(b.sum) > 0)
                    .map((balance) => (
                      <SelectItem key={balance.balanceId} value={balance.balanceId.toString()}>
                        {balance.balanceName} ({parseFloat(balance.sum).toFixed(2)} {balance.currency})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

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
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateDialogOpen(false);
                resetForm();
              }}
              className="flex-1 border-green-500/30 text-white hover:bg-white/10"
              data-testid="button-cancel-create"
            >
              Отмена
            </Button>
            <Button
              onClick={handleCreateVoucher}
              disabled={createVoucherMutation.isPending}
              className="flex-1 bg-accent hover:bg-accent/90 text-secondary"
              data-testid="button-confirm-create"
            >
              {createVoucherMutation.isPending ? "Создание..." : "Создать"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
