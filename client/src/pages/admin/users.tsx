import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminRequest } from "@/lib/adminApi";
import { queryClient } from "@/lib/queryClient";
import { RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { UserProfilePopover } from "@/components/UserProfilePopover";

type User = {
  id: number;
  tgId: string;
  tgUsername: string | null;
  name: string | null;
  apiKey: string | null;
  status: string | null;
  agreement: number | null;
  blocked: boolean | null;
  defaultFiatBalanceId: number | null;
  idRef: number | null;
  codeRef: string | null;
};

export default function AdminUsers() {
  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ['/admin/api/users'],
    queryFn: () => adminRequest('/users'),
  });

  const getAgreementBadge = (agreement: number | null) => {
    return agreement === 1 ? (
      <Badge variant="default">Принято</Badge>
    ) : (
      <Badge variant="outline">Не принято</Badge>
    );
  };

  const getStatusBadge = (status: string | null, blocked: boolean | null) => {
    if (blocked) {
      return <Badge variant="destructive">Заблокирован</Badge>;
    }
    return status === "active" ? (
      <Badge variant="default">Активен</Badge>
    ) : (
      <Badge variant="secondary">{status || 'Неизвестно'}</Badge>
    );
  };

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
                  <TableHead>Имя</TableHead>
                  <TableHead>Реферальный код</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Соглашение</TableHead>
                  <TableHead>Реферал от</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.map((user) => (
                  <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                    <TableCell className="font-medium">{user.id}</TableCell>
                    <TableCell>
                      <UserProfilePopover userId={user.id} userName={user.name}>
                        <button 
                          className="hover:underline cursor-pointer text-left"
                          data-testid={`button-user-name-${user.id}`}
                        >
                          {user.name || '-'}
                        </button>
                      </UserProfilePopover>
                    </TableCell>
                    <TableCell className="font-mono">{user.codeRef || '-'}</TableCell>
                    <TableCell>{getStatusBadge(user.status, user.blocked)}</TableCell>
                    <TableCell>{getAgreementBadge(user.agreement)}</TableCell>
                    <TableCell>{user.idRef ? `#${user.idRef}` : '-'}</TableCell>
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
