import { Link } from "wouter";
import { Zap, Percent, CreditCard, X } from "lucide-react";
import { RussiaFlag, TurkeyFlag } from "@/components/flags";

type Country = {
  id: string;
  name: string;
  description: string;
  time: string;
  fee: string;
  method: string;
  FlagComponent: React.FC<React.SVGProps<SVGSVGElement>>;
};

export default function SelectCountryScreen() {
  const countries: Country[] = [
    {
      id: "russia",
      name: "Россия (RU)",
      description: "Любой банк в России",
      time: "15 минут",
      fee: "1-2%",
      method: "Card",
      FlagComponent: RussiaFlag
    },
    {
      id: "turkey", 
      name: "Турция (TR)",
      description: "Любой банк в Турции",
      time: "15 минут",
      fee: "3-6%", 
      method: "Card",
      FlagComponent: TurkeyFlag
    }
  ];

  return (
    <div className="mobile-screen gradient-bg text-white">
      <div className="flex flex-col h-full">
        {/* Title */}
        <div className="text-center pt-8 pb-8">
          <h1 className="text-xl font-semibold" data-testid="text-select-country-title">
            Выберите страну
          </h1>
        </div>
        
        {countries.map((country) => (
          <Link key={country.id} href="/exchange">
            <div 
              className="crypto-card mx-6 cursor-pointer hover:opacity-90 transition-all mb-[15px]"
                  data-testid={`country-card-${country.id}`}
                >
                  {/* Country Header */}
                  <div className="flex items-center mb-6">
                    {/* Country Flag */}
                    <div 
                      className="w-12 h-12 rounded-full flex items-center justify-center mr-4 bg-white/5 border border-white/10 overflow-hidden"
                      data-testid={`flag-wrapper-${country.id}`}
                    >
                      <country.FlagComponent 
                        className="w-10 h-10" 
                        data-testid={`flag-${country.id}`}
                        aria-label={`${country.name} flag`}
                      />
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
  );
}