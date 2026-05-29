import { Switch, Route } from "wouter";
import { lazy, Suspense, useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthGuard } from "@/components";
import { useLocation } from "wouter";

// Splash loads immediately — critical path
import SplashScreen from "@/pages/splash";

// All other pages load lazily (only when navigated to)
const AgreementScreen = lazy(() => import("@/pages/agreement"));
const HomeScreen = lazy(() => import("@/pages/home"));
function SelectCountryRedirect() {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation("/exchange"); }, []);
  return null;
}
const ExchangeScreen = lazy(() => import("@/pages/exchange"));
const TopUpScreen = lazy(() => import("@/pages/top-up"));
const TrackingScreen = lazy(() => import("@/pages/tracking"));
const TopUpSuccessScreen = lazy(() => import("@/pages/top-up-success"));
const TransferProcessingScreen = lazy(() => import("@/pages/transfer-processing"));
const TransferSuccessScreen = lazy(() => import("@/pages/transfer-success"));
const PaymentScreen = lazy(() => import("@/pages/payment"));
const SellScreen = lazy(() => import("@/pages/sell"));
const SupportScreen = lazy(() => import("@/pages/support"));
const CardsScreen = lazy(() => import("@/pages/cards"));
const HistoryScreen = lazy(() => import("@/pages/history"));
const NotificationsScreen = lazy(() => import("@/pages/notifications"));
const InvoiceScreen = lazy(() => import("@/pages/invoice"));
const SettingsScreen = lazy(() => import("@/pages/settings"));
const SecurityScreen = lazy(() => import("@/pages/security"));
const LoyaltyScreen = lazy(() => import("@/pages/loyalty"));
const DevicesScreen = lazy(() => import("@/pages/devices"));
const VouchersScreen = lazy(() => import("@/pages/vouchers"));
const WalletScreen = lazy(() => import("@/pages/wallet"));
const P2PScreen = lazy(() => import("@/pages/p2p"));
const BottomNavigation = lazy(() => import("@/components/bottom-navigation"));
const AdminRouteProvider = lazy(() =>
  import("@/components/AdminRouteProvider").then((m) => ({ default: m.AdminRoutes }))
);
// InvoiceNotificationProvider is heavy (SSE connection + Drawer + lucide icons).
// It is only loaded for authenticated routes, NOT on splash/agreement.
const InvoiceNotificationProvider = lazy(() =>
  import("@/contexts/InvoiceNotificationContext").then((m) => ({
    default: m.InvoiceNotificationProvider,
  }))
);

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-green-400 animate-spin" />
    </div>
  );
}

// Wraps protected pages with auth check + invoice notifications (SSE).
// SSE & invoice fetching only happen for authenticated users.
function Protected({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard requireAgreement={true}>
      <Suspense fallback={null}>
        <InvoiceNotificationProvider>{children}</InvoiceNotificationProvider>
      </Suspense>
    </AuthGuard>
  );
}

function Router() {
  const [location] = useLocation();
  const showBottomNav = ["/home", "/wallet", "/exchange", "/transfer", "/top-up", "/vouchers", "/cards", "/loyalty", "/p2p"].includes(location);

  return (
    <div className="min-h-screen gradient-bg relative z-10">
      <Suspense fallback={<PageLoader />}>
        <Switch>
          {/* Public routes - no authentication required */}
          <Route path="/" component={SplashScreen} />
          <Route path="/agreement">
            <AgreementScreen />
          </Route>

          {/* Protected routes */}
          <Route path="/home"><Protected><HomeScreen /></Protected></Route>
          <Route path="/wallet"><Protected><WalletScreen /></Protected></Route>
          <Route path="/select-country"><Protected><SelectCountryRedirect /></Protected></Route>
          <Route path="/exchange"><Protected><ExchangeScreen /></Protected></Route>
          <Route path="/top-up"><Protected><TopUpScreen /></Protected></Route>
          <Route path="/tracking"><Protected><TrackingScreen /></Protected></Route>
          <Route path="/top-up-success"><Protected><TopUpSuccessScreen /></Protected></Route>
          <Route path="/transfer-processing"><Protected><TransferProcessingScreen /></Protected></Route>
          <Route path="/transfer-success"><Protected><TransferSuccessScreen /></Protected></Route>
          <Route path="/payment"><Protected><PaymentScreen /></Protected></Route>
          <Route path="/transfer"><Protected><SellScreen /></Protected></Route>
          <Route path="/support"><Protected><SupportScreen /></Protected></Route>
          <Route path="/cards"><Protected><CardsScreen /></Protected></Route>
          <Route path="/history"><Protected><HistoryScreen /></Protected></Route>
          <Route path="/notifications"><Protected><NotificationsScreen /></Protected></Route>
          <Route path="/invoice/:orderNumber"><Protected><InvoiceScreen /></Protected></Route>
          <Route path="/settings"><Protected><SettingsScreen /></Protected></Route>
          <Route path="/settings/security"><Protected><SecurityScreen /></Protected></Route>
          <Route path="/devices"><Protected><DevicesScreen /></Protected></Route>
          <Route path="/loyalty"><Protected><LoyaltyScreen /></Protected></Route>
          <Route path="/vouchers"><Protected><VouchersScreen /></Protected></Route>
          <Route path="/p2p"><Protected><P2PScreen /></Protected></Route>

          {/* Admin routes - loaded last to not interfere with main routes */}
          <AdminRouteProvider />
        </Switch>
      </Suspense>

      {showBottomNav && (
        <Suspense fallback={null}>
          <BottomNavigation />
        </Suspense>
      )}
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
