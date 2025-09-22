import { useState } from "react";
import { Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default function SupportScreen() {
  const { toast } = useToast();
  const [isDisputeModalOpen, setIsDisputeModalOpen] = useState(false);
  const [ticketNumber, setTicketNumber] = useState("");
  const [disputeMessage, setDisputeMessage] = useState("");

  const handleOpenDispute = () => {
    if (!ticketNumber.trim() || !disputeMessage.trim()) {
      toast({
        title: "Ошибка",
        description: "Заполните все поля",
        variant: "destructive",
      });
      return;
    }

    // Here you would send the dispute to your API
    toast({
      title: "Спор открыт",
      description: "Ваш спор был отправлен в службу поддержки. С вами свяжутся в течение 24 часов.",
    });
    
    // Reset form and close modal
    setTicketNumber("");
    setDisputeMessage("");
    setIsDisputeModalOpen(false);
  };

  return (
    <div className="mobile-screen text-white">
      {/* Header */}
      <div className="text-center py-8">
        <h1 className="text-2xl font-bold mb-4" data-testid="text-title">
          Вы не получили средства?
        </h1>
        
        {/* Support Icon */}
        <div className="w-20 h-20 bg-accent rounded-full flex items-center justify-center mx-auto mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 510 510" className="text-accent-foreground" fill="currentColor">
            <path d="M58.297 293.05a12.2 12.2 0 0 1 1.157 5.206v45.123c0 6.772-5.498 12.27-12.269 12.27-6.772 0-12.27-5.498-12.27-12.27v-45.123c0-5.526 3.66-10.203 8.687-11.738 12.237-35.913 46.276-61.774 86.308-61.774s74.072 25.861 86.309 61.774c5.026 1.535 8.687 6.212 8.687 11.738v45.123c0 6.772-5.498 12.27-12.27 12.27s-12.27-5.498-12.27-12.27v-45.123c0-1.861.415-3.625 1.158-5.206-9.679-30.321-38.099-52.306-71.614-52.306-33.514 0-61.934 21.985-71.613 52.306M93.566 63.546V28.298c0-8.687 7.111-15.798 15.798-15.798h331.202c8.687 0 15.778 7.111 15.778 15.798v35.248zm42.937-13.645c5.08 0 9.226-4.125 9.226-9.205 0-5.079-4.146-9.226-9.226-9.226-5.079 0-9.226 4.147-9.226 9.226s4.147 9.205 9.226 9.205m35.411 0c5.08 0 9.206-4.125 9.206-9.205 0-5.079-4.126-9.226-9.206-9.226s-9.226 4.147-9.226 9.226 4.147 9.205 9.226 9.205m35.391 0c5.079 0 9.226-4.125 9.226-9.205 0-5.079-4.147-9.226-9.226-9.226s-9.226 4.147-9.226 9.226 4.146 9.205 9.226 9.205m249.039 29.645V262.43H330.492c-19.665 0-35.71 16.045-35.71 35.71v3.226h-53.876v-3.11c0-9.471-4.667-17.861-11.826-22.992-16.021-39.015-54.409-66.52-99.17-66.52-12.755 0-24.993 2.234-36.344 6.331V79.546zm-68.748 131.891v-89.552c0-14.25-11.628-25.878-25.878-25.878H230.866c-14.251 0-25.878 11.628-25.878 25.878v89.552c0 14.254 11.624 25.851 25.878 25.851h7.119v19.39a11.63 11.63 0 0 0 20.014 8.056l26.366-27.446h77.353c14.254 0 25.878-11.597 25.878-25.851m-133.611 34.38v-16.529a8 8 0 0 0-8-8h-15.119c-5.436 0-9.878-4.415-9.878-9.851v-89.552c0-5.439 4.438-9.878 9.878-9.878h130.852c5.439 0 9.878 4.439 9.878 9.878v89.552c0 5.436-4.442 9.851-9.878 9.851h-80.762c-2.177 0-4.26.887-5.769 2.458zm-1.822-96.261c-7.803 0-14.138 6.335-14.138 14.138s6.335 14.138 14.138 14.138 14.138-6.335 14.138-14.138-6.335-14.138-14.138-14.138m44.129 0c-7.803 0-14.138 6.335-14.138 14.138s6.335 14.138 14.138 14.138 14.138-6.335 14.138-14.138-6.335-14.138-14.138-14.138" />
          </svg>
        </div>
        
        <p className="text-sm text-muted-foreground px-6">
          Если вы уверены что средства на вашу карту не поступили, задайте вопрос консультанту если не поможет, откройте спор
        </p>
      </div>
      
      {/* Chat Interface */}
      <div className="flex-1 px-6">
        <div className="chat-bubble">
          <div className="flex items-start space-x-3">
            <div className="avatar">
              <div className="w-full h-full bg-gradient-accent rounded-full flex items-center justify-center">
                <span className="text-accent-foreground font-semibold text-sm">E</span>
              </div>
            </div>
            <div className="flex-1">
              <div className="mb-1">
                <span className="font-semibold text-gray-800">Elena from support</span>
                <div className="flex items-center text-xs text-gray-500 mt-1">
                  <Clock className="w-3 h-3 mr-1" />
                  Response time: 1 min.
                </div>
              </div>
              <div className="text-gray-800">Hi there! How can I help?</div>
            </div>
          </div>
        </div>
        
        {/* Telegram Bot Button */}
        <div className="mt-4">
          <a 
            href="https://t.me/support_swiftx" 
            target="_blank" 
            rel="noopener noreferrer"
            className="action-button flex items-center justify-between animate-vibrate"
            data-testid="button-telegram-support"
          >
            <span className="font-medium">Обратиться за помощью</span>
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="24" 
              height="24" 
              viewBox="0 0 24 24" 
              className="ml-2"
            >
              <circle cx="12" cy="12" r="12" fill="#039be5" />
              <path 
                fill="#fff" 
                d="m5.491 11.74 11.57-4.461c.537-.194 1.006.131.832.943l.001-.001-1.97 9.281c-.146.658-.537.818-1.084.508l-3-2.211-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.121l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953" 
              />
            </svg>
          </a>
        </div>
      </div>
      
      {/* Actions */}
      <div className="px-6 pb-20">
        <Dialog open={isDisputeModalOpen} onOpenChange={setIsDisputeModalOpen}>
          <DialogTrigger asChild>
            <button 
              className="action-button mb-4"
              data-testid="button-open-dispute"
            >
              Открыть спор
            </button>
          </DialogTrigger>
          <DialogContent className="mobile-screen bg-secondary border-none text-white">
            <DialogHeader>
              <DialogTitle className="text-white">Открыть спор</DialogTitle>
              <DialogDescription className="text-gray-300">
                Заполните форму для открытия спора по вашей заявке
              </DialogDescription>
            </DialogHeader>
            
            <div className="crypto-card mt-4">
              <div className="space-y-4">
                {/* Ticket Number */}
                <div>
                  <Label htmlFor="ticket-number" className="text-white mb-2 block">
                    Номер заявки
                  </Label>
                  <Input
                    id="ticket-number"
                    placeholder="Введите номер заявки"
                    value={ticketNumber}
                    onChange={(e) => setTicketNumber(e.target.value)}
                    className="input-field"
                    data-testid="input-ticket-number"
                  />
                </div>

                {/* Dispute Message */}
                <div>
                  <Label htmlFor="dispute-message" className="text-white mb-2 block">
                    Сообщение
                  </Label>
                  <Textarea
                    id="dispute-message"
                    placeholder="Опишите вашу проблему..."
                    value={disputeMessage}
                    onChange={(e) => setDisputeMessage(e.target.value)}
                    className="input-field"
                    rows={4}
                    data-testid="textarea-dispute-message"
                  />
                </div>

                {/* Submit Button */}
                <button 
                  onClick={handleOpenDispute}
                  className="action-button mt-6"
                  data-testid="button-submit-dispute"
                >
                  Открыть спор
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
