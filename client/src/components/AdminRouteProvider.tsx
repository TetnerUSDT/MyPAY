import { useEffect, useState } from "react";
import { Route } from "wouter";
import { getAdminPath } from "@/lib/adminApi";
import AdminLogin from "@/pages/admin/login";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminBalances from "@/pages/admin/balances";

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
      <Route path={`/${adminPath}`}>
        {() => {
          window.location.href = `/${adminPath}/login`;
          return null;
        }}
      </Route>
    </>
  );
}
