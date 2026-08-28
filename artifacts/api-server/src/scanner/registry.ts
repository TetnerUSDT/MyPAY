import { db } from "../db";
import { sql } from "drizzle-orm";

export type AdapterType = "evm_jsonrpc" | "solana_jsonrpc" | "tron_rest" | "ton_rest";
export type AuthMode = "none" | "header" | "path" | "optional_header";

export interface ScannerProvider {
  code: string;
  name: string;
  adapter_type: AdapterType;
  auth_mode: AuthMode;
  endpoint_template: string;
  header_name: string | null;
  supported_networks: string[];
  docs_url: string | null;
  is_builtin: number;
}

export interface NetworkProviderConfig {
  id: number;
  network: string;
  provider_code: string;
  enabled: number;
  priority: number;
  endpoint_override: string | null;
  max_block_range: number | null;
  rps_limit: number | null;
  provider: ScannerProvider;
  keys?: LeasedKeyInfo[];
}

export interface LeasedKeyInfo {
  keyId: number;
  apiKey: string;
  label: string | null;
}

let cache: Record<string, NetworkProviderConfig[]> = {};
let lastLoadedAt = 0;
const CACHE_TTL_MS = 5000; // reload from DB max every 5 seconds

export async function getProviderChain(network: string): Promise<NetworkProviderConfig[]> {
  const now = Date.now();
  if (now - lastLoadedAt > CACHE_TTL_MS) {
    await reloadRegistry();
  }
  return cache[network] ?? [];
}

export async function reloadRegistry(): Promise<void> {
  try {
    // Guard: if tables don't exist yet (migrations haven't run), return empty cache silently
    let exists = false;
    try {
      const check = await db.execute(sql`
        SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'scanner_network_providers'
      `);
      exists = parseInt((check[0] as any[])[0]?.cnt ?? "0") > 0;
    } catch { exists = false; }

    if (!exists) {
      lastLoadedAt = Date.now(); // suppress further retries until TTL expires naturally
      return;
    }

    const rows = await db.execute(sql`
      SELECT
        snp.id, snp.network, snp.provider_code, snp.enabled, snp.priority,
        snp.endpoint_override, snp.max_block_range, snp.rps_limit,
        sp.code, sp.name, sp.adapter_type, sp.auth_mode,
        sp.endpoint_template, sp.header_name, sp.supported_networks,
        sp.docs_url, sp.is_builtin
      FROM scanner_network_providers snp
      JOIN scanner_providers sp ON sp.code = snp.provider_code
      ORDER BY snp.network, snp.priority ASC
    `);
    const configs = rows[0] as any[];

    const newCache: Record<string, NetworkProviderConfig[]> = {};
    for (const row of configs) {
      const network = row.network as string;
      if (!newCache[network]) newCache[network] = [];

      let supportedNetworks: string[] = [];
      try {
        supportedNetworks = typeof row.supported_networks === "string"
          ? JSON.parse(row.supported_networks)
          : (row.supported_networks ?? []);
      } catch { supportedNetworks = []; }

      newCache[network].push({
        id: row.id,
        network,
        provider_code: row.provider_code,
        enabled: row.enabled,
        priority: row.priority,
        endpoint_override: row.endpoint_override ?? null,
        max_block_range: row.max_block_range ?? null,
        rps_limit: row.rps_limit ?? null,
        provider: {
          code: row.code,
          name: row.name,
          adapter_type: row.adapter_type as AdapterType,
          auth_mode: row.auth_mode as AuthMode,
          endpoint_template: row.endpoint_template,
          header_name: row.header_name ?? null,
          supported_networks: supportedNetworks,
          docs_url: row.docs_url ?? null,
          is_builtin: row.is_builtin,
        },
      });
    }

    cache = newCache;
    lastLoadedAt = Date.now();
  } catch (err: any) {
    console.warn("[ProviderRegistry] reload error:", err.message);
  }
}

export function getEffectiveEndpoint(cfg: NetworkProviderConfig, apiKey?: string): string {
  const base = cfg.endpoint_override ?? cfg.provider.endpoint_template;
  if (cfg.provider.auth_mode === "path" && apiKey) {
    return base.replace("{KEY}", apiKey).replace("{API_KEY}", apiKey);
  }
  return base;
}

export function invalidateCache(): void {
  lastLoadedAt = 0;
}
