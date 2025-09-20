import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Send, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function SupportScreen() {
  const [message, setMessage] = useState("");
  const [chatId] = useState("demo-chat-1");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const sendMessageMutation = useMutation({
    mutationFn: async (data: { sender: string; message: string }) => {
      const response = await apiRequest("POST", `/api/support/chats/${chatId}/messages`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/chats"] });
      setMessage("");
      toast({
        title: "Message sent",
        description: "Your message has been sent to support",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      sendMessageMutation.mutate({
        sender: "user",
        message: message.trim(),
      });
    }
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
          Если вы уверены что средства на вашу карту задайте вопрос консультанту если не поможет, откройте спор
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
              <div className="flex items-center mb-1">
                <span className="font-semibold text-gray-800">Elena from support</span>
                <div className="flex items-center ml-2 text-xs text-gray-500">
                  <Clock className="w-3 h-3 mr-1" />
                  Response time: 1 min.
                </div>
              </div>
              <div className="text-gray-800">Hi there! How can I help?</div>
            </div>
          </div>
        </div>
        
        {/* Chat Input */}
        <div className="mt-4">
          <form onSubmit={handleSendMessage}>
            <div className="flex items-center bg-white rounded-full p-2">
              <input 
                type="text" 
                placeholder="Type your own question..." 
                className="flex-1 px-4 py-2 text-gray-800 placeholder-gray-500 bg-transparent outline-none"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                data-testid="input-chat-message"
              />
              <button 
                type="submit"
                className="w-10 h-10 bg-accent rounded-full flex items-center justify-center ml-2 disabled:opacity-50"
                disabled={!message.trim() || sendMessageMutation.isPending}
                data-testid="button-send-message"
              >
                <Send className="w-4 h-4 text-accent-foreground" />
              </button>
            </div>
          </form>
        </div>
      </div>
      
      {/* Actions */}
      <div className="px-6 pb-8">
        <button 
          className="action-button mb-4"
          data-testid="button-open-dispute"
        >
          Открыть спор
        </button>
      </div>
    </div>
  );
}
