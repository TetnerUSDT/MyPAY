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
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 48 48">
            <g fill="#fff">
              <path d="M46 24c0-12.15-9.85-22-22-22S2 11.85 2 24c0 4.05 1.09 7.85 3 11.1V33c0-1.12.37-2.15.98-2.98C5.34 28.13 5 26.1 5 24 5 13.51 13.51 5 24 5s19 8.51 19 19c0 2.1-.34 4.13-.98 6.02.61.83.98 1.86.98 2.98v2.1c1.91-3.25 3-7.05 3-11.1"/>
              <path d="M38 24c0-.55.45-1 1-1h1.95c-.14-2.37-.77-4.59-1.78-6.6l-.81.47c-.48.27-1.09.11-1.37-.37s-.11-1.09.37-1.37l.81-.47a17.1 17.1 0 0 0-4.83-4.83l-.47.81c-.28.48-.89.65-1.37.37s-.64-.89-.37-1.37l.47-.81A16.9 16.9 0 0 0 25 7.05V9c0 .55-.45 1-1 1s-1-.45-1-1V7.05c-2.37.14-4.59.77-6.6 1.78l.47.81c.27.48.11 1.09-.37 1.37s-1.09.11-1.37-.37l-.47-.81a17.1 17.1 0 0 0-4.83 4.83l.81.47c.48.28.65.89.37 1.37s-.89.64-1.37.37l-.81-.47A16.9 16.9 0 0 0 7.05 23H9c.55 0 1 .45 1 1s-.45 1-1 1H7.05c.07 1.24.28 2.43.6 3.58.7-.37 1.5-.58 2.35-.58h28c.85 0 1.65.21 2.35.58.32-1.15.53-2.34.6-3.58H39c-.55 0-1-.45-1-1m-14 2c-.74 0-1.38-.4-1.72-1H16c-.55 0-1-.45-1-1s.45-1 1-1h6.28c.17-.3.42-.55.72-.72V14c0-.55.45-1 1-1s1 .45 1 1v8.28c.6.34 1 .98 1 1.72 0 1.1-.9 2-2 2m14 4H10a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h28a3 3 0 0 0 3-3V33a3 3 0 0 0-3-3m-22 7c0 1.103-.897 2-2 2h-2v2h3a1 1 0 0 1 0 2h-3c-1.103 0-2-.897-2-2v-2c0-1.103.897-2 2-2h2v-2h-3a1 1 0 0 1 0-2h3c1.103 0 2 .897 2 2zm8 5a1 1 0 0 1-2 0v-3h-2c-1.103 0-2-.897-2-2v-3a1 1 0 0 1 2 0v3h2v-3a1 1 0 0 1 2 0zm3.98 1.196a1 1 0 0 1-1.176.784 1 1 0 0 1-.784-1.177l2-10a1 1 0 0 1 1.177-.784 1 1 0 0 1 .784 1.177l-2 10zm9.449-7.494-2.493 6.649a1 1 0 0 1-1.288.585 1 1 0 0 1-.585-1.288l2.493-6.649h-2.557a1 1 0 0 1 0-2h2.557a2 2 0 0 1 1.873 2.702z"/>
            </g>
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
