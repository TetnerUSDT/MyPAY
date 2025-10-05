import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminRequest } from "@/lib/adminApi";
import { queryClient } from "@/lib/queryClient";
import { RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type User = {
  id: number;
  username: string;
  email: string | null;
  phoneNumber: string | null;
  telegramId: string | null;
  referralCode: string;
  agreedToTerms: boolean;
  createdAt: string;
};

export default function AdminUsers() {
  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ['/admin/api/users'],
    queryFn: () => adminRequest('/users'),
  });

  return (
    <AdminLayout title="Пользователи" description="Управление пользователями платформы">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Список пользователей</h2>
          <Button 
            variant="outline" 
            onClick={() => queryClient.invalidateQueries({ queryKey: ['/admin/api/users'] })}
            data-testid="button-refresh-users"
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
                  <TableHead>Имя пользователя</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Телефон</TableHead>
                  <TableHead>Telegram ID</TableHead>
                  <TableHead>Реферальный код</TableHead>
                  <TableHead>Соглашение</TableHead>
                  <TableHead>Дата регистрации</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.map((user) => (
                  <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                    <TableCell>{user.id}</TableCell>
                    <TableCell className="font-medium">{user.username}</TableCell>
                    <TableCell>{user.email || '-'}</TableCell>
                    <TableCell>{user.phoneNumber || '-'}</TableCell>
                    <TableCell>{user.telegramId || '-'}</TableCell>
                    <TableCell className="font-mono">{user.referralCode}</TableCell>
                    <TableCell>
                      {user.agreedToTerms ? (
                        <Badge variant="default">Принято</Badge>
                      ) : (
                        <Badge variant="outline">Не принято</Badge>
                      )}
                    </TableCell>
                    <TableCell>{new Date(user.createdAt).toLocaleString('ru-RU')}</TableCell>
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
