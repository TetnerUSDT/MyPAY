import { Link } from "wouter";
import { Check } from "lucide-react";

export default function SuccessScreen() {
  return (
    <div className="mobile-screen text-white">
      <div className="flex flex-col items-center justify-center min-h-screen text-center px-6">
        <h1 className="text-2xl font-bold mb-8" data-testid="text-title">
          Выполнена успешно
        </h1>
        
        {/* Success Icon */}
        <div className="w-24 h-24 bg-accent rounded-full flex items-center justify-center mb-8 animate-pulse-green">
          <Check className="w-12 h-12 text-accent-foreground" />
        </div>
        
        <p className="text-lg mb-4">Средства были отправлены на вашу карту,</p>
        <p className="text-lg mb-8">обмен завершен с двух сторон!</p>
        
        <div className="w-full max-w-sm mb-8">
          <Link href="/support">
            <p className="text-sm text-yellow-400 text-center cursor-pointer hover:underline">
              Что делать если вы не получили средства?
            </p>
          </Link>
        </div>
        
        <Link href="/" className="w-full max-w-sm">
          <button 
            className="action-button"
            data-testid="button-back-home"
          >
            Вернуться на главную
          </button>
        </Link>
      </div>
    </div>
  );
}
