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
  idUser: number;
  network: string;
  address: string;
  privateKey: string | null;
  reservationTime: string | null;
  reserved: string | null;
  status: string | null;
};

export default function AdminWallets() {
  const { data: wallets, isLoading } = useQuery<Wallet[]>({
    queryKey: ['/admin/api/wallets'],
    queryFn: () => adminRequest('/wallets'),
  });

  const getStatusBadge = (status: string | null, reservationTime: string | null) => {
    if (status === "reserved" || status === "active") {
      if (reservationTime) {
        const isExpired = new Date(reservationTime) < new Date();
        return isExpired ? (
          <Badge variant="outline">Резерв истек</Badge>
        ) : (
          <Badge variant="secondary">Зарезервирован</Badge>
        );
      }
      return <Badge variant="default">Активен</Badge>;
    }
    return <Badge variant="outline">{status || 'Неизвестно'}</Badge>;
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
                  <TableHead>Сеть</TableHead>
                  <TableHead>Пользователь</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Операция</TableHead>
                  <TableHead>Зарезервирован до</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wallets?.map((wallet) => (
                  <TableRow key={wallet.id} data-testid={`row-wallet-${wallet.id}`}>
                    <TableCell className="font-medium">{wallet.id}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {wallet.address.substring(0, 8)}...{wallet.address.substring(wallet.address.length - 6)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{wallet.network}</Badge>
                    </TableCell>
                    <TableCell>#{wallet.idUser}</TableCell>
                    <TableCell>{getStatusBadge(wallet.status, wallet.reservationTime)}</TableCell>
                    <TableCell>{wallet.reserved || '-'}</TableCell>
                    <TableCell>
                      {wallet.reservationTime ? (
                        <span className={new Date(wallet.reservationTime) < new Date() ? 'text-muted-foreground' : ''}>
                          {new Date(wallet.reservationTime).toLocaleString('ru-RU')}
                        </span>
                      ) : '-'}
                    </TableCell>
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
