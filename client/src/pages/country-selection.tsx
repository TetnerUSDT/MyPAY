import { Link } from "wouter";
import { ArrowLeft, X, Zap, Percent, CreditCard } from "lucide-react";

export default function CountrySelectionScreen() {
  return (
    <div className="mobile-screen text-white">
      {/* Header */}
      <div className="mobile-header">
        <div className="w-8 h-1 bg-white rounded-full"></div>
        <Link href="/">
          <button 
            className="w-8 h-8 rounded-full bg-black/20 flex items-center justify-center"
            data-testid="button-close"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </Link>
      </div>
      
      {/* Content */}
      <div className="mobile-content">
        <h1 className="text-2xl font-bold text-center mb-12" data-testid="text-title">
          Выберите страну
        </h1>
        
        <div className="space-y-4">
          {/* Russia Option */}
          <Link href="/exchange">
            <div 
              className="crypto-card cursor-pointer hover:opacity-90 transition-all"
              data-testid="card-country-russia"
            >
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center mr-4">
                  <svg className="w-6 h-6 text-yellow-800" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm3 2h6v4H7V6zm8 8v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2h10z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Россия (RU)</h3>
                  <p className="text-muted-foreground text-sm">Любой банк в России</p>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="flex items-center">
                  <Zap className="w-4 h-4 text-yellow-400 mr-2" />
                  <div>
                    <div className="text-yellow-400">Время</div>
                    <div>15 минут</div>
                  </div>
                </div>
                <div className="flex items-center">
                  <Percent className="w-4 h-4 text-green-400 mr-2" />
                  <div>
                    <div className="text-green-400">Fee</div>
                    <div>1-2%</div>
                  </div>
                </div>
                <div className="flex items-center">
                  <CreditCard className="w-4 h-4 text-blue-400 mr-2" />
                  <div>
                    <div className="text-blue-400">Method</div>
                    <div>Card</div>
                  </div>
                </div>
              </div>
            </div>
          </Link>
          
          {/* Turkey Option */}
          <Link href="/exchange">
            <div 
              className="crypto-card cursor-pointer hover:opacity-90 transition-all"
              data-testid="card-country-turkey"
            >
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center mr-4">
                  <svg className="w-6 h-6 text-yellow-800" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm3 2h6v4H7V6zm8 8v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2h10z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Турция (TR)</h3>
                  <p className="text-muted-foreground text-sm">Любой банк в Турции</p>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="flex items-center">
                  <Zap className="w-4 h-4 text-yellow-400 mr-2" />
                  <div>
                    <div className="text-yellow-400">Время</div>
                    <div>15 минут</div>
                  </div>
                </div>
                <div className="flex items-center">
                  <Percent className="w-4 h-4 text-green-400 mr-2" />
                  <div>
                    <div className="text-green-400">Fee</div>
                    <div>3-6%</div>
                  </div>
                </div>
                <div className="flex items-center">
                  <CreditCard className="w-4 h-4 text-blue-400 mr-2" />
                  <div>
                    <div className="text-blue-400">Method</div>
                    <div>Card</div>
                  </div>
                </div>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
