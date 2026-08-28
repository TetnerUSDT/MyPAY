import { NetworkProviderConfig } from "../registry";
import { leaseKeyForProvider, recordKeyError, recordKeySuccess } from "../key-lease";

export interface TonTransfer {
  txHash: string;
  amountRaw: string; // base units, 6 decimals
  blockTimestampMs?: number; // unix ms when tx was confirmed
}

const TON_USDT_MASTER_ADDR = "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs";

/**
 * Scan TON address for incoming USDT Jetton transfers via TonCenter v3 API.
 * auth_mode: none = public (rate limited), header = with API key (higher limits),
 *            optional_header = try with key if available
 */
export async function getTonTransfers(
  cfg: NetworkProviderConfig,
  address: string
): Promise<TonTransfer[]> {
  const authMode = cfg.provider.auth_mode;
  let headers: Record<string, string> = { "Accept": "application/json" };
  let keyId: number | undefined;

  if (authMode === "header") {
    const key = await leaseKeyForProvider(cfg.provider_code, "TON");
    if (!key) throw new Error(`No keys available for ${cfg.provider_code}`);
    keyId = key.keyId;
    if (cfg.provider.header_name) headers[cfg.provider.header_name] = key.apiKey;
  } else if (authMode === "optional_header") {
    const key = await leaseKeyForProvider(cfg.provider_code, "TON");
    keyId = key?.keyId;
    if (key && cfg.provider.header_name) headers[cfg.provider.header_name] = key.apiKey;
  }

  const baseUrl = cfg.endpoint_override ?? cfg.provider.endpoint_template;

  try {
    const url = `${baseUrl}/api/v3/jetton/transfers?direction=in&owner_address=${encodeURIComponent(address)}&jetton_master=${encodeURIComponent(TON_USDT_MASTER_ADDR)}&limit=10`;
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });

    if (!r.ok) {
      if (keyId !== undefined) await recordKeyError(keyId);
      throw new Error(`HTTP ${r.status} from ${cfg.provider_code}`);
    }

    const data = await r.json() as any;
    if (keyId !== undefined) await recordKeySuccess(keyId);

    const transfers: any[] = data.jetton_transfers ?? [];
    return transfers.map(t => ({
      txHash: t.transaction_hash ?? t.trace_id ?? "",
      amountRaw: t.amount ?? "0",
      blockTimestampMs: (t.transaction_now ?? t.utime) ? Number(t.transaction_now ?? t.utime) * 1000 : undefined,
    }));
  } catch (err) {
    if (keyId !== undefined) await recordKeyError(keyId);
    throw err;
  }
}
