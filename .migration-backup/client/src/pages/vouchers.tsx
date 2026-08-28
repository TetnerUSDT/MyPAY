import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { ChevronLeft, Plus, Copy, Ticket, CheckCircle2, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { ru, enUS } from "date-fns/locale";
import Lottie from "lottie-react";
import voucherAnimation from "@assets/VOUCHER_1761385257411.json";
import QRScanner, { QRScannerButton } from "@/components/qr-scanner";
import { useTranslation } from "react-i18next";

// Helper function to get user-friendly error messages
function getErrorMessage(error: any, t: (key: string) => string): string {
  // Try to extract message from different error formats
  let message = '';
  
  if (typeof error === 'string') {
    message = error;
  } else if (error?.message) {
    message = error.message;
  } else if (typeof error === 'object') {
    // If error is JSON string, try to parse it
    try {
      const errorStr = JSON.stringify(error);
      const parsed = JSON.parse(errorStr);
      message = parsed.message || errorStr;
    } catch {
      message = String(error);
    }
  }
  
  // Common error patterns
  const errorMap: Record<string, string> = {
    'Voucher not found': t('vouchers.errors.voucherNotFound'),
    'Insufficient balance': t('vouchers.errors.insufficientBalance'),
    'Invalid voucher code': t('vouchers.errors.invalidCode'),
    'Voucher already activated': t('vouchers.errors.alreadyActivated'),
    'Voucher is not active': t('vouchers.errors.notActive'),
    'Voucher expired': t('vouchers.errors.expired'),
    'Invalid security value': t('vouchers.errors.invalidSecurity'),
    'Security code is required': t('vouchers.errors.securityRequired'),
    'Invalid security code': t('vouchers.errors.invalidSecurityCode'),
    'Internal server error': t('vouchers.errors.serverError'),
    'Unauthorized': t('vouchers.errors.unauthorized'),
  };
  
  // Check for exact match
  for (const [key, value] of Object.entries(errorMap)) {
    if (message.includes(key)) {
      return value;
    }
  }
  
  // Return original message if no mapping found
  return message || t('vouchers.errors.genericError');
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
  network?: string;
  balanceStatus: 'active' | 'frozen';
  balanceType?: 'fiat' | 'crypto' | 'token' | 'voucher';
  targetBalanceId?: number;
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
  const { t, i18n } = useTranslation();
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
    onSuccess: async (data) => {
      // Refetch all voucher-related queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['/api/vouchers/my?status=active'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/vouchers/my?status=activated'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/user/balances'] })
      ]);
      
      setIsCreateDialogOpen(false);
      resetCreateForm();
      toast({
        title: t('vouchers.voucherCreated'),
        description: t('vouchers.voucherCreatedDesc'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: getErrorMessage(error, t),
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
          title: t('common.error'),
          description: t('vouchers.voucherAlreadyUsed'),
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
        title: t('common.error'),
        description: getErrorMessage(error, t),
        variant: "destructive",
      });
    },
  });

  const activateVoucherMutation = useMutation({
    mutationFn: async (data: { code: string; securityValue?: string }) => {
      const response = await apiRequest("POST", "/api/vouchers/activate", data);
      return await response.json() as { message: string; amount: number; currency: string; newBalance: string };
    },
    onSuccess: async (data) => {
      // Refetch all related queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['/api/vouchers/my?status=active'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/vouchers/my?status=activated'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/user/balances'] })
      ]);
      
      toast({
        title: t('vouchers.voucherActivated'),
        description: t('vouchers.voucherActivatedDesc', { amount: data.amount, currency: data.currency }),
      });
      
      setIsSecurityDialogOpen(false);
      handleActivateDialogChange(false);
      resetActivationForm();
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: getErrorMessage(error, t),
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
        title: t('common.error'),
        description: t('vouchers.selectBalance'),
        variant: "destructive",
      });
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: t('common.error'),
        description: t('exchange.enterValidAmount'),
        variant: "destructive",
      });
      return;
    }

    if (securityType !== 'none' && !securityValue) {
      toast({
        title: t('common.error'),
        description: securityType === 'pin' ? t('vouchers.enterPinCode') : t('vouchers.enterSecurityWord'),
        variant: "destructive",
      });
      return;
    }

    if (securityType === 'pin' && !/^\d{4,6}$/.test(securityValue)) {
      toast({
        title: t('common.error'),
        description: t('vouchers.enterPinCode'),
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
        title: t('common.error'),
        description: t('vouchers.enterVoucherCode'),
        variant: "destructive",
      });
      return;
    }

    if (!voucherCode.startsWith('V') || !voucherCode.endsWith('D')) {
      toast({
        title: t('common.error'),
        description: t('vouchers.errors.invalidCode'),
        variant: "destructive",
      });
      return;
    }

    checkVoucherMutation.mutate(voucherCode);
  };

  const handleActivateWithSecurity = () => {
    if (!activationSecurityValue) {
      toast({
        title: t('common.error'),
        description: voucherInfo?.securityType === 'pin' ? t('vouchers.enterPinToActivate') : t('vouchers.enterWordToActivate'),
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
      title: t('common.copied'),
      description: t('vouchers.codeCopied'),
    });
  };

  const getSecurityLabel = (type: string) => {
    switch (type) {
      case 'pin':
        return t('vouchers.securityPin');
      case 'word':
        return t('vouchers.securityWord');
      default:
        return t('vouchers.securityNone');
    }
  };

  const renderVoucherCard = (voucher: Voucher) => {
    const isActive = voucher.status === 'active';
    
    return (
      <div key={voucher.id} className="bg-[#13151A] border border-white/5 rounded-3xl p-5 space-y-4" data-testid={`voucher-card-${voucher.id}`}>
        {/* Top row: status badge + amount */}
        <div className="flex items-center justify-between">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-bold ${
            isActive
              ? 'bg-[#3ab368]/10 border-[#3ab368]/20 text-[#3ab368]'
              : 'bg-white/5 border-white/10 text-white/40'
          }`}>
            <Ticket className="w-3 h-3" />
            {isActive ? t('vouchers.active') : t('vouchers.activated')}
          </span>
          <span className="text-xl font-bold text-white" data-testid={`voucher-amount-${voucher.id}`}>
            {parseFloat(voucher.amount).toFixed(2)} <span className="text-white/50 text-sm">{voucher.currency}</span>
          </span>
        </div>

        {/* Code row */}
        <div className="flex items-center gap-3 bg-[#1A1D24] border border-white/5 rounded-2xl px-4 py-3">
          <span className="flex-1 font-mono text-sm font-semibold text-white/80 tracking-wider" data-testid={`voucher-code-${voucher.id}`}>
            {voucher.code}
          </span>
          <button
            onClick={() => handleCopyCode(voucher.code)}
            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
            data-testid={`button-copy-${voucher.id}`}
          >
            <Copy className="w-4 h-4 text-white/40" />
          </button>
        </div>

        {/* Meta row: security + date */}
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-white/35 uppercase tracking-wider font-bold">{getSecurityLabel(voucher.securityType)}</span>
          <span className="text-white/30">
            {format(new Date(voucher.createdAt), "dd MMM yyyy, HH:mm", { locale: i18n.language === 'ru' ? ru : enUS })}
          </span>
        </div>
        {voucher.activatedAt && (
          <div className="text-[11px] text-white/25">
            {t('vouchers.activated')}: {format(new Date(voucher.activatedAt), "dd MMM yyyy, HH:mm", { locale: i18n.language === 'ru' ? ru : enUS })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0B0C10] text-[#E2E8F0] pb-28 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-6 pb-4">
        <Link href="/home">
          <button className="w-10 h-10 rounded-full bg-white/5 border border-white/5 flex items-center justify-center hover:bg-white/10 transition-colors" data-testid="button-close">
            <ChevronLeft className="w-5 h-5 text-white/70" />
          </button>
        </Link>
        <h1 className="text-[17px] font-semibold tracking-tight text-white" data-testid="text-vouchers-title">
          {t('vouchers.title')}
        </h1>
        <div className="w-10 h-10" />
      </div>

      <div className="px-5 space-y-4">
        {/* Voucher Animation */}
        <div className="flex justify-center -mt-4 mb-2">
          <Lottie 
            animationData={voucherAnimation} 
            loop={true}
            className="w-64 h-64"
          />
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 px-0">
          <button
            onClick={() => setIsCreateDialogOpen(true)}
            className="flex items-center justify-center gap-2 bg-[#3ab368] hover:bg-[#3ab368]/90 text-[#0B0C10] font-bold py-4 rounded-2xl transition-all shadow-lg shadow-[#3ab368]/20 active:scale-[0.98]"
            data-testid="button-create-voucher"
          >
            <Plus className="w-5 h-5" />
            {t('vouchers.create')}
          </button>
          <button
            onClick={() => handleActivateDialogChange(true)}
            className="flex items-center justify-center gap-2 bg-[#13151A] border border-white/10 hover:border-white/20 text-white font-bold py-4 rounded-2xl transition-all active:scale-[0.98]"
            data-testid="button-activate-voucher"
          >
            <CheckCircle2 className="w-5 h-5 text-[#3ab368]" />
            {t('vouchers.activate')}
          </button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-4">
          <TabsList className="grid w-full grid-cols-2 bg-[#13151A] border border-white/5 rounded-2xl p-1 h-auto">
            <TabsTrigger 
              value="active" 
              className="rounded-xl py-2.5 text-sm font-semibold text-white/40 data-[state=active]:bg-[#1A1D24] data-[state=active]:text-white data-[state=active]:border data-[state=active]:border-white/10 transition-all"
              data-testid="tab-active-vouchers"
            >
              {t('vouchers.tabs.active')}
            </TabsTrigger>
            <TabsTrigger 
              value="completed" 
              className="rounded-xl py-2.5 text-sm font-semibold text-white/40 data-[state=active]:bg-[#1A1D24] data-[state=active]:text-white data-[state=active]:border data-[state=active]:border-white/10 transition-all"
              data-testid="tab-completed-vouchers"
            >
              {t('vouchers.tabs.history')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4 mt-6">
            {activeLoading ? (
              <div className="text-center py-8 text-white/40">{t('common.loading')}</div>
            ) : activeVouchers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                  <Ticket className="w-8 h-8 text-white/10" />
                </div>
                <p className="text-white/40 font-medium">{t('vouchers.noActiveVouchers')}</p>
              </div>
            ) : (
              activeVouchers.map(renderVoucherCard)
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4 mt-6">
            {activatedLoading ? (
              <div className="text-center py-8 text-white/40">{t('common.loading')}</div>
            ) : activatedVouchers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                  <Ticket className="w-8 h-8 text-white/10" />
                </div>
                <p className="text-white/40 font-medium">{t('vouchers.noActivatedVouchers')}</p>
              </div>
            ) : (
              activatedVouchers.map(renderVoucherCard)
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Create Voucher Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="bg-[#13151A] text-white border border-white/10 rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl">{t('vouchers.createTitle')}</DialogTitle>
            <DialogDescription className="text-white/40">
              {t('vouchers.selectBalance')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Balance Selection */}
            <div className="space-y-2">
              <label htmlFor="balance" className="text-[11px] font-bold uppercase tracking-wider text-white/40">{t('vouchers.selectCurrency')}</label>
              {availableBalances.length === 0 ? (
                <div className="bg-[#1A1D24] border border-white/5 rounded-2xl p-4 text-center">
                  <p className="text-sm text-white/60">{t('vouchers.errors.insufficientBalance')}</p>
                </div>
              ) : (
                <Select value={selectedBalance} onValueChange={setSelectedBalance}>
                  <SelectTrigger className="bg-[#1A1D24] border-white/10 text-white rounded-2xl" data-testid="select-balance">
                    <SelectValue placeholder={t('vouchers.selectCurrency')} />
                  </SelectTrigger>
                  <SelectContent className="bg-[#13151A] border-white/10 text-white rounded-2xl">
                    {availableBalances.map((balance) => (
                      <SelectItem key={balance.balanceId} value={balance.balanceId.toString()} className="focus:bg-white/10">
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
                  <label htmlFor="amount" className="text-[11px] font-bold uppercase tracking-wider text-white/40">{t('vouchers.amount')}</label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="bg-[#1A1D24] border border-white/5 text-white placeholder:text-white/25 rounded-2xl focus:border-white/15"
                    data-testid="input-amount"
                  />
                </div>

                {/* Security Type */}
                <div className="space-y-2 mt-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-white/40">{t('vouchers.securityType')}</label>
                  <RadioGroup value={securityType} onValueChange={(value: any) => {
                    setSecurityType(value);
                    setSecurityValue("");
                  }}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="none" id="none" className="border-white/20 text-[#3ab368]" data-testid="radio-security-none" />
                      <label htmlFor="none" className="cursor-pointer text-white/70 text-sm">{t('vouchers.securityNone')}</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="pin" id="pin" className="border-white/20 text-[#3ab368]" data-testid="radio-security-pin" />
                      <label htmlFor="pin" className="cursor-pointer text-white/70 text-sm">{t('vouchers.securityPin')} (4-6)</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="word" id="word" className="border-white/20 text-[#3ab368]" data-testid="radio-security-word" />
                      <label htmlFor="word" className="cursor-pointer text-white/70 text-sm">{t('vouchers.securityWord')}</label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Security Value Input */}
                {securityType !== 'none' && (
                  <div className="space-y-2">
                    <label htmlFor="security" className="text-[11px] font-bold uppercase tracking-wider text-white/40">
                      {securityType === 'pin' ? t('vouchers.securityPin') : t('vouchers.securityWord')}
                    </label>
                    <Input
                      id="security"
                      type={securityType === 'pin' ? 'number' : 'text'}
                      value={securityValue}
                      onChange={(e) => setSecurityValue(e.target.value)}
                      placeholder={securityType === 'pin' ? '1234' : t('vouchers.enterPassword')}
                      maxLength={securityType === 'pin' ? 6 : undefined}
                      className="bg-[#1A1D24] border border-white/5 text-white placeholder:text-white/25 rounded-2xl focus:border-white/15"
                      data-testid="input-security-value"
                    />
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                setIsCreateDialogOpen(false);
                resetCreateForm();
              }}
              className="flex-1 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-2xl py-3"
              data-testid="button-cancel-create"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleCreateVoucher}
              disabled={createVoucherMutation.isPending || availableBalances.length === 0}
              className="flex-1 bg-[#3ab368] hover:bg-[#3ab368]/90 text-[#0B0C10] font-bold rounded-2xl py-3 shadow-lg shadow-[#3ab368]/20 disabled:opacity-40"
              data-testid="button-confirm-create"
            >
              {createVoucherMutation.isPending ? t('vouchers.creating') : t('vouchers.createVoucher')}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Activate Voucher Dialog */}
      <Dialog open={isActivateDialogOpen} onOpenChange={handleActivateDialogChange}>
        <DialogContent className="bg-[#13151A] text-white border border-white/10 rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl">{t('vouchers.activateVoucher')}</DialogTitle>
            <DialogDescription className="text-white/40">
              {t('vouchers.enterVoucherCode')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="code" className="text-[11px] font-bold uppercase tracking-wider text-white/40">{t('vouchers.voucherCode')}</label>
              <div className="flex gap-2 items-center">
                <Input
                  id="code"
                  type="text"
                  value={formatCodeDisplay(voucherCode)}
                  onChange={(e) => handleCodeChange(e.target.value.replace(/-/g, ''))}
                  placeholder="V-0000-00000-0000-D"
                  className="bg-[#1A1D24] border border-white/5 text-white text-center text-lg font-mono font-semibold tracking-wider flex-1 rounded-2xl focus:border-white/15"
                  maxLength={19} // 15 chars + 4 dashes
                  data-testid="input-voucher-code"
                />
                <QRScannerButton 
                  onClick={() => setIsScannerOpen(true)}
                  className="border-white/10 bg-[#1A1D24] hover:bg-white/10 text-white shrink-0 rounded-2xl"
                />
              </div>
              <p className="text-[11px] text-white/40 text-center font-bold tracking-wider uppercase">
                {t('vouchers.entered')}: {voucherCode.length}/15
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                handleActivateDialogChange(false);
                resetActivationForm();
              }}
              className="flex-1 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-2xl py-3"
              data-testid="button-cancel-activate"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleCheckVoucher}
              disabled={checkVoucherMutation.isPending || voucherCode.length !== 15}
              className="flex-1 bg-[#3ab368] hover:bg-[#3ab368]/90 text-[#0B0C10] font-bold rounded-2xl py-3 shadow-lg shadow-[#3ab368]/20 disabled:opacity-40"
              data-testid="button-check-voucher"
            >
              {checkVoucherMutation.isPending ? t('vouchers.checking') : t('vouchers.activate')}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Security Dialog for Activation */}
      <Dialog open={isSecurityDialogOpen} onOpenChange={setIsSecurityDialogOpen}>
        <DialogContent className="bg-[#13151A] text-white border border-white/10 rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Lock className="w-5 h-5" />
              {t('vouchers.protectedVoucher')}
            </DialogTitle>
            <DialogDescription className="text-white/40">
              {t('vouchers.enterSecurityCode', { type: voucherInfo?.securityType === 'word' ? t('vouchers.securityWord').toLowerCase() : t('vouchers.securityPin') })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="text-center space-y-2">
              <p className="text-white/60">
                {t('vouchers.voucherProtectedBy', { type: voucherInfo?.securityType === 'pin' ? t('vouchers.securityPin') : t('vouchers.securityWord').toLowerCase() })}
              </p>
              <p className="text-2xl font-bold text-[#3ab368]">
                {voucherInfo?.amount} {voucherInfo?.currency}
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="security" className="text-[11px] font-bold uppercase tracking-wider text-white/40">
                {voucherInfo?.securityType === 'pin' ? t('vouchers.securityPin') : t('vouchers.securityWord')}
              </label>
              
              {voucherInfo?.securityType === 'pin' ? (
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={activationSecurityValue}
                    onChange={setActivationSecurityValue}
                    data-testid="input-pin-code"
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} className="bg-[#1A1D24] border-white/10 text-white" />
                      <InputOTPSlot index={1} className="bg-[#1A1D24] border-white/10 text-white" />
                      <InputOTPSlot index={2} className="bg-[#1A1D24] border-white/10 text-white" />
                      <InputOTPSlot index={3} className="bg-[#1A1D24] border-white/10 text-white" />
                      <InputOTPSlot index={4} className="bg-[#1A1D24] border-white/10 text-white" />
                      <InputOTPSlot index={5} className="bg-[#1A1D24] border-white/10 text-white" />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              ) : (
                <Input
                  id="security"
                  type="password"
                  value={activationSecurityValue}
                  onChange={(e) => setActivationSecurityValue(e.target.value)}
                  placeholder={t('vouchers.enterPassword')}
                  className="bg-[#1A1D24] border border-white/5 text-white placeholder:text-white/25 rounded-2xl focus:border-white/15"
                  data-testid="input-password"
                />
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                setIsSecurityDialogOpen(false);
                setActivationSecurityValue("");
              }}
              className="flex-1 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-2xl py-3"
              data-testid="button-cancel-security"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleActivateWithSecurity}
              disabled={activateVoucherMutation.isPending}
              className="flex-1 bg-[#3ab368] hover:bg-[#3ab368]/90 text-[#0B0C10] font-bold rounded-2xl py-3 shadow-lg shadow-[#3ab368]/20 disabled:opacity-40"
              data-testid="button-confirm-activate"
            >
              {activateVoucherMutation.isPending ? t('vouchers.activating') : t('vouchers.activate')}
            </button>
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
            title: t('vouchers.qrScanned'),
            description: t('vouchers.qrScannedSuccess'),
          });
        }}
        title={t('vouchers.scanVoucher')}
        validate={(data) => {
          // Validate voucher format: V + 13 digits + D (total 15 characters)
          const voucherRegex = /^V\d{13}D$/;
          return voucherRegex.test(data);
        }}
        errorMessage={t('vouchers.errors.invalidFormat')}
      />
    </div>
  );
}
