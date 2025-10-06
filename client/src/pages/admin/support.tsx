import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { adminRequest } from "@/lib/adminApi";
import { queryClient } from "@/lib/queryClient";
import { MessageSquare, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

type SupportTicket = {
  id: number;
  userId: number;
  exchangeId: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  exchangeNumber?: string;
};

type SupportMessage = {
  id: number;
  ticketId: number;
  sender: string;
  message: string;
  createdAt: string;
};

export default function AdminSupport() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [replyMessage, setReplyMessage] = useState("");
  const { toast } = useToast();

  const { data: tickets, isLoading } = useQuery<SupportTicket[]>({
    queryKey: ['/admin/api/support/tickets'],
    queryFn: () => adminRequest('/support/tickets'),
  });

  const { data: messages = [], refetch: refetchMessages } = useQuery<SupportMessage[]>({
    queryKey: ['/admin/api/support/tickets', selectedTicket?.id, 'messages'],
    queryFn: () => adminRequest(`/support/tickets/${selectedTicket!.id}/messages`),
    enabled: !!selectedTicket,
  });

  const replyMutation = useMutation({
    mutationFn: ({ ticketId, message }: { ticketId: number; message: string }) =>
      adminRequest(`/support/tickets/${ticketId}/reply`, { method: 'POST', body: JSON.stringify({ message }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/admin/api/support/tickets'] });
      refetchMessages();
      toast({ title: "Ответ отправлен" });
      setReplyMessage("");
    },
  });

  const closeMutation = useMutation({
    mutationFn: (ticketId: number) =>
      adminRequest(`/support/tickets/${ticketId}/close`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/admin/api/support/tickets'] });
      toast({ title: "Тикет закрыт" });
      setIsDialogOpen(false);
      setSelectedTicket(null);
    },
  });

  const handleViewTicket = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setReplyMessage("");
    setIsDialogOpen(true);
  };

  const handleReply = () => {
    if (!selectedTicket || !replyMessage.trim()) return;
    replyMutation.mutate({ ticketId: selectedTicket.id, message: replyMessage });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: "default" | "secondary" | "outline"; label: string }> = {
      "wait-user": { variant: "secondary", label: "Ожидает пользователя" },
      "wait-support": { variant: "default", label: "Ожидает поддержку" },
      "closed": { variant: "outline", label: "Закрыт" },
    };
    
    const config = statusConfig[status] || { variant: "outline" as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <AdminLayout title="Поддержка" description="Управление обращениями пользователей">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Список обращений</h2>
          <Button 
            variant="outline" 
            onClick={() => queryClient.invalidateQueries({ queryKey: ['/admin/api/support/tickets'] })}
            data-testid="button-refresh-support"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Обновить
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-8">Загрузка...</div>
        ) : (
          <div className="border rounded-lg overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Тикет</TableHead>
                  <TableHead>Пользователь</TableHead>
                  <TableHead>Обмен</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Создан</TableHead>
                  <TableHead>Обновлен</TableHead>
                  <TableHead>Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets?.map((ticket) => (
                  <TableRow key={ticket.id} data-testid={`row-support-${ticket.id}`}>
                    <TableCell className="font-medium">#{ticket.id}</TableCell>
                    <TableCell>#{ticket.userId}</TableCell>
                    <TableCell className="font-mono text-sm">{ticket.exchangeNumber || `#${ticket.exchangeId}`}</TableCell>
                    <TableCell>{getStatusBadge(ticket.status)}</TableCell>
                    <TableCell>{new Date(ticket.createdAt).toLocaleString('ru-RU')}</TableCell>
                    <TableCell>{new Date(ticket.updatedAt).toLocaleString('ru-RU')}</TableCell>
                    <TableCell>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleViewTicket(ticket)}
                        data-testid={`button-view-ticket-${ticket.id}`}
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setSelectedTicket(null);
            setReplyMessage("");
          }
        }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Тикет #{selectedTicket?.id}</DialogTitle>
              <DialogDescription>
                Пользователь: #{selectedTicket?.userId} | Обмен: {selectedTicket?.exchangeNumber || `#${selectedTicket?.exchangeId}`}
              </DialogDescription>
            </DialogHeader>
            
            <ScrollArea className="h-96 border rounded-lg p-4">
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={`flex ${msg.sender === 'support' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[80%] rounded-lg p-3 ${
                      msg.sender === 'support' 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted'
                    }`}>
                      <div className="text-xs font-semibold mb-1 opacity-70">
                        {msg.sender === 'support' ? 'Поддержка' : 'Пользователь'}
                      </div>
                      <div className="text-sm">{msg.message}</div>
                      <div className="text-xs opacity-70 mt-1">
                        {new Date(msg.createdAt).toLocaleString('ru-RU')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {selectedTicket?.status !== "closed" && (
              <div className="space-y-3">
                <Textarea
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  placeholder="Введите ответ..."
                  rows={3}
                  data-testid="textarea-reply-message"
                />
                <div className="flex justify-between">
                  <Button 
                    variant="outline" 
                    onClick={() => closeMutation.mutate(selectedTicket.id)}
                    data-testid="button-close-ticket"
                  >
                    Закрыть тикет
                  </Button>
                  <Button 
                    onClick={handleReply} 
                    disabled={!replyMessage.trim() || replyMutation.isPending}
                    data-testid="button-send-reply"
                  >
                    Отправить
                  </Button>
                </div>
              </div>
            )}

            {selectedTicket?.status === "closed" && (
              <div className="text-center text-muted-foreground py-4">
                Этот тикет закрыт
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
