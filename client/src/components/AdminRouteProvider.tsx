import { useEffect, useState } from "react";
import { Route } from "wouter";
import { getAdminPath } from "@/lib/adminApi";
import AdminLogin from "@/pages/admin/login";
import AdminDashboard from "@/pages/admin/dashboard";

export function AdminRoutes() {
  const [adminPath, setAdminPath] = useState<string | null>(null);

  useEffect(() => {
    getAdminPath().then(setAdminPath);
  }, []);

  if (!adminPath) {
    return null; // or loading indicator
  }

  return (
    <>
      <Route path={`/${adminPath}/login`} component={AdminLogin} />
      <Route path={`/${adminPath}/dashboard`} component={AdminDashboard} />
      <Route path={`/${adminPath}`}>
        {() => {
          window.location.href = `/${adminPath}/login`;
          return null;
        }}
      </Route>
    </>
  );
}
