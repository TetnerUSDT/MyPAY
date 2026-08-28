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

type Card = {
  id: number;
  title: string;
  country: string;
  lang: string | null;
  timeExchange: number;
  commission: string;
  idBalance: string | null;
  status: string;
};

export default function AdminCards() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const { toast } = useToast();

  const { data: cards, isLoading } = useQuery<Card[]>({
    queryKey: ['/admin/api/cards'],
    queryFn: () => adminRequest('/cards'),
  });

  const form = useForm({
    defaultValues: {
      title: "",
      country: "",
      lang: "",
      timeExchange: "",
      commission: "",
      idBalance: "",
      status: "1",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => adminRequest('/cards', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/admin/api/cards'] });
      toast({ title: "Страна добавлена" });
      setIsDialogOpen(false);
      form.reset();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      adminRequest(`/cards/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/admin/api/cards'] });
      toast({ title: "Страна обновлена" });
      setIsDialogOpen(false);
      setSelectedCard(null);
      form.reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => adminRequest(`/cards/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/admin/api/cards'] });
      toast({ title: "Страна удалена" });
    },
  });

  const handleEdit = (card: Card) => {
    setSelectedCard(card);
    form.reset({
      title: card.title,
      country: card.country,
      lang: card.lang || "",
      timeExchange: card.timeExchange.toString(),
      commission: card.commission,
      idBalance: card.idBalance || "",
      status: card.status,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (data: any) => {
    const payload = {
      ...data,
      timeExchange: parseInt(data.timeExchange),
    };
    
    if (selectedCard) {
      updateMutation.mutate({ id: selectedCard.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <AdminLayout title="Управление странами" description="Добавление и настройка стран для обмена">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Список стран</h2>
          <Button onClick={() => {
            setSelectedCard(null);
            form.reset();
            setIsDialogOpen(true);
          }} data-testid="button-add-card">
            <Plus className="h-4 w-4 mr-2" />
            Добавить страну
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
                  <TableHead>Название</TableHead>
                  <TableHead>Страна</TableHead>
                  <TableHead>Язык</TableHead>
                  <TableHead>Время обмена</TableHead>
                  <TableHead>Комиссия</TableHead>
                  <TableHead>ID балансов</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cards?.map((card) => (
                  <TableRow key={card.id} data-testid={`row-card-${card.id}`}>
                    <TableCell>{card.id}</TableCell>
                    <TableCell className="font-medium">{card.title}</TableCell>
                    <TableCell>{card.country}</TableCell>
                    <TableCell>{card.lang || '-'}</TableCell>
                    <TableCell>{card.timeExchange} мин</TableCell>
                    <TableCell>{card.commission}%</TableCell>
                    <TableCell>{card.idBalance || '-'}</TableCell>
                    <TableCell>{card.status === "1" ? "Активна" : "Скрыта"}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button size="sm" variant="outline" onClick={() => handleEdit(card)} data-testid={`button-edit-card-${card.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(card.id)} data-testid={`button-delete-card-${card.id}`}>
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
              <DialogTitle>{selectedCard ? "Редактировать страну" : "Добавить страну"}</DialogTitle>
              <DialogDescription>
                Настройте параметры обмена для страны
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Название</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Россия" data-testid="input-card-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Код страны</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="RU" data-testid="input-card-country" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="lang"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Языки</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="ru,en" data-testid="input-card-lang" />
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
                      <FormLabel>Время обмена (минуты)</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" placeholder="15" data-testid="input-card-time" />
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
                      <FormLabel>Комиссия (%)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="2.5" data-testid="input-card-commission" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="idBalance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ID балансов (через запятую)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="1,2,3" data-testid="input-card-balances" />
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
                          <SelectTrigger data-testid="select-card-status">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="1">Активна</SelectItem>
                          <SelectItem value="0">Скрыта</SelectItem>
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
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-card">
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
