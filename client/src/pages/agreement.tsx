import { useLocation } from "wouter";
import { Check, Loader2 } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { User } from "@shared/schema";
import { useEffect } from "react";

export default function AgreementScreen() {
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
          <p>Загрузка...</p>
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
            Соглашение об использовании услуг<br />обменного сервиса криптовалюты
          </h1>
        </div>
        
        {/* Scrollable Content */}
        <div className="flex-1 px-5 overflow-y-auto">
          <div className="text-sm leading-relaxed pb-8" data-testid="text-agreement-content">
            
            {/* Section 1 */}
            <div className="mb-6">
              <h2 className="text-base font-semibold text-accent mb-3">1. Общие положения</h2>
              <p className="text-white/90 mb-2">
                <span className="font-medium">1.1.</span> Настоящее соглашение (далее — Соглашение) регулирует порядок предоставления услуг обменного сервиса (далее — Сервис) по обмену криптовалют и иных цифровых активов между пользователем (далее — Пользователь) и Сервисом.
              </p>
              <p className="text-white/90 mb-2">
                <span className="font-medium">1.2.</span> Использование услуг Сервиса означает полное и безоговорочное согласие Пользователя с условиями данного Соглашения.
              </p>
              <p className="text-white/90 mb-2">
                <span className="font-medium">1.3.</span> Сервис оставляет за собой право вносить изменения в Соглашение без предварительного уведомления. Актуальная версия публикуется на сайте Сервиса.
              </p>
              <p className="text-white/90">
                <span className="font-medium">1.4.</span> Услуги предоставляются только совершеннолетним лицам, имеющим право работать с цифровыми активами согласно законодательству своей юрисдикции.
              </p>
            </div>

            {/* Section 2 */}
            <div className="mb-6">
              <h2 className="text-base font-semibold text-accent mb-3">2. Условия обмена</h2>
              <p className="text-white/90 mb-3">
                <span className="font-medium">2.1. Срок обработки заявки:</span> Обработка заявки осуществляется в срок до 10 минут с момента получения криптовалюты от Пользователя.
              </p>
              <p className="text-white/90 mb-3">
                <span className="font-medium">2.2. Способ выплаты:</span> Выплата осуществляется исключительно в криптовалюте на адрес кошелька Пользователя.
              </p>
              <p className="text-white/90 mb-3">
                <span className="font-medium">2.3. Контактные данные:</span> Пользователь обязан указывать актуальные данные и корректные криптовалютные адреса. Сервис не несёт ответственности за ошибочно указанные адреса.
              </p>
              <p className="text-white/90 mb-3">
                <span className="font-medium">2.4. Подтверждение транзакций:</span> Для подтверждения входящей транзакции Сервис вправе запросить дополнительные материалы: хеш транзакции, скриншот отправки, видеофиксацию или другие сведения. Обработка заявки может быть приостановлена до получения подтверждений.
              </p>
              <p className="text-white/90">
                <span className="font-medium">2.5. Сетевые риски:</span> Сервис не контролирует работу блокчейн-сетей и не несёт ответственности за задержки подтверждений, перегруженность сети, повышенные комиссии или технические сбои.
              </p>
            </div>

            {/* Section 3 */}
            <div className="mb-6">
              <h2 className="text-base font-semibold text-accent mb-3">3. Права и обязанности сторон</h2>
              <p className="text-white/90 mb-2">
                <span className="font-medium">3.1. Обязанности Пользователя:</span>
              </p>
              <ul className="text-white/90 mb-3 pl-4 space-y-1">
                <li>• Указывать корректные данные и криптовалютные адреса.</li>
                <li>• Подтверждать отправку криптовалюты при запросе Сервиса.</li>
                <li>• Использовать Сервис в рамках законодательства своей страны.</li>
              </ul>
              <p className="text-white/90 mb-2">
                <span className="font-medium">3.2. Обязанности Сервиса:</span>
              </p>
              <ul className="text-white/90 mb-3 pl-4 space-y-1">
                <li>• Корректно выполнять обмен согласно заявке Пользователя.</li>
                <li>• Информировать о статусе заявки и задержках.</li>
                <li>• Обеспечивать конфиденциальность данных.</li>
              </ul>
              <p className="text-white/90 mb-2">
                <span className="font-medium">3.3. Права Сервиса:</span>
              </p>
              <ul className="text-white/90 pl-4 space-y-1">
                <li>• Приостанавливать обработку заявки до предоставления подтверждений.</li>
                <li>• Отказать в обслуживании при подозрении на нарушение правил или законодательства.</li>
                <li>• Изменять условия работы, размещая актуальную информацию на сайте.</li>
              </ul>
            </div>

            {/* Section 4 */}
            <div className="mb-6">
              <h2 className="text-base font-semibold text-accent mb-3">4. Ответственность сторон</h2>
              <p className="text-white/90 mb-2">
                <span className="font-medium">4.1.</span> Сервис не несёт ответственности за задержки, вызванные блокчейн-сетями, форками, перегрузками или техническими сбоями.
              </p>
              <p className="text-white/90 mb-2">
                <span className="font-medium">4.2.</span> Пользователь несёт полную ответственность за корректность предоставленных адресов.
              </p>
              <p className="text-white/90 mb-2">
                <span className="font-medium">4.3.</span> Сервис не возвращает криптовалюту, отправленную на неверный адрес по вине Пользователя.
              </p>
              <p className="text-white/90">
                <span className="font-medium">4.4.</span> В случае форс-мажора Сервис вправе временно приостановить работу.
              </p>
            </div>

            {/* Section 5 */}
            <div className="mb-6">
              <h2 className="text-base font-semibold text-accent mb-3">5. Конфиденциальность</h2>
              <p className="text-white/90 mb-2">
                <span className="font-medium">5.1.</span> Сервис не передаёт личную информацию третьим лицам, кроме случаев, предусмотренных законом.
              </p>
              <p className="text-white/90">
                <span className="font-medium">5.2.</span> Пользователь соглашается на обработку данных для выполнения обмена и обеспечения безопасности.
              </p>
            </div>

            {/* Section 6 */}
            <div className="mb-6">
              <h2 className="text-base font-semibold text-accent mb-3">6. Заключительные положения</h2>
              <p className="text-white/90 mb-2">
                <span className="font-medium">6.1.</span> Соглашение вступает в силу с момента принятия Пользователем.
              </p>
              <p className="text-white/90 mb-2">
                <span className="font-medium">6.2.</span> Споры решаются путем переговоров, а при невозможности — в соответствии с законодательством юрисдикции Сервиса.
              </p>
              <p className="text-white/90">
                <span className="font-medium">6.3.</span> Сервис не предоставляет налоговых или юридических консультаций. Пользователь самостоятельно отвечает за свои обязательства.
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