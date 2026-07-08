import { NetworkProviderConfig, getEffectiveEndpoint } from "../registry";
import { leaseKeyForProvider, recordKeyError, recordKeySuccess } from "../key-lease";

export interface TronTransfer {
  txHash: string;
  amountRaw: string; // decimal string
  blockTimestampMs?: number; // unix ms when tx was confirmed
}

const TRON_USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

/**
 * Scan TRON address for incoming USDT TRC20 transfers.
 * Supports both REST providers:
 *   - tronscan (auth_mode: none) — public REST API
 *   - trongrid (auth_mode: optional_header | header) — with or without API key
 */
export async function getTronTransfers(
  cfg: NetworkProviderConfig,
  address: string
): Promise<TronTransfer[]> {
  const adapter = cfg.provider.adapter_type;
  if (adapter !== "tron_rest") {
    throw new Error(`Unsupported adapter for TRON: ${adapter}`);
  }

  const providerCode = cfg.provider_code;
  const authMode = cfg.provider.auth_mode;

  let headers: Record<string, string> = { "Accept": "application/json" };
  let keyId: number | undefined;

  if (authMode === "header") {
    const key = await leaseKeyForProvider(providerCode, "TRON");
    if (!key) throw new Error(`No keys available for ${providerCode}`);
    keyId = key.keyId;
    if (cfg.provider.header_name) headers[cfg.provider.header_name] = key.apiKey;
  } else if (authMode === "optional_header") {
    const key = await leaseKeyForProvider(providerCode, "TRON");
    keyId = key?.keyId;
    if (key && cfg.provider.header_name) headers[cfg.provider.header_name] = key.apiKey;
  }

  const baseUrl = cfg.endpoint_override ?? cfg.provider.endpoint_template;

  try {
    let url: string;
    let parser: (data: any) => TronTransfer[];

    if (providerCode === "tronscan") {
      url = `${baseUrl}/api/transfer/trc20?limit=10&start=0&toAddress=${address}&tokenName=USDT`;
      parser = (data) => (data.data ?? []).map((tx: any) => ({
        txHash: tx.transactionId,
        amountRaw: tx.amount ?? "0",
        blockTimestampMs: tx.timestamp ? Number(tx.timestamp) : undefined,
      }));
    } else if (providerCode === "trongrid") {
      url = `${baseUrl}/v1/accounts/${address}/transactions/trc20?contract_address=${TRON_USDT_CONTRACT}&limit=10&only_to=true`;
      parser = (data) => (data.data ?? []).map((tx: any) => ({
        txHash: tx.transaction_id,
        amountRaw: tx.value ?? "0",
        blockTimestampMs: tx.block_timestamp ? Number(tx.block_timestamp) : undefined,
      }));
    } else {
      throw new Error(`Unknown TRON provider: ${providerCode}`);
    }

    const r = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
    if (!r.ok) {
      if (keyId !== undefined) await recordKeyError(keyId);
      throw new Error(`HTTP ${r.status} from ${providerCode}`);
    }

    const data = await r.json() as any;
    if (keyId !== undefined) await recordKeySuccess(keyId);
    return parser(data);
  } catch (err) {
    if (keyId !== undefined) await recordKeyError(keyId);
    throw err;
  }
}
