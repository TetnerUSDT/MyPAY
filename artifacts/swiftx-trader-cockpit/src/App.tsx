import { type ReactNode, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

import { Layout } from '@/components/layout';
import Market from '@/pages/market';
import Deals from '@/pages/deals';
import Ads from '@/pages/ads';
import PaymentDetails from '@/pages/payment-details';
import CreateAd from '@/pages/create-ad';
import OrderDetail from '@/pages/order-detail';

const queryClient = new QueryClient();

function Router() {
  return (
    <RoutedErrorBoundary>
      <Layout>
        <Switch>
          <Route path="/" component={Market} />
          <Route path="/deals" component={DealsRoute} />
          <Route path="/ads" component={AdsRoute} />
          <Route path="/payment-details" component={PaymentDetails} />
          <Route path="/create-ad" component={CreateAdRoute} />
          <Route path="/order/:id">
            <OrderDetail />
          </Route>
          <Route component={NotFound} />
        </Switch>
      </Layout>
    </RoutedErrorBoundary>
  );
}

function CreateAdRoute() {
  return <CreateAd />;
}

function DealsRoute() {
  return <Deals />;
}

function AdsRoute() {
  return <Ads />;
}

function AuthGate({ children }: { children: ReactNode }) {
  const [hasApiKey, setHasApiKey] = useState(() => Boolean(localStorage.getItem("userApiKey")));

  useEffect(() => {
    const sync = () => setHasApiKey(Boolean(localStorage.getItem("userApiKey")));
    window.addEventListener("userApiKeyChanged", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("userApiKeyChanged", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  if (!hasApiKey) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b0d11] px-6 text-white">
        <div className="w-full max-w-md rounded-3xl border border-white/[.08] bg-[#111419] p-8 text-center shadow-2xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-2xl font-black text-primary-foreground shadow-lg shadow-primary/20">S</div>
          <h1 className="mt-6 text-2xl font-semibold">Войдите в SwiftX</h1>
          <p className="mt-2 text-sm leading-relaxed text-white/45">
            Торговый кабинет использует защищённый доступ SwiftX. Сначала войдите в основном приложении, затем вернитесь сюда.
          </p>
          <a
            href="/"
            className="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition hover:brightness-110"
          >
            Открыть SwiftX
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthGate>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
        </AuthGate>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
