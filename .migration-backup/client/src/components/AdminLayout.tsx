import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { adminRequest, getAdminCredentials, clearAdminCredentials, getAdminPath } from "@/lib/adminApi";
import { LogOut, ArrowLeft } from "lucide-react";

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
  description?: string;
}

export function AdminLayout({ children, title, description }: AdminLayoutProps) {
  const [adminPath, setAdminPath] = useState<string>('admin');
  const [, setLocation] = useLocation();

  useEffect(() => {
    const init = async () => {
      try {
        const path = await getAdminPath();
        setAdminPath(path);
        
        const creds = getAdminCredentials();
        console.log('AdminLayout: checking credentials', { hasCreds: !!creds, path });
        
        if (!creds) {
          console.log('AdminLayout: no credentials, redirecting to login');
          setLocation(`/${path}/login`);
        }
      } catch (error) {
        console.error('AdminLayout init error:', error);
      }
    };
    init();
  }, [setLocation]);

  const handleLogout = async () => {
    clearAdminCredentials();
    const path = await getAdminPath();
    setLocation(`/${path}/login`);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href={`/${adminPath}/dashboard`}>
                <Button variant="ghost" size="sm" data-testid="button-back-dashboard">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Назад
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">{title}</h1>
                {description && <p className="text-sm text-muted-foreground">{description}</p>}
              </div>
            </div>
            <Button variant="outline" onClick={handleLogout} data-testid="button-logout">
              <LogOut className="h-4 w-4 mr-2" />
              Выход
            </Button>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
