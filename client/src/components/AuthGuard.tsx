import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { User } from "@shared/schema";
import { Loader2 } from "lucide-react";

interface AuthGuardProps {
  children: React.ReactNode;
  requireAgreement?: boolean;
}

export default function AuthGuard({ children, requireAgreement = false }: AuthGuardProps) {
  const [, setLocation] = useLocation();
  const hasApiKey = !!localStorage.getItem("userApiKey");

  // Fetch current user if API key exists
  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: ["/api/auth/me"],
    enabled: hasApiKey,
    retry: false,
  });

  // Handle authentication errors
  useEffect(() => {
    if (error && hasApiKey) {
      const errorMessage = error.message || "";
      // Only clear API key on authentication errors (401/403)
      if (errorMessage.includes("401") || errorMessage.includes("403") || errorMessage.includes("API key")) {
        localStorage.removeItem("userApiKey");
        setLocation("/");
      }
    }
  }, [error, hasApiKey, setLocation]);

  // Redirect logic based on auth status
  useEffect(() => {
    // If no API key, redirect to splash for authentication
    if (!hasApiKey) {
      setLocation("/");
      return;
    }

    // If user is loaded and requireAgreement is true
    if (user && requireAgreement) {
      if (user.agreement === 0) {
        // User hasn't agreed yet, redirect to agreement page
        setLocation("/agreement");
        return;
      }
      // User has agreed (agreement === 1), allow access
    }
  }, [hasApiKey, user, requireAgreement, setLocation]);

  // Show loading while checking authentication
  if (hasApiKey && isLoading) {
    return (
      <div className="mobile-screen gradient-bg text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin" />
          <p>Проверка доступа...</p>
        </div>
      </div>
    );
  }

  // If user is not loaded yet or redirecting, show nothing
  if (!hasApiKey || (requireAgreement && (!user || user.agreement === 0))) {
    return null;
  }

  // User is authenticated and (if required) has agreed to terms
  return <>{children}</>;
}