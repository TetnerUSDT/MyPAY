import { useLocation } from "wouter";
import { Check, Loader2 } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { User } from "@shared/schema";
import { useEffect } from "react";

export default function AgreementScreen() {
  const [, setLocation] = useLocation();
  const hasApiKey = !!localStorage.getItem("userApiKey");
  
  // Fetch current user to check agreement status (only if API key exists)
  const { data: user, isLoading: userLoading, error } = useQuery<User>({
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
      // For other errors (500, network, etc.), leave API key intact
    }
  }, [error, hasApiKey, setLocation]);
  
  // Redirect if user already agreed (side-effect moved from render)
  useEffect(() => {
    if (user && user.agreement === 1) {
      setLocation("/home");
    }
  }, [user, setLocation]);
  
  // Mutation to update agreement
  const updateAgreementMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PATCH", "/api/auth/agreement");
      return response.json();
    },
    onSuccess: async (updatedUser) => {
      // Update the cache immediately with the returned user data
      queryClient.setQueryData(["/api/auth/me"], updatedUser);
      // Ensure query is invalidated and refetched
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      // Redirect to home after successful agreement update
      setLocation("/home");
    },
    onError: (error) => {
      console.error("Failed to update agreement:", error);
      const errorMessage = error.message || "";
      
      // Check if it's an authentication error
      if (errorMessage.includes("401") || errorMessage.includes("403") || errorMessage.includes("API key")) {
        // Clear invalid API key and redirect to splash for re-authentication
        localStorage.removeItem("userApiKey");
        setLocation("/");
      } else {
        // For other errors, still show error but don't redirect
        console.error("Agreement update failed:", error);
      }
    },
  });
  
  const handleConfirmAgreement = () => {
    // If no API key, redirect to splash for authentication first
    if (!hasApiKey) {
      setLocation("/");
      return;
    }
    updateAgreementMutation.mutate();
  };
  
  // Early return if redirecting (prevent render of agreement screen)
  if (user && user.agreement === 1) {
    return null;
  }
  
  // Show loading state only if we're trying to fetch user data
  if (hasApiKey && userLoading) {
    return (
      <div className="mobile-screen gradient-bg text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin" />
          <p>Загрузка...</p>
        </div>
      </div>
    );
  }
  
  const agreementText = `Пользовательское соглашение которое должен прочитать пользователь и согласиться со всеми условиями и правилами сервиса

Пользовательское соглашение которое должен прочитать пользователь и согласиться со всеми условиями и правилами сервиса

Пользовательское соглашение которое должен прочитать пользователь и согласиться со всеми условиями и правилами сервиса

Пользовательское соглашение которое должен прочитать пользователь и согласиться со всеми условиями и правилами сервиса

Пользовательское соглашение которое должен прочитать пользователь и согласиться со всеми условиями и правилами сервиса

Пользовательское соглашение которое должен прочитать пользователь и согласиться со всеми условиями и правилами сервиса

Пользовательское соглашение которое должен прочитать пользователь и согласиться со всеми условиями и правилами сервиса

Пользовательское соглашение которое должен прочитать пользователь и согласиться со всеми условиями и правилами сервиса

Дополнительные условия использования сервиса, конфиденциальность данных, обработка персональной информации и другие важные аспекты работы с платформой.

Согласие с условиями означает полное принятие всех правил и обязательств, изложенных в данном документе.`;

  return (
    <div className="mobile-screen gradient-bg text-white">
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="text-center pt-12 pb-6">
          <h1 className="text-xl font-semibold text-accent" data-testid="text-agreement-title">
            Пользовательское соглашение
          </h1>
        </div>
        
        {/* Scrollable Content */}
        <div className="flex-1 px-6 overflow-y-auto">
          <div className="text-sm leading-relaxed space-y-4 pb-8" data-testid="text-agreement-content">
            {agreementText.split('\n\n').map((paragraph, index) => (
              <p key={index} className="text-white">
                {paragraph}
              </p>
            ))}
          </div>
        </div>
        
        {/* Bottom Button */}
        <div className="p-6">
          <button 
            onClick={handleConfirmAgreement}
            disabled={updateAgreementMutation.isPending}
            className="action-button w-full disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="button-confirm-agreement"
          >
            {updateAgreementMutation.isPending ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Сохранение...
              </>
            ) : (
              <>
                <Check className="w-5 h-5 mr-2" />
                {hasApiKey ? "Подтвердить согласие" : "Продолжить"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}