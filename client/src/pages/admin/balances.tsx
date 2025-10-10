import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { adminRequest } from "@/lib/adminApi";
import { queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertBalanceSchema, insertUsersBalancesSchema } from "@shared/schema";
import { z } from "zod";
import { Plus, Pencil, Trash2 } from "lucide-react";

type Balance = {
  id: number;
  title: string;
  network: string | null;
  currency: string;
  rate: string | null;
  balanceType: "fiat" | "crypto" | "token" | "voucher";
  status: string | null;
};

type UserBalance = {
  id: number;
  idUser: number;
  idBalance: number;
  sum: string;
  status: string | null;
  userName: string | null;
  userTgId: string | null;
  balanceTitle: string | null;
  balanceNetwork: string | null;
  balanceCurrency: string | null;
  balanceType: string | null;
};

type User = {
  id: number;
  tgId: string;
  name: string | null;
  img: string | null;
  referralCode: string;
  countReferrals: number;
};

const balanceFormSchema = insertBalanceSchema;
const userBalanceFormSchema = insertUsersBalancesSchema;

export default function AdminBalances() {
  const [isSystemDialogOpen, setIsSystemDialogOpen] = useState(false);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [editingBalance, setEditingBalance] = useState<Balance | null>(null);
  const [editingUserBalance, setEditingUserBalance] = useState<UserBalance | null>(null);
  const { toast } = useToast();

  // System Balances Queries
  const { data: balances, isLoading: isLoadingBalances } = useQuery<Balance[]>({
    queryKey: ['/admin/api/balances'],
    queryFn: () => adminRequest('/balances'),
  });

  // User Balances Queries
  const { data: userBalances, isLoading: isLoadingUserBalances } = useQuery<UserBalance[]>({
    queryKey: ['/admin/api/user-balances'],
    queryFn: () => adminRequest('/user-balances'),
  });

  // Users Query (for dropdown)
  const { data: users } = useQuery<User[]>({
    queryKey: ['/admin/api/users'],
    queryFn: () => adminRequest('/users?limit=1000'),
  });

  // System Balance Form
  const systemBalanceForm = useForm<z.infer<typeof balanceFormSchema>>({
    resolver: zodResolver(balanceFormSchema),
    defaultValues: {
      title: "",
      currency: "",
      network: null,
      balanceType: "fiat",
      rate: null,
      status: "active",
    },
  });

  // User Balance Form
  const userBalanceForm = useForm<z.infer<typeof userBalanceFormSchema>>({
    resolver: zodResolver(userBalanceFormSchema),
    defaultValues: {
      idUser: 0,
      idBalance: 0,
      sum: "0",
      status: "active",
    },
  });

  // System Balance Mutations
  const createBalanceMutation = useMutation({
    mutationFn: (data: z.infer<typeof balanceFormSchema>) => 
      adminRequest('/balances', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/admin/api/balances'] });
      toast({ title: "Системный баланс создан" });
      setIsSystemDialogOpen(false);
      systemBalanceForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const updateBalanceMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: z.infer<typeof balanceFormSchema> }) =>
      adminRequest(`/balances/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/admin/api/balances'] });
      toast({ title: "Системный баланс обновлен" });
      setIsSystemDialogOpen(false);
      setEditingBalance(null);
      systemBalanceForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const deleteBalanceMutation = useMutation({
    mutationFn: (id: number) => adminRequest(`/balances/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/admin/api/balances'] });
      toast({ title: "Системный баланс удален" });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  // User Balance Mutations
  const createUserBalanceMutation = useMutation({
    mutationFn: (data: z.infer<typeof userBalanceFormSchema>) => 
      adminRequest('/user-balances', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/admin/api/user-balances'] });
      toast({ title: "Баланс пользователя создан" });
      setIsUserDialogOpen(false);
      userBalanceForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const updateUserBalanceMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: z.infer<typeof userBalanceFormSchema> }) =>
      adminRequest(`/user-balances/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/admin/api/user-balances'] });
      toast({ title: "Баланс пользователя обновлен" });
      setIsUserDialogOpen(false);
      setEditingUserBalance(null);
      userBalanceForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const deleteUserBalanceMutation = useMutation({
    mutationFn: (id: number) => adminRequest(`/user-balances/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/admin/api/user-balances'] });
      toast({ title: "Баланс пользователя удален" });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  // System Balance Handlers
  const handleSystemBalanceSubmit = (data: z.infer<typeof balanceFormSchema>) => {
    if (editingBalance) {
      updateBalanceMutation.mutate({ id: editingBalance.id, data });
    } else {
      createBalanceMutation.mutate(data);
    }
  };

  const handleEditSystemBalance = (balance: Balance) => {
    setEditingBalance(balance);
    systemBalanceForm.reset({
      title: balance.title,
      currency: balance.currency,
      network: balance.network || null,
      balanceType: balance.balanceType,
      rate: balance.rate || null,
      status: balance.status || "active",
    });
    setIsSystemDialogOpen(true);
  };

  const handleDeleteSystemBalance = (id: number) => {
    if (confirm("Вы уверены, что хотите удалить этот системный баланс?")) {
      deleteBalanceMutation.mutate(id);
    }
  };

  // User Balance Handlers
  const handleUserBalanceSubmit = (data: z.infer<typeof userBalanceFormSchema>) => {
    if (editingUserBalance) {
      updateUserBalanceMutation.mutate({ id: editingUserBalance.id, data });
    } else {
      createUserBalanceMutation.mutate(data);
    }
  };

  const handleEditUserBalance = (userBalance: UserBalance) => {
    setEditingUserBalance(userBalance);
    userBalanceForm.reset({
      idUser: userBalance.idUser,
      idBalance: userBalance.idBalance,
      sum: userBalance.sum,
      status: userBalance.status || "active",
    });
    setIsUserDialogOpen(true);
  };

  const handleDeleteUserBalance = (id: number) => {
    if (confirm("Вы уверены, что хотите удалить этот баланс пользователя?")) {
      deleteUserBalanceMutation.mutate(id);
    }
  };

  return (
    <AdminLayout title="Управление балансами" description="Управление системными балансами и балансами пользователей">
      <Tabs defaultValue="system" className="space-y-4">
        <TabsList>
          <TabsTrigger value="system" data-testid="tab-system-balances">Системные балансы</TabsTrigger>
          <TabsTrigger value="user" data-testid="tab-user-balances">Балансы пользователей</TabsTrigger>
        </TabsList>

        {/* System Balances Tab */}
        <TabsContent value="system" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Системные балансы</h2>
            <Dialog open={isSystemDialogOpen} onOpenChange={(open) => {
              setIsSystemDialogOpen(open);
              if (!open) {
                setEditingBalance(null);
                systemBalanceForm.reset();
              }
            }}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-system-balance">
                  <Plus className="h-4 w-4 mr-2" />
                  Добавить системный баланс
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editingBalance ? "Редактировать системный баланс" : "Добавить системный баланс"}</DialogTitle>
                  <DialogDescription>
                    Заполните данные для {editingBalance ? "обновления" : "создания"} системного баланса
                  </DialogDescription>
                </DialogHeader>
                <Form {...systemBalanceForm}>
                  <form onSubmit={systemBalanceForm.handleSubmit(handleSystemBalanceSubmit)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={systemBalanceForm.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Название</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Tether" data-testid="input-system-balance-title" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={systemBalanceForm.control}
                        name="currency"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Валюта</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="USDT" data-testid="input-system-balance-currency" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={systemBalanceForm.control}
                        name="type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Тип</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-system-balance-type">
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
                        control={systemBalanceForm.control}
                        name="network"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Сеть</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} placeholder="TRC20" data-testid="input-system-balance-network" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={systemBalanceForm.control}
                      name="rate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Курс</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} type="number" step="0.00000001" placeholder="1.0" data-testid="input-system-balance-rate" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={systemBalanceForm.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Статус</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || "active"}>
                            <FormControl>
                              <SelectTrigger data-testid="select-system-balance-status">
                                <SelectValue placeholder="Выберите статус" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="active">Активный</SelectItem>
                              <SelectItem value="frozen">Неактивный (Frozen)</SelectItem>
                              <SelectItem value="hidden">Скрыт (Hidden)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end space-x-2">
                      <Button type="button" variant="outline" onClick={() => setIsSystemDialogOpen(false)}>
                        Отмена
                      </Button>
                      <Button type="submit" disabled={createBalanceMutation.isPending || updateBalanceMutation.isPending} data-testid="button-save-system-balance">
                        {editingBalance ? "Обновить" : "Создать"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          {isLoadingBalances ? (
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
                    <TableRow key={balance.id} data-testid={`row-system-balance-${balance.id}`}>
                      <TableCell>{balance.id}</TableCell>
                      <TableCell className="font-medium">{balance.title}</TableCell>
                      <TableCell>{balance.currency}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs ${
                          balance.balanceType === 'crypto' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {balance.balanceType}
                        </span>
                      </TableCell>
                      <TableCell>{balance.network || '-'}</TableCell>
                      <TableCell>{balance.rate || '-'}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs ${
                          balance.status === 'active' ? 'bg-green-100 text-green-800' : 
                          balance.status === 'frozen' ? 'bg-blue-100 text-blue-800' : 
                          balance.status === 'hidden' ? 'bg-gray-100 text-gray-800' : 
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {balance.status === 'active' ? 'Активный' : 
                           balance.status === 'frozen' ? 'Неактивный' : 
                           balance.status === 'hidden' ? 'Скрыт' : 
                           balance.status || '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => handleEditSystemBalance(balance)}
                            data-testid={`button-edit-system-balance-${balance.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="destructive" 
                            onClick={() => handleDeleteSystemBalance(balance.id)}
                            data-testid={`button-delete-system-balance-${balance.id}`}
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
        </TabsContent>

        {/* User Balances Tab */}
        <TabsContent value="user" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Балансы пользователей</h2>
            <Dialog open={isUserDialogOpen} onOpenChange={(open) => {
              setIsUserDialogOpen(open);
              if (!open) {
                setEditingUserBalance(null);
                userBalanceForm.reset();
              }
            }}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-user-balance">
                  <Plus className="h-4 w-4 mr-2" />
                  Добавить баланс пользователю
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editingUserBalance ? "Редактировать баланс пользователя" : "Добавить баланс пользователю"}</DialogTitle>
                  <DialogDescription>
                    Заполните данные для {editingUserBalance ? "обновления" : "создания"} баланса пользователя
                  </DialogDescription>
                </DialogHeader>
                <Form {...userBalanceForm}>
                  <form onSubmit={userBalanceForm.handleSubmit(handleUserBalanceSubmit)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={userBalanceForm.control}
                        name="idUser"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Пользователь</FormLabel>
                            <Select 
                              onValueChange={(value) => field.onChange(parseInt(value))} 
                              value={field.value?.toString() || ""}
                            >
                              <FormControl>
                                <SelectTrigger data-testid="select-user-balance-user">
                                  <SelectValue placeholder="Выберите пользователя" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {users?.map((user) => (
                                  <SelectItem key={user.id} value={user.id.toString()}>
                                    {user.name || user.tgId} (ID: {user.id})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={userBalanceForm.control}
                        name="idBalance"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Баланс</FormLabel>
                            <Select 
                              onValueChange={(value) => field.onChange(parseInt(value))} 
                              value={field.value?.toString() || ""}
                              disabled={!!editingUserBalance}
                            >
                              <FormControl>
                                <SelectTrigger data-testid="select-user-balance-balance">
                                  <SelectValue placeholder="Выберите баланс" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {balances?.map((balance) => (
                                  <SelectItem key={balance.id} value={balance.id.toString()}>
                                    {balance.title} ({balance.currency}{balance.network ? ` - ${balance.network}` : ''})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={userBalanceForm.control}
                      name="sum"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Сумма</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} type="number" step="0.00000001" placeholder="0" data-testid="input-user-balance-sum" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={userBalanceForm.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Статус</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} placeholder="active" data-testid="input-user-balance-status" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end space-x-2">
                      <Button type="button" variant="outline" onClick={() => setIsUserDialogOpen(false)}>
                        Отмена
                      </Button>
                      <Button type="submit" disabled={createUserBalanceMutation.isPending || updateUserBalanceMutation.isPending} data-testid="button-save-user-balance">
                        {editingUserBalance ? "Обновить" : "Создать"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          {isLoadingUserBalances ? (
            <div className="text-center py-8">Загрузка...</div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Пользователь</TableHead>
                    <TableHead>Telegram ID</TableHead>
                    <TableHead>Баланс</TableHead>
                    <TableHead>Валюта</TableHead>
                    <TableHead>Сеть</TableHead>
                    <TableHead>Тип</TableHead>
                    <TableHead>Сумма</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userBalances?.map((userBalance) => (
                    <TableRow key={userBalance.id} data-testid={`row-user-balance-${userBalance.id}`}>
                      <TableCell>{userBalance.id}</TableCell>
                      <TableCell className="font-medium">{userBalance.userName || '-'}</TableCell>
                      <TableCell>{userBalance.userTgId || '-'}</TableCell>
                      <TableCell>{userBalance.balanceTitle || '-'}</TableCell>
                      <TableCell>{userBalance.balanceCurrency || '-'}</TableCell>
                      <TableCell>{userBalance.balanceNetwork || '-'}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs ${
                          userBalance.balanceType === 'crypto' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {userBalance.balanceType || '-'}
                        </span>
                      </TableCell>
                      <TableCell className="font-semibold">{userBalance.sum}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs ${
                          userBalance.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {userBalance.status || '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => handleEditUserBalance(userBalance)}
                            data-testid={`button-edit-user-balance-${userBalance.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="destructive" 
                            onClick={() => handleDeleteUserBalance(userBalance.id)}
                            data-testid={`button-delete-user-balance-${userBalance.id}`}
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
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
