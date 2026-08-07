import { useState, useMemo, useEffect } from "react";
import { ArrowDownUp, ChevronDown, Wallet } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { getBalanceIcon } from "@/lib/balanceIcons";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SendButton from "@/components/SendButton";

type NetworkType = "TRC20" | "BEP20" | "TON" | "Polygon";

const NETWORK_META: Record<NetworkType, { label: string; iconId: number }> = {
  TRC20:   { label: "Tron",    iconId: 3  },
  BEP20:   { label: "BSC",     iconId: 4  },
  TON:     { label: "TON",     iconId: 6  },
  Polygon: { label: "Polygon", iconId: 10 },
};

interface CryptoBalance {
  id: number;
  title: string;
  network: string;
  currency: string;
  sum: string;
  status: string;
}

interface TransferTabProps {
  network?: string;
  currency?: string;
  onSuccess?: () => void;
}

// Asset badge — same style as ExchangeTab's CurrencyBadge
function AssetBadge({ balance, hasMultiple, networkBalances, onChangeCurrency }: {
  balance: CryptoBalance | undefined;
  hasMultiple: boolean;
  networkBalances: CryptoBalance[];
  onChangeCurrency: (c: string) => void;
}) {
  if (!balance) return null;
  if (hasMultiple) {
    return (
      <Select value={balance.currency} onValueChange={onChangeCurrency}>
        <SelectTrigger className="w-auto border-0 bg-transparent p-0 h-auto focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 [&>svg:last-child]:hidden [&>[data-radix-select-icon]]:hidden">
          <div className="flex items-center gap-2.5 bg-white/5 hover:bg-white/10 transition-colors py-1.5 pl-1.5 pr-3 rounded-full border border-white/10">
            <div className="w-7 h-7 rounded-full overflow-hidden bg-black/40 flex-shrink-0 flex items-center justify-center border border-white/5">
              <img src={getBalanceIcon(balance.id)} alt={balance.currency} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            </div>
            <div className="flex flex-col items-start justify-center">
              <div className="font-semibold text-white text-sm leading-none tracking-tight">{balance.currency}</div>
              <div className="text-[10px] text-white/40 leading-none mt-0.5 font-medium uppercase tracking-wider">{balance.network}</div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-white/40 ml-0.5" />
          </div>
        </SelectTrigger>
        <SelectContent className="bg-[#1A1D24] border-white/10 text-white rounded-xl">
          {networkBalances.map((b) => (
            <SelectItem key={b.id} value={b.currency} className="focus:bg-white/5 focus:text-white rounded-lg cursor-pointer text-xs">
              {b.currency}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  return (
    <div className="flex items-center gap-2.5 bg-white/5 py-1.5 pl-1.5 pr-3 rounded-full border border-white/10">
      <div className="w-7 h-7 rounded-full overflow-hidden bg-black/40 flex-shrink-0 flex items-center justify-center border border-white/5">
        <img src={getBalanceIcon(balance.id)} alt={balance.currency} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      </div>
      <div className="flex flex-col items-start justify-center">
        <div className="font-semibold text-white text-sm leading-none tracking-tight">{balance.currency}</div>
        <div className="text-[10px] text-white/40 leading-none mt-0.5 font-medium uppercase tracking-wider">{balance.network}</div>
      </div>
    </div>
  );
}

const FEE = 2;

export default function TransferTab({ network, currency, onSuccess }: TransferTabProps) {
  const { t } = useTranslation();
  const [sendAmount, setSendAmount] = useState("100");
  const [activeNetwork, setActiveNetwork] = useState<NetworkType>(
    (["TRC20", "BEP20", "TON", "Polygon"].includes(network || "") ? network : "TRC20") as NetworkType
  );
  const [selectedCurrency, setSelectedCurrency] = useState<string | null>(currency || null);
  const [walletAddress, setWalletAddress] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: cryptoBalances = [], isLoading } = useQuery<CryptoBalance[]>({
    queryKey: ["/api/user/crypto-balances"],
  });

  const networkBalances = useMemo(() => {
    return cryptoBalances.filter(b => b.network === activeNetwork);
  }, [cryptoBalances, activeNetwork]);

  useEffect(() => {
    if (networkBalances.length > 0) {
      if (selectedCurrency) {
        const exists = networkBalances.some(b => b.currency === selectedCurrency);
        if (exists) return;
      }
      setSelectedCurrency(networkBalances[0].currency);
    }
  }, [networkBalances]);

  const handleNetworkChange = (net: NetworkType) => {
    setActiveNetwork(net);
    setSelectedCurrency(null);
  };

  const currentBalanceData = useMemo(() => {
    let balance: CryptoBalance | undefined;
    if (selectedCurrency) balance = networkBalances.find(b => b.currency === selectedCurrency);
    if (!balance && networkBalances.length > 0) balance = networkBalances[0];
    return balance;
  }, [networkBalances, selectedCurrency]);

  const currentBalance = currentBalanceData?.sum || "0.00";
  const currentCurrency = currentBalanceData?.currency || "USDT";
  const hasMultiple = networkBalances.length > 1;

  const receiveAmount = useMemo(() => {
    const n = parseFloat(sendAmount) || 0;
    const result = n - FEE;
    return result > 0 ? result.toFixed(2) : "0.00";
  }, [sendAmount]);

  const isValidTransaction = useMemo(() => {
    const amount = parseFloat(sendAmount) || 0;
    const available = parseFloat(currentBalance);
    return amount > FEE && amount <= available && walletAddress.trim().length > 0;
  }, [sendAmount, currentBalance, walletAddress]);

  const sellMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/transactions", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      onSuccess?.();
    },
    onError: () => {
      toast({ title: t('common.error'), description: t('sell.transactionError'), variant: "destructive" });
    },
  });

  // Returns a Promise so SendButton can drive the success/error animation.
  // Simulates a successful transfer (backend not yet wired).
  const handleSend = async (): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, 1200));
  };

  return (
    <div className="text-[#E2E8F0] pb-6 font-sans">

      {/* Network Tabs */}
      <div className="mb-4 flex justify-center">
        <div className="bg-[#13151A] border border-white/5 rounded-2xl p-1 flex gap-1 w-full">
          {(["TRC20", "BEP20", "TON", "Polygon"] as NetworkType[]).map((net) => {
            const meta = NETWORK_META[net];
            const isActive = activeNetwork === net;
            return (
              <button
                key={net}
                onClick={() => handleNetworkChange(net)}
                className={`flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-xl transition-all ${
                  isActive
                    ? "bg-[#1A1D24] border border-white/10 text-white shadow-sm"
                    : "text-white/40 hover:text-white/60"
                }`}
                data-testid={`button-network-${net.toLowerCase()}`}
              >
                <div className="w-5 h-5 rounded-full overflow-hidden bg-black/40 flex-shrink-0">
                  <img
                    src={`/uploads/balances/${meta.iconId}.png`}
                    alt={meta.label}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
                <span className="text-[10px] font-semibold leading-none">{meta.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* YOU PAY card */}
      <div className="bg-[#13151A] border border-white/5 rounded-3xl p-5">
        <div className="text-[11px] font-bold uppercase tracking-wider text-white/40 mb-3">
          {t('sell.enterAmount')}
        </div>
        <div className="flex items-end justify-between gap-3">
          <div className="flex-1 min-w-0">
            <input
              type="number"
              placeholder="0"
              className="text-4xl font-bold bg-transparent outline-none text-white w-full placeholder:text-white/20"
              value={sendAmount}
              onChange={(e) => setSendAmount(e.target.value)}
              data-testid="input-send-amount"
            />
          </div>
          <AssetBadge
            balance={currentBalanceData}
            hasMultiple={hasMultiple}
            networkBalances={networkBalances}
            onChangeCurrency={setSelectedCurrency}
          />
        </div>
        {/* Balance hint */}
        {!isLoading && (
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[11px] text-white/30">{t('sell.balance')}: {parseFloat(currentBalance).toFixed(2)} {currentCurrency}</span>
            <button
              onClick={() => setSendAmount((parseFloat(currentBalance) - FEE).toString())}
              className="bg-[#3ab368]/10 text-[#3ab368] text-[10px] font-bold px-2 py-0.5 rounded-full hover:bg-[#3ab368]/20 transition-colors"
            >
              MAX
            </button>
          </div>
        )}
      </div>

      {/* Arrow divider — overlaps both cards like Exchange */}
      <div className="flex items-center justify-center -my-4 relative z-10">
        <div className="w-10 h-10 rounded-full bg-[#0D0F13] border-4 border-[#0D0F13] flex items-center justify-center shadow-xl ring-1 ring-white/5">
          <ArrowDownUp className="w-4 h-4 text-[#3ab368]" />
        </div>
      </div>

      {/* YOU RECEIVE card */}
      <div className="bg-[#13151A] border border-white/5 rounded-3xl p-5">
        <div className="text-[11px] font-bold uppercase tracking-wider text-white/40 mb-3">
          {t('sell.enterWalletInNetwork', { network: activeNetwork })}
        </div>

        {/* Receive amount (readonly display) */}
        <div className="flex items-end justify-between gap-3 mb-4">
          <div className="text-4xl font-bold text-white/90">{receiveAmount}</div>
          <AssetBadge
            balance={currentBalanceData}
            hasMultiple={false}
            networkBalances={[]}
            onChangeCurrency={() => {}}
          />
        </div>

        {/* Wallet address input */}
        <div className="bg-[#1A1D24] rounded-2xl px-4 py-3 border border-white/5 focus-within:border-white/15 transition-colors flex items-center gap-3">
          <Wallet className="w-4 h-4 text-white/30 shrink-0" />
          <input
            type="text"
            placeholder={t('sell.enterAddress', { network: activeNetwork })}
            className="w-full bg-transparent font-mono text-sm outline-none text-white/90 placeholder:text-white/20"
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
            data-testid="input-recipient-wallet"
          />
        </div>
      </div>

      {/* Rate / Commission row */}
      <div className="mt-3 bg-[#13151A] border border-white/5 rounded-2xl px-4 py-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-white/40 font-medium">Rate</span>
          <span className="text-[12px] text-white/70 font-semibold">1 {currentCurrency} = 1 {currentCurrency}</span>
        </div>
        <div className="border-t border-white/5" />
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-white/40 font-medium">{t('sell.feeWillBe')}</span>
          <span className="text-[12px] text-[#3ab368] font-semibold">{FEE}.00 {currentCurrency}</span>
        </div>
      </div>

      {/* Send button — GSAP animated */}
      <div className="mt-4">
        <SendButton
          disabled={!isValidTransaction}
          onSend={handleSend}
          label={t('sell.submit') + " →"}
          data-testid="button-send"
        />
      </div>
    </div>
  );
}
