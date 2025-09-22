import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PreloaderProvider, RouteChangePreloader } from "@/components";
import SplashScreen from "@/pages/splash";
import AgreementScreen from "@/pages/agreement";
import HomeScreen from "@/pages/home";
import SelectCountryScreen from "@/pages/select-country";
import ExchangeScreen from "@/pages/exchange";
import TopUpScreen from "@/pages/top-up";
import WaitScreen from "@/pages/wait";
import TopUpSuccessScreen from "@/pages/top-up-success";
import TransferProcessingScreen from "@/pages/transfer-processing";
import TransferSuccessScreen from "@/pages/transfer-success";
import PaymentScreen from "@/pages/payment";
import SellScreen from "@/pages/sell";
import SupportScreen from "@/pages/support";
import CardsScreen from "@/pages/cards";
import HistoryScreen from "@/pages/history";
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
        <Route path="/exchange" component={ExchangeScreen} />
        <Route path="/top-up" component={TopUpScreen} />
        <Route path="/wait" component={WaitScreen} />
        <Route path="/top-up-success" component={TopUpSuccessScreen} />
        <Route path="/transfer-processing" component={TransferProcessingScreen} />
        <Route path="/transfer-success" component={TransferSuccessScreen} />
        <Route path="/payment" component={PaymentScreen} />
        <Route path="/transfer" component={SellScreen} />
        <Route path="/support" component={SupportScreen} />
        <Route path="/cards" component={CardsScreen} />
        <Route path="/history" component={HistoryScreen} />
      </Switch>
      
      {showBottomNav && <BottomNavigation />}
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <PreloaderProvider>
        <TooltipProvider>
          <Toaster />
          <RouteChangePreloader />
          <Router />
        </TooltipProvider>
      </PreloaderProvider>
    </QueryClientProvider>
  );
}

export default App;
