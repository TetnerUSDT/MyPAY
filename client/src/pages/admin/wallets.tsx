import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminRequest } from "@/lib/adminApi";
import { queryClient } from "@/lib/queryClient";
import { RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Wallet = {
  id: number;
  userId: number | null;
  balanceId: number;
  walletAddress: string;
  status: string;
  reservedUntil: string | null;
  reservedFor: string | null;
  createdAt: string;
};

export default function AdminWallets() {
  const { data: wallets, isLoading } = useQuery<Wallet[]>({
    queryKey: ['/admin/api/wallets'],
    queryFn: () => adminRequest('/wallets'),
  });

  const getStatusBadge = (status: string, reservedUntil: string | null) => {
    if (status === "reserved" && reservedUntil) {
      const isExpired = new Date(reservedUntil) < new Date();
      return isExpired ? (
        <Badge variant="outline">Истекло</Badge>
      ) : (
        <Badge variant="secondary">Зарезервирован</Badge>
      );
    }
    return <Badge variant="default">Свободен</Badge>;
  };

  return (
    <AdminLayout title="Кошельки" description="Управление кошельками платформы">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Список кошельков</h2>
          <Button 
            variant="outline" 
            onClick={() => queryClient.invalidateQueries({ queryKey: ['/admin/api/wallets'] })}
            data-testid="button-refresh-wallets"
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
                  <TableHead>Адрес кошелька</TableHead>
                  <TableHead>Пользователь</TableHead>
                  <TableHead>Баланс ID</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Зарезервирован до</TableHead>
                  <TableHead>Операция</TableHead>
                  <TableHead>Создан</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wallets?.map((wallet) => (
                  <TableRow key={wallet.id} data-testid={`row-wallet-${wallet.id}`}>
                    <TableCell>{wallet.id}</TableCell>
                    <TableCell className="font-mono text-sm">{wallet.walletAddress}</TableCell>
                    <TableCell>{wallet.userId ? `#${wallet.userId}` : '-'}</TableCell>
                    <TableCell>#{wallet.balanceId}</TableCell>
                    <TableCell>{getStatusBadge(wallet.status, wallet.reservedUntil)}</TableCell>
                    <TableCell>
                      {wallet.reservedUntil ? (
                        <span className={new Date(wallet.reservedUntil) < new Date() ? 'text-muted-foreground' : ''}>
                          {new Date(wallet.reservedUntil).toLocaleString('ru-RU')}
                        </span>
                      ) : '-'}
                    </TableCell>
                    <TableCell>{wallet.reservedFor || '-'}</TableCell>
                    <TableCell>{new Date(wallet.createdAt).toLocaleString('ru-RU')}</TableCell>
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
