import { Link } from "wouter";
import { Check } from "lucide-react";

export default function AgreementScreen() {
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
          <Link href="/home" className="w-full">
            <button 
              className="action-button"
              data-testid="button-confirm-agreement"
            >
              <Check className="w-5 h-5 mr-2" />
              Подтвердить согласие
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}