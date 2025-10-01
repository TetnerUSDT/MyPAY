import { Link } from "wouter";
import { Zap, Percent, CreditCard, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { RussiaFlag, TurkeyFlag } from "@/components/flags";

type Card = {
  id: number;
  title: string;
  country: string;
  lang: string | null;
  timeExchange: number;
  commission: string;
  idBalance: string | null;
  status: string | null;
};

// Map language codes to flag components
const flagMap: Record<string, React.FC<React.SVGProps<SVGSVGElement>>> = {
  ru: RussiaFlag,
  tr: TurkeyFlag,
};

export default function SelectCountryScreen() {
  const { data: cards = [], isLoading } = useQuery<Card[]>({
    queryKey: ["/api/cards/active"],
  });

  if (isLoading) {
    return (
      <div className="mobile-screen gradient-bg text-white">
        <div className="flex flex-col h-full items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground">Загрузка стран...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-screen gradient-bg text-white">
      <div className="flex flex-col h-full">
        {/* Title */}
        <div className="text-center pt-8 pb-8">
          <h1 className="text-xl font-semibold" data-testid="text-select-country-title">
            Выберите страну
          </h1>
        </div>
        
        {cards.map((card) => {
          const FlagComponent = card.lang ? flagMap[card.lang] : null;
          
          return (
            <Link key={card.id} href={`/exchange?country=${card.id}`}>
              <div 
                className="crypto-card mx-6 cursor-pointer hover:opacity-90 transition-all mb-[15px]"
                data-testid={`country-card-${card.id}`}
              >
                {/* Country Header */}
                <div className="flex items-center mb-6">
                  {/* Country Flag */}
                  <div 
                    className="w-12 h-12 rounded-full flex items-center justify-center mr-4 bg-white/5 border border-white/10 overflow-hidden"
                    data-testid={`flag-wrapper-${card.id}`}
                  >
                    {FlagComponent ? (
                      <FlagComponent 
                        className="w-10 h-10" 
                        data-testid={`flag-${card.id}`}
                        aria-label={`${card.title} flag`}
                      />
                    ) : (
                      <div className="w-10 h-10 flex items-center justify-center text-white/50">
                        ?
                      </div>
                    )}
                  </div>
                  
                  {/* Country Info */}
                  <div>
                    <h3 className="font-semibold text-lg text-white" data-testid={`country-name-${card.id}`}>
                      {card.title}
                    </h3>
                    <p className="text-muted-foreground text-sm" data-testid={`country-description-${card.id}`}>
                      {card.country}
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
                    <span className="text-white" data-testid={`country-time-${card.id}`}>
                      {card.timeExchange} минут
                    </span>
                  </div>
                  
                  {/* Fee */}
                  <div className="flex flex-col">
                    <div className="flex items-center mb-1">
                      <Percent className="w-4 h-4 text-green-400 mr-1" />
                      <span className="text-green-400 font-medium">Fee</span>
                    </div>
                    <span className="text-white" data-testid={`country-fee-${card.id}`}>
                      {card.commission}%
                    </span>
                  </div>
                  
                  {/* Method */}
                  <div className="flex flex-col">
                    <div className="flex items-center mb-1">
                      <CreditCard className="w-4 h-4 text-yellow-400 mr-1" />
                      <span className="text-yellow-400 font-medium">Method</span>
                    </div>
                    <span className="text-white" data-testid={`country-method-${card.id}`}>
                      Card
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}