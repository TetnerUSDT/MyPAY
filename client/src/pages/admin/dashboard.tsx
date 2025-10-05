import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { adminRequest, getAdminCredentials, clearAdminCredentials, getAdminPath } from "@/lib/adminApi";
import { 
  Users, Wallet, ArrowRightLeft, CreditCard, DollarSign, 
  MessageSquare, Settings, LogOut, LayoutDashboard 
} from "lucide-react";

interface AdminInfo {
  username: string;
  isSuperAdmin: boolean;
  permissions: string[];
}

export default function AdminDashboard() {
  const [adminInfo, setAdminInfo] = useState<AdminInfo | null>(null);
  const [, setLocation] = useLocation();
  const adminPath = getAdminPath();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const creds = getAdminCredentials();
        if (!creds) {
          setLocation(`/${adminPath}/login`);
          return;
        }

        const info = await adminRequest('/auth/check');
        setAdminInfo(info);
      } catch (error) {
        setLocation(`/${adminPath}/login`);
      }
    };

    checkAuth();
  }, [adminPath, setLocation]);

  const handleLogout = () => {
    clearAdminCredentials();
    setLocation(`/${adminPath}/login`);
  };

  const menuItems = [
    { icon: ArrowRightLeft, title: "Обмены", description: "Управление заявками", path: `/${adminPath}/exchanges` },
    { icon: Users, title: "Пользователи", description: "Управление пользователями", path: `/${adminPath}/users` },
    { icon: Wallet, title: "Кошельки", description: "Управление кошельками", path: `/${adminPath}/wallets` },
    { icon: CreditCard, title: "Карты и банки", description: "Настройка стран и банков", path: `/${adminPath}/cards` },
    { icon: DollarSign, title: "Балансы", description: "Управление балансами", path: `/${adminPath}/balances` },
    { icon: DollarSign, title: "Курсы обмена", description: "Настройка курсов", path: `/${adminPath}/rates` },
    { icon: MessageSquare, title: "Поддержка", description: "Тикеты и сообщения", path: `/${adminPath}/support` },
    { icon: Settings, title: "Администраторы", description: "Управление админами", path: `/${adminPath}/admins` },
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
