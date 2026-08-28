import { useState, useEffect } from "react";
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
import { Eye, RefreshCw, Copy, Check, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { UserProfilePopover } from "@/components/UserProfilePopover";

type Exchange = {
  id: number;
  numberOrder: string;
  idUser: number;
  userName: string | null;
  walletId: number | null;
  walletAddress: string | null;
  cardNumber: string | null;
  manualCardNumber: string | null;
  fromCurrency: string;
  toCurrency: string;
  amountFrom: string;
  amountTo: string;
  rate: string;
  status: string;
  timestamp: string;
  cancelReason: string | null;
  paymentHash: string | null;
  tempBalance: string | null;
  // User card details
  cardName?: string | null;
  cardFirstName?: string | null;
  cardLastName?: string | null;
  cardPhone?: string | null;
  cardCountry?: string | null;
  cardAccountNumber?: string | null;
  cardBankName?: string | null;
};

export default function AdminExchanges() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCardDetailsModalOpen, setIsCardDetailsModalOpen] = useState(false);
  const [selectedExchange, setSelectedExchange] = useState<Exchange | null>(null);
  const [copiedWallet, setCopiedWallet] = useState(false);
  const [copiedCard, setCopiedCard] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
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

  // Watch status changes and clear irrelevant fields
  const currentStatus = form.watch("status");
  useEffect(() => {
    if (currentStatus !== "canceled") {
      form.setValue("cancelReason", "");
    }
    if (currentStatus !== "wait-paid") {
      form.setValue("paymentHash", "");
    }
  }, [currentStatus, form]);

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
    
    // Only include cancelReason when status is canceled
    if (data.status === "canceled" && data.cancelReason) {
      updateData.cancelReason = data.cancelReason;
    }
    
    // Only include paymentHash when status is wait-paid
    if (data.status === "wait-paid" && data.paymentHash) {
      updateData.paymentHash = data.paymentHash;
    }
    
    updateMutation.mutate({ id: selectedExchange.id, data: updateData });
  };

  const copyWalletAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedWallet(true);
    toast({ title: "Адрес скопирован" });
    setTimeout(() => setCopiedWallet(false), 2000);
  };

  const formatCardNumber = (cardNumber: string) => {
    const cleaned = cardNumber.replace(/\s/g, '');
    return cleaned.match(/.{1,4}/g)?.join(' ') || cardNumber;
  };

  const copyCardNumber = (cardNumber: string) => {
    const cleaned = cardNumber.replace(/\s/g, '');
    navigator.clipboard.writeText(cleaned);
    setCopiedCard(true);
    toast({ title: "Номер карты скопирован" });
    setTimeout(() => setCopiedCard(false), 2000);
  };

  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      toast({ title: "Ошибка копирования", variant: "destructive" });
    }
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
                    <TableCell>
                      <UserProfilePopover userId={exchange.idUser} userName={exchange.userName}>
                        <button 
                          className="hover:underline cursor-pointer text-left"
                          data-testid={`button-user-name-${exchange.idUser}`}
                        >
                          {exchange.userName || `#${exchange.idUser}`}
                        </button>
                      </UserProfilePopover>
                    </TableCell>
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
            setCopiedWallet(false);
          }
        }}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Обмен #{selectedExchange?.numberOrder}</DialogTitle>
              <DialogDescription className="flex items-center gap-2">
                <span>ID: {selectedExchange?.id} • Пользователь:</span>
                {selectedExchange && (
                  <UserProfilePopover userId={selectedExchange.idUser} userName={selectedExchange.userName}>
                    <button 
                      className="hover:underline cursor-pointer text-left inline-flex"
                      data-testid={`button-dialog-user-name-${selectedExchange.idUser}`}
                    >
                      {selectedExchange.userName || `#${selectedExchange.idUser}`}
                    </button>
                  </UserProfilePopover>
                )}
              </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                {/* Информация об обмене */}
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="grid grid-cols-[1fr,auto] gap-4 pb-3">
                    {/* Левая колонка - направление и сумма */}
                    <div className="space-y-3">
                      <div className="text-sm">
                        <span className="text-muted-foreground">Направление:</span>
                        <div className="font-medium mt-1">{selectedExchange?.fromCurrency} → {selectedExchange?.toCurrency}</div>
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Сумма:</span>
                        <div className="font-medium mt-1">{selectedExchange?.amountFrom} → {selectedExchange?.amountTo}</div>
                      </div>
                    </div>
                    
                    {/* Правая колонка - курс */}
                    <div className="bg-primary/10 border-2 border-primary/20 rounded-lg p-2.5 flex items-center gap-2.5 min-w-[200px]">
                      <div className="bg-primary/20 p-1.5 rounded-lg">
                        <TrendingUp className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wide">Курс</div>
                        <div className="text-xl font-bold text-primary mt-0.5" data-testid="text-exchange-rate">{selectedExchange?.rate}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Блок с деталями платежа */}
                {(selectedExchange?.walletAddress || 
                  selectedExchange?.cardNumber || 
                  selectedExchange?.manualCardNumber || 
                  selectedExchange?.cardAccountNumber ||
                  selectedExchange?.cardFirstName ||
                  selectedExchange?.cardLastName ||
                  selectedExchange?.cardPhone ||
                  selectedExchange?.cardCountry ||
                  selectedExchange?.cardBankName ||
                  selectedExchange?.cardName ||
                  (selectedExchange?.tempBalance && parseFloat(selectedExchange.tempBalance) > 0)) && (
                  <div className="bg-primary/10 border-2 border-primary/20 rounded-lg p-4 space-y-3">
                    {selectedExchange?.walletAddress && (
                      <div>
                        <span className="text-muted-foreground text-sm">Кошелек:</span>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="flex-1 bg-background px-3 py-1.5 rounded text-sm font-mono">
                            {selectedExchange.walletAddress}
                          </code>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => copyWalletAddress(selectedExchange.walletAddress!)}
                            data-testid="button-copy-wallet"
                          >
                            {copiedWallet ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    {(selectedExchange?.cardNumber || 
                      selectedExchange?.manualCardNumber || 
                      selectedExchange?.cardAccountNumber ||
                      selectedExchange?.cardFirstName ||
                      selectedExchange?.cardLastName ||
                      selectedExchange?.cardPhone ||
                      selectedExchange?.cardCountry ||
                      selectedExchange?.cardBankName ||
                      selectedExchange?.cardName) && (
                      <div>
                        <span className="text-muted-foreground text-sm">Реквизиты получателя:</span>
                        <button
                          type="button"
                          onClick={() => setIsCardDetailsModalOpen(true)}
                          className="w-full mt-1 bg-background hover:bg-muted px-3 py-2 rounded text-left transition-colors"
                          data-testid="button-card-details"
                        >
                          {selectedExchange.cardName && (
                            <div className="text-primary font-medium text-sm mb-1">{selectedExchange.cardName}</div>
                          )}
                          <div className="font-mono text-sm">
                            {(() => {
                              const parts = [];
                              if (selectedExchange.cardNumber) {
                                parts.push(formatCardNumber(selectedExchange.cardNumber));
                              } else if (selectedExchange.manualCardNumber) {
                                parts.push(formatCardNumber(selectedExchange.manualCardNumber));
                              }
                              if (selectedExchange.cardAccountNumber) {
                                parts.push(selectedExchange.cardAccountNumber);
                              }
                              return parts.join('  ');
                            })()}
                          </div>
                        </button>
                      </div>
                    )}
                    
                    {selectedExchange?.tempBalance && parseFloat(selectedExchange.tempBalance) > 0 && (
                      <div>
                        <span className="text-muted-foreground text-sm">Оплата с внутреннего баланса:</span>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="flex-1 bg-background px-3 py-1.5 rounded text-sm font-mono font-semibold text-primary" data-testid="text-temp-balance">
                            {selectedExchange.tempBalance} {selectedExchange.fromCurrency}
                          </code>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Управление статусом */}
                <div className="bg-muted/50 rounded-lg p-4 space-y-4">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Статус обмена</FormLabel>
                        <FormControl>
                          <RadioGroup onValueChange={field.onChange} value={field.value} className="grid grid-cols-3 gap-2">
                            <div className="flex items-center">
                              <RadioGroupItem value="wait" id="status-wait" className="peer sr-only" />
                              <Label
                                htmlFor="status-wait"
                                className="w-full text-center px-3 py-2 text-sm rounded-md cursor-pointer transition-colors border-2 peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground peer-data-[state=checked]:border-primary"
                              >
                                Ожидание
                              </Label>
                            </div>
                            <div className="flex items-center">
                              <RadioGroupItem value="wait-paid" id="status-wait-paid" className="peer sr-only" />
                              <Label
                                htmlFor="status-wait-paid"
                                className="w-full text-center px-3 py-2 text-sm rounded-md cursor-pointer transition-colors border-2 peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground peer-data-[state=checked]:border-primary"
                              >
                                Ожидание оплаты
                              </Label>
                            </div>
                            <div className="flex items-center">
                              <RadioGroupItem value="paid" id="status-paid" className="peer sr-only" />
                              <Label
                                htmlFor="status-paid"
                                className="w-full text-center px-3 py-2 text-sm rounded-md cursor-pointer transition-colors border-2 peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground peer-data-[state=checked]:border-primary"
                              >
                                Оплачено
                              </Label>
                            </div>
                            <div className="flex items-center">
                              <RadioGroupItem value="complete" id="status-complete" className="peer sr-only" />
                              <Label
                                htmlFor="status-complete"
                                className="w-full text-center px-3 py-2 text-sm rounded-md cursor-pointer transition-colors border-2 peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground peer-data-[state=checked]:border-primary"
                              >
                                Завершено
                              </Label>
                            </div>
                            <div className="flex items-center">
                              <RadioGroupItem value="canceled" id="status-canceled" className="peer sr-only" />
                              <Label
                                htmlFor="status-canceled"
                                className="w-full text-center px-3 py-2 text-sm rounded-md cursor-pointer transition-colors border-2 peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground peer-data-[state=checked]:border-primary"
                              >
                                Отменено
                              </Label>
                            </div>
                            <div className="flex items-center">
                              <RadioGroupItem value="dispute" id="status-dispute" className="peer sr-only" />
                              <Label
                                htmlFor="status-dispute"
                                className="w-full text-center px-3 py-2 text-sm rounded-md cursor-pointer transition-colors border-2 peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground peer-data-[state=checked]:border-primary"
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
                  
                  {/* Хеш транзакции - только для wait-paid */}
                  {form.watch("status") === "wait-paid" && (
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
                  )}
                  
                  {/* Причина отмены - только для canceled */}
                  {form.watch("status") === "canceled" && (
                    <FormField
                      control={form.control}
                      name="cancelReason"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Причина отмены</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Укажите причину отмены" data-testid="input-cancel-reason" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
                
                <div className="flex justify-end space-x-2 pt-2">
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

        {/* Card Details Modal */}
        <Dialog open={isCardDetailsModalOpen} onOpenChange={setIsCardDetailsModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Реквизиты карты получателя</DialogTitle>
              <DialogDescription>
                Полная информация о реквизитах карты для выполнения перевода
              </DialogDescription>
            </DialogHeader>
            
            {selectedExchange && (
              <div className="space-y-3 mt-4">
                {/* Card Name */}
                {selectedExchange.cardName && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="text-xs text-muted-foreground mb-1">Название</div>
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{selectedExchange.cardName}</div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(selectedExchange.cardName!, 'cardName')}
                        data-testid="button-copy-name"
                      >
                        {copiedField === 'cardName' ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Full Name */}
                {(selectedExchange.cardFirstName || selectedExchange.cardLastName) && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="text-xs text-muted-foreground mb-1">Имя и Фамилия</div>
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{selectedExchange.cardFirstName} {selectedExchange.cardLastName}</div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(`${selectedExchange.cardFirstName} ${selectedExchange.cardLastName}`, 'fullName')}
                        data-testid="button-copy-fullname"
                      >
                        {copiedField === 'fullName' ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Phone */}
                {selectedExchange.cardPhone && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="text-xs text-muted-foreground mb-1">Телефон</div>
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{selectedExchange.cardPhone}</div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(selectedExchange.cardPhone!, 'phone')}
                        data-testid="button-copy-phone"
                      >
                        {copiedField === 'phone' ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Country */}
                {selectedExchange.cardCountry && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="text-xs text-muted-foreground mb-1">Страна</div>
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{selectedExchange.cardCountry}</div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(selectedExchange.cardCountry!, 'country')}
                        data-testid="button-copy-country"
                      >
                        {copiedField === 'country' ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Bank */}
                {selectedExchange.cardBankName && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="text-xs text-muted-foreground mb-1">Банк</div>
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{selectedExchange.cardBankName}</div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(selectedExchange.cardBankName!, 'bank')}
                        data-testid="button-copy-bank"
                      >
                        {copiedField === 'bank' ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Card Number */}
                {selectedExchange.cardNumber && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="text-xs text-muted-foreground mb-1">Номер карты</div>
                    <div className="flex items-center justify-between">
                      <div className="font-mono">{formatCardNumber(selectedExchange.cardNumber)}</div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(selectedExchange.cardNumber!, 'card')}
                        data-testid="button-copy-card-number"
                      >
                        {copiedField === 'card' ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Account Number */}
                {selectedExchange.cardAccountNumber && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="text-xs text-muted-foreground mb-1">Номер счета</div>
                    <div className="flex items-center justify-between">
                      <div className="font-mono">{selectedExchange.cardAccountNumber}</div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(selectedExchange.cardAccountNumber!, 'account')}
                        data-testid="button-copy-account"
                      >
                        {copiedField === 'account' ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Manual Card Number (fallback) */}
                {!selectedExchange.cardNumber && selectedExchange.manualCardNumber && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="text-xs text-muted-foreground mb-1">Номер карты (вручную)</div>
                    <div className="flex items-center justify-between">
                      <div className="font-mono">{formatCardNumber(selectedExchange.manualCardNumber)}</div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(selectedExchange.manualCardNumber!, 'manualCard')}
                        data-testid="button-copy-manual-card"
                      >
                        {copiedField === 'manualCard' ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
