import { Link, useLocation } from "wouter";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function TransferProcessingScreen() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();

  useEffect(() => {
    // After 3 seconds, navigate to final success state
    const timeout = setTimeout(() => {
      setLocation("/transfer-success");
    }, 3000);

    // Clean up the timeout if component unmounts
    return () => clearTimeout(timeout);
  }, [setLocation]);

  return (
    <div className="mobile-screen text-white">
      <div className="flex flex-col items-center justify-center min-h-screen text-center px-6">
        <h1 className="text-2xl font-bold mb-16" data-testid="text-title">
          {t('transfer.processing')}
        </h1>
        
        {/* Processing Animation */}
        <div className="w-32 h-32 mb-16 flex items-center justify-center">
          <Loader2 
            className="w-24 h-24 animate-spin text-accent" 
            data-testid="animation-processing"
          />
        </div>
        
        <p className="text-lg mb-16 px-4">
          {t('transfer.inQueue')}
        </p>
        
        <div className="w-full max-w-sm">
          <Link href="/home" className="w-full">
            <button 
              className="action-button"
              data-testid="button-back-home"
            >
              {t('common.backToHome')}
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
