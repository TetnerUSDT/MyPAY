import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminRequest } from "@/lib/adminApi";
import { queryClient } from "@/lib/queryClient";
import { RefreshCw, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Wallet = {
  id: number;
  idUser: number | null;
  network: string;
  address: string;
  privateKey: string | null;
  reservationTime: string | null;
  reserved: string | null;
  status: string | null;
};

export default function AdminWallets() {
  const [searchAddress, setSearchAddress] = useState("");
  const [filterNetwork, setFilterNetwork] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const buildQueryString = () => {
    const params = new URLSearchParams();
    if (searchAddress) params.append('address', searchAddress);
    if (filterNetwork !== 'all') params.append('network', filterNetwork);
    if (filterStatus !== 'all') params.append('status', filterStatus);
    return params.toString();
  };

  const { data: wallets, isLoading } = useQuery<Wallet[]>({
    queryKey: ['/admin/api/wallets', searchAddress, filterNetwork, filterStatus],
    queryFn: () => {
      const queryString = buildQueryString();
      return adminRequest(`/wallets${queryString ? `?${queryString}` : ''}`);
    },
  });

  const getStatusBadge = (status: string | null, reservationTime: string | null) => {
    if (status === "reserved" || status === "active") {
      if (reservationTime) {
        const isExpired = new Date(reservationTime) < new Date();
        return isExpired ? (
          <Badge variant="destructive">Резерв истек</Badge>
        ) : (
          <Badge variant="secondary">Зарезервирован</Badge>
        );
      }
      return <Badge variant="default">Активен</Badge>;
    }
    return <Badge variant="outline">{status || 'Неизвестно'}</Badge>;
  };

  const clearFilters = () => {
    setSearchAddress("");
    setFilterNetwork("all");
    setFilterStatus("all");
  };

  const hasActiveFilters = searchAddress || filterNetwork !== 'all' || filterStatus !== 'all';

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

        {/* Filters Section */}
        <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg border">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по адресу кошелька..."
              value={searchAddress}
              onChange={(e) => setSearchAddress(e.target.value)}
              className="pl-9"
              data-testid="input-search-wallet-address"
            />
          </div>
          
          <Select value={filterNetwork} onValueChange={setFilterNetwork}>
            <SelectTrigger className="w-[180px]" data-testid="select-filter-network">
              <SelectValue placeholder="Все сети" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все сети</SelectItem>
              <SelectItem value="TON">TON</SelectItem>
              <SelectItem value="TRC20">TRC20</SelectItem>
              <SelectItem value="BEP20">BEP20</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]" data-testid="select-filter-status">
              <SelectValue placeholder="Все статусы" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все статусы</SelectItem>
              <SelectItem value="active">Активен</SelectItem>
              <SelectItem value="reserved">Зарезервирован</SelectItem>
              <SelectItem value="expired">Резерв истек</SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              data-testid="button-clear-filters"
            >
              <X className="h-4 w-4 mr-1" />
              Сбросить
            </Button>
          )}
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
                {wallets?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Кошельки не найдены
                    </TableCell>
                  </TableRow>
                ) : (
                  wallets?.map((wallet) => (
                    <TableRow key={wallet.id} data-testid={`row-wallet-${wallet.id}`}>
                      <TableCell className="font-medium">{wallet.id}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {wallet.address.substring(0, 8)}...{wallet.address.substring(wallet.address.length - 6)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{wallet.network}</Badge>
                      </TableCell>
                      <TableCell>{wallet.idUser ? `#${wallet.idUser}` : '-'}</TableCell>
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
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
