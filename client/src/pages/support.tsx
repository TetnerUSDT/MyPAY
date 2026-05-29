import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { ChevronLeft, Clock, Send, MessageCircle, Headphones, AlertCircle, MessageSquare, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest, queryClient } from "@/lib/queryClient";
import BottomNavigation from "@/components/bottom-navigation";
import { useTranslation } from "react-i18next";

// Images from public directory - use direct URLs
const supportAvatar = "/uploads/support/avatar.jpg";
const catImage = "/uploads/icons/cat-logo.png";

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
  const { t } = useTranslation();
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
        title: t('support.ticketCreated'),
        description: t('support.ticketCreatedDesc'),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets/open"] });
      setTicketNumber("");
      setDisputeMessage("");
      setIsDisputeModalOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || t('support.ticketCreateError'),
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
        title: t('common.error'),
        description: error.message || t('support.sendMessageError'),
        variant: "destructive",
      });
    },
  });

  const handleOpenDispute = () => {
    if (!ticketNumber.trim() || !disputeMessage.trim()) {
      toast({
        title: t('common.error'),
        description: t('common.fillAllFields'),
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
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-yellow-400/20 text-yellow-400">
            {t('support.waitingYourResponse')}
          </span>
        );
      case "wait-support":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-400/20 text-blue-400">
            {t('support.waitingSupport')}
          </span>
        );
      case "closed":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/10 text-white/40">
            {t('support.closed', 'Closed')}
          </span>
        );
      default:
        return null;
    }
  };

  const getUserAvatar = () => {
    return user?.img || catImage;
  };

  return (
    <div className="min-h-screen bg-[#0B0C10] text-[#E2E8F0] pb-28 font-sans selection:bg-[#3ab368]/30 selection:text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-6 pb-4">
        <Link href="/home">
          <button className="w-10 h-10 rounded-full bg-white/5 border border-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
            <ChevronLeft className="w-5 h-5 text-white/70" />
          </button>
        </Link>
        <h1 className="text-[17px] font-semibold tracking-tight text-white">{t('support.title')}</h1>
        <div className="w-10 h-10" />
      </div>

      <div className="space-y-4 mt-2">
        {/* Support Agent Card */}
        <div className="bg-[#13151A] rounded-3xl border border-white/5 p-5 mx-5 shadow-2xl shadow-black/40">
          <div className="flex items-start space-x-4 mb-5">
            <div className="relative">
              <div className="w-14 h-14 rounded-full overflow-hidden border border-white/10">
                <img 
                  src={supportAvatar} 
                  alt="Support" 
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#3ab368] border-2 border-[#13151A] rounded-full"></div>
            </div>
            <div className="flex-1 pt-1">
              <div className="font-semibold text-white tracking-tight">Elena from support</div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#3ab368] mt-0.5 flex items-center">
                <Clock className="w-3 h-3 mr-1" />
                Response time: ~1 min
              </div>
              <div className="text-sm text-white/70 mt-1">Hi there! How can I help?</div>
            </div>
          </div>
          
          {/* Telegram Contact Button */}
          <a href="https://t.me/swiftx11" target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-between w-full bg-[#3ab368] hover:bg-[#3ab368]/90 text-[#0B0C10] font-semibold py-3.5 px-5 rounded-2xl transition-all shadow-lg shadow-[#3ab368]/20 active:scale-[0.98]"
            data-testid="button-telegram-support">
            <span>{t('support.contactSupport')}</span>
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="24" 
              height="24" 
              viewBox="0 0 24 24" 
            >
              <circle cx="12" cy="12" r="12" fill="#039be5" />
              <path 
                fill="#fff" 
                d="m5.491 11.74 11.57-4.461c.537-.194 1.006.131.832.943l.001-.001-1.97 9.281c-.146.658-.537.818-1.084.508l-3-2.211-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.121l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953" 
              />
            </svg>
          </a>
        </div>

        {/* Open Ticket Widget */}
        {ticket && (
          <div className="mx-5">
            <div 
              className="bg-[#13151A] rounded-3xl border border-white/5 p-5 shadow-2xl shadow-black/40 cursor-pointer hover:bg-[#1A1D24] transition-colors"
              onClick={() => setIsChatModalOpen(true)}
              data-testid="widget-open-ticket"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-medium text-sm tracking-tight flex items-center">
                  <MessageSquare className="w-4 h-4 mr-2 text-[#3ab368]" />
                  {t('support.openTicket')}
                </h3>
                {getStatusBadge(ticket.status)}
              </div>
              <div className="text-xs text-white/40 mb-1 font-medium">
                {t('support.ticketNumber')}: <span className="font-mono text-white/90">{ticket.exchangeNumber}</span>
              </div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#3ab368] mt-2">
                {t('support.clickToOpenChat')}
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mx-5">
          <Dialog open={isDisputeModalOpen} onOpenChange={setIsDisputeModalOpen}>
            <DialogTrigger asChild>
              <button 
                className="w-full flex items-center justify-between bg-[#1A1D24] border border-white/5 rounded-2xl p-4 hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
                data-testid="button-open-dispute"
                disabled={!!ticket}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                    <AlertCircle className="w-4 h-4 text-white/70" />
                  </div>
                  <span className="text-sm font-medium text-white tracking-tight">
                    {ticket ? t('support.haveOpenTicket') : t('support.openDispute')}
                  </span>
                </div>
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md bg-[#13151A] border-white/10 rounded-3xl text-white">
              <DialogHeader>
                <DialogTitle className="text-white tracking-tight">{t('support.disputeTitle')}</DialogTitle>
                <DialogDescription className="text-white/40 text-xs">
                  {t('support.disputeDesc')}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 mt-2">
                {/* Ticket Number */}
                <div>
                  <Label htmlFor="ticket-number" className="text-[11px] font-bold uppercase tracking-wider text-white/40 mb-2 block">
                    {t('support.ticketNumber')}
                  </Label>
                  <Input
                    id="ticket-number"
                    placeholder={t('support.enterTicketNumber')}
                    value={ticketNumber}
                    onChange={(e) => setTicketNumber(e.target.value)}
                    className="bg-[#1A1D24] border-white/5 rounded-xl text-white placeholder-white/20 focus-visible:ring-1 focus-visible:ring-[#3ab368]"
                    data-testid="input-ticket-number"
                  />
                </div>

                {/* Dispute Message */}
                <div>
                  <Label htmlFor="dispute-message" className="text-[11px] font-bold uppercase tracking-wider text-white/40 mb-2 block">
                    {t('support.message')}
                  </Label>
                  <Textarea
                    id="dispute-message"
                    placeholder={t('support.describeIssue')}
                    value={disputeMessage}
                    onChange={(e) => setDisputeMessage(e.target.value)}
                    className="bg-[#1A1D24] border-white/5 rounded-xl text-white placeholder-white/20 focus-visible:ring-1 focus-visible:ring-[#3ab368] resize-none"
                    rows={4}
                    data-testid="textarea-dispute-message"
                  />
                </div>

                {/* Submit Button */}
                <button 
                  onClick={handleOpenDispute}
                  className="w-full bg-[#3ab368] hover:bg-[#3ab368]/90 text-[#0B0C10] font-semibold py-3 px-5 rounded-xl transition-all shadow-lg shadow-[#3ab368]/20 disabled:opacity-50 mt-2"
                  data-testid="button-submit-dispute"
                  disabled={createTicketMutation.isPending}
                >
                  {createTicketMutation.isPending ? t('common.creating') : t('support.openDispute')}
                </button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Chat Modal — full screen */}
        <Dialog open={isChatModalOpen} onOpenChange={setIsChatModalOpen}>
          <DialogContent className="fixed inset-0 w-full h-full max-w-none max-h-none rounded-none bg-[#0B0C10] border-0 p-0 flex flex-col text-[#E2E8F0] translate-x-0 translate-y-0 data-[state=open]:animate-none">
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-6 pb-4 border-b border-white/5 shrink-0">
              {/* Left: Ticket label + number (two lines) */}
              <div className="flex flex-col justify-center">
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/35 leading-none mb-1">
                  Ticket
                </span>
                <span className="text-[15px] font-bold font-mono text-white tracking-tight leading-none">
                  #{ticket?.exchangeNumber}
                </span>
              </div>

              {/* Right: status badge + close */}
              <div className="flex items-center gap-3">
                {ticket && getStatusBadge(ticket.status)}
                <button
                  onClick={() => setIsChatModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/5 border border-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4 text-white/50" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 px-5 py-4">
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                    data-testid={`message-${msg.sender}-${msg.id}`}
                  >
                    <div className={`flex items-end gap-2 max-w-[80%] ${msg.sender === "user" ? "flex-row-reverse" : ""}`}>
                      <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 border border-white/10">
                        {msg.sender === "user" ? (
                          <img src={getUserAvatar()} alt="User" className="w-full h-full object-cover" />
                        ) : (
                          <img src={supportAvatar} alt="Support" className="w-full h-full object-cover" />
                        )}
                      </div>
                      <div className={`rounded-2xl px-4 py-2.5 ${msg.sender === "user" ? "bg-[#3ab368]/10 border border-[#3ab368]/20 rounded-br-sm" : "bg-[#13151A] border border-white/5 rounded-bl-sm"}`}>
                        <p className="text-sm text-white">{msg.message}</p>
                        <p className={`text-[10px] mt-1 text-right ${msg.sender === "user" ? "text-[#3ab368]/60" : "text-white/30"}`}>
                          {new Date(msg.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-4 border-t border-white/5 shrink-0 bg-[#0B0C10]">
              <div className="flex items-center gap-2 bg-[#13151A] border border-white/5 rounded-2xl p-1.5 pr-2">
                <Input
                  placeholder={t('support.typeMessage')}
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className="bg-transparent border-0 focus-visible:ring-0 text-white placeholder:text-white/25 h-10 px-3 text-sm"
                  data-testid="input-chat-message"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!chatMessage.trim() || sendMessageMutation.isPending}
                  className="w-9 h-9 bg-[#3ab368] hover:bg-[#3ab368]/90 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl flex items-center justify-center transition-all flex-shrink-0 shadow-lg shadow-[#3ab368]/20"
                  data-testid="button-send-message"
                >
                  <Send className="w-4 h-4 text-[#0B0C10]" />
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
}
