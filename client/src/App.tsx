import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PreloaderProvider, RouteChangePreloader, AuthGuard } from "@/components";
import SplashScreen from "@/pages/splash";
import AgreementScreen from "@/pages/agreement";
import HomeScreen from "@/pages/home";
import SelectCountryScreen from "@/pages/select-country";
import ExchangeScreen from "@/pages/exchange";
import TopUpScreen from "@/pages/top-up";
import WaitScreen from "@/pages/wait";
import TrackingScreen from "@/pages/tracking";
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
import { AdminRoutes } from "@/components/AdminRouteProvider";

function Router() {
  const [location] = useLocation();
  const showBottomNav = ["/home", "/exchange", "/transfer", "/top-up", "/support", "/select-country", "/cards"].includes(location);

  return (
    <div className="min-h-screen gradient-bg">
      <Switch>
        {/* Admin routes - dynamically loaded */}
        <AdminRoutes />
        
        {/* Public routes - no authentication required */}
        <Route path="/" component={SplashScreen} />
        <Route path="/agreement" component={AgreementScreen} />
        
        {/* Protected routes - require authentication and agreement */}
        <Route path="/home">
          <AuthGuard requireAgreement={true}>
            <HomeScreen />
          </AuthGuard>
        </Route>
        
        <Route path="/select-country">
          <AuthGuard requireAgreement={true}>
            <SelectCountryScreen />
          </AuthGuard>
        </Route>
        
        <Route path="/exchange">
          <AuthGuard requireAgreement={true}>
            <ExchangeScreen />
          </AuthGuard>
        </Route>
        
        <Route path="/top-up">
          <AuthGuard requireAgreement={true}>
            <TopUpScreen />
          </AuthGuard>
        </Route>
        
        <Route path="/wait">
          <AuthGuard requireAgreement={true}>
            <WaitScreen />
          </AuthGuard>
        </Route>
        
        <Route path="/tracking">
          <AuthGuard requireAgreement={true}>
            <TrackingScreen />
          </AuthGuard>
        </Route>
        
        <Route path="/top-up-success">
          <AuthGuard requireAgreement={true}>
            <TopUpSuccessScreen />
          </AuthGuard>
        </Route>
        
        <Route path="/transfer-processing">
          <AuthGuard requireAgreement={true}>
            <TransferProcessingScreen />
          </AuthGuard>
        </Route>
        
        <Route path="/transfer-success">
          <AuthGuard requireAgreement={true}>
            <TransferSuccessScreen />
          </AuthGuard>
        </Route>
        
        <Route path="/payment">
          <AuthGuard requireAgreement={true}>
            <PaymentScreen />
          </AuthGuard>
        </Route>
        
        <Route path="/transfer">
          <AuthGuard requireAgreement={true}>
            <SellScreen />
          </AuthGuard>
        </Route>
        
        <Route path="/support">
          <AuthGuard requireAgreement={true}>
            <SupportScreen />
          </AuthGuard>
        </Route>
        
        <Route path="/cards">
          <AuthGuard requireAgreement={true}>
            <CardsScreen />
          </AuthGuard>
        </Route>
        
        <Route path="/history">
          <AuthGuard requireAgreement={true}>
            <HistoryScreen />
          </AuthGuard>
        </Route>
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
