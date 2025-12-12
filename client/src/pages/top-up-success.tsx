import { Link } from "wouter";
import { CheckCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function TopUpSuccessScreen() {
  const { t } = useTranslation();
  
  return (
    <div className="mobile-screen text-white">
      <div className="flex flex-col items-center justify-center min-h-screen text-center px-6">
        <h1 className="text-2xl font-bold mb-16" data-testid="text-title">
          {t('topUpSuccess.title')}
        </h1>
        
        {/* Success Animation */}
        <div className="w-32 h-32 mb-16 flex items-center justify-center">
          <CheckCircle 
            className="w-24 h-24 text-accent" 
            data-testid="animation-success"
          />
        </div>
        
        <p className="text-lg mb-2 px-4">
          {t('topUpSuccess.message1')}
        </p>
        <p className="text-lg mb-16 px-4">
          {t('topUpSuccess.message2')}
        </p>
        
        <div className="w-full max-w-sm">
          <Link href="/home" className="w-full">
            <button 
              className="action-button"
              data-testid="button-back-home"
            >
              {t('topUpSuccess.backToHome')}
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}