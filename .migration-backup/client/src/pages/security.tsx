import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ChevronLeft, Lock, CheckCircle2, ShieldCheck } from "lucide-react";
import PinInputModal from "@/components/pin-input-modal";
import { useTranslation } from "react-i18next";

interface User {
  id: number;
  name: string;
}

export default function SecurityScreen() {
  const { t } = useTranslation();
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);

  const { data: user } = useQuery<User>({
    queryKey: ['/api/auth/me']
  });

  const hasPinCode = false;

  const handleSetPinClick = () => {
    setIsPinModalOpen(true);
  };

  const handlePinSuccess = () => {
    setIsPinModalOpen(false);
  };

  return (
    <>
      <div className="min-h-screen bg-[#0B0C10] text-[#E2E8F0] pb-28 font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-6 pb-4">
          <Link href="/settings">
            <button
              className="w-10 h-10 rounded-full bg-white/5 border border-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
              data-testid="button-back"
            >
              <ChevronLeft className="w-5 h-5 text-white/70" />
            </button>
          </Link>
          <h1 className="text-[17px] font-semibold tracking-tight text-white" data-testid="text-page-title">
            {t('security.title')}
          </h1>
          <div className="w-10 h-10" />
        </div>

        <div className="px-5 space-y-3">
          {/* Section label */}
          <p className="text-[11px] font-bold uppercase tracking-wider text-white/40 px-1">
            {t('security.pinCodeDesc')}
          </p>

          {/* PIN Code card */}
          <div className="bg-[#13151A] border border-white/5 rounded-3xl p-5">
            <div className="flex items-center gap-4">
              {/* Icon */}
              <div className="w-11 h-11 rounded-2xl bg-[#1A1D24] border border-white/5 flex items-center justify-center shrink-0">
                {hasPinCode
                  ? <ShieldCheck className="w-5 h-5 text-[#3ab368]" />
                  : <Lock className="w-5 h-5 text-white/40" />
                }
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold text-white leading-tight">
                  {t('security.pinCode')}
                </p>
                <p className="text-[12px] text-white/40 mt-0.5 leading-snug">
                  {hasPinCode
                    ? t('security.pinCodeSet')
                    : t('security.pinCodeNotSet')}
                </p>
              </div>

              {/* Action */}
              <div className="flex items-center gap-2 shrink-0">
                {hasPinCode && (
                  <CheckCircle2 className="w-4 h-4 text-[#3ab368]" data-testid="icon-pin-set" />
                )}
                <button
                  onClick={handleSetPinClick}
                  className={`px-4 py-2 rounded-xl text-[13px] font-bold transition-all active:scale-[0.97] ${
                    hasPinCode
                      ? "bg-white/5 border border-white/10 hover:bg-white/10 text-white/70"
                      : "bg-[#3ab368] hover:bg-[#3ab368]/90 text-[#0B0C10] shadow-lg shadow-[#3ab368]/20"
                  }`}
                  data-testid="button-set-pin"
                >
                  {hasPinCode ? t('security.change') : t('security.set')}
                </button>
              </div>
            </div>
          </div>

          {/* Footer note */}
          <p className="text-[12px] text-white/25 px-1 pt-1 leading-relaxed">
            {t('security.moreMethodsSoon')}
          </p>
        </div>
      </div>

      <PinInputModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        onSuccess={handlePinSuccess}
        mode={hasPinCode ? "change" : "set"}
      />
    </>
  );
}
