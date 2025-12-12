import { Link, useLocation } from "wouter";
import { Home, ArrowRightLeft, Wallet, Ticket } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function BottomNavigation() {
  const [location] = useLocation();
  const { t } = useTranslation();

  const navItems = [
    { path: "/home", icon: Home, label: t('nav.home') },
    { path: "/select-country", icon: ArrowRightLeft, label: t('nav.exchange') },
    { path: "/wallet", icon: Wallet, label: t('nav.wallet') },
    { path: "/vouchers", icon: Ticket, label: t('nav.vouchers') },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card/90 backdrop-blur-lg border-t border-border px-6 py-3">
      <div className="flex justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.path;
          
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
