import { NetworkProviderConfig, getEffectiveEndpoint } from "../registry";
import { leaseKeyForProvider, recordKeyError, recordKeySuccess } from "../key-lease";

export interface SolanaTransfer {
  txHash: string;
  amountRaw: string; // base units decimal string (6 decimals for USDT)
  blockTimestampMs?: number; // unix ms when tx was confirmed
}

const SOLANA_USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";

/**
 * Call Solana JSON-RPC on the given provider config.
 * Supports: none (public), header (Helius with X-API-KEY), path (Helius ?api-key=...)
 */
async function solanaRpc(
  cfg: NetworkProviderConfig,
  method: string,
  params: any[]
): Promise<any> {
  let endpoint: string;
  let headers: Record<string, string> = { "Content-Type": "application/json" };
  let keyId: number | undefined;

  const authMode = cfg.provider.auth_mode;

  if (authMode === "none") {
    endpoint = getEffectiveEndpoint(cfg);
  } else if (authMode === "path") {
    const key = await leaseKeyForProvider(cfg.provider_code, "SOL");
    if (!key) throw new Error(`No keys for ${cfg.provider_code}`);
    keyId = key.keyId;
    endpoint = getEffectiveEndpoint(cfg, key.apiKey);
  } else if (authMode === "header") {
    const key = await leaseKeyForProvider(cfg.provider_code, "SOL");
    if (!key) throw new Error(`No keys for ${cfg.provider_code}`);
    keyId = key.keyId;
    endpoint = getEffectiveEndpoint(cfg);
    if (cfg.provider.header_name) headers[cfg.provider.header_name] = key.apiKey;
  } else {
    // optional_header
    const key = await leaseKeyForProvider(cfg.provider_code, "SOL");
    keyId = key?.keyId;
    endpoint = getEffectiveEndpoint(cfg);
    if (key && cfg.provider.header_name) headers[cfg.provider.header_name] = key.apiKey;
  }

  const r = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(12000),
  });

  if (!r.ok) {
    if (keyId !== undefined) await recordKeyError(keyId);
    throw new Error(`HTTP ${r.status} from ${cfg.provider_code}`);
  }

  const data = await r.json() as any;
  if (data.error) {
    if (keyId !== undefined) await recordKeyError(keyId);
    throw new Error(`RPC error from ${cfg.provider_code}: ${JSON.stringify(data.error)}`);
  }

  if (keyId !== undefined) await recordKeySuccess(keyId);
  return data.result;
}

/**
 * Raw Solana JSON-RPC call (exported for use in legacy checkTxOnChain).
 */
export async function getSolanaRpcResult(
  cfg: NetworkProviderConfig,
  method: string,
  params: any[]
): Promise<any> {
  return solanaRpc(cfg, method, params);
}

/**
 * Scan Solana address for recent incoming USDT SPL transfers.
 * Uses ATA (Associated Token Account) discovery pattern.
 */
export async function getSolanaTransfers(
  cfg: NetworkProviderConfig,
  address: string
): Promise<SolanaTransfer[]> {
  // Step 1: Find the USDT Associated Token Account (ATA) for this wallet
  const tokenAccts = await solanaRpc(cfg, "getTokenAccountsByOwner", [
    address,
    { mint: SOLANA_USDT_MINT },
    { encoding: "jsonParsed" },
  ]);

  const ataAddress: string | null = tokenAccts?.value?.[0]?.pubkey ?? null;
  if (!ataAddress) return [];

  // Step 2: Get recent signatures for the ATA
  const sigs = await solanaRpc(cfg, "getSignaturesForAddress", [ataAddress, { limit: 10 }]);
  if (!Array.isArray(sigs) || sigs.length === 0) return [];

  const results: SolanaTransfer[] = [];
  for (const sig of sigs.slice(0, 5)) {
    try {
      const tx = await solanaRpc(cfg, "getTransaction", [
        sig.signature,
        { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 },
      ]);
      if (!tx) continue;

      const preBals: any[] = tx.meta?.preTokenBalances ?? [];
      const postBals: any[] = tx.meta?.postTokenBalances ?? [];

      const pre = preBals.find((b: any) => b.mint === SOLANA_USDT_MINT && b.owner === address);
      const post = postBals.find((b: any) => b.mint === SOLANA_USDT_MINT && b.owner === address);

      if (post) {
        const preBal = BigInt(pre?.uiTokenAmount?.amount ?? "0");
        const postBal = BigInt(post.uiTokenAmount?.amount ?? "0");
        const delta = postBal - preBal;
        if (delta > BigInt(0)) {
          results.push({
            txHash: sig.signature,
            amountRaw: delta.toString(),
            blockTimestampMs: sig.blockTime ? Number(sig.blockTime) * 1000 : undefined,
          });
        }
      }
    } catch { /* skip this tx */ }
  }
  return results;
}
