import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { adminRequest } from "@/lib/adminApi";
import { queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, XCircle, RefreshCw, Send, Command, Navigation, Pencil, Trash2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// Command form schema
const commandFormSchema = z.object({
  command: z.string().min(1, "Команда обязательна").regex(/^[/a-zA-Z0-9_\u0400-\u04FF\s]+$/, "Команда может содержать буквы, цифры, подчеркивания и /"),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});

type CommandFormValues = z.infer<typeof commandFormSchema>;

// Menu form schema
const menuFormSchema = z.object({
  title: z.string().min(1, "Название меню обязательно"),
  keyboardType: z.enum(["reply", "inline"]).default("reply"),
  rows: z.number().min(1).max(10).default(3),
  columns: z.number().min(1).max(4).default(2),
  isRoot: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

type MenuFormValues = z.infer<typeof menuFormSchema>;

// Button form schema
const buttonFormSchema = z.object({
  text: z.string().min(1, "Текст кнопки обязателен"),
  rowIndex: z.number().min(0),
  columnIndex: z.number().min(0),
  actionType: z.enum(["command", "url", "callback"]).default("command"),
  actionValue: z.string().optional(),
  isActive: z.boolean().default(true),
});

type ButtonFormValues = z.infer<typeof buttonFormSchema>;

// Webhook Tab Component
function WebhookTab() {
  const [customWebhookUrl, setCustomWebhookUrl] = useState("");
  const { toast } = useToast();

  const { data: webhookInfo, isLoading } = useQuery({
    queryKey: ['/admin/api/telegram/webhook/info'],
    queryFn: () => adminRequest('/telegram/webhook/info'),
  });

  const setWebhookMutation = useMutation({
    mutationFn: (webhookUrl?: string) => 
      adminRequest('/telegram/webhook/set', {
        method: 'POST',
        body: JSON.stringify({ webhookUrl }),
      }),
    onSuccess: (data) => {
      if (data.ok) {
        toast({
          title: "Успех",
          description: data.message,
        });
        queryClient.invalidateQueries({ queryKey: ['/admin/api/telegram/webhook/info'] });
        setCustomWebhookUrl("");
      } else {
        toast({
          title: "Ошибка",
          description: data.message,
          variant: "destructive",
        });
      }
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось установить webhook",
        variant: "destructive",
      });
    },
  });

  const deleteWebhookMutation = useMutation({
    mutationFn: () => 
      adminRequest('/telegram/webhook', {
        method: 'DELETE',
      }),
    onSuccess: (data) => {
      if (data.ok) {
        toast({
          title: "Успех",
          description: data.message,
        });
        queryClient.invalidateQueries({ queryKey: ['/admin/api/telegram/webhook/info'] });
      } else {
        toast({
          title: "Ошибка",
          description: data.message,
          variant: "destructive",
        });
      }
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось удалить webhook",
        variant: "destructive",
      });
    },
  });

  const handleSetWebhook = () => {
    setWebhookMutation.mutate(customWebhookUrl || undefined);
  };

  const handleDeleteWebhook = () => {
    deleteWebhookMutation.mutate();
  };

  const isWebhookSet = webhookInfo?.info?.url && webhookInfo.info.url !== "";
  const webhookStatus = webhookInfo?.info;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Статус Webhook
            <Button
              variant="ghost"
              size="sm"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['/admin/api/telegram/webhook/info'] })}
              data-testid="button-refresh-webhook"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardTitle>
          <CardDescription>
            Текущее состояние webhook для Telegram бота
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div>Загрузка...</div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Статус:</span>
                {isWebhookSet ? (
                  <Badge variant="default" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Активен
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1">
                    <XCircle className="h-3 w-3" />
                    Не настроен
                  </Badge>
                )}
              </div>

              {webhookStatus?.url && (
                <div className="space-y-2">
                  <div>
                    <span className="text-sm font-medium">URL:</span>
                    <div className="mt-1 p-2 bg-muted rounded-md">
                      <code className="text-xs break-all">{webhookStatus.url}</code>
                    </div>
                  </div>

                  {webhookStatus.pending_update_count !== undefined && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Ожидающих обновлений:</span>
                      <Badge variant="outline">{webhookStatus.pending_update_count}</Badge>
                    </div>
                  )}

                  {webhookStatus.last_error_message && (
                    <Alert variant="destructive">
                      <AlertDescription>
                        <strong>Последняя ошибка:</strong> {webhookStatus.last_error_message}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Настроить Webhook</CardTitle>
          <CardDescription>
            Установите webhook для получения обновлений от Telegram
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              URL Webhook (оставьте пустым для автоопределения)
            </label>
            <Input
              placeholder="https://your-domain.com/api/telegram/webhook"
              value={customWebhookUrl}
              onChange={(e) => setCustomWebhookUrl(e.target.value)}
              data-testid="input-webhook-url"
            />
            <p className="text-xs text-muted-foreground">
              Если оставить пустым, система попытается автоматически определить URL на основе домена Replit
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleSetWebhook}
              disabled={setWebhookMutation.isPending}
              data-testid="button-set-webhook"
            >
              <Send className="h-4 w-4 mr-2" />
              {setWebhookMutation.isPending ? "Настройка..." : "Установить Webhook"}
            </Button>

            {isWebhookSet && (
              <Button
                variant="destructive"
                onClick={handleDeleteWebhook}
                disabled={deleteWebhookMutation.isPending}
                data-testid="button-delete-webhook"
              >
                {deleteWebhookMutation.isPending ? "Удаление..." : "Удалить Webhook"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Инструкция по настройке</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <ol className="list-decimal list-inside space-y-2">
            <li>Убедитесь, что у вас есть действующий Telegram Bot Token</li>
            <li>Убедитесь, что сервер доступен из интернета</li>
            <li>Нажмите "Установить Webhook" для автоматической настройки</li>
            <li>После установки webhook, отправьте команду /start боту в Telegram</li>
            <li>Проверьте логи сервера для отладки, если что-то не работает</li>
          </ol>

          <Alert className="mt-4">
            <AlertDescription>
              <strong>Важно:</strong> Для работы webhook необходимо, чтобы переменная окружения 
              TELEGRAM_BOT_TOKEN была правильно настроена.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}

// Command Dialog Component
function CommandDialog({ 
  command, 
  open, 
  onOpenChange 
}: { 
  command?: any; 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const isEdit = !!command;

  const form = useForm<CommandFormValues>({
    resolver: zodResolver(commandFormSchema),
    defaultValues: {
      command: "",
      description: "",
      isActive: true,
    },
  });

  // Reset form when command changes or dialog opens
  useEffect(() => {
    if (open) {
      form.reset({
        command: command?.command || "",
        description: command?.description || "",
        isActive: command?.isActive ?? true,
      });
    }
  }, [command, open, form]);

  const createMutation = useMutation({
    mutationFn: (data: CommandFormValues) =>
      adminRequest('/bot/commands', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      toast({
        title: "Успех",
        description: "Команда успешно создана",
      });
      queryClient.invalidateQueries({ queryKey: ['/admin/api/bot/commands'] });
      onOpenChange(false);
      form.reset();
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось создать команду",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: CommandFormValues) =>
      adminRequest(`/bot/commands/${command.id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      toast({
        title: "Успех",
        description: "Команда успешно обновлена",
      });
      queryClient.invalidateQueries({ queryKey: ['/admin/api/bot/commands'] });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось обновить команду",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CommandFormValues) => {
    if (isEdit) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Редактировать команду" : "Добавить команду"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Обновите данные команды бота" : "Создайте новую команду для Telegram бота"}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="command"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Команда</FormLabel>
                  <FormControl>
                    <Input placeholder="/start или Текст кнопки" {...field} data-testid="input-command" />
                  </FormControl>
                  <FormDescription>
                    Команда или текст кнопки, которую бот будет распознавать
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Описание (опционально)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Краткое описание команды"
                      {...field}
                      data-testid="input-description"
                    />
                  </FormControl>
                  <FormDescription>
                    Внутреннее описание для администраторов
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Активна</FormLabel>
                    <FormDescription>
                      Бот будет отвечать на эту команду
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-active"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel"
              >
                Отмена
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save"
              >
                {(createMutation.isPending || updateMutation.isPending) ? "Сохранение..." : "Сохранить"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// Reaction Form Dialog Component
function ReactionFormDialog({
  reaction,
  commandId,
  open,
  onOpenChange
}: {
  reaction: any;
  commandId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();

  const reactionFormSchema = z.object({
    reactionType: z.string().min(1, "Тип реакции обязателен"),
    textContent: z.string().optional(),
    endpointUrl: z.string().optional(),
    endpointMethod: z.string().optional(),
    conditions: z.string().optional(),
    priority: z.number().min(0).default(0),
    isActive: z.boolean().default(true),
  });

  const form = useForm({
    resolver: zodResolver(reactionFormSchema),
    defaultValues: {
      reactionType: "text",
      textContent: "",
      endpointUrl: "",
      endpointMethod: "GET",
      conditions: "",
      priority: 0,
      isActive: true,
    },
  });

  useEffect(() => {
    if (reaction) {
      form.reset({
        reactionType: reaction.reactionType || "text",
        textContent: reaction.textContent || "",
        endpointUrl: reaction.endpointUrl || "",
        endpointMethod: reaction.endpointMethod || "GET",
        conditions: reaction.conditions ? JSON.stringify(reaction.conditions, null, 2) : "",
        priority: reaction.priority || 0,
        isActive: reaction.isActive ?? true,
      });
    } else {
      form.reset({
        reactionType: "text",
        textContent: "",
        endpointUrl: "",
        endpointMethod: "GET",
        conditions: "",
        priority: 0,
        isActive: true,
      });
    }
  }, [reaction, form]);

  const createMutation = useMutation({
    mutationFn: (data: any) =>
      adminRequest(`/bot/commands/${commandId}/reactions`, {
        method: 'POST',
        body: JSON.stringify({ ...data, commandId: parseInt(commandId!) }),
      }),
    onSuccess: () => {
      toast({ title: "Успех", description: "Реакция успешно создана" });
      queryClient.invalidateQueries({ queryKey: ['/admin/api/bot/commands', commandId, 'reactions'] });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось создать реакцию", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) =>
      adminRequest(`/bot/reactions/${reaction?.id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      toast({ title: "Успех", description: "Реакция успешно обновлена" });
      queryClient.invalidateQueries({ queryKey: ['/admin/api/bot/commands', commandId, 'reactions'] });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось обновить реакцию", variant: "destructive" });
    },
  });

  const onSubmit = (data: any) => {
    try {
      const payload = { ...data };
      // Parse conditions JSON if provided
      if (payload.conditions && payload.conditions.trim()) {
        try {
          payload.conditions = JSON.parse(payload.conditions);
        } catch (e) {
          toast({
            title: "Ошибка",
            description: "Некорректный JSON в поле условий",
            variant: "destructive",
          });
          return;
        }
      } else {
        payload.conditions = null;
      }

      if (reaction) {
        updateMutation.mutate(payload);
      } else {
        createMutation.mutate(payload);
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось обработать данные формы",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{reaction ? "Редактировать реакцию" : "Добавить реакцию"}</DialogTitle>
          <DialogDescription>
            {reaction ? "Обновите параметры реакции" : "Создайте новую реакцию для команды"}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="reactionType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Тип реакции</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-reaction-type">
                        <SelectValue placeholder="Выберите тип реакции" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="text">Текст</SelectItem>
                      <SelectItem value="endpoint">API Endpoint</SelectItem>
                      <SelectItem value="mixed">Текст + Endpoint</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {(form.watch("reactionType") === "text" || form.watch("reactionType") === "mixed") && (
              <FormField
                control={form.control}
                name="textContent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Текстовое содержимое</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Введите текст ответа" {...field} data-testid="input-text-content" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {(form.watch("reactionType") === "endpoint" || form.watch("reactionType") === "mixed") && (
              <>
                <FormField
                  control={form.control}
                  name="endpointUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Endpoint URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://api.example.com/webhook" {...field} data-testid="input-endpoint-url" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endpointMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>HTTP метод</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-endpoint-method">
                            <SelectValue placeholder="Выберите метод" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="GET">GET</SelectItem>
                          <SelectItem value="POST">POST</SelectItem>
                          <SelectItem value="PUT">PUT</SelectItem>
                          <SelectItem value="PATCH">PATCH</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Приоритет</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                      data-testid="input-priority"
                    />
                  </FormControl>
                  <FormDescription>Чем выше число, тем выше приоритет</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="conditions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Условия выполнения (JSON)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder='[{"field": "userId", "operator": "equals", "value": "123", "action": "execute"}]'
                      className="font-mono text-sm"
                      rows={4}
                      {...field}
                      data-testid="input-conditions"
                    />
                  </FormControl>
                  <FormDescription>
                    JSON массив условий для выполнения реакции (опционально)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Активна</FormLabel>
                    <FormDescription>Реакция будет выполняться</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-is-active" />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel">
                Отмена
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save">
                {reaction ? "Обновить" : "Создать"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// Reactions Dialog Component
function ReactionsDialog({
  commandId,
  open,
  onOpenChange
}: {
  commandId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editingReaction, setEditingReaction] = useState<any>(null);

  const { data: reactions, isLoading } = useQuery({
    queryKey: ['/admin/api/bot/commands', commandId, 'reactions'],
    queryFn: () => commandId ? adminRequest(`/bot/commands/${commandId}/reactions`) : Promise.resolve([]),
    enabled: !!commandId && open,
  });

  const deleteMutation = useMutation({
    mutationFn: (reactionId: number) =>
      adminRequest(`/bot/commands/${commandId}/reactions/${reactionId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      toast({ title: "Успех", description: "Реакция успешно удалена" });
      queryClient.invalidateQueries({ queryKey: ['/admin/api/bot/commands', commandId, 'reactions'] });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось удалить реакцию", variant: "destructive" });
    },
  });

  const handleEdit = (reaction: any) => {
    setEditingReaction(reaction);
    setFormOpen(true);
  };

  const handleAdd = () => {
    setEditingReaction(null);
    setFormOpen(true);
  };

  const handleDelete = (reactionId: number) => {
    if (confirm("Вы уверены, что хотите удалить эту реакцию?")) {
      deleteMutation.mutate(reactionId);
    }
  };

  return (
    <>
      <ReactionFormDialog
        reaction={editingReaction}
        commandId={commandId}
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingReaction(null);
        }}
      />

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Управление реакциями команды</DialogTitle>
            <DialogDescription>
              Создавайте и редактируйте реакции для этой команды
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {isLoading ? (
              <div>Загрузка...</div>
            ) : reactions && reactions.length > 0 ? (
              <div className="space-y-2">
                {reactions.map((reaction: any) => (
                  <div
                    key={reaction.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                    data-testid={`reaction-item-${reaction.id}`}
                  >
                    <div>
                      <div className="font-medium">{reaction.reactionType}</div>
                      <div className="text-sm text-muted-foreground">
                        Приоритет: {reaction.priority}
                        {reaction.textContent && ` • ${reaction.textContent.substring(0, 50)}...`}
                      </div>
                    </div>
                    <div className="flex gap-2 items-center">
                      <Badge variant={reaction.isActive ? "default" : "secondary"}>
                        {reaction.isActive ? "Активна" : "Неактивна"}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(reaction)}
                        data-testid={`button-edit-reaction-${reaction.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(reaction.id)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-reaction-${reaction.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                Реакции не найдены. Добавьте первую реакцию.
              </div>
            )}
            <Button className="w-full" variant="outline" onClick={handleAdd} data-testid="button-add-reaction">
              <Plus className="h-4 w-4 mr-2" />
              Добавить реакцию
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Commands Tab Component
function CommandsTab() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCommand, setEditingCommand] = useState<any>(null);
  const [reactionsDialogOpen, setReactionsDialogOpen] = useState(false);
  const [selectedCommandId, setSelectedCommandId] = useState<string | null>(null);

  const { data: commands, isLoading } = useQuery({
    queryKey: ['/admin/api/bot/commands'],
    queryFn: () => adminRequest('/bot/commands'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      adminRequest(`/bot/commands/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      toast({
        title: "Успех",
        description: "Команда успешно удалена",
      });
      queryClient.invalidateQueries({ queryKey: ['/admin/api/bot/commands'] });
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось удалить команду",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (cmd: any) => {
    setEditingCommand(cmd);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingCommand(null);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Вы уверены, что хотите удалить эту команду?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleManageReactions = (commandId: string) => {
    setSelectedCommandId(commandId);
    setReactionsDialogOpen(true);
  };

  return (
    <>
      <CommandDialog
        command={editingCommand}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingCommand(null);
        }}
      />
      
      <ReactionsDialog
        commandId={selectedCommandId}
        open={reactionsDialogOpen}
        onOpenChange={(open) => {
          setReactionsDialogOpen(open);
          if (!open) setSelectedCommandId(null);
        }}
      />
      
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Команды Бота</CardTitle>
                <CardDescription>
                  Управление командами Telegram бота
                </CardDescription>
              </div>
              <Button onClick={handleAdd} data-testid="button-add-command">
                <Plus className="h-4 w-4 mr-2" />
                Добавить команду
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div>Загрузка...</div>
            ) : commands && commands.length > 0 ? (
              <div className="space-y-2">
                {commands.map((cmd: any) => (
                  <div
                    key={cmd.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                    data-testid={`command-item-${cmd.id}`}
                  >
                    <div className="flex-1">
                      <div className="font-medium">{cmd.command}</div>
                      {cmd.description && (
                        <div className="text-sm text-muted-foreground">{cmd.description}</div>
                      )}
                    </div>
                    <div className="flex gap-2 items-center">
                      <Badge variant={cmd.isActive ? "default" : "secondary"}>
                        {cmd.isActive ? "Активна" : "Неактивна"}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleManageReactions(cmd.id)}
                        data-testid={`button-manage-reactions-${cmd.id}`}
                      >
                        Реакции
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(cmd)}
                        data-testid={`button-edit-${cmd.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(cmd.id)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-${cmd.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                Команды не найдены. Добавьте первую команду.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// Menu Dialog Component
function MenuDialog({
  menu,
  open,
  onOpenChange
}: {
  menu?: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const isEdit = !!menu;

  const form = useForm<MenuFormValues>({
    resolver: zodResolver(menuFormSchema),
    defaultValues: {
      title: "",
      keyboardType: "reply",
      rows: 3,
      columns: 2,
      isRoot: false,
      isActive: true,
    },
  });

  // Reset form when menu changes or dialog opens
  useEffect(() => {
    if (open) {
      form.reset({
        title: menu?.title || "",
        keyboardType: menu?.keyboardType || "reply",
        rows: menu?.rows || 3,
        columns: menu?.columns || 2,
        isRoot: menu?.isRoot || false,
        isActive: menu?.isActive ?? true,
      });
    }
  }, [menu, open, form]);

  const createMutation = useMutation({
    mutationFn: (data: MenuFormValues) =>
      adminRequest('/bot/menus', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      toast({
        title: "Успех",
        description: "Меню успешно создано",
      });
      queryClient.invalidateQueries({ queryKey: ['/admin/api/bot/menus'] });
      onOpenChange(false);
      form.reset();
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось создать меню",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: MenuFormValues) =>
      adminRequest(`/bot/menus/${menu.id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      toast({
        title: "Успех",
        description: "Меню успешно обновлено",
      });
      queryClient.invalidateQueries({ queryKey: ['/admin/api/bot/menus'] });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось обновить меню",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: MenuFormValues) => {
    if (isEdit) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Редактировать меню" : "Добавить меню"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Обновите настройки меню" : "Создайте новое меню для бота"}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Название меню</FormLabel>
                  <FormControl>
                    <Input placeholder="Главное меню" {...field} data-testid="input-menu-title" />
                  </FormControl>
                  <FormDescription>
                    Внутреннее название для идентификации
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="rows"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Строк</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min={1}
                        max={10}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                        data-testid="input-rows"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="columns"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Столбцов</FormLabel>
                    <FormControl>
                      <Input 
                        type="number"
                        min={1}
                        max={4}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                        data-testid="input-columns"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="isRoot"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Корневое меню</FormLabel>
                    <FormDescription>
                      Показывать при команде /start
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-root"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Активно</FormLabel>
                    <FormDescription>
                      Бот будет использовать это меню
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-menu-active"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-menu"
              >
                Отмена
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-menu"
              >
                {(createMutation.isPending || updateMutation.isPending) ? "Сохранение..." : "Сохранить"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// Button Form Dialog Component
function ButtonFormDialog({
  button,
  menuId,
  open,
  onOpenChange
}: {
  button: any;
  menuId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();

  const buttonFormSchema = z.object({
    text: z.string().min(1, "Текст кнопки обязателен"),
    rowIndex: z.number().min(0),
    columnIndex: z.number().min(0),
    actionType: z.string().min(1, "Тип действия обязателен"),
    actionValue: z.string().optional(),
    url: z.string().optional(),
    isActive: z.boolean().default(true),
  });

  const form = useForm({
    resolver: zodResolver(buttonFormSchema),
    defaultValues: {
      text: "",
      rowIndex: 0,
      columnIndex: 0,
      actionType: "command",
      actionValue: "",
      url: "",
      isActive: true,
    },
  });

  useEffect(() => {
    if (button) {
      form.reset({
        text: button.text || "",
        rowIndex: button.rowIndex || 0,
        columnIndex: button.columnIndex || 0,
        actionType: button.actionType || "command",
        actionValue: button.actionValue || "",
        url: button.url || "",
        isActive: button.isActive ?? true,
      });
    } else {
      form.reset({
        text: "",
        rowIndex: 0,
        columnIndex: 0,
        actionType: "command",
        actionValue: "",
        url: "",
        isActive: true,
      });
    }
  }, [button, form]);

  const createMutation = useMutation({
    mutationFn: (data: any) =>
      adminRequest(`/bot/menus/${menuId}/buttons`, {
        method: 'POST',
        body: JSON.stringify({ ...data, menuId: parseInt(menuId!) }),
      }),
    onSuccess: () => {
      toast({ title: "Успех", description: "Кнопка успешно создана" });
      queryClient.invalidateQueries({ queryKey: ['/admin/api/bot/menus', menuId, 'buttons'] });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось создать кнопку", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) =>
      adminRequest(`/bot/buttons/${button?.id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      toast({ title: "Успех", description: "Кнопка успешно обновлена" });
      queryClient.invalidateQueries({ queryKey: ['/admin/api/bot/menus', menuId, 'buttons'] });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось обновить кнопку", variant: "destructive" });
    },
  });

  const onSubmit = (data: any) => {
    if (button) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{button ? "Редактировать кнопку" : "Добавить кнопку"}</DialogTitle>
          <DialogDescription>
            {button ? "Обновите параметры кнопки" : "Создайте новую кнопку для меню"}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="text"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Текст кнопки</FormLabel>
                  <FormControl>
                    <Input placeholder="Введите текст кнопки" {...field} data-testid="input-button-text" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="rowIndex"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ряд (Row)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                        data-testid="input-row-index"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="columnIndex"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Колонка (Column)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                        data-testid="input-column-index"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="actionType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Тип действия</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-action-type">
                        <SelectValue placeholder="Выберите тип действия" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="command">Команда</SelectItem>
                      <SelectItem value="url">URL</SelectItem>
                      <SelectItem value="callback">Callback</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {(form.watch("actionType") === "command" || form.watch("actionType") === "callback") && (
              <FormField
                control={form.control}
                name="actionValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{form.watch("actionType") === "command" ? "Команда" : "Callback данные"}</FormLabel>
                    <FormControl>
                      <Input placeholder={form.watch("actionType") === "command" ? "/start" : "callback_data"} {...field} data-testid="input-action-value" />
                    </FormControl>
                    <FormDescription>
                      {form.watch("actionType") === "command" ? "Команда для выполнения" : "Данные для callback запроса"}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {form.watch("actionType") === "url" && (
              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://example.com" {...field} data-testid="input-url" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Активна</FormLabel>
                    <FormDescription>Кнопка будет отображаться в меню</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-is-active" />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel">
                Отмена
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save">
                {button ? "Обновить" : "Создать"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// Button Dialog Component for managing buttons of a menu
function ButtonDialog({
  menuId,
  open,
  onOpenChange
}: {
  menuId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editingButton, setEditingButton] = useState<any>(null);

  const { data: buttons, isLoading } = useQuery({
    queryKey: ['/admin/api/bot/menus', menuId, 'buttons'],
    queryFn: () => menuId ? adminRequest(`/bot/menus/${menuId}/buttons`) : Promise.resolve([]),
    enabled: !!menuId && open,
  });

  const deleteMutation = useMutation({
    mutationFn: (buttonId: number) =>
      adminRequest(`/bot/menus/${menuId}/buttons/${buttonId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      toast({ title: "Успех", description: "Кнопка успешно удалена" });
      queryClient.invalidateQueries({ queryKey: ['/admin/api/bot/menus', menuId, 'buttons'] });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось удалить кнопку", variant: "destructive" });
    },
  });

  const handleEdit = (btn: any) => {
    setEditingButton(btn);
    setFormOpen(true);
  };

  const handleAdd = () => {
    setEditingButton(null);
    setFormOpen(true);
  };

  const handleDelete = (buttonId: number) => {
    if (confirm("Вы уверены, что хотите удалить эту кнопку?")) {
      deleteMutation.mutate(buttonId);
    }
  };

  return (
    <>
      <ButtonFormDialog
        button={editingButton}
        menuId={menuId}
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingButton(null);
        }}
      />

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Управление кнопками меню</DialogTitle>
            <DialogDescription>
              Создавайте и редактируйте кнопки для этого меню
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {isLoading ? (
              <div>Загрузка...</div>
            ) : buttons && buttons.length > 0 ? (
              <div className="space-y-2">
                {buttons.map((btn: any) => (
                  <div
                    key={btn.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                    data-testid={`button-item-${btn.id}`}
                  >
                    <div>
                      <div className="font-medium">{btn.text}</div>
                      <div className="text-sm text-muted-foreground">
                        Позиция: Row {btn.rowIndex}, Col {btn.columnIndex} • {btn.actionType}
                      </div>
                    </div>
                    <div className="flex gap-2 items-center">
                      <Badge variant={btn.isActive ? "default" : "secondary"}>
                        {btn.isActive ? "Активна" : "Неактивна"}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(btn)}
                        data-testid={`button-edit-btn-${btn.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(btn.id)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-btn-${btn.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                Кнопки не найдены. Добавьте первую кнопку.
              </div>
            )}
            <Button className="w-full" variant="outline" onClick={handleAdd} data-testid="button-add-menu-button">
              <Plus className="h-4 w-4 mr-2" />
              Добавить кнопку
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Navigation Tab Component
function NavigationTab() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState<any>(null);
  const [buttonsDialogOpen, setButtonsDialogOpen] = useState(false);
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null);

  const { data: menus, isLoading } = useQuery({
    queryKey: ['/admin/api/bot/menus'],
    queryFn: () => adminRequest('/bot/menus'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      adminRequest(`/bot/menus/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      toast({
        title: "Успех",
        description: "Меню успешно удалено",
      });
      queryClient.invalidateQueries({ queryKey: ['/admin/api/bot/menus'] });
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось удалить меню",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (menu: any) => {
    setEditingMenu(menu);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingMenu(null);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Вы уверены, что хотите удалить это меню?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleManageButtons = (menuId: string) => {
    setSelectedMenuId(menuId);
    setButtonsDialogOpen(true);
  };

  return (
    <>
      <MenuDialog
        menu={editingMenu}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingMenu(null);
        }}
      />
      
      <ButtonDialog
        menuId={selectedMenuId}
        open={buttonsDialogOpen}
        onOpenChange={(open) => {
          setButtonsDialogOpen(open);
          if (!open) setSelectedMenuId(null);
        }}
      />
      
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Навигация и Меню</CardTitle>
                <CardDescription>
                  Управление меню и кнопками навигации бота
                </CardDescription>
              </div>
              <Button onClick={handleAdd} data-testid="button-add-menu">
                <Plus className="h-4 w-4 mr-2" />
                Добавить меню
              </Button>
            </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div>Загрузка...</div>
          ) : menus && menus.length > 0 ? (
            <div className="space-y-2">
              {menus.map((menu: any) => (
                <div
                  key={menu.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                  data-testid={`menu-item-${menu.id}`}
                >
                  <div>
                    <div className="font-medium">{menu.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {menu.keyboardType} • {menu.rows}x{menu.columns}
                    </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    {menu.isRoot && (
                      <Badge variant="default">Корневое</Badge>
                    )}
                    <Badge variant={menu.isActive ? "default" : "secondary"}>
                      {menu.isActive ? "Активно" : "Неактивно"}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleManageButtons(menu.id)}
                      data-testid={`button-manage-buttons-${menu.id}`}
                    >
                      Кнопки
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(menu)}
                      data-testid={`button-edit-menu-${menu.id}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(menu.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-menu-${menu.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              Меню не найдены. Добавьте первое меню.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </>
  );
}

// Main Component
export default function AdminTelegram() {
  return (
    <AdminLayout title="Telegram Bot" description="Управление Telegram ботом">
      <Tabs defaultValue="webhook" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="webhook" data-testid="tab-webhook">
            Webhook
          </TabsTrigger>
          <TabsTrigger value="commands" data-testid="tab-commands">
            <Command className="h-4 w-4 mr-2" />
            Команды
          </TabsTrigger>
          <TabsTrigger value="navigation" data-testid="tab-navigation">
            <Navigation className="h-4 w-4 mr-2" />
            Навигация
          </TabsTrigger>
        </TabsList>

        <TabsContent value="webhook" className="mt-6">
          <WebhookTab />
        </TabsContent>

        <TabsContent value="commands" className="mt-6">
          <CommandsTab />
        </TabsContent>

        <TabsContent value="navigation" className="mt-6">
          <NavigationTab />
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
