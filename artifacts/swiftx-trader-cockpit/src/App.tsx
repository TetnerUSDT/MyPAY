import { type ReactNode } from 'react';
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
          <Route path="/deals" component={Deals} />
          <Route path="/ads" component={Ads} />
          <Route path="/payment-details" component={PaymentDetails} />
          <Route path="/create-ad" component={CreateAd} />
          <Route path="/order/:id" component={OrderDetail} />
          <Route component={NotFound} />
        </Switch>
      </Layout>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
