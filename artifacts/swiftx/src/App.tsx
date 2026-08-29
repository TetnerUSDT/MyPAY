import { Switch, Route, Router as WouterRouter } from "wouter";
import { lazy, Suspense, useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthGuard } from "@/components";
import { UnifiedPreloader } from "@/components/UnifiedPreloader";
import { useP2PDesktop } from "@/hooks/use-p2p-desktop";
import { useLocation } from "wouter";

// Splash loads immediately — critical path
import SplashScreen from "@/pages/splash";

// All other pages load lazily (only when navigated to)
const AgreementScreen = lazy(() => import("@/pages/agreement"));
const HomeScreen = lazy(() => import("@/pages/home"));
function SelectCountryRedirect() {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation("/wallet?sheet=exchange"); }, []);
  return null;
}
const TrackingScreen = lazy(() => import("@/pages/tracking"));
const TopUpSuccessScreen = lazy(() => import("@/pages/top-up-success"));
const TransferProcessingScreen = lazy(() => import("@/pages/transfer-processing"));
const TransferSuccessScreen = lazy(() => import("@/pages/transfer-success"));
const PaymentScreen = lazy(() => import("@/pages/payment"));
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
const P2POrderScreen = lazy(() => import("@/pages/p2p-order-responsive"));
const P2PCreateAdScreen = lazy(() => import("@/pages/p2p-create-ad"));
const P2PMyAdsScreen = lazy(() => import("@/pages/p2p-my-ads"));
const P2PPaymentMethodsScreen = lazy(() => import("@/pages/p2p-payment-methods"));
const P2POrdersScreen = lazy(() => import("@/pages/p2p-orders"));
const P2PMerchantScreen = lazy(() => import("@/pages/p2p-merchant"));
const P2PDashboardScreen = lazy(() => import("@/pages/p2p-dashboard"));
const P2PVerifyScreen = lazy(() => import("@/pages/p2p-verify"));
const BusinessScreen = lazy(() => import("@/pages/business"));
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
  return <UnifiedPreloader label="Загрузка..." />;
}

// Wraps protected pages with auth check + invoice notifications (SSE).
// SSE & invoice fetching only happen for authenticated users.
function Protected({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard requireAgreement={true}>
      <Suspense fallback={<UnifiedPreloader label="Загрузка..." />}>
        <InvoiceNotificationProvider>{children}</InvoiceNotificationProvider>
      </Suspense>
    </AuthGuard>
  );
}

function Router() {
  const [location] = useLocation();
  const isP2PDesktop = useP2PDesktop();
  const showBottomNav = ["/home", "/wallet", "/vouchers", "/cards", "/loyalty", "/p2p"].includes(location)
    && !(location === "/p2p" && isP2PDesktop);

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
          <Route path="/tracking"><Protected><TrackingScreen /></Protected></Route>
          <Route path="/top-up-success"><Protected><TopUpSuccessScreen /></Protected></Route>
          <Route path="/transfer-processing"><Protected><TransferProcessingScreen /></Protected></Route>
          <Route path="/transfer-success"><Protected><TransferSuccessScreen /></Protected></Route>
          <Route path="/payment"><Protected><PaymentScreen /></Protected></Route>
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
          <Route path="/p2p/order/:id"><Protected><P2POrderScreen /></Protected></Route>
          <Route path="/p2p/create-ad"><Protected><P2PCreateAdScreen /></Protected></Route>
          <Route path="/p2p/my-ads"><Protected><P2PMyAdsScreen /></Protected></Route>
          <Route path="/p2p/my-payment-methods"><Protected><P2PPaymentMethodsScreen /></Protected></Route>
          <Route path="/p2p/orders"><Protected><P2POrdersScreen /></Protected></Route>
          <Route path="/p2p/user/:id"><Protected><P2PMerchantScreen /></Protected></Route>
          <Route path="/p2p/dashboard"><Protected><P2PDashboardScreen /></Protected></Route>
          <Route path="/p2p/verify"><Protected><P2PVerifyScreen /></Protected></Route>
          <Route path="/business"><Protected><BusinessScreen /></Protected></Route>
          <Route path="/pay/:invoiceNumber" component={lazy(() => import("@/pages/merchant-pay"))} />

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
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
