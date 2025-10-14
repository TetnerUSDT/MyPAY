import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { adminRequest } from "@/lib/adminApi";
import { queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, XCircle, RefreshCw, Send, Command, Navigation } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

// Commands Tab Component
function CommandsTab() {
  const { toast } = useToast();

  const { data: commands, isLoading } = useQuery({
    queryKey: ['/admin/api/bot/commands'],
    queryFn: () => adminRequest('/bot/commands'),
  });

  return (
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
            <Button data-testid="button-add-command">
              <Command className="h-4 w-4 mr-2" />
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
                  <div>
                    <div className="font-medium">{cmd.command}</div>
                    {cmd.description && (
                      <div className="text-sm text-muted-foreground">{cmd.description}</div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Badge variant={cmd.isActive ? "default" : "secondary"}>
                      {cmd.isActive ? "Активна" : "Неактивна"}
                    </Badge>
                    <Button variant="outline" size="sm">Редактировать</Button>
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
  );
}

// Navigation Tab Component
function NavigationTab() {
  const { toast } = useToast();

  const { data: menus, isLoading } = useQuery({
    queryKey: ['/admin/api/bot/menus'],
    queryFn: () => adminRequest('/bot/menus'),
  });

  return (
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
            <Button data-testid="button-add-menu">
              <Navigation className="h-4 w-4 mr-2" />
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
                  <div className="flex gap-2">
                    {menu.isRoot && (
                      <Badge variant="default">Корневое</Badge>
                    )}
                    <Badge variant={menu.isActive ? "default" : "secondary"}>
                      {menu.isActive ? "Активно" : "Неактивно"}
                    </Badge>
                    <Button variant="outline" size="sm">Редактировать</Button>
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
