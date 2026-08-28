import { db } from "../db";
import { sql } from "drizzle-orm";

async function tableExists(table: string): Promise<boolean> {
  try {
    const rows = await db.execute(sql`
      SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ${table}
    `);
    return parseInt((rows[0] as any[])[0]?.cnt ?? "0") > 0;
  } catch { return false; }
}

async function columnExists(table: string, column: string): Promise<boolean> {
  try {
    const rows = await db.execute(sql`
      SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ${table} AND COLUMN_NAME = ${column}
    `);
    return parseInt((rows[0] as any[])[0]?.cnt ?? "0") > 0;
  } catch { return false; }
}

async function rowCountIs(table: string): Promise<number> {
  try {
    const rows = await db.execute(sql`SELECT COUNT(*) AS cnt FROM \`${sql.raw(table)}\``);
    return parseInt((rows[0] as any[])[0]?.cnt ?? "0");
  } catch { return 0; }
}

export async function runScannerProviderMigrations(): Promise<void> {
  try {
    // ── Table: scanner_providers ──────────────────────────────────────────────
    if (!await tableExists("scanner_providers")) {
      await db.execute(sql`
        CREATE TABLE scanner_providers (
          code VARCHAR(50) NOT NULL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          adapter_type VARCHAR(30) NOT NULL,
          auth_mode VARCHAR(30) NOT NULL DEFAULT 'none',
          endpoint_template TEXT NOT NULL,
          header_name VARCHAR(100) NULL,
          supported_networks TEXT NULL,
          docs_url VARCHAR(255) NULL,
          is_builtin TINYINT(1) NOT NULL DEFAULT 1
        )
      `);
    }

    // ── Table: scanner_network_providers ─────────────────────────────────────
    if (!await tableExists("scanner_network_providers")) {
      await db.execute(sql`
        CREATE TABLE scanner_network_providers (
          id INT AUTO_INCREMENT PRIMARY KEY,
          network VARCHAR(20) NOT NULL,
          provider_code VARCHAR(50) NOT NULL,
          enabled TINYINT(1) NOT NULL DEFAULT 1,
          priority INT NOT NULL DEFAULT 10,
          endpoint_override VARCHAR(500) NULL,
          max_block_range INT NULL,
          rps_limit INT NULL,
          UNIQUE KEY uq_network_provider (network, provider_code)
        )
      `);
    }

    // ── Column: merchant_scanner_keys.provider_code ───────────────────────────
    if (!await columnExists("merchant_scanner_keys", "provider_code")) {
      await db.execute(sql`
        ALTER TABLE merchant_scanner_keys
        ADD COLUMN provider_code VARCHAR(50) NULL AFTER provider
      `);
    }

    // ── Seed providers (idempotent upsert) ───────────────────────────────────
    const seedProviders = [
      // TRON
      {
        code: "tronscan",
        name: "TronScan",
        adapter_type: "tron_rest",
        auth_mode: "none",
        endpoint_template: "https://apilist.tronscanapi.com",
        header_name: null,
        supported_networks: ["TRON"],
        docs_url: "https://docs.tronscan.org",
      },
      {
        code: "trongrid",
        name: "TronGrid",
        adapter_type: "tron_rest",
        auth_mode: "optional_header",
        endpoint_template: "https://api.trongrid.io",
        header_name: "TGRID-API-Key",
        supported_networks: ["TRON"],
        docs_url: "https://developers.tron.network/reference/trongrid",
      },
      // TON
      {
        code: "toncenter",
        name: "TonCenter",
        adapter_type: "ton_rest",
        auth_mode: "optional_header",
        endpoint_template: "https://toncenter.com",
        header_name: "X-API-Key",
        supported_networks: ["TON"],
        docs_url: "https://toncenter.com/api/v3/",
      },
      // BSC
      {
        code: "1rpc_bsc",
        name: "1RPC (BSC)",
        adapter_type: "evm_jsonrpc",
        auth_mode: "none",
        endpoint_template: "https://1rpc.io/bnb",
        header_name: null,
        supported_networks: ["BSC"],
        docs_url: "https://docs.1rpc.io",
      },
      {
        code: "publicnode_bsc",
        name: "PublicNode (BSC)",
        adapter_type: "evm_jsonrpc",
        auth_mode: "none",
        endpoint_template: "https://bsc-rpc.publicnode.com",
        header_name: null,
        supported_networks: ["BSC"],
        docs_url: "https://publicnode.com",
      },
      {
        code: "bsc_dataseed",
        name: "Binance Dataseed (BSC)",
        adapter_type: "evm_jsonrpc",
        auth_mode: "none",
        endpoint_template: "https://bsc-dataseed.binance.org",
        header_name: null,
        supported_networks: ["BSC"],
        docs_url: null,
      },
      {
        code: "nodereal_bsc",
        name: "NodeReal (BSC)",
        adapter_type: "evm_jsonrpc",
        auth_mode: "none",
        endpoint_template: "https://bsc-mainnet.nodereal.io/v1/64a9df0874fb4a93b9d0a3849de012d3",
        header_name: null,
        supported_networks: ["BSC"],
        docs_url: "https://docs.nodereal.io/reference",
      },
      // ETH
      {
        code: "publicnode_eth",
        name: "PublicNode (ETH)",
        adapter_type: "evm_jsonrpc",
        auth_mode: "none",
        endpoint_template: "https://ethereum-rpc.publicnode.com",
        header_name: null,
        supported_networks: ["ETH"],
        docs_url: "https://publicnode.com",
      },
      {
        code: "llamarpc_eth",
        name: "LlamaRPC (ETH)",
        adapter_type: "evm_jsonrpc",
        auth_mode: "none",
        endpoint_template: "https://eth.llamarpc.com",
        header_name: null,
        supported_networks: ["ETH"],
        docs_url: null,
      },
      {
        code: "nodereal_eth",
        name: "NodeReal (ETH)",
        adapter_type: "evm_jsonrpc",
        auth_mode: "path",
        endpoint_template: "https://eth-mainnet.nodereal.io/v1/{KEY}",
        header_name: null,
        supported_networks: ["ETH"],
        docs_url: "https://docs.nodereal.io/reference",
      },
      // ARBITRUM
      {
        code: "publicnode_arb",
        name: "PublicNode (Arbitrum)",
        adapter_type: "evm_jsonrpc",
        auth_mode: "none",
        endpoint_template: "https://arbitrum-one-rpc.publicnode.com",
        header_name: null,
        supported_networks: ["ARBITRUM"],
        docs_url: "https://publicnode.com",
      },
      {
        code: "arb_official",
        name: "Arbitrum Official RPC",
        adapter_type: "evm_jsonrpc",
        auth_mode: "none",
        endpoint_template: "https://arb1.arbitrum.io/rpc",
        header_name: null,
        supported_networks: ["ARBITRUM"],
        docs_url: null,
      },
      {
        code: "nodereal_arb",
        name: "NodeReal (Arbitrum)",
        adapter_type: "evm_jsonrpc",
        auth_mode: "path",
        endpoint_template: "https://open-platform.nodereal.io/{KEY}/arbitrum-nitro/",
        header_name: null,
        supported_networks: ["ARBITRUM"],
        docs_url: "https://docs.nodereal.io/reference",
      },
      // POLYGON
      {
        code: "publicnode_pol",
        name: "PublicNode (Polygon)",
        adapter_type: "evm_jsonrpc",
        auth_mode: "none",
        endpoint_template: "https://polygon-bor-rpc.publicnode.com",
        header_name: null,
        supported_networks: ["POLYGON"],
        docs_url: "https://publicnode.com",
      },
      {
        code: "polygon_rpc",
        name: "Polygon RPC",
        adapter_type: "evm_jsonrpc",
        auth_mode: "none",
        endpoint_template: "https://polygon-rpc.com",
        header_name: null,
        supported_networks: ["POLYGON"],
        docs_url: null,
      },
      // SOLANA
      {
        code: "publicnode_sol",
        name: "PublicNode (Solana)",
        adapter_type: "solana_jsonrpc",
        auth_mode: "none",
        endpoint_template: "https://solana-rpc.publicnode.com",
        header_name: null,
        supported_networks: ["SOL"],
        docs_url: "https://publicnode.com",
      },
      {
        code: "solana_mainnet",
        name: "Solana Mainnet Beta",
        adapter_type: "solana_jsonrpc",
        auth_mode: "none",
        endpoint_template: "https://api.mainnet-beta.solana.com",
        header_name: null,
        supported_networks: ["SOL"],
        docs_url: null,
      },
      {
        code: "helius",
        name: "Helius (Solana)",
        adapter_type: "solana_jsonrpc",
        auth_mode: "path",
        endpoint_template: "https://mainnet.helius-rpc.com/?api-key={KEY}",
        header_name: null,
        supported_networks: ["SOL"],
        docs_url: "https://docs.helius.dev",
      },
    ];

    for (const p of seedProviders) {
      const nets = JSON.stringify(p.supported_networks);
      await db.execute(sql`
        INSERT INTO scanner_providers
          (code, name, adapter_type, auth_mode, endpoint_template, header_name, supported_networks, docs_url, is_builtin)
        VALUES
          (${p.code}, ${p.name}, ${p.adapter_type}, ${p.auth_mode}, ${p.endpoint_template},
           ${p.header_name ?? null}, ${nets}, ${p.docs_url ?? null}, 1)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          adapter_type = VALUES(adapter_type),
          auth_mode = VALUES(auth_mode),
          endpoint_template = VALUES(endpoint_template),
          header_name = VALUES(header_name),
          supported_networks = VALUES(supported_networks),
          docs_url = VALUES(docs_url)
      `);
    }

    // ── Seed default network provider configs ────────────────────────────────
    const seedNetworkConfigs = [
      // TRON — TronScan first (free), TronGrid second (optional key)
      { network: "TRON",     provider_code: "tronscan",       enabled: 1, priority: 1, max_block_range: null, rps_limit: null },
      { network: "TRON",     provider_code: "trongrid",       enabled: 1, priority: 2, max_block_range: null, rps_limit: 15 },
      // TON — TonCenter (optional key)
      { network: "TON",      provider_code: "toncenter",      enabled: 1, priority: 1, max_block_range: null, rps_limit: null },
      // BSC — NodeReal first (free key embedded, large range), publicnode second, dataseed fallback; 1rpc disabled (rate-limited free tier)
      { network: "BSC",      provider_code: "nodereal_bsc",   enabled: 1, priority: 1, max_block_range: 3000, rps_limit: null },
      { network: "BSC",      provider_code: "publicnode_bsc", enabled: 1, priority: 2, max_block_range: null, rps_limit: 20 },
      { network: "BSC",      provider_code: "bsc_dataseed",   enabled: 1, priority: 3, max_block_range: null, rps_limit: null },
      { network: "BSC",      provider_code: "1rpc_bsc",       enabled: 0, priority: 4, max_block_range: 49,   rps_limit: null },
      // ETH
      { network: "ETH",      provider_code: "publicnode_eth", enabled: 1, priority: 1, max_block_range: null, rps_limit: 20 },
      { network: "ETH",      provider_code: "llamarpc_eth",   enabled: 1, priority: 2, max_block_range: null, rps_limit: null },
      { network: "ETH",      provider_code: "nodereal_eth",   enabled: 0, priority: 3, max_block_range: null, rps_limit: null },
      // ARBITRUM
      { network: "ARBITRUM", provider_code: "publicnode_arb", enabled: 1, priority: 1, max_block_range: null, rps_limit: 20 },
      { network: "ARBITRUM", provider_code: "arb_official",   enabled: 1, priority: 2, max_block_range: null, rps_limit: null },
      { network: "ARBITRUM", provider_code: "nodereal_arb",   enabled: 0, priority: 3, max_block_range: null, rps_limit: null },
      // POLYGON
      { network: "POLYGON",  provider_code: "publicnode_pol", enabled: 1, priority: 1, max_block_range: null, rps_limit: 20 },
      { network: "POLYGON",  provider_code: "polygon_rpc",    enabled: 1, priority: 2, max_block_range: null, rps_limit: null },
      // SOLANA
      { network: "SOL",      provider_code: "publicnode_sol", enabled: 1, priority: 1, max_block_range: null, rps_limit: 20 },
      { network: "SOL",      provider_code: "solana_mainnet", enabled: 1, priority: 2, max_block_range: null, rps_limit: null },
      { network: "SOL",      provider_code: "helius",         enabled: 0, priority: 3, max_block_range: null, rps_limit: null },
    ];

    for (const c of seedNetworkConfigs) {
      await db.execute(sql`
        INSERT INTO scanner_network_providers
          (network, provider_code, enabled, priority, max_block_range, rps_limit)
        VALUES
          (${c.network}, ${c.provider_code}, ${c.enabled}, ${c.priority},
           ${c.max_block_range ?? null}, ${c.rps_limit ?? null})
        ON DUPLICATE KEY UPDATE
          priority = VALUES(priority),
          max_block_range = VALUES(max_block_range),
          rps_limit = VALUES(rps_limit)
      `);
    }

    // ── Migrate existing merchant_scanner_keys to new provider_code ──────────
    // Map old provider names to new codes
    const providerMap: Record<string, string> = {
      TronGrid:  "trongrid",
      TronScan:  "tronscan",
      TonCenter: "toncenter",
      Helius:    "helius",
      BscScan:   "bsc_dataseed",
      Etherscan: "llamarpc_eth",
    };
    for (const [oldName, newCode] of Object.entries(providerMap)) {
      await db.execute(sql`
        UPDATE merchant_scanner_keys
        SET provider_code = ${newCode}
        WHERE provider = ${oldName} AND (provider_code IS NULL OR provider_code = '')
      `);
    }

    console.log("[Scanner] Provider migrations completed");
  } catch (err: any) {
    console.error("[Scanner] Provider migrations error:", err.message);
  }
}
