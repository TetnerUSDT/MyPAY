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
import TopUpSuccessScreen from "@/pages/top-up-success";
import SellScreen from "@/pages/sell";
import SupportScreen from "@/pages/support";
import CardsScreen from "@/pages/cards";
import BottomNavigation from "@/components/bottom-navigation";
import { useLocation } from "wouter";

function Router() {
  const [location] = useLocation();
  const showBottomNav = ["/home", "/exchange", "/transfer", "/top-up", "/support", "/select-country", "/cards"].includes(location);

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
        <Route path="/top-up-success" component={TopUpSuccessScreen} />
        <Route path="/transfer" component={SellScreen} />
        <Route path="/support" component={SupportScreen} />
        <Route path="/cards" component={CardsScreen} />
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
