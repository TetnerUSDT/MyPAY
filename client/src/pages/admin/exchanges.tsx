import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { adminRequest } from "@/lib/adminApi";
import { queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { Eye, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Exchange = {
  id: number;
  numberOrder: string;
  idUser: number;
  walletId: number | null;
  walletAddress: string | null;
  fromCurrency: string;
  toCurrency: string;
  amountFrom: string;
  amountTo: string;
  rate: string;
  status: string;
  timestamp: string;
  cancelReason: string | null;
  paymentHash: string | null;
};

export default function AdminExchanges() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedExchange, setSelectedExchange] = useState<Exchange | null>(null);
  const { toast } = useToast();

  const { data: exchanges, isLoading } = useQuery<Exchange[]>({
    queryKey: ['/admin/api/exchanges'],
    queryFn: () => adminRequest('/exchanges'),
  });

  const form = useForm({
    defaultValues: {
      status: "wait",
      cancelReason: "",
      paymentHash: "",
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { status: string; cancelReason?: string; paymentHash?: string } }) =>
      adminRequest(`/exchanges/${id}/status`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/admin/api/exchanges'] });
      toast({ title: "Обмен обновлен" });
      setIsDialogOpen(false);
      setSelectedExchange(null);
      form.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const handleEdit = (exchange: Exchange) => {
    setSelectedExchange(exchange);
    form.reset({
      status: exchange.status,
      cancelReason: exchange.cancelReason || "",
      paymentHash: exchange.paymentHash || "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (data: any) => {
    if (!selectedExchange) return;
    
    const updateData: any = { status: data.status };
    if (data.cancelReason) updateData.cancelReason = data.cancelReason;
    if (data.paymentHash) updateData.paymentHash = data.paymentHash;
    
    updateMutation.mutate({ id: selectedExchange.id, data: updateData });
  };

  const statusLabels: Record<string, string> = {
    "wait": "Ожидание",
    "wait-paid": "Ожидание оплаты",
    "paid": "Оплачено",
    "complete": "Завершено",
    "canceled": "Отменено",
    "dispute": "Спор"
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      wait: "outline",
      "wait-paid": "secondary",
      paid: "secondary",
      complete: "default",
      canceled: "destructive",
      dispute: "destructive",
    };
    
    return <Badge variant={variants[status] || "outline"}>{statusLabels[status] || status}</Badge>;
  };

  return (
    <AdminLayout title="Управление обменами" description="Просмотр и изменение статусов обменов">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Список обменов</h2>
          <Button 
            variant="outline" 
            onClick={() => queryClient.invalidateQueries({ queryKey: ['/admin/api/exchanges'] })}
            data-testid="button-refresh-exchanges"
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
                  <TableHead>Номер</TableHead>
                  <TableHead>Пользователь</TableHead>
                  <TableHead>Направление</TableHead>
                  <TableHead>Сумма</TableHead>
                  <TableHead>Курс</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Дата</TableHead>
                  <TableHead>Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exchanges?.map((exchange) => (
                  <TableRow key={exchange.id} data-testid={`row-exchange-${exchange.id}`}>
                    <TableCell>{exchange.id}</TableCell>
                    <TableCell className="font-medium">{exchange.numberOrder}</TableCell>
                    <TableCell>#{exchange.idUser}</TableCell>
                    <TableCell>{exchange.fromCurrency} → {exchange.toCurrency}</TableCell>
                    <TableCell>{exchange.amountFrom} → {exchange.amountTo}</TableCell>
                    <TableCell>{exchange.rate}</TableCell>
                    <TableCell>{getStatusBadge(exchange.status)}</TableCell>
                    <TableCell>{new Date(exchange.timestamp).toLocaleString('ru-RU')}</TableCell>
                    <TableCell>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleEdit(exchange)}
                        data-testid={`button-edit-exchange-${exchange.id}`}
                      >
                        <Eye className="h-4 w-4" />
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
            setSelectedExchange(null);
            form.reset();
          }
        }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Управление обменом #{selectedExchange?.numberOrder}</DialogTitle>
              <DialogDescription>
                Измените статус или добавьте дополнительную информацию
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><strong>ID:</strong> {selectedExchange?.id}</div>
                  <div><strong>Пользователь:</strong> #{selectedExchange?.idUser}</div>
                  <div><strong>Направление:</strong> {selectedExchange?.fromCurrency} → {selectedExchange?.toCurrency}</div>
                  <div><strong>Сумма:</strong> {selectedExchange?.amountFrom} → {selectedExchange?.amountTo}</div>
                  <div><strong>Курс:</strong> {selectedExchange?.rate}</div>
                  <div className="col-span-2"><strong>Кошелек:</strong> <span className="font-mono text-sm">{selectedExchange?.walletAddress || '-'}</span></div>
                </div>
                
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Статус</FormLabel>
                      <FormControl>
                        <RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-wrap gap-3">
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="wait" id="status-wait" className="peer sr-only" />
                            <Label
                              htmlFor="status-wait"
                              className="px-4 py-2 rounded-full cursor-pointer transition-colors border-2 peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground peer-data-[state=checked]:border-primary"
                            >
                              Ожидание
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="wait-paid" id="status-wait-paid" className="peer sr-only" />
                            <Label
                              htmlFor="status-wait-paid"
                              className="px-4 py-2 rounded-full cursor-pointer transition-colors border-2 peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground peer-data-[state=checked]:border-primary"
                            >
                              Ожидание оплаты
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="paid" id="status-paid" className="peer sr-only" />
                            <Label
                              htmlFor="status-paid"
                              className="px-4 py-2 rounded-full cursor-pointer transition-colors border-2 peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground peer-data-[state=checked]:border-primary"
                            >
                              Оплачено
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="complete" id="status-complete" className="peer sr-only" />
                            <Label
                              htmlFor="status-complete"
                              className="px-4 py-2 rounded-full cursor-pointer transition-colors border-2 peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground peer-data-[state=checked]:border-primary"
                            >
                              Завершено
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="canceled" id="status-canceled" className="peer sr-only" />
                            <Label
                              htmlFor="status-canceled"
                              className="px-4 py-2 rounded-full cursor-pointer transition-colors border-2 peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground peer-data-[state=checked]:border-primary"
                            >
                              Отменено
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="dispute" id="status-dispute" className="peer sr-only" />
                            <Label
                              htmlFor="status-dispute"
                              className="px-4 py-2 rounded-full cursor-pointer transition-colors border-2 peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground peer-data-[state=checked]:border-primary"
                            >
                              Спор
                            </Label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="paymentHash"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Хеш транзакции</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="0x..." data-testid="input-payment-hash" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="cancelReason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Причина отмены</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Опционально" data-testid="input-cancel-reason" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Отмена
                  </Button>
                  <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-exchange">
                    Сохранить
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
