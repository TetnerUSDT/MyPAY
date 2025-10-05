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

type Bank = {
  id: number;
  cardId: number;
  bankName: string;
  timeExchange: number | null;
  commission: string | null;
  status: string;
};

type Card = {
  id: number;
  title: string;
  country: string;
};

export default function AdminBanks() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const { toast } = useToast();

  const { data: banks, isLoading } = useQuery<Bank[]>({
    queryKey: ['/admin/api/banks'],
    queryFn: () => adminRequest('/banks'),
  });

  const { data: cards } = useQuery<Card[]>({
    queryKey: ['/admin/api/cards'],
    queryFn: () => adminRequest('/cards'),
  });

  const form = useForm({
    defaultValues: {
      cardId: "",
      bankName: "",
      timeExchange: "",
      commission: "",
      status: "1",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => adminRequest('/banks', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/admin/api/banks'] });
      toast({ title: "Банк добавлен" });
      setIsDialogOpen(false);
      form.reset();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      adminRequest(`/banks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/admin/api/banks'] });
      toast({ title: "Банк обновлен" });
      setIsDialogOpen(false);
      setSelectedBank(null);
      form.reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => adminRequest(`/banks/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/admin/api/banks'] });
      toast({ title: "Банк удален" });
    },
  });

  const handleEdit = (bank: Bank) => {
    setSelectedBank(bank);
    form.reset({
      cardId: bank.cardId.toString(),
      bankName: bank.bankName,
      timeExchange: bank.timeExchange?.toString() || "",
      commission: bank.commission || "",
      status: bank.status,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (data: any) => {
    const payload = {
      ...data,
      cardId: parseInt(data.cardId),
      timeExchange: data.timeExchange ? parseInt(data.timeExchange) : null,
    };
    
    if (selectedBank) {
      updateMutation.mutate({ id: selectedBank.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const getCardTitle = (cardId: number) => {
    return cards?.find(c => c.id === cardId)?.title || `#${cardId}`;
  };

  return (
    <AdminLayout title="Управление банками" description="Добавление банков к странам">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Список банков</h2>
          <Button onClick={() => {
            setSelectedBank(null);
            form.reset();
            setIsDialogOpen(true);
          }} data-testid="button-add-bank">
            <Plus className="h-4 w-4 mr-2" />
            Добавить банк
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
                  <TableHead>Название банка</TableHead>
                  <TableHead>Страна</TableHead>
                  <TableHead>Время обмена</TableHead>
                  <TableHead>Комиссия</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {banks?.map((bank) => (
                  <TableRow key={bank.id} data-testid={`row-bank-${bank.id}`}>
                    <TableCell>{bank.id}</TableCell>
                    <TableCell className="font-medium">{bank.bankName}</TableCell>
                    <TableCell>{getCardTitle(bank.cardId)}</TableCell>
                    <TableCell>{bank.timeExchange ? `${bank.timeExchange} мин` : '-'}</TableCell>
                    <TableCell>{bank.commission ? `${bank.commission}%` : '-'}</TableCell>
                    <TableCell>{bank.status === "1" ? "Активен" : "Скрыт"}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button size="sm" variant="outline" onClick={() => handleEdit(bank)} data-testid={`button-edit-bank-${bank.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(bank.id)} data-testid={`button-delete-bank-${bank.id}`}>
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
              <DialogTitle>{selectedBank ? "Редактировать банк" : "Добавить банк"}</DialogTitle>
              <DialogDescription>
                Настройте параметры банка для обмена
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="cardId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Страна</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-bank-card">
                            <SelectValue placeholder="Выберите страну" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {cards?.map((card) => (
                            <SelectItem key={card.id} value={card.id.toString()}>
                              {card.title} ({card.country})
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
                  name="bankName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Название банка</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Сбербанк" data-testid="input-bank-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="timeExchange"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Время обмена (минуты, опционально)</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" placeholder="15" data-testid="input-bank-time" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="commission"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Комиссия (%, опционально)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="2.5" data-testid="input-bank-commission" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Статус</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-bank-status">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="1">Активен</SelectItem>
                          <SelectItem value="0">Скрыт</SelectItem>
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
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-bank">
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
