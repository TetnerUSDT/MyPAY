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
  
  return (
    <div className="mobile-screen gradient-bg text-white">
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="text-center pt-8 pb-4">
          <h1 className="text-xl font-bold text-accent" data-testid="text-agreement-title">
            Соглашение об использовании услуг<br />обменного сервиса
          </h1>
        </div>
        
        {/* Scrollable Content */}
        <div className="flex-1 px-5 overflow-y-auto">
          <div className="text-sm leading-relaxed pb-8" data-testid="text-agreement-content">
            
            {/* Section 1 */}
            <div className="mb-6">
              <h2 className="text-base font-semibold text-accent mb-3">1. Общие положения</h2>
              <p className="text-white/90 mb-2">
                <span className="font-medium">1.1.</span> Настоящее соглашение (далее — Соглашение) регулирует порядок предоставления услуг обменного сервиса (далее — Сервис) по обмену электронных валют, криптовалют и иных платежных средств между пользователем (далее — Пользователь) и Сервисом.
              </p>
              <p className="text-white/90 mb-2">
                <span className="font-medium">1.2.</span> Использование услуг Сервиса означает полное и безоговорочное согласие Пользователя с условиями настоящего Соглашения.
              </p>
              <p className="text-white/90 mb-2">
                <span className="font-medium">1.3.</span> Сервис оставляет за собой право вносить изменения в Соглашение без предварительного уведомления Пользователя. Актуальная версия Соглашения доступна на сайте Сервиса.
              </p>
              <p className="text-white/90">
                <span className="font-medium">1.4.</span> Сервис предоставляет услуги только совершеннолетним лицам, имеющим право на осуществление финансовых операций в соответствии с законодательством их юрисдикции.
              </p>
            </div>

            {/* Section 2 */}
            <div className="mb-6">
              <h2 className="text-base font-semibold text-accent mb-3">2. Условия обмена</h2>
              <p className="text-white/90 mb-3">
                <span className="font-medium">2.1. Срок обработки заявки:</span> Обработка заявки на обмен осуществляется в срок от 5 до 300 минут с момента получения оплаты от Пользователя. В отдельных случаях, связанных с действиями банка или платежной системы, перевод может быть приостановлен до 72 часов. В таких случаях срок обработки заявки увеличивается, о чем Пользователь будет уведомлен.
              </p>
              <p className="text-white/90 mb-3">
                <span className="font-medium">2.2. Способ выплаты:</span> Выплаты производятся через Систему быстрых платежей (СБП). При необходимости выплата может быть разбита на несколько частей для соблюдения лимитов или требований платежной системы.
              </p>
              <p className="text-white/90 mb-3">
                <span className="font-medium">2.3. Контактные данные:</span> Пользователь обязан указывать актуальные и достоверные контактные данные при добавлении карт или иных платежных реквизитов. Сервис не несет ответственности за ошибки, связанные с предоставлением некорректных данных.
              </p>
              <p className="text-white/90 mb-3">
                <span className="font-medium">2.4. Подтверждение платежей:</span> Для подтверждения входящих платежей оператор Сервиса вправе запросить у Пользователя дополнительные документы, включая скриншоты, выписки или видеозаписи из истории личного кабинета банка. В случае непредоставления запрошенных подтверждений выплата по заявке будет приостановлена до выполнения данного требования.
              </p>
              <p className="text-white/90">
                <span className="font-medium">2.5. Банковское регулирование и риски:</span> В условиях ужесточения банковского регулирования участились случаи блокировки карт и счетов. Сервис применяет максимально безопасные процедуры для минимизации рисков, однако не контролирует действия банков и платежных систем и не несет ответственности за их решения, включая возможные блокировки или ограничения.
              </p>
            </div>

            {/* Section 3 */}
            <div className="mb-6">
              <h2 className="text-base font-semibold text-accent mb-3">3. Права и обязанности сторон</h2>
              <p className="text-white/90 mb-2">
                <span className="font-medium">3.1. Обязанности Пользователя:</span>
              </p>
              <ul className="text-white/90 mb-3 pl-4 space-y-1">
                <li>• Предоставлять достоверные данные при оформлении заявки на обмен.</li>
                <li>• Своевременно предоставлять запрошенные Сервисом документы для подтверждения платежей.</li>
                <li>• Соблюдать законодательство своей юрисдикции при использовании услуг Сервиса.</li>
              </ul>
              <p className="text-white/90 mb-2">
                <span className="font-medium">3.2. Обязанности Сервиса:</span>
              </p>
              <ul className="text-white/90 mb-3 pl-4 space-y-1">
                <li>• Обеспечивать обработку заявок в соответствии с условиями Соглашения.</li>
                <li>• Информировать Пользователя о статусе заявки и возможных задержках.</li>
                <li>• Соблюдать конфиденциальность данных Пользователя в соответствии с Политикой конфиденциальности.</li>
              </ul>
              <p className="text-white/90 mb-2">
                <span className="font-medium">3.3. Права Сервиса:</span>
              </p>
              <ul className="text-white/90 pl-4 space-y-1">
                <li>• Приостанавливать обработку заявки до получения необходимых подтверждений от Пользователя.</li>
                <li>• Отказать в предоставлении услуг в случае подозрения на нарушение законодательства или правил Сервиса.</li>
                <li>• Изменять комиссии и лимиты без предварительного уведомления, размещая актуальную информацию на сайте.</li>
              </ul>
            </div>

            {/* Section 4 */}
            <div className="mb-6">
              <h2 className="text-base font-semibold text-accent mb-3">4. Ответственность сторон</h2>
              <p className="text-white/90 mb-2">
                <span className="font-medium">4.1.</span> Сервис не несет ответственности за задержки, вызванные действиями банков, платежных систем или третьих лиц.
              </p>
              <p className="text-white/90 mb-2">
                <span className="font-medium">4.2.</span> Пользователь несет полную ответственность за предоставление некорректных данных, что может привести к невозможности выполнения обмена или возврата средств.
              </p>
              <p className="text-white/90 mb-2">
                <span className="font-medium">4.3.</span> Сервис не несет ответственности за убытки, возникшие в результате блокировки счетов или карт банком Пользователя.
              </p>
              <p className="text-white/90">
                <span className="font-medium">4.4.</span> В случае форс-мажорных обстоятельств (технические сбои, изменения законодательства и т.д.) Сервис вправе приостановить предоставление услуг до устранения таких обстоятельств.
              </p>
            </div>

            {/* Section 5 */}
            <div className="mb-6">
              <h2 className="text-base font-semibold text-accent mb-3">5. Политика возврата</h2>
              <p className="text-white/90 mb-2">
                <span className="font-medium">5.1.</span> Возврат средств возможен только в случае, если обмен не был выполнен по вине Сервиса и при наличии технической возможности возврата.
              </p>
              <p className="text-white/90 mb-2">
                <span className="font-medium">5.2.</span> Возврат осуществляется за вычетом комиссий платежных систем и операционных расходов Сервиса.
              </p>
              <p className="text-white/90">
                <span className="font-medium">5.3.</span> Заявки на возврат рассматриваются в течение 7 рабочих дней с момента их подачи.
              </p>
            </div>

            {/* Section 6 */}
            <div className="mb-6">
              <h2 className="text-base font-semibold text-accent mb-3">6. Конфиденциальность</h2>
              <p className="text-white/90 mb-2">
                <span className="font-medium">6.1.</span> Сервис обязуется не передавать персональные данные Пользователя третьим лицам, за исключением случаев, предусмотренных законодательством или настоящим Соглашением.
              </p>
              <p className="text-white/90">
                <span className="font-medium">6.2.</span> Пользователь соглашается на обработку предоставленных данных в целях выполнения обмена и обеспечения безопасности операций.
              </p>
            </div>

            {/* Section 7 */}
            <div className="mb-6">
              <h2 className="text-base font-semibold text-accent mb-3">7. Заключительные положения</h2>
              <p className="text-white/90 mb-2">
                <span className="font-medium">7.1.</span> Настоящее Соглашение вступает в силу с момента его принятия Пользователем и действует до полного выполнения сторонами своих обязательств.
              </p>
              <p className="text-white/90 mb-2">
                <span className="font-medium">7.2.</span> Все споры, связанные с использованием услуг Сервиса, разрешаются путем переговоров. В случае невозможности урегулирования споров они передаются в суд в соответствии с законодательством юрисдикции Сервиса.
              </p>
              <p className="text-white/90">
                <span className="font-medium">7.3.</span> Сервис не предоставляет консультаций по вопросам налогообложения или легальности операций. Пользователь самостоятельно несет ответственность за соблюдение налогового законодательства своей страны.
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