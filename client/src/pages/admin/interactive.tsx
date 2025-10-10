import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { adminRequest } from "@/lib/adminApi";
import { queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Bell, Plus, Trash2, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Notification = {
  id: number;
  userId: number | null;
  type: string;
  title: string;
  message: string;
  imageUrl: string | null;
  videoUrl: string | null;
  linkUrl: string | null;
  linkText: string | null;
  redirectTo: string | null;
  invoiceId: number | null;
  exchangeId: number | null;
  isRead: boolean;
  createdAt: string;
};

type Invoice = {
  id: number;
  orderNumber: string;
  userId: number;
  walletId: number | null;
  balanceId: number | null;
  amount: string;
  currency: string;
  network: string | null;
  description: string | null;
  paymentMethod: string | null;
  status: string;
  expiresAt: string | null;
  paidAt: string | null;
  paymentHash: string | null;
  createdAt: string;
};

const notificationSchema = z.object({
  userId: z.string().optional(),
  type: z.enum(['info', 'invoice', 'exchange', 'promotion']),
  title: z.string().min(1, "Обязательное поле"),
  message: z.string().min(1, "Обязательное поле"),
  imageUrl: z.string().optional(),
  videoUrl: z.string().optional(),
  linkUrl: z.string().optional(),
  linkText: z.string().optional(),
  redirectTo: z.string().optional(),
});

const invoiceSchema = z.object({
  userId: z.string().min(1, "Обязательное поле"),
  balanceId: z.string().min(1, "Обязательное поле"),
  amount: z.string().min(1, "Обязательное поле"),
  currency: z.string().min(1, "Обязательное поле"),
  network: z.string().optional(),
  description: z.string().optional(),
  expiresAt: z.string().optional(),
});

export default function AdminInteractive() {
  const [isNotificationDialogOpen, setIsNotificationDialogOpen] = useState(false);
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const { toast } = useToast();

  const { data: notifications, isLoading: notificationsLoading } = useQuery<Notification[]>({
    queryKey: ['/admin/api/notifications'],
    queryFn: () => adminRequest('/notifications'),
  });

  const { data: invoices, isLoading: invoicesLoading } = useQuery<Invoice[]>({
    queryKey: ['/admin/api/invoices'],
    queryFn: () => adminRequest('/invoices'),
  });

  const { data: users } = useQuery({
    queryKey: ['/admin/api/users'],
    queryFn: () => adminRequest('/users'),
  });

  const { data: balances } = useQuery({
    queryKey: ['/admin/api/balances'],
    queryFn: () => adminRequest('/balances'),
  });

  const notificationForm = useForm({
    resolver: zodResolver(notificationSchema),
    defaultValues: {
      userId: "all",
      type: "info" as const,
      title: "",
      message: "",
      imageUrl: "",
      videoUrl: "",
      linkUrl: "",
      linkText: "",
      redirectTo: "",
    },
  });

  const invoiceForm = useForm({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      userId: "",
      balanceId: "",
      amount: "",
      currency: "",
      network: "",
      description: "",
      expiresAt: "",
    },
  });

  const createNotificationMutation = useMutation({
    mutationFn: (data: any) => adminRequest('/notifications', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/admin/api/notifications'] });
      toast({ title: "Уведомление создано" });
      setIsNotificationDialogOpen(false);
      notificationForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: (id: number) => adminRequest(`/notifications/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/admin/api/notifications'] });
      toast({ title: "Уведомление удалено" });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const createInvoiceMutation = useMutation({
    mutationFn: (data: any) => {
      // Generate order number
      const orderNumber = Array.from({ length: 10 }, () => 
        'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 36)]
      ).join('');
      
      // Set expiration (30 minutes from now)
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      
      return adminRequest('/invoices', { 
        method: 'POST', 
        body: JSON.stringify({
          ...data,
          orderNumber,
          expiresAt,
          status: 'pending'
        }) 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/admin/api/invoices'] });
      toast({ title: "Счет создан и отправлен пользователю" });
      setIsInvoiceDialogOpen(false);
      invoiceForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const updateInvoiceStatusMutation = useMutation({
    mutationFn: ({ id, status, paymentHash }: { id: number; status: string; paymentHash?: string }) =>
      adminRequest(`/invoices/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, paymentHash }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/admin/api/invoices'] });
      toast({ title: "Статус обновлен" });
      setSelectedInvoice(null);
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const handleNotificationSubmit = (data: any) => {
    const payload: any = {
      userId: (data.userId && data.userId !== 'all') ? parseInt(data.userId) : null,
      type: data.type,
      title: data.title,
      message: data.message,
      isRead: false,
    };
    
    if (data.imageUrl) payload.imageUrl = data.imageUrl;
    if (data.videoUrl) payload.videoUrl = data.videoUrl;
    if (data.linkUrl) payload.linkUrl = data.linkUrl;
    if (data.linkText) payload.linkText = data.linkText;
    if (data.redirectTo) payload.redirectTo = data.redirectTo;
    
    createNotificationMutation.mutate(payload);
  };

  const handleInvoiceSubmit = (data: any) => {
    console.log('Invoice form data:', data);
    console.log('Form errors:', invoiceForm.formState.errors);
    
    const selectedBalance = balances?.find((b: any) => b.id === parseInt(data.balanceId));
    
    const payload = {
      userId: parseInt(data.userId),
      balanceId: parseInt(data.balanceId),
      amount: data.amount,
      currency: selectedBalance?.currency || data.currency,
      network: selectedBalance?.network || data.network || null,
      description: data.description || null,
    };
    
    console.log('Invoice payload:', payload);
    createInvoiceMutation.mutate(payload);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "outline",
      paid: "default",
      expired: "destructive",
      canceled: "secondary",
    };
    
    const labels: Record<string, string> = {
      pending: "В ожидании",
      paid: "Оплачен",
      expired: "Просрочен",
      canceled: "Отменен",
    };
    
    return <Badge variant={variants[status]} data-testid={`status-${status}`}>{labels[status]}</Badge>;
  };

  return (
    <AdminLayout title="Интерактив">
      <div className="container mx-auto p-4">

        <Tabs defaultValue="invoices" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="invoices" data-testid="tab-invoices">
              <DollarSign className="w-4 h-4 mr-2" />
              Счета на оплату
            </TabsTrigger>
            <TabsTrigger value="notifications" data-testid="tab-notifications">
              <Bell className="w-4 h-4 mr-2" />
              Уведомления
            </TabsTrigger>
          </TabsList>

          <TabsContent value="invoices" className="mt-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Управление счетами</h2>
              <Dialog open={isInvoiceDialogOpen} onOpenChange={setIsInvoiceDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-create-invoice">
                    <Plus className="w-4 h-4 mr-2" />
                    Создать счет
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Создать счет на оплату</DialogTitle>
                    <DialogDescription>
                      Счет автоматически отправится пользователю как уведомление
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...invoiceForm}>
                    <form onSubmit={invoiceForm.handleSubmit(handleInvoiceSubmit, (errors) => {
                      console.error('Invoice form validation errors:', errors);
                      toast({ 
                        title: "Ошибка валидации", 
                        description: "Проверьте правильность заполнения всех полей",
                        variant: "destructive" 
                      });
                    })} className="space-y-4">
                      <FormField
                        control={invoiceForm.control}
                        name="userId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Пользователь</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-invoice-user">
                                  <SelectValue placeholder="Выберите пользователя" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {users?.map((user: any) => (
                                  <SelectItem key={user.id} value={user.id.toString()}>
                                    {user.name} (ID: {user.id})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={invoiceForm.control}
                        name="balanceId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Валюта/Сеть</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-invoice-balance">
                                  <SelectValue placeholder="Выберите валюту" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {balances?.filter((b: any) => b.status === 'active').map((balance: any) => (
                                  <SelectItem key={balance.id} value={balance.id.toString()}>
                                    {balance.title} ({balance.currency})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={invoiceForm.control}
                        name="amount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Сумма</FormLabel>
                            <FormControl>
                              <Input {...field} type="number" step="0.01" placeholder="100.00" data-testid="input-invoice-amount" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={invoiceForm.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Описание (необязательно)</FormLabel>
                            <FormControl>
                              <Textarea {...field} placeholder="За что платеж?" data-testid="input-invoice-description" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button 
                        type="submit" 
                        className="w-full" 
                        disabled={createInvoiceMutation.isPending}
                        onClick={() => {
                          console.log('Submit button clicked');
                          console.log('Form state:', invoiceForm.getValues());
                          console.log('Form errors:', invoiceForm.formState.errors);
                        }}
                        data-testid="button-submit-invoice"
                      >
                        {createInvoiceMutation.isPending ? "Создание..." : "Создать счет"}
                      </Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>№ Заказа</TableHead>
                    <TableHead>Пользователь</TableHead>
                    <TableHead>Сумма</TableHead>
                    <TableHead>Описание</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Создан</TableHead>
                    <TableHead>Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoicesLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center">Загрузка...</TableCell>
                    </TableRow>
                  ) : invoices?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">Счетов пока нет</TableCell>
                    </TableRow>
                  ) : (
                    invoices?.map((invoice) => (
                      <TableRow key={invoice.id} data-testid={`row-invoice-${invoice.id}`}>
                        <TableCell className="font-mono">{invoice.orderNumber}</TableCell>
                        <TableCell>ID: {invoice.userId}</TableCell>
                        <TableCell>{invoice.amount} {invoice.currency}</TableCell>
                        <TableCell>{invoice.description || "-"}</TableCell>
                        <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                        <TableCell>{new Date(invoice.createdAt).toLocaleString('ru-RU')}</TableCell>
                        <TableCell>
                          {invoice.status === 'pending' && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateInvoiceStatusMutation.mutate({ id: invoice.id, status: 'paid' })}
                                data-testid={`button-mark-paid-${invoice.id}`}
                              >
                                Оплачен
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => updateInvoiceStatusMutation.mutate({ id: invoice.id, status: 'canceled' })}
                                data-testid={`button-cancel-${invoice.id}`}
                              >
                                Отменить
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="notifications" className="mt-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Создать уведомление</h2>
              <Dialog open={isNotificationDialogOpen} onOpenChange={setIsNotificationDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-create-notification">
                    <Plus className="w-4 h-4 mr-2" />
                    Создать уведомление
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Создать уведомление</DialogTitle>
                    <DialogDescription>
                      Отправить уведомление конкретному пользователю или всем сразу
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...notificationForm}>
                    <form onSubmit={notificationForm.handleSubmit(handleNotificationSubmit)} className="space-y-4">
                      <FormField
                        control={notificationForm.control}
                        name="userId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Получатель</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-notification-user">
                                  <SelectValue placeholder="Всем пользователям" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="all">Всем пользователям</SelectItem>
                                {users?.map((user: any) => (
                                  <SelectItem key={user.id} value={user.id.toString()}>
                                    {user.name} (ID: {user.id})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={notificationForm.control}
                        name="type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Тип</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-notification-type">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="info">Информация</SelectItem>
                                <SelectItem value="promotion">Акция</SelectItem>
                                <SelectItem value="exchange">Обмен</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={notificationForm.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Заголовок</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Важное уведомление" data-testid="input-notification-title" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={notificationForm.control}
                        name="message"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Сообщение</FormLabel>
                            <FormControl>
                              <Textarea {...field} placeholder="Текст уведомления" rows={3} data-testid="input-notification-message" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={notificationForm.control}
                        name="linkUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Ссылка (необязательно)</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="https://example.com" data-testid="input-notification-link" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={notificationForm.control}
                        name="linkText"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Текст ссылки</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Перейти" data-testid="input-notification-link-text" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="submit" className="w-full" disabled={createNotificationMutation.isPending} data-testid="button-submit-notification">
                        {createNotificationMutation.isPending ? "Отправка..." : "Отправить уведомление"}
                      </Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Получатель</TableHead>
                    <TableHead>Тип</TableHead>
                    <TableHead>Заголовок</TableHead>
                    <TableHead>Сообщение</TableHead>
                    <TableHead>Создано</TableHead>
                    <TableHead>Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notificationsLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center">Загрузка...</TableCell>
                    </TableRow>
                  ) : notifications?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center">
                        <div className="py-8">
                          <Bell className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                          <h3 className="text-lg font-semibold mb-2">Уведомления отправляются мгновенно</h3>
                          <p className="text-muted-foreground">
                            Пользователи увидят уведомление на своей аватарке с анимацией и счетчиком
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    notifications?.map((notification) => (
                      <TableRow key={notification.id} data-testid={`row-notification-${notification.id}`}>
                        <TableCell>{notification.id}</TableCell>
                        <TableCell>
                          {notification.userId ? `ID: ${notification.userId}` : "Все пользователи"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={notification.type === 'promotion' ? 'default' : 'secondary'}>
                            {notification.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">{notification.title}</TableCell>
                        <TableCell className="max-w-[300px] truncate">{notification.message}</TableCell>
                        <TableCell>{new Date(notification.createdAt).toLocaleString('ru-RU')}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deleteNotificationMutation.mutate(notification.id)}
                            data-testid={`button-delete-notification-${notification.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
