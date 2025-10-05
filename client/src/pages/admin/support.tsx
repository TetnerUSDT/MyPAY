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

type SupportChat = {
  id: string;
  userId: number | null;
  transactionId: string | null;
  messages: { sender: string; message: string; timestamp: string }[];
  status: string;
  createdAt: string;
};

export default function AdminSupport() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedChat, setSelectedChat] = useState<SupportChat | null>(null);
  const [replyMessage, setReplyMessage] = useState("");
  const { toast } = useToast();

  const { data: chats, isLoading } = useQuery<SupportChat[]>({
    queryKey: ['/admin/api/support'],
    queryFn: () => adminRequest('/support'),
  });

  const replyMutation = useMutation({
    mutationFn: ({ chatId, message }: { chatId: string; message: string }) =>
      adminRequest(`/support/${chatId}/reply`, { method: 'POST', body: JSON.stringify({ message }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/admin/api/support'] });
      toast({ title: "Ответ отправлен" });
      setReplyMessage("");
    },
  });

  const closeMutation = useMutation({
    mutationFn: (chatId: string) =>
      adminRequest(`/support/${chatId}/close`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/admin/api/support'] });
      toast({ title: "Чат закрыт" });
      setIsDialogOpen(false);
      setSelectedChat(null);
    },
  });

  const handleViewChat = (chat: SupportChat) => {
    setSelectedChat(chat);
    setReplyMessage("");
    setIsDialogOpen(true);
  };

  const handleReply = () => {
    if (!selectedChat || !replyMessage.trim()) return;
    replyMutation.mutate({ chatId: selectedChat.id, message: replyMessage });
  };

  const getStatusBadge = (status: string) => {
    return status === "open" ? (
      <Badge variant="default">Открыт</Badge>
    ) : (
      <Badge variant="outline">Закрыт</Badge>
    );
  };

  return (
    <AdminLayout title="Поддержка" description="Управление обращениями пользователей">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Список обращений</h2>
          <Button 
            variant="outline" 
            onClick={() => queryClient.invalidateQueries({ queryKey: ['/admin/api/support'] })}
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
                  <TableHead>ID</TableHead>
                  <TableHead>Пользователь</TableHead>
                  <TableHead>Транзакция</TableHead>
                  <TableHead>Сообщений</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Создан</TableHead>
                  <TableHead>Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {chats?.map((chat) => (
                  <TableRow key={chat.id} data-testid={`row-support-${chat.id}`}>
                    <TableCell className="font-mono text-sm">{chat.id.slice(0, 8)}...</TableCell>
                    <TableCell>{chat.userId ? `#${chat.userId}` : '-'}</TableCell>
                    <TableCell className="font-mono text-sm">{chat.transactionId ? chat.transactionId.slice(0, 8) + '...' : '-'}</TableCell>
                    <TableCell>{chat.messages.length}</TableCell>
                    <TableCell>{getStatusBadge(chat.status)}</TableCell>
                    <TableCell>{new Date(chat.createdAt).toLocaleString('ru-RU')}</TableCell>
                    <TableCell>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleViewChat(chat)}
                        data-testid={`button-view-chat-${chat.id}`}
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
            setSelectedChat(null);
            setReplyMessage("");
          }
        }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Чат поддержки</DialogTitle>
              <DialogDescription>
                Пользователь: {selectedChat?.userId ? `#${selectedChat.userId}` : 'Не указан'}
              </DialogDescription>
            </DialogHeader>
            
            <ScrollArea className="h-96 border rounded-lg p-4">
              <div className="space-y-4">
                {selectedChat?.messages.map((msg, idx) => (
                  <div 
                    key={idx} 
                    className={`flex ${msg.sender === 'admin' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[80%] rounded-lg p-3 ${
                      msg.sender === 'admin' 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted'
                    }`}>
                      <div className="text-sm">{msg.message}</div>
                      <div className="text-xs opacity-70 mt-1">
                        {new Date(msg.timestamp).toLocaleString('ru-RU')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {selectedChat?.status === "open" && (
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
                    onClick={() => closeMutation.mutate(selectedChat.id)}
                    data-testid="button-close-chat"
                  >
                    Закрыть чат
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

            {selectedChat?.status === "closed" && (
              <div className="text-center text-muted-foreground py-4">
                Этот чат закрыт
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
