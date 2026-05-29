import { useEffect, useState } from "react";
import { Route, Redirect } from "wouter";
import { getAdminPath } from "@/lib/adminApi";
import AdminLogin from "@/pages/admin/login";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminBalances from "@/pages/admin/balances";
import AdminExchanges from "@/pages/admin/exchanges";
import AdminCards from "@/pages/admin/cards";
import AdminBanks from "@/pages/admin/banks";
import AdminExchangeRates from "@/pages/admin/exchange-rates";
import AdminSupport from "@/pages/admin/support";
import AdminUsers from "@/pages/admin/users";
import AdminWallets from "@/pages/admin/wallets";
import AdminInteractive from "@/pages/admin/interactive";
import AdminTelegram from "@/pages/admin/telegram";
import AdminP2P from "@/pages/admin/p2p";

export function AdminRoutes() {
  const [adminPath, setAdminPath] = useState<string>('admin');

  useEffect(() => {
    getAdminPath().then(setAdminPath);
  }, []);

  return (
    <>
      <Route path={`/${adminPath}/login`} component={AdminLogin} />
      <Route path={`/${adminPath}/dashboard`} component={AdminDashboard} />
      <Route path={`/${adminPath}/balances`} component={AdminBalances} />
      <Route path={`/${adminPath}/exchanges`} component={AdminExchanges} />
      <Route path={`/${adminPath}/cards`} component={AdminCards} />
      <Route path={`/${adminPath}/banks`} component={AdminBanks} />
      <Route path={`/${adminPath}/exchange-rates`} component={AdminExchangeRates} />
      <Route path={`/${adminPath}/support`} component={AdminSupport} />
      <Route path={`/${adminPath}/users`} component={AdminUsers} />
      <Route path={`/${adminPath}/wallets`} component={AdminWallets} />
      <Route path={`/${adminPath}/telegram`} component={AdminTelegram} />
      <Route path={`/${adminPath}/interactive`} component={AdminInteractive} />
      <Route path={`/${adminPath}/p2p`} component={AdminP2P} />
      <Route path={`/${adminPath}`}>
        <Redirect to={`/${adminPath}/login`} />
      </Route>
    </>
  );
}
