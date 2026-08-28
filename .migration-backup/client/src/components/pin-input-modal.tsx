import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

interface PinInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  mode: "set" | "change";
}

export default function PinInputModal({ isOpen, onClose, onSuccess, mode }: PinInputModalProps) {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [step, setStep] = useState<"enter" | "confirm">("enter");
  const { toast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    if (isOpen) {
      setPin("");
      setConfirmPin("");
      setStep("enter");
    }
  }, [isOpen]);

  const setPinMutation = useMutation({
    mutationFn: async (pinCode: string) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({ success: true });
        }, 500);
      });
    },
    onSuccess: () => {
      toast({
        title: t('security.featureInDevelopment'),
        description: t('security.pinCodeAvailableSoon'),
      });
      onSuccess();
    },
    onError: () => {
      toast({
        title: t('security.error'),
        description: t('security.failedToSavePin'),
        variant: "destructive",
      });
    },
  });

  const handleNumberClick = (num: string) => {
    if (step === "enter") {
      if (pin.length < 4) {
        const newPin = pin + num;
        setPin(newPin);
        if (newPin.length === 4) {
          setTimeout(() => {
            setStep("confirm");
          }, 300);
        }
      }
    } else {
      if (confirmPin.length < 4) {
        const newConfirmPin = confirmPin + num;
        setConfirmPin(newConfirmPin);
        if (newConfirmPin.length === 4) {
          setTimeout(() => {
            if (pin === newConfirmPin) {
              setPinMutation.mutate(newConfirmPin);
            } else {
              toast({
                title: t('security.error'),
                description: t('security.codesDoNotMatch'),
                variant: "destructive",
              });
              setPin("");
              setConfirmPin("");
              setStep("enter");
            }
          }, 300);
        }
      }
    }
  };

  const handleDelete = () => {
    if (step === "enter") {
      setPin(pin.slice(0, -1));
    } else {
      setConfirmPin(confirmPin.slice(0, -1));
    }
  };

  if (!isOpen) return null;

  const currentPin = step === "enter" ? pin : confirmPin;

  return (
    <div className="fixed inset-0 z-50 bg-gradient-primary flex flex-col">
      <div className="flex justify-end p-6">
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
          data-testid="button-close-pin-modal"
        >
          <X className="w-6 h-6 text-white" />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
        <h1 className="text-2xl font-bold text-white mb-2 text-center" data-testid="text-pin-title">
          {step === "enter" 
            ? (mode === "set" ? t('security.setPinCode') : t('security.enterNewCode')) 
            : t('security.repeatPinCode')}
        </h1>
        
        <p className="text-green-200 text-sm mb-12 text-center" data-testid="text-pin-subtitle">
          {step === "enter" 
            ? t('security.enter4DigitCode') 
            : t('security.confirmYourCode')}
        </p>

        <div className="flex gap-4 mb-16" data-testid="pin-dots-container">
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
              className={`w-4 h-4 rounded-full transition-all duration-200 ${
                currentPin.length > index
                  ? "bg-accent scale-110"
                  : "bg-white/30"
              }`}
              data-testid={`pin-dot-${index}`}
            />
          ))}
        </div>

        <div className="w-full max-w-xs space-y-4">
          {[[1, 2, 3], [4, 5, 6], [7, 8, 9]].map((row, rowIndex) => (
            <div key={rowIndex} className="flex gap-4 justify-center">
              {row.map((num) => (
                <button
                  key={num}
                  onClick={() => handleNumberClick(num.toString())}
                  className="w-20 h-20 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 flex items-center justify-center text-2xl font-semibold text-white transition-all"
                  data-testid={`button-pin-${num}`}
                >
                  {num}
                </button>
              ))}
            </div>
          ))}
          
          <div className="flex gap-4 justify-center">
            <div className="w-20 h-20 flex items-center justify-center">
              {currentPin.length > 0 && (
                <button
                  onClick={handleDelete}
                  className="text-sm text-green-200 hover:text-white transition-colors font-medium"
                  data-testid="button-pin-delete"
                >
                  {t('security.delete')}
                </button>
              )}
            </div>
            <button
              onClick={() => handleNumberClick("0")}
              className="w-20 h-20 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 flex items-center justify-center text-2xl font-semibold text-white transition-all"
              data-testid="button-pin-0"
            >
              0
            </button>
            <div className="w-20 h-20" />
          </div>
        </div>
      </div>
    </div>
  );
}
