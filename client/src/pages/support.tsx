import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Clock, Send, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest, queryClient } from "@/lib/queryClient";
import supportAvatar from "@assets/support_1759681481551.jpg";

interface Message {
  id: number;
  ticketId: number;
  sender: "user" | "support";
  message: string;
  createdAt: string;
}

interface Ticket {
  id: number;
  userId: number;
  exchangeId: number;
  exchangeNumber: string;
  status: "wait-user" | "wait-support" | "closed";
  createdAt: string;
  updatedAt: string;
}

export default function SupportScreen() {
  const { toast } = useToast();
  const [isDisputeModalOpen, setIsDisputeModalOpen] = useState(false);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [ticketNumber, setTicketNumber] = useState("");
  const [disputeMessage, setDisputeMessage] = useState("");
  const [chatMessage, setChatMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch user data for avatar
  const { data: user } = useQuery<{ img: string | null }>({
    queryKey: ["/api/auth/me"],
  });

  // Fetch open ticket
  const { data: ticket, isLoading: ticketLoading } = useQuery<Ticket>({
    queryKey: ["/api/support/tickets/open"],
    retry: false,
  });

  // Fetch messages for open ticket
  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ["/api/support/tickets", ticket?.id, "messages"],
    enabled: !!ticket?.id,
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Create ticket mutation
  const createTicketMutation = useMutation({
    mutationFn: async (data: { exchangeNumber: string; message: string }) => {
      const res = await apiRequest("POST", "/api/support/tickets", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Тикет создан",
        description: "Ваш тикет был успешно создан. Поддержка ответит в ближайшее время.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets/open"] });
      setTicketNumber("");
      setDisputeMessage("");
      setIsDisputeModalOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось создать тикет",
        variant: "destructive",
      });
    },
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (data: { ticketId: number; message: string }) => {
      const res = await apiRequest("POST", `/api/support/tickets/${data.ticketId}/messages`, { message: data.message });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets", ticket?.id, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets/open"] });
      setChatMessage("");
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось отправить сообщение",
        variant: "destructive",
      });
    },
  });

  const handleOpenDispute = () => {
    if (!ticketNumber.trim() || !disputeMessage.trim()) {
      toast({
        title: "Ошибка",
        description: "Заполните все поля",
        variant: "destructive",
      });
      return;
    }

    createTicketMutation.mutate({
      exchangeNumber: ticketNumber,
      message: disputeMessage,
    });
  };

  const handleSendMessage = () => {
    if (!chatMessage.trim() || !ticket) {
      return;
    }

    sendMessageMutation.mutate({
      ticketId: ticket.id,
      message: chatMessage,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "wait-user":
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-400/20 text-yellow-400">
            Ожидает вашего ответа
          </span>
        );
      case "wait-support":
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-400/20 text-white">
            Ожидает ответа
          </span>
        );
      default:
        return null;
    }
  };

  const getUserAvatar = () => {
    if (user?.img) {
      return user.img;
    }
    // Cat placeholder
    return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='512' height='512' viewBox='0 0 512 512'%3E%3Cg fill='%2313b601'%3E%3Cpath d='M496.52 129.86C483.09 80.38 431.63 28.92 382.15 15.49 351.82 7.92 311.17.13 256 0c-55.16.14-95.81 7.92-126.14 15.49C80.38 28.93 28.92 80.38 15.49 129.86 7.92 160.19.14 200.84 0 256c.14 55.17 7.92 95.82 15.49 126.15 13.43 49.48 64.89 100.93 114.37 114.37 30.33 7.57 71 15.35 126.14 15.49 55.17-.14 95.82-7.92 126.15-15.49 49.48-13.44 100.94-64.89 114.37-114.37 7.57-30.33 15.35-71 15.49-126.15-.14-55.16-7.92-95.81-15.49-126.14'/%3E%3C/g%3E%3C/svg%3E";
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
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 48 48" xmlSpace="preserve">
            <path fill="#000" d="M46 24c0-12.15-9.85-22-22-22S2 11.85 2 24c0 4.05 1.09 7.85 3 11.1V33c0-1.12.37-2.15.98-2.98C5.34 28.13 5 26.1 5 24 5 13.51 13.51 5 24 5s19 8.51 19 19c0 2.1-.34 4.13-.98 6.02.61.83.98 1.86.98 2.98v2.1c1.91-3.25 3-7.05 3-11.1" data-original="#000000"/>
            <path fill="#000" d="M38 24c0-.55.45-1 1-1h1.95c-.14-2.37-.77-4.59-1.78-6.6l-.81.47c-.48.27-1.09.11-1.37-.37s-.11-1.09.37-1.37l.81-.47a17.1 17.1 0 0 0-4.83-4.83l-.47.81c-.28.48-.89.65-1.37.37s-.64-.89-.37-1.37l.47-.81A16.9 16.9 0 0 0 25 7.05V9c0 .55-.45 1-1 1s-1-.45-1-1V7.05c-2.37.14-4.59.77-6.6 1.78l.47.81c.27.48.11 1.09-.37 1.37s-1.09.11-1.37-.37l-.47-.81a17.1 17.1 0 0 0-4.83 4.83l.81.47c.48.28.65.89.37 1.37s-.89.64-1.37.37l-.81-.47A16.9 16.9 0 0 0 7.05 23H9c.55 0 1 .45 1 1s-.45 1-1 1H7.05c.07 1.24.28 2.43.6 3.58.7-.37 1.5-.58 2.35-.58h28c.85 0 1.65.21 2.35.58.32-1.15.53-2.34.6-3.58H39c-.55 0-1-.45-1-1m-14 2c-.74 0-1.38-.4-1.72-1H16c-.55 0-1-.45-1-1s.45-1 1-1h6.28c.17-.3.42-.55.72-.72V14c0-.55.45-1 1-1s1 .45 1 1v8.28c.6.34 1 .98 1 1.72 0 1.1-.9 2-2 2m14 4H10a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h28a3 3 0 0 0 3-3V33a3 3 0 0 0-3-3m-22 7c0 1.103-.897 2-2 2h-2v2h3a1 1 0 0 1 0 2h-3c-1.103 0-2-.897-2-2v-2c0-1.103.897-2 2-2h2v-2h-3a1 1 0 0 1 0-2h3c1.103 0 2 .897 2 2zm8 5a1 1 0 0 1-2 0v-3h-2c-1.103 0-2-.897-2-2v-3a1 1 0 0 1 2 0v3h2v-3a1 1 0 0 1 2 0zm3.98 1.196a1 1 0 0 1-1.176.784 1 1 0 0 1-.784-1.177l2-10a1 1 0 0 1 1.177-.784 1 1 0 0 1 .784 1.177l-2 10zm9.449-7.494-2.493 6.649a1 1 0 0 1-1.288.585 1 1 0 0 1-.585-1.288l2.493-6.649h-2.557a1 1 0 0 1 0-2h2.557a2 2 0 0 1 1.873 2.702z" data-original="#000000"/>
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
              <img 
                src={supportAvatar} 
                alt="Support" 
                className="w-full h-full rounded-full object-cover"
              />
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
            href="https://t.me/swiftx11" 
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
      
      {/* Open Ticket Widget */}
      {ticket && (
        <div className="px-6 mt-6">
          <div 
            className="crypto-card cursor-pointer hover:bg-secondary/80 transition-colors"
            onClick={() => setIsChatModalOpen(true)}
            data-testid="widget-open-ticket"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Открытый тикет</h3>
              {getStatusBadge(ticket.status)}
            </div>
            <div className="text-sm text-muted-foreground mb-2">
              Заявка: <span className="font-mono text-accent">{ticket.exchangeNumber}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Кликните чтобы открыть чат
            </div>
          </div>
        </div>
      )}
      
      {/* Actions */}
      <div className="px-6 pb-20 mt-6">
        {/* Create Dispute Modal */}
        <Dialog open={isDisputeModalOpen} onOpenChange={setIsDisputeModalOpen}>
          <DialogTrigger asChild>
            <button 
              className="action-button mb-4"
              data-testid="button-open-dispute"
              disabled={!!ticket}
            >
              {ticket ? "У вас уже есть открытый тикет" : "Открыть спор"}
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
                  disabled={createTicketMutation.isPending}
                >
                  {createTicketMutation.isPending ? "Создание..." : "Открыть спор"}
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Chat Modal */}
        <Dialog open={isChatModalOpen} onOpenChange={setIsChatModalOpen}>
          <DialogContent className="mobile-screen bg-secondary border-none text-white max-h-[90vh] flex flex-col p-0">
            {/* Header */}
            <DialogHeader className="px-6 py-4 border-b border-white/10">
              <DialogTitle className="text-white text-lg">
                Тикет #{ticket?.exchangeNumber}
              </DialogTitle>
              <div className="mt-2">
                {ticket && getStatusBadge(ticket.status)}
              </div>
            </DialogHeader>

            {/* Messages */}
            <ScrollArea className="flex-1 px-6 py-4">
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender === "user" ? "justify-start" : "justify-end"}`}
                    data-testid={`message-${msg.sender}-${msg.id}`}
                  >
                    <div className={`flex items-start space-x-3 max-w-[80%] ${msg.sender === "support" ? "flex-row-reverse space-x-reverse" : ""}`}>
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                        {msg.sender === "user" ? (
                          <img 
                            src={getUserAvatar()} 
                            alt="User" 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <img 
                            src={supportAvatar} 
                            alt="Support" 
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      
                      {/* Message bubble */}
                      <div className={`rounded-lg px-4 py-3 border ${msg.sender === "user" ? "bg-accent/10 border-accent/30" : "bg-white/5 border-white/10"}`}>
                        <p className="text-sm text-white">{msg.message}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(msg.createdAt).toLocaleTimeString("ru-RU", { 
                            hour: "2-digit", 
                            minute: "2-digit" 
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="px-6 py-4 border-t border-white/10">
              <div className="flex items-center space-x-3">
                <Input
                  placeholder="Введите сообщение..."
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className="input-field flex-1"
                  data-testid="input-chat-message"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!chatMessage.trim() || sendMessageMutation.isPending}
                  className="w-12 h-12 bg-accent hover:bg-accent/80 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg flex items-center justify-center transition-colors"
                  data-testid="button-send-message"
                >
                  <Send className="w-5 h-5 text-accent-foreground" />
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
