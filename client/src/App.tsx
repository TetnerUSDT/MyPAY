import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import SplashScreen from "@/pages/splash";
import AgreementScreen from "@/pages/agreement";
import HomeScreen from "@/pages/home";
import SelectCountryScreen from "@/pages/select-country";
import CountrySelectionScreen from "@/pages/country-selection";
import ExchangeScreen from "@/pages/exchange";
import TopUpScreen from "@/pages/top-up";
import WaitScreen from "@/pages/wait";
import SuccessScreen from "@/pages/success";
import SellScreen from "@/pages/sell";
import SupportScreen from "@/pages/support";
import BottomNavigation from "@/components/bottom-navigation";
import { useLocation } from "wouter";

function Router() {
  const [location] = useLocation();
  const showBottomNav = ["/home", "/exchange", "/sell", "/top-up", "/support"].includes(location);

  return (
    <div className="min-h-screen gradient-bg">
      <Switch>
        <Route path="/" component={SplashScreen} />
        <Route path="/agreement" component={AgreementScreen} />
        <Route path="/home" component={HomeScreen} />
        <Route path="/select-country" component={SelectCountryScreen} />
        <Route path="/country" component={CountrySelectionScreen} />
        <Route path="/exchange" component={ExchangeScreen} />
        <Route path="/top-up" component={TopUpScreen} />
        <Route path="/wait" component={WaitScreen} />
        <Route path="/success" component={SuccessScreen} />
        <Route path="/sell" component={SellScreen} />
        <Route path="/support" component={SupportScreen} />
      </Switch>
      
      {showBottomNav && <BottomNavigation />}
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
