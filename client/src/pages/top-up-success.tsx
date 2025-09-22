import { Link } from "wouter";
import { LottieAnimation } from "@/components";
import paymentSuccessAnimation from "@/assets/payment-success.json";

export default function TopUpSuccessScreen() {
  return (
    <div className="mobile-screen text-white">
      <div className="flex flex-col items-center justify-center min-h-screen text-center px-6">
        <h1 className="text-2xl font-bold mb-16" data-testid="text-title">
          Ожидайте зачисления
        </h1>
        
        {/* Success Animation */}
        <div className="w-32 h-32 mb-16 flex items-center justify-center">
          <LottieAnimation
            animationData={paymentSuccessAnimation}
            width={116}
            height={116}
            loop={false}
            autoplay={true}
            data-testid="animation-success"
          />
        </div>
        
        <p className="text-lg mb-2 px-4">
          Мы получили уведомление, как только мы 
        </p>
        <p className="text-lg mb-16 px-4">
          получим подтверждения сети, ваш баланс будет пополнен автоматически.
        </p>
        
        <div className="w-full max-w-sm">
          <Link href="/home" className="w-full">
            <button 
              className="action-button"
              data-testid="button-back-home"
            >
              Вернуться на главную
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}