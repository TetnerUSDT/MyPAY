import { Link } from "wouter";

export default function TopUpSuccessScreen() {
  return (
    <div className="mobile-screen text-white">
      <div className="flex flex-col items-center justify-center min-h-screen text-center px-6">
        <h1 className="text-2xl font-bold mb-16" data-testid="text-title">
          Ожидайте зачисления
        </h1>
        
        {/* Success Icon - Green checkmark in circle */}
        <div className="w-32 h-32 mb-16 flex items-center justify-center">
          <svg 
            width="116" 
            height="116" 
            viewBox="0 0 116 116" 
            fill="none" 
            className="animate-pulse-green"
            data-testid="icon-success"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              height="116" 
              width="116" 
              viewBox="0 0 24 24" 
              fill="#a5fe7c"
            >
              <path fill="none" d="M0 0h24v24H0z"/>
              <path d="M22 5.18 10.59 16.6l-4.24-4.24 1.41-1.41 2.83 2.83 10-10zm-2.21 5.04c.13.57.21 1.17.21 1.78 0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8c1.58 0 3.04.46 4.28 1.25l1.44-1.44A9.9 9.9 0 0 0 12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10c0-1.19-.22-2.33-.6-3.39z"/>
            </svg>
          </svg>
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