import { Link, useLocation } from "wouter";
import { Home, ArrowRightLeft, Wallet, Headphones } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function BottomNavigation() {
  const [location] = useLocation();
  const { toast } = useToast();

  const handleWalletClick = () => {
    toast({
      title: "Кошелек",
      description: "Данный сервис станет доступным в ближайшее время",
      variant: "default",
    });
  };

  const navItems = [
    { path: "/home", icon: Home, label: "Home" },
    { path: "/select-country", icon: ArrowRightLeft, label: "Exchange" },
    { path: "/top-up", icon: Wallet, label: "Wallet" },
    { path: "/support", icon: Headphones, label: "Support" },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card/90 backdrop-blur-lg border-t border-border px-6 py-3">
      <div className="flex justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.path;
          
          // Special handling for Wallet button
          if (item.label === "Wallet") {
            return (
              <button 
                key={item.path}
                onClick={handleWalletClick}
                className={`flex flex-col items-center p-2 transition-colors ${
                  isActive ? "text-accent" : "text-muted-foreground hover:text-foreground"
                }`}
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <Icon className="w-5 h-5 mb-1" />
                <span className="text-xs">{item.label}</span>
              </button>
            );
          }
          
          return (
            <Link 
              key={item.path} 
              href={item.path}
              data-testid={`nav-${item.label.toLowerCase()}`}
            >
              <button 
                className={`flex flex-col items-center p-2 transition-colors ${
                  isActive ? "text-accent" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-5 h-5 mb-1" />
                <span className="text-xs">{item.label}</span>
              </button>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
