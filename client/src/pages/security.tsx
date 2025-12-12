import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, Lock, CheckCircle2 } from "lucide-react";
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
      <div className="mobile-screen gradient-bg text-white min-h-screen">
        <div className="px-4 pt-8 pb-8 space-y-6">
          <div className="flex items-center gap-4 mb-6">
            <Link href="/settings">
              <button 
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                data-testid="button-back"
              >
                <ArrowLeft className="w-5 h-5 text-white" />
              </button>
            </Link>
            <h1 className="text-2xl font-bold text-white" data-testid="text-page-title">
              {t('security.title')}
            </h1>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-green-200 px-2">
              {t('security.pinCodeDesc')}
            </h2>

            <div className="crypto-card">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center shrink-0">
                    <Lock className="w-6 h-6 text-accent" />
                  </div>
                  <div className="flex-1 flex flex-col gap-1">
                    <h3 className="text-white font-semibold text-left">{t('security.pinCode')}</h3>
                    <p className="text-green-200 text-sm text-left">
                      {hasPinCode 
                        ? t('security.pinCodeSet')
                        : t('security.pinCodeNotSet')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  {hasPinCode && (
                    <CheckCircle2 className="w-5 h-5 text-accent" data-testid="icon-pin-set" />
                  )}
                  <button
                    onClick={handleSetPinClick}
                    className="px-4 py-2 bg-accent hover:bg-accent/90 text-primary-foreground rounded-lg font-medium transition-colors"
                    data-testid="button-set-pin"
                  >
                    {hasPinCode ? t('security.change') : t('security.set')}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 px-2">
              <p className="text-sm text-green-200/70">
                {t('security.moreMethodsSoon')}
              </p>
            </div>
          </div>
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
