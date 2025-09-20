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
      </div>
    </div>
  );
}