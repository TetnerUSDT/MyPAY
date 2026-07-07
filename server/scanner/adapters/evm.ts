import { NetworkProviderConfig, getEffectiveEndpoint } from "../registry";
import { leaseKeyForProvider, recordKeyError, recordKeySuccess } from "../key-lease";

export interface EvmTransfer {
  txHash: string;
  amountRaw: string; // 0x-prefixed hex
  contractAddress?: string;
}

const ERC20_TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

export async function evmJsonRpc(
  cfg: NetworkProviderConfig,
  method: string,
  params: any[]
): Promise<any> {
  let endpoint: string;
  let keyId: number | undefined;
  let headers: Record<string, string> = { "Content-Type": "application/json" };

  const authMode = cfg.provider.auth_mode;

  if (authMode === "none") {
    endpoint = getEffectiveEndpoint(cfg);
  } else if (authMode === "path") {
    const key = await leaseKeyForProvider(cfg.provider_code, cfg.network);
    if (!key) throw new Error(`No keys available for ${cfg.provider_code}`);
    keyId = key.keyId;
    endpoint = getEffectiveEndpoint(cfg, key.apiKey);
  } else if (authMode === "header") {
    const key = await leaseKeyForProvider(cfg.provider_code, cfg.network);
    if (!key) throw new Error(`No keys available for ${cfg.provider_code}`);
    keyId = key.keyId;
    endpoint = getEffectiveEndpoint(cfg);
    if (cfg.provider.header_name) headers[cfg.provider.header_name] = key.apiKey;
  } else {
    // optional_header — try with key if available, fall back to keyless
    const key = await leaseKeyForProvider(cfg.provider_code, cfg.network);
    keyId = key?.keyId;
    endpoint = getEffectiveEndpoint(cfg);
    if (key && cfg.provider.header_name) headers[cfg.provider.header_name] = key.apiKey;
  }

  const timeout = 10000;
  const r = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(timeout),
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
 * Scan EVM address for incoming ERC20 USDT transfers using eth_getLogs.
 * Respects max_block_range from provider config (e.g. 1rpc.io = 49 blocks).
 */
export async function getEvmTransfers(
  cfg: NetworkProviderConfig,
  address: string,
  contractAddress: string,
  defaultBlockRange = 2000
): Promise<EvmTransfer[]> {
  const paddedAddress = "0x000000000000000000000000" + address.slice(2).toLowerCase();
  const maxRange = cfg.max_block_range ?? defaultBlockRange;

  const latestHex = await evmJsonRpc(cfg, "eth_blockNumber", []);
  if (!latestHex) throw new Error("eth_blockNumber returned null");
  const latest = parseInt(latestHex, 16);

  if (maxRange < defaultBlockRange) {
    // Need multiple chunked requests in parallel (like 1rpc.io/BSC with 49-block limit)
    const chunks = Math.ceil(defaultBlockRange / maxRange);
    const tasks = Array.from({ length: chunks }, (_, i) => {
      const toN = Math.max(1, latest - i * maxRange);
      const fromN = Math.max(0, toN - maxRange);
      return {
        fromBlock: "0x" + fromN.toString(16),
        toBlock: "0x" + toN.toString(16),
      };
    });

    const allResults = await Promise.allSettled(
      tasks.map(({ fromBlock, toBlock }) =>
        evmJsonRpc(cfg, "eth_getLogs", [{
          address: contractAddress,
          topics: [ERC20_TRANSFER_TOPIC, null, paddedAddress],
          fromBlock,
          toBlock,
        }])
      )
    );

    const succeeded = allResults.filter(r => r.status === "fulfilled").length;
    // If every chunk failed (e.g. rate-limited), throw so callWithFallback tries next provider
    if (succeeded === 0) {
      const firstErr = (allResults[0] as PromiseRejectedResult).reason;
      throw new Error(`All ${tasks.length} chunks failed for ${cfg.provider_code}: ${firstErr?.message ?? firstErr}`);
    }

    const transfers: EvmTransfer[] = [];
    const seen = new Set<string>();
    for (const r of allResults) {
      if (r.status !== "fulfilled" || !Array.isArray(r.value)) continue;
      for (const log of r.value) {
        if (!seen.has(log.transactionHash)) {
          seen.add(log.transactionHash);
          transfers.push({ txHash: log.transactionHash, amountRaw: log.data, contractAddress });
        }
      }
    }
    return transfers;
  } else {
    const fromBlock = "0x" + Math.max(0, latest - defaultBlockRange).toString(16);
    const logs = await evmJsonRpc(cfg, "eth_getLogs", [{
      address: contractAddress,
      topics: [ERC20_TRANSFER_TOPIC, null, paddedAddress],
      fromBlock,
      toBlock: "latest",
    }]);
    if (!Array.isArray(logs)) return [];
    return logs.map((log: any) => ({
      txHash: log.transactionHash,
      amountRaw: log.data,
      contractAddress,
    }));
  }
}

export function hexAmountToDecimal(hexRaw: string, decimals: number): string {
  try {
    const raw = BigInt(hexRaw);
    const divisor = BigInt(10 ** decimals);
    const integer = raw / divisor;
    const fraction = (raw % divisor).toString().padStart(decimals, "0");
    return `${integer}.${fraction}`;
  } catch {
    return "0.000000";
  }
}
