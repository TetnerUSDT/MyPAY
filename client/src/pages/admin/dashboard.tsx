import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { adminRequest, getAdminCredentials, clearAdminCredentials, getAdminPath } from "@/lib/adminApi";
import { 
  Users, Wallet, ArrowRightLeft, CreditCard, DollarSign, 
  MessageSquare, Settings, LogOut, LayoutDashboard, Landmark, TrendingUp, Bell, Send, Shield, Store
} from "lucide-react";

interface AdminInfo {
  username: string;
  isSuperAdmin: boolean;
  permissions: string[];
}

export default function AdminDashboard() {
  const [adminInfo, setAdminInfo] = useState<AdminInfo | null>(null);
  const [adminPath, setAdminPath] = useState<string>('admin');
  const [, setLocation] = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const path = await getAdminPath();
        setAdminPath(path);
        
        const creds = getAdminCredentials();
        if (!creds) {
          setLocation(`/${path}/login`);
          return;
        }

        const info = await adminRequest('/auth/check');
        setAdminInfo(info);
      } catch (error) {
        const path = await getAdminPath();
        setLocation(`/${path}/login`);
      }
    };

    checkAuth();
  }, [setLocation]);

  const handleLogout = () => {
    clearAdminCredentials();
    setLocation(`/${adminPath}/login`);
  };

  const menuItems = [
    { icon: DollarSign, title: "Балансы", description: "Управление балансами", path: `/${adminPath}/balances` },
    { icon: ArrowRightLeft, title: "Обмены", description: "Управление заявками", path: `/${adminPath}/exchanges` },
    { icon: CreditCard, title: "Страны", description: "Настройка стран", path: `/${adminPath}/cards` },
    { icon: Landmark, title: "Банки", description: "Управление банками", path: `/${adminPath}/banks` },
    { icon: TrendingUp, title: "Курсы обмена", description: "Настройка курсов", path: `/${adminPath}/exchange-rates` },
    { icon: Bell, title: "Интерактив", description: "Уведомления и счета", path: `/${adminPath}/interactive` },
    { icon: MessageSquare, title: "Поддержка", description: "Чаты с пользователями", path: `/${adminPath}/support` },
    { icon: Users, title: "Пользователи", description: "Управление пользователями", path: `/${adminPath}/users` },
    { icon: Wallet, title: "Кошельки", description: "Управление кошельками", path: `/${adminPath}/wallets` },
    { icon: Send, title: "Telegram Bot", description: "Настройка Telegram бота", path: `/${adminPath}/telegram` },
    { icon: Shield, title: "P2P Обменник", description: "Споры, мерчанты, сделки, логи", path: `/${adminPath}/p2p` },
    { icon: Store, title: "Business", description: "Магазины мерчантов, одобрение, статистика", path: `/${adminPath}/business` },
  ];

  if (!adminInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <LayoutDashboard className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Админ панель</h1>
              <p className="text-sm text-muted-foreground">
                {adminInfo.username} {adminInfo.isSuperAdmin && "(Супер админ)"}
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout} data-testid="button-admin-logout">
            <LogOut className="h-4 w-4 mr-2" />
            Выход
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Панель управления</h2>
          <p className="text-muted-foreground">
            Выберите раздел для управления системой
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {menuItems.map((item, index) => (
            <Link key={index} href={item.path}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full" data-testid={`card-menu-${item.title.toLowerCase()}`}>
                <CardHeader>
                  <div className="flex items-center space-x-2">
                    <item.icon className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{item.title}</CardTitle>
                  </div>
                  <CardDescription>{item.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
