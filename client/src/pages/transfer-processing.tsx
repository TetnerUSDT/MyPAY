import { Link } from "wouter";

export default function TransferProcessingScreen() {
  return (
    <div className="mobile-screen text-white">
      <div className="flex flex-col items-center justify-center min-h-screen text-center px-6">
        <h1 className="text-2xl font-bold mb-16" data-testid="text-title">
          Выполнение платежа
        </h1>
        
        {/* Processing Icon - Hourglass */}
        <div className="w-32 h-32 mb-16 flex items-center justify-center">
          <svg 
            width="116" 
            height="116" 
            viewBox="0 0 116 116" 
            fill="none" 
            className="animate-pulse-green"
            data-testid="icon-processing"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              height="116" 
              width="116" 
              viewBox="0 0 24 24" 
              fill="#a5fe7c"
            >
              <path fill="none" d="M0 0h24v24H0z"/>
              <path d="m18 22-.01-6L14 12l3.99-4.01L18 2H6v6l4 4-4 3.99V22zM8 7.5V4h8v3.5l-4 4z"/>
            </svg>
          </svg>
        </div>
        
        <p className="text-lg mb-16 px-4">
          Ваш перевод в очереди на выполнение
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