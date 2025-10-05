import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { adminRequest } from "@/lib/adminApi";
import { queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertBalanceSchema } from "@shared/schema";
import { z } from "zod";
import { Plus, Pencil, Trash2 } from "lucide-react";

type Balance = {
  id: number;
  title: string;
  network: string | null;
  currency: string;
  rate: string | null;
  type: "fiat" | "crypto" | "token" | "voucher";
  status: string | null;
};

const balanceFormSchema = insertBalanceSchema;

export default function AdminBalances() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBalance, setEditingBalance] = useState<Balance | null>(null);
  const { toast } = useToast();

  const { data: balances, isLoading } = useQuery<Balance[]>({
    queryKey: ['/admin/api/balances'],
    queryFn: () => adminRequest('/balances'),
  });

  const form = useForm<z.infer<typeof balanceFormSchema>>({
    resolver: zodResolver(balanceFormSchema),
    defaultValues: {
      title: "",
      currency: "",
      network: null,
      type: "fiat",
      rate: null,
      status: "active",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: z.infer<typeof balanceFormSchema>) => 
      adminRequest('/balances', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/admin/api/balances'] });
      toast({ title: "Баланс создан" });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: z.infer<typeof balanceFormSchema> }) =>
      adminRequest(`/balances/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/admin/api/balances'] });
      toast({ title: "Баланс обновлен" });
      setIsDialogOpen(false);
      setEditingBalance(null);
      form.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => adminRequest(`/balances/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/admin/api/balances'] });
      toast({ title: "Баланс удален" });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (data: z.infer<typeof balanceFormSchema>) => {
    if (editingBalance) {
      updateMutation.mutate({ id: editingBalance.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (balance: Balance) => {
    setEditingBalance(balance);
    form.reset({
      title: balance.title,
      currency: balance.currency,
      network: balance.network || null,
      type: balance.type,
      rate: balance.rate || null,
      status: balance.status || "active",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Вы уверены, что хотите удалить этот баланс?")) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <AdminLayout title="Управление балансами" description="Добавление и редактирование fiat и crypto балансов">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Список балансов</h2>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setEditingBalance(null);
              form.reset();
            }
          }}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-balance">
                <Plus className="h-4 w-4 mr-2" />
                Добавить баланс
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingBalance ? "Редактировать баланс" : "Добавить баланс"}</DialogTitle>
                <DialogDescription>
                  Заполните данные для {editingBalance ? "обновления" : "создания"} баланса
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Название</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Tether" data-testid="input-balance-title" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="currency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Валюта</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="USDT" data-testid="input-balance-currency" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Тип</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-balance-type">
                                <SelectValue placeholder="Выберите тип" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="fiat">Fiat</SelectItem>
                              <SelectItem value="crypto">Crypto</SelectItem>
                              <SelectItem value="token">Token</SelectItem>
                              <SelectItem value="voucher">Voucher</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="network"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Сеть</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} placeholder="TRC20" data-testid="input-balance-network" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="rate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Курс</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} type="number" step="0.00000001" placeholder="1.0" data-testid="input-balance-rate" />
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
                        <FormControl>
                          <Input {...field} value={field.value || ""} placeholder="active" data-testid="input-balance-status" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Отмена
                    </Button>
                    <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-balance">
                      {editingBalance ? "Обновить" : "Создать"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="text-center py-8">Загрузка...</div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Название</TableHead>
                  <TableHead>Валюта</TableHead>
                  <TableHead>Тип</TableHead>
                  <TableHead>Сеть</TableHead>
                  <TableHead>Курс</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {balances?.map((balance) => (
                  <TableRow key={balance.id} data-testid={`row-balance-${balance.id}`}>
                    <TableCell>{balance.id}</TableCell>
                    <TableCell className="font-medium">{balance.title}</TableCell>
                    <TableCell>{balance.currency}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs ${
                        balance.type === 'crypto' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {balance.type}
                      </span>
                    </TableCell>
                    <TableCell>{balance.network || '-'}</TableCell>
                    <TableCell>{balance.rate || '-'}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs ${
                        balance.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {balance.status || '-'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => handleEdit(balance)}
                          data-testid={`button-edit-balance-${balance.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive" 
                          onClick={() => handleDelete(balance.id)}
                          data-testid={`button-delete-balance-${balance.id}`}
                        >
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
      </div>
    </AdminLayout>
  );
}
