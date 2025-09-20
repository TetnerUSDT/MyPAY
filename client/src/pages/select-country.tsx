import { Link } from "wouter";
import { Zap, Percent, CreditCard, X } from "lucide-react";

export default function SelectCountryScreen() {
  const countries = [
    {
      id: "russia",
      name: "Россия (RU)",
      description: "Любой банк в России",
      time: "15 минут",
      fee: "1-2%",
      method: "Card",
      flag: "🇷🇺"
    },
    {
      id: "turkey", 
      name: "Турция (TR)",
      description: "Любой банк в Турции",
      time: "15 минут",
      fee: "3-6%", 
      method: "Card",
      flag: "🇹🇷"
    }
  ];

  return (
    <div className="mobile-screen gradient-bg text-white">
      <div className="flex flex-col h-full">
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
        
        {/* Title */}
        <div className="text-center pt-8 pb-8">
          <h1 className="text-xl font-semibold" data-testid="text-select-country-title">
            Выберите страну
          </h1>
        </div>
        
        {/* Country Cards */}
        <div className="px-6">
          {countries.map((country) => (
              <Link key={country.id} href="/exchange">
                <div 
                  className="crypto-card cursor-pointer hover:opacity-90 transition-all mb-[15px]"
                  data-testid={`country-card-${country.id}`}
                >
                  {/* Country Header */}
                  <div className="flex items-center mb-6">
                    {/* Bank Icon */}
                    <div className="w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center mr-4">
                      <svg className="w-6 h-6 text-yellow-800" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm3 2h6v4H7V6zm8 8v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2h10z" clipRule="evenodd" />
                      </svg>
                    </div>
                    
                    {/* Country Info */}
                    <div>
                      <h3 className="font-semibold text-lg text-white" data-testid={`country-name-${country.id}`}>
                        {country.name}
                      </h3>
                      <p className="text-muted-foreground text-sm" data-testid={`country-description-${country.id}`}>
                        {country.description}
                      </p>
                    </div>
                  </div>
                  
                  {/* Details Grid */}
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    {/* Time */}
                    <div className="flex flex-col">
                      <div className="flex items-center mb-1">
                        <Zap className="w-4 h-4 text-yellow-400 mr-1" />
                        <span className="text-yellow-400 font-medium">Время</span>
                      </div>
                      <span className="text-white" data-testid={`country-time-${country.id}`}>
                        {country.time}
                      </span>
                    </div>
                    
                    {/* Fee */}
                    <div className="flex flex-col">
                      <div className="flex items-center mb-1">
                        <Percent className="w-4 h-4 text-green-400 mr-1" />
                        <span className="text-green-400 font-medium">Fee</span>
                      </div>
                      <span className="text-white" data-testid={`country-fee-${country.id}`}>
                        {country.fee}
                      </span>
                    </div>
                    
                    {/* Method */}
                    <div className="flex flex-col">
                      <div className="flex items-center mb-1">
                        <CreditCard className="w-4 h-4 text-yellow-400 mr-1" />
                        <span className="text-yellow-400 font-medium">Method</span>
                      </div>
                      <span className="text-white" data-testid={`country-method-${country.id}`}>
                        {country.method}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
        </div>
      </div>
    </div>
  );
}