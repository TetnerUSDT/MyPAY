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
        
        {/* Sad Face Icon */}
        <div className="w-20 h-20 bg-accent rounded-full flex items-center justify-center mx-auto mb-6">
          <svg 
            className="w-10 h-10 text-accent-foreground" 
            fill="currentColor" 
            viewBox="0 0 24 24"
          >
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-3.5 6L10 6.5 8.5 8 10 9.5 8.5 11 10 9.5 11.5 11 10 9.5 11.5 8 10 6.5 8.5 8zm7 0L17 6.5 15.5 8 17 9.5 15.5 11 17 9.5 18.5 11 17 9.5 18.5 8 17 6.5 15.5 8zm-6 7c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
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
