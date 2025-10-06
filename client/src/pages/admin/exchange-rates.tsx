import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { adminRequest } from "@/lib/adminApi";
import { queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { Pencil, Plus, Trash2 } from "lucide-react";

type ExchangeRate = {
  id: string;
  fromBalanceId: number | null;
  toBalanceId: number | null;
  fromCurrency: string;
  toCurrency: string;
  rate: string;
  updatedAt: string;
};

type Balance = {
  id: number;
  type: string;
  symbol: string;
};

export default function AdminExchangeRates() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedRate, setSelectedRate] = useState<ExchangeRate | null>(null);
  const { toast } = useToast();

  const { data: rates, isLoading } = useQuery<ExchangeRate[]>({
    queryKey: ['/admin/api/exchange-rates'],
    queryFn: () => adminRequest('/exchange-rates'),
  });

  const { data: balances } = useQuery<Balance[]>({
    queryKey: ['/admin/api/balances'],
    queryFn: () => adminRequest('/balances'),
  });

  const form = useForm({
    defaultValues: {
      fromBalanceId: "",
      toBalanceId: "",
      fromCurrency: "",
      toCurrency: "",
      rate: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => adminRequest('/exchange-rates', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/admin/api/exchange-rates'] });
      toast({ title: "Курс добавлен" });
      setIsDialogOpen(false);
      form.reset();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      adminRequest(`/exchange-rates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/admin/api/exchange-rates'] });
      toast({ title: "Курс обновлен" });
      setIsDialogOpen(false);
      setSelectedRate(null);
      form.reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminRequest(`/exchange-rates/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/admin/api/exchange-rates'] });
      toast({ title: "Курс удален" });
    },
  });

  const handleEdit = (rate: ExchangeRate) => {
    setSelectedRate(rate);
    form.reset({
      fromBalanceId: rate.fromBalanceId?.toString() || "",
      toBalanceId: rate.toBalanceId?.toString() || "",
      fromCurrency: rate.fromCurrency,
      toCurrency: rate.toCurrency,
      rate: rate.rate,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (data: any) => {
    const payload = {
      ...data,
      fromBalanceId: data.fromBalanceId && data.fromBalanceId !== "none" ? parseInt(data.fromBalanceId) : null,
      toBalanceId: data.toBalanceId && data.toBalanceId !== "none" ? parseInt(data.toBalanceId) : null,
    };
    
    if (selectedRate) {
      updateMutation.mutate({ id: selectedRate.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <AdminLayout title="Курсы обмена" description="Управление курсами обмена валют">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Список курсов</h2>
          <Button onClick={() => {
            setSelectedRate(null);
            form.reset();
            setIsDialogOpen(true);
          }} data-testid="button-add-rate">
            <Plus className="h-4 w-4 mr-2" />
            Добавить курс
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-8">Загрузка...</div>
        ) : (
          <div className="border rounded-lg overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Направление</TableHead>
                  <TableHead>Курс</TableHead>
                  <TableHead>Обновлен</TableHead>
                  <TableHead>Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rates?.map((rate) => (
                  <TableRow key={rate.id} data-testid={`row-rate-${rate.id}`}>
                    <TableCell className="font-medium">{rate.fromCurrency} → {rate.toCurrency}</TableCell>
                    <TableCell>{rate.rate}</TableCell>
                    <TableCell>{new Date(rate.updatedAt).toLocaleString('ru-RU')}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button size="sm" variant="outline" onClick={() => handleEdit(rate)} data-testid={`button-edit-rate-${rate.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(rate.id)} data-testid={`button-delete-rate-${rate.id}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selectedRate ? "Редактировать курс" : "Добавить курс"}</DialogTitle>
              <DialogDescription>
                Настройте параметры курса обмена
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="fromCurrency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Из валюты</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="USDT" data-testid="input-from-currency" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="toCurrency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>В валюту</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="RUB" data-testid="input-to-currency" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="rate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Курс</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="95.50" data-testid="input-rate" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="fromBalanceId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Баланс источник (опционально)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-from-balance">
                            <SelectValue placeholder="Выберите баланс" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Не выбрано</SelectItem>
                          {balances?.map((balance) => (
                            <SelectItem key={balance.id} value={balance.id.toString()}>
                              {balance.symbol} ({balance.type})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="toBalanceId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Баланс назначения (опционально)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-to-balance">
                            <SelectValue placeholder="Выберите баланс" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Не выбрано</SelectItem>
                          {balances?.map((balance) => (
                            <SelectItem key={balance.id} value={balance.id.toString()}>
                              {balance.symbol} ({balance.type})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Отмена
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-rate">
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
