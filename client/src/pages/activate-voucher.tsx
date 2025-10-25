import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { X, CheckCircle2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

interface VoucherCheckResponse {
  id: number;
  amount: string;
  currency: string;
  status: string;
  securityType: 'none' | 'word' | 'pin';
  requiresSecurity: boolean;
  createdAt: string;
}

export default function ActivateVoucherPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherInfo, setVoucherInfo] = useState<VoucherCheckResponse | null>(null);
  const [isSecurityDialogOpen, setIsSecurityDialogOpen] = useState(false);
  const [securityValue, setSecurityValue] = useState("");

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
        description: error.message || "Ваучер не найден",
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
      setVoucherCode("");
      setVoucherInfo(null);
      setSecurityValue("");
      
      // Redirect to vouchers page after 1.5 seconds
      setTimeout(() => {
        setLocation("/vouchers");
      }, 1500);
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось активировать ваучер",
        variant: "destructive",
      });
    },
  });

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
    if (!securityValue) {
      toast({
        title: "Ошибка",
        description: voucherInfo?.securityType === 'pin' ? "Введите PIN-код" : "Введите пароль",
        variant: "destructive",
      });
      return;
    }

    activateVoucherMutation.mutate({
      code: voucherCode,
      securityValue,
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

  return (
    <div className="mobile-screen gradient-bg text-white pb-24">
      {/* Header */}
      <div className="flex items-center justify-between p-6">
        <h1 className="text-xl font-semibold" data-testid="text-activate-title">
          Активировать ваучер
        </h1>
        <Link href="/vouchers">
          <button 
            className="w-8 h-8 rounded-full bg-black/20 flex items-center justify-center"
            data-testid="button-close"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </Link>
      </div>

      <div className="px-6 space-y-6">
        {/* Success Icon */}
        <div className="flex justify-center py-8">
          <div className="w-24 h-24 rounded-full bg-accent/20 flex items-center justify-center">
            <CheckCircle2 className="w-12 h-12 text-accent" />
          </div>
        </div>

        {/* Info */}
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">Введите код ваучера</h2>
          <p className="text-green-200">
            Код состоит из 15 символов (V + 13 цифр + D)
          </p>
        </div>

        {/* Voucher Code Input */}
        <div className="space-y-4 bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-green-500/30">
          <div className="space-y-2">
            <Label htmlFor="code" className="text-green-200">Код ваучера</Label>
            <Input
              id="code"
              type="text"
              value={formatCodeDisplay(voucherCode)}
              onChange={(e) => handleCodeChange(e.target.value.replace(/-/g, ''))}
              placeholder="V-0000-00000-0000-D"
              className="bg-white/90 text-secondary text-center text-lg font-mono font-semibold tracking-wider"
              maxLength={19} // 15 chars + 4 dashes
              data-testid="input-voucher-code"
            />
            <p className="text-xs text-green-200 text-center">
              Введено: {voucherCode.length}/15
            </p>
          </div>

          <Button
            onClick={handleCheckVoucher}
            disabled={checkVoucherMutation.isPending || voucherCode.length !== 15}
            className="w-full bg-accent hover:bg-accent/90 text-secondary font-semibold py-6 rounded-xl"
            data-testid="button-check-voucher"
          >
            {checkVoucherMutation.isPending ? "Проверка..." : "Активировать"}
          </Button>
        </div>

        {/* Quick tip */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
          <p className="text-sm text-blue-200 text-center">
            💡 Вы можете скопировать код ваучера из чата или сообщения
          </p>
        </div>
      </div>

      {/* Security Dialog */}
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
                    value={securityValue}
                    onChange={setSecurityValue}
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
                  value={securityValue}
                  onChange={(e) => setSecurityValue(e.target.value)}
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
                setSecurityValue("");
              }}
              className="flex-1 border-green-500/30 text-white hover:bg-white/10"
              data-testid="button-cancel-activate"
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
    </div>
  );
}
