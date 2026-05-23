import { Switch, Route } from "wouter";
import { lazy, Suspense } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthGuard } from "@/components";
import { InvoiceNotificationProvider } from "@/contexts/InvoiceNotificationContext";
import { useLocation } from "wouter";

// Splash loads immediately — critical path
import SplashScreen from "@/pages/splash";

// All other pages load lazily (only when navigated to)
const AgreementScreen = lazy(() => import("@/pages/agreement"));
const HomeScreen = lazy(() => import("@/pages/home"));
const SelectCountryScreen = lazy(() => import("@/pages/select-country"));
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
const BottomNavigation = lazy(() => import("@/components/bottom-navigation"));
const AdminRouteProvider = lazy(() =>
  import("@/components/AdminRouteProvider").then((m) => ({ default: m.AdminRoutes }))
);

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-green-400 animate-spin" />
    </div>
  );
}

function Router() {
  const [location] = useLocation();
  const showBottomNav = ["/home", "/wallet", "/exchange", "/transfer", "/top-up", "/vouchers", "/select-country", "/cards", "/loyalty"].includes(location);

  return (
    <div className="min-h-screen gradient-bg relative z-10">
      <Suspense fallback={<PageLoader />}>
        <Switch>
          {/* Public routes - no authentication required */}
          <Route path="/" component={SplashScreen} />
          <Route path="/agreement">
            <AgreementScreen />
          </Route>

          {/* Protected routes - require authentication and agreement */}
          <Route path="/home">
            <AuthGuard requireAgreement={true}>
              <HomeScreen />
            </AuthGuard>
          </Route>

          <Route path="/wallet">
            <AuthGuard requireAgreement={true}>
              <WalletScreen />
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

          <Route path="/notifications">
            <AuthGuard requireAgreement={true}>
              <NotificationsScreen />
            </AuthGuard>
          </Route>

          <Route path="/invoice/:orderNumber">
            <AuthGuard requireAgreement={true}>
              <InvoiceScreen />
            </AuthGuard>
          </Route>

          <Route path="/settings">
            <AuthGuard requireAgreement={true}>
              <SettingsScreen />
            </AuthGuard>
          </Route>

          <Route path="/settings/security">
            <AuthGuard requireAgreement={true}>
              <SecurityScreen />
            </AuthGuard>
          </Route>

          <Route path="/devices">
            <AuthGuard requireAgreement={true}>
              <DevicesScreen />
            </AuthGuard>
          </Route>

          <Route path="/loyalty">
            <AuthGuard requireAgreement={true}>
              <LoyaltyScreen />
            </AuthGuard>
          </Route>

          <Route path="/vouchers">
            <AuthGuard requireAgreement={true}>
              <VouchersScreen />
            </AuthGuard>
          </Route>

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
        <InvoiceNotificationProvider>
          <Toaster />
          <Router />
        </InvoiceNotificationProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
