import { useLocation } from "wouter";
import { Check, Loader2 } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User } from "@/lib/schema";
import { useEffect } from "react";

export default function AgreementScreen() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const hasApiKey = !!localStorage.getItem("userApiKey");
  
  // If no API key, redirect to splash (Telegram will auto-auth there)
  useEffect(() => {
    if (!hasApiKey) {
      setLocation("/");
    }
  }, [hasApiKey, setLocation]);
  
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
  
  // Show loading state if fetching user data
  if (hasApiKey && userLoading) {
    return (
      <div className="mobile-screen gradient-bg text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin" />
          <p>{t('agreement.loading')}</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="mobile-screen gradient-bg text-white">
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="text-center pt-8 pb-4">
          <h1 className="text-xl font-bold text-accent" data-testid="text-agreement-title">
            {t('agreement.title')}
          </h1>
        </div>
        
        {/* Scrollable Content */}
        <div className="flex-1 px-5 overflow-y-auto">
          <div className="text-sm leading-relaxed pb-8" data-testid="text-agreement-content">
            
            {/* Section 1 */}
            <div className="mb-6">
              <h2 className="text-base font-semibold text-accent mb-3">{t('agreement.section1Title')}</h2>
              <p className="text-white/90 mb-2">
                <span className="font-medium">1.1.</span> {t('agreement.section1_1')}
              </p>
              <p className="text-white/90 mb-2">
                <span className="font-medium">1.2.</span> {t('agreement.section1_2')}
              </p>
              <p className="text-white/90 mb-2">
                <span className="font-medium">1.3.</span> {t('agreement.section1_3')}
              </p>
              <p className="text-white/90">
                <span className="font-medium">1.4.</span> {t('agreement.section1_4')}
              </p>
            </div>

            {/* Section 2 */}
            <div className="mb-6">
              <h2 className="text-base font-semibold text-accent mb-3">{t('agreement.section2Title')}</h2>
              <p className="text-white/90 mb-3">
                <span className="font-medium">2.1. {t('agreement.section2_1_title')}</span> {t('agreement.section2_1')}
              </p>
              <p className="text-white/90 mb-3">
                <span className="font-medium">2.2. {t('agreement.section2_2_title')}</span> {t('agreement.section2_2')}
              </p>
              <p className="text-white/90 mb-3">
                <span className="font-medium">2.3. {t('agreement.section2_3_title')}</span> {t('agreement.section2_3')}
              </p>
              <p className="text-white/90 mb-3">
                <span className="font-medium">2.4. {t('agreement.section2_4_title')}</span> {t('agreement.section2_4')}
              </p>
              <p className="text-white/90">
                <span className="font-medium">2.5. {t('agreement.section2_5_title')}</span> {t('agreement.section2_5')}
              </p>
            </div>

            {/* Section 3 */}
            <div className="mb-6">
              <h2 className="text-base font-semibold text-accent mb-3">{t('agreement.section3Title')}</h2>
              <p className="text-white/90 mb-2">
                <span className="font-medium">3.1. {t('agreement.section3_1_title')}</span>
              </p>
              <ul className="text-white/90 mb-3 pl-4 space-y-1">
                <li>• {t('agreement.section3_1_item1')}</li>
                <li>• {t('agreement.section3_1_item2')}</li>
                <li>• {t('agreement.section3_1_item3')}</li>
              </ul>
              <p className="text-white/90 mb-2">
                <span className="font-medium">3.2. {t('agreement.section3_2_title')}</span>
              </p>
              <ul className="text-white/90 mb-3 pl-4 space-y-1">
                <li>• {t('agreement.section3_2_item1')}</li>
                <li>• {t('agreement.section3_2_item2')}</li>
                <li>• {t('agreement.section3_2_item3')}</li>
              </ul>
              <p className="text-white/90 mb-2">
                <span className="font-medium">3.3. {t('agreement.section3_3_title')}</span>
              </p>
              <ul className="text-white/90 pl-4 space-y-1">
                <li>• {t('agreement.section3_3_item1')}</li>
                <li>• {t('agreement.section3_3_item2')}</li>
                <li>• {t('agreement.section3_3_item3')}</li>
              </ul>
            </div>

            {/* Section 4 */}
            <div className="mb-6">
              <h2 className="text-base font-semibold text-accent mb-3">{t('agreement.section4Title')}</h2>
              <p className="text-white/90 mb-2">
                <span className="font-medium">4.1.</span> {t('agreement.section4_1')}
              </p>
              <p className="text-white/90 mb-2">
                <span className="font-medium">4.2.</span> {t('agreement.section4_2')}
              </p>
              <p className="text-white/90 mb-2">
                <span className="font-medium">4.3.</span> {t('agreement.section4_3')}
              </p>
              <p className="text-white/90">
                <span className="font-medium">4.4.</span> {t('agreement.section4_4')}
              </p>
            </div>

            {/* Section 5 */}
            <div className="mb-6">
              <h2 className="text-base font-semibold text-accent mb-3">{t('agreement.section5Title')}</h2>
              <p className="text-white/90 mb-2">
                <span className="font-medium">5.1.</span> {t('agreement.section5_1')}
              </p>
              <p className="text-white/90">
                <span className="font-medium">5.2.</span> {t('agreement.section5_2')}
              </p>
            </div>

            {/* Section 6 */}
            <div className="mb-6">
              <h2 className="text-base font-semibold text-accent mb-3">{t('agreement.section6Title')}</h2>
              <p className="text-white/90 mb-2">
                <span className="font-medium">6.1.</span> {t('agreement.section6_1')}
              </p>
              <p className="text-white/90 mb-2">
                <span className="font-medium">6.2.</span> {t('agreement.section6_2')}
              </p>
              <p className="text-white/90">
                <span className="font-medium">6.3.</span> {t('agreement.section6_3')}
              </p>
            </div>

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
                {t('agreement.saving')}
              </>
            ) : (
              <>
                <Check className="w-5 h-5 mr-2" />
                {hasApiKey ? t('agreement.confirmAgreement') : t('agreement.continue')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}