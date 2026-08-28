/**
 * Local blockchain transfer module.
 * Signs and broadcasts transactions using stored private keys.
 * NO external wallet API calls for transfers — only public node RPCs and standard relayers.
 *
 * TRON GasFree:
 *   Signs a PermitTransfer EIP-712 message and submits it to a GasFree relayer API.
 *   Config via env vars:
 *     TRON_GASFREE_PROVIDER        — relayer base URL  (e.g. https://www.okx.com/priapi/v5/dex/gasfree)
 *     TRON_GASFREE_SERVICE_PROVIDER — service-provider TRON address
 *     TRON_GASFREE_VERIFYING_CONTRACT — verifying-contract TRON address
 *     TRON_GASFREE_API_KEY         — optional, for HMAC-signed requests
 *     TRON_GASFREE_API_SECRET      — optional, paired with API_KEY
 */

import { createHmac } from "crypto";
import { createRequire } from "module";

// ── GasFree config (from env) ──────────────────────────────────────────────
const GASFREE_PROVIDER        = process.env.TRON_GASFREE_PROVIDER ?? "";
const GASFREE_SERVICE_PROVIDER= process.env.TRON_GASFREE_SERVICE_PROVIDER ?? "";
const GASFREE_VERIFYING_CONTRACT = process.env.TRON_GASFREE_VERIFYING_CONTRACT ?? "";
const GASFREE_API_KEY         = process.env.TRON_GASFREE_API_KEY ?? "";
const GASFREE_API_SECRET      = process.env.TRON_GASFREE_API_SECRET ?? "";

const TRON_CHAIN_ID = 728126428;

// ── USDT contract addresses ────────────────────────────────────────────────
const USDT_CONTRACTS: Record<string, { address: string; decimals: number }> = {
  BSC:      { address: "0x55d398326f99059fF775485246999027B3197955", decimals: 18 },
  ETH:      { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6  },
  ARBITRUM: { address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6  },
  POLYGON:  { address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", decimals: 6  },
  TRON:     { address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",         decimals: 6  },
  TON:      { address: "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs", decimals: 6 },
  SOLANA:   { address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",    decimals: 6 },
};

// ── EVM RPC endpoints ──────────────────────────────────────────────────────
const EVM_RPCS: Record<string, string[]> = {
  BSC:      ["https://bsc-dataseed1.binance.org/", "https://bsc-dataseed2.binance.org/", "https://bsc-dataseed1.defibit.io/"],
  ETH:      ["https://eth.llamarpc.com", "https://rpc.ankr.com/eth"],
  ARBITRUM: ["https://arb1.arbitrum.io/rpc", "https://rpc.ankr.com/arbitrum"],
  POLYGON:  ["https://polygon-rpc.com", "https://rpc.ankr.com/polygon"],
};

// ERC20 minimal ABI for transfer
const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
];

// ── GasFree PermitTransfer EIP-712 types ──────────────────────────────────
const PERMIT_712_TYPES = {
  PermitTransfer: [
    { name: "token",           type: "address" },
    { name: "serviceProvider", type: "address" },
    { name: "user",            type: "address" },
    { name: "receiver",        type: "address" },
    { name: "value",           type: "uint256" },
    { name: "maxFee",          type: "uint256" },
    { name: "deadline",        type: "uint256" },
    { name: "version",         type: "uint256" },
    { name: "nonce",           type: "uint256" },
  ],
};

// ── Result type ────────────────────────────────────────────────────────────
export interface TransferResult {
  txHash: string;
}

// ── TRON address → 32-byte ABI-encoded hex (без TronWeb) ──────────────────
// TRON base58check → BigInt → strip 0x41 prefix + 4-byte checksum → 20-byte EVM addr padded to 32
function tronBase58ToAbiHex(address: string): string {
  const ALPHA = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let n = 0n;
  for (const c of address) {
    const idx = ALPHA.indexOf(c);
    if (idx < 0) throw new Error(`Invalid TRON address char: ${c}`);
    n = n * 58n + BigInt(idx);
  }
  // 25 bytes = 1 prefix (41) + 20 EVM addr + 4 checksum = 50 hex chars
  const full = n.toString(16).padStart(50, "0");
  // chars 0-1 = 0x41 prefix, chars 2-41 = 20-byte EVM addr, chars 42-49 = checksum
  return full.slice(2, 42).padStart(64, "0");
}

// ── TRON transfer fee quote ────────────────────────────────────────────────
export interface TronTransferQuote {
  energyRequired: number;      // энергия нужна для этого tx
  energyAvailable: number;     // бесплатная энергия от замороженного TRX
  energyShortfall: number;     // энергия которую нужно сжечь из TRX
  energyFeeSun: number;        // стоимость энергии в sun
  bandwidthRequired: number;   // estimated bytes
  bandwidthAvailable: number;  // бесплатный bandwidth
  bandwidthFeeSun: number;     // стоимость bandwidth в sun
  totalFeeSun: number;         // итого TRX нужно (sun)
  trxBalanceSun: number;       // текущий TRX баланс (sun)
  feeLimitSun: number;         // рекомендованный feeLimit для triggerSmartContract
  sufficient: boolean;
  shortfallSun: number;        // 0 если хватает
}

// ── TRON pre-flight: вычислить стоимость перевода в TRX ───────────────────
// Вызывает 3 TronGrid API параллельно + estimateenergy для USDT
// Бросает если API недоступен — не блокирует перевод если quote не критична
export async function getTronTransferQuote(
  fromAddress: string,
  toAddress: string,
  amountSun: bigint,
  currency: string,
): Promise<TronTransferQuote> {
  const BASE = "https://api.trongrid.io";
  const TRONGRID_KEY = process.env.TRONWEB_PRO_API_KEY ?? "";

  // Базовые заголовки — с API ключом estimateenergy работает точнее
  const tronHeaders = (extra: Record<string, string> = {}): Record<string, string> => ({
    "Accept": "application/json",
    "Content-Type": "application/json",
    ...(TRONGRID_KEY ? { "TRON-PRO-API-KEY": TRONGRID_KEY } : {}),
    ...extra,
  });

  // Параллельный запрос: баланс + ресурсы + параметры сети
  const [accountData, resourceData, chainData] = await Promise.all([
    fetch(`${BASE}/v1/accounts/${fromAddress}`, {
      headers: tronHeaders(),
      signal: AbortSignal.timeout(10_000),
    }).then(r => r.json() as Promise<any>),
    fetch(`${BASE}/wallet/getaccountresource`, {
      method: "POST",
      headers: tronHeaders(),
      body: JSON.stringify({ address: fromAddress, visible: true }),
      signal: AbortSignal.timeout(10_000),
    }).then(r => r.json() as Promise<any>),
    fetch(`${BASE}/wallet/getchainparameters`, {
      headers: tronHeaders(),
      signal: AbortSignal.timeout(10_000),
    }).then(r => r.json() as Promise<any>),
  ]);

  // TRX баланс
  const trxBalanceSun = Number(accountData.data?.[0]?.balance ?? 0);

  // Доступная энергия (от стейкинга)
  const energyLimit = Number(resourceData.EnergyLimit ?? 0);
  const energyUsed  = Number(resourceData.EnergyUsed ?? 0);
  const energyAvailable = Math.max(0, energyLimit - energyUsed);

  // Доступный bandwidth
  const freeNetLimit = Number(resourceData.freeNetLimit ?? 1500);
  const freeNetUsed  = Number(resourceData.freeNetUsed ?? 0);
  const netLimit     = Number(resourceData.NetLimit ?? 0);
  const netUsed      = Number(resourceData.NetUsed ?? 0);
  const bandwidthAvailable = Math.max(0, (freeNetLimit - freeNetUsed) + (netLimit - netUsed));

  // Цены из параметров сети
  const chainParams = (chainData.chainParameter ?? []) as Array<{ key: string; value: number }>;
  const energyFeeSunPerUnit     = chainParams.find(p => p.key === "getEnergyFee")?.value ?? 420;
  const bandwidthFeeSunPerByte  = chainParams.find(p => p.key === "getTransactionFee")?.value ?? 1000;

  // Оценка энергии через API (точнее fallback константы)
  let energyRequired = currency === "USDT" ? 65_000 : 0; // conservative USDT default
  if (currency === "USDT") {
    try {
      // ABI-encode transfer(address,uint256) без зависимости от TronWeb instance
      // TRON base58check → 25 bytes big-int → strip 0x41 prefix + checksum → 20-byte EVM addr
      const addrHex  = tronBase58ToAbiHex(toAddress);
      const amtHex   = amountSun.toString(16).padStart(64, "0");
      const parameter = addrHex + amtHex;

      const est = await fetch(`${BASE}/wallet/estimateenergy`, {
        method: "POST",
        headers: tronHeaders(),
        body: JSON.stringify({
          owner_address: fromAddress,
          contract_address: USDT_CONTRACTS["TRON"].address,
          function_selector: "transfer(address,uint256)",
          parameter,
          visible: true,
        }),
        signal: AbortSignal.timeout(10_000),
      }).then(r => r.json() as Promise<any>);

      if (est.energy_required) {
        energyRequired = Math.ceil(Number(est.energy_required) * 1.15); // +15% margin
        console.log(`[TRON quote] estimateEnergy=${est.energy_required}, с запасом=${energyRequired}`);
      } else if (est.Error || est.code) {
        // TronGrid returned a structured error (e.g. contract not activated, bad params, rate-limit)
        console.warn(
          `[TRON quote] estimateEnergy вернул ошибку — используем fallback ${energyRequired}: ` +
          `code=${est.code ?? "n/a"}, message=${est.Error ?? "n/a"}`,
        );
      } else {
        // Unexpected shape — log raw response for debugging
        console.warn(
          `[TRON quote] estimateEnergy: неожиданный ответ (нет energy_required и нет Error) — ` +
          `используем fallback ${energyRequired}. Ответ: ${JSON.stringify(est)}`,
        );
      }
    } catch (err: any) {
      console.warn(`[TRON quote] estimateEnergy недоступен, используем ${energyRequired}: ${err.message}`);
    }
  }

  // Размер транзакции в байтах
  const bandwidthRequired = currency === "USDT" ? 350 : 270;

  // Рассчитываем дефицит
  const energyShortfall   = Math.max(0, energyRequired - energyAvailable);
  const energyFeeSun      = energyShortfall * energyFeeSunPerUnit;
  const bandwidthShortfall = Math.max(0, bandwidthRequired - bandwidthAvailable);
  const bandwidthFeeSun   = bandwidthShortfall * bandwidthFeeSunPerByte;
  const totalFeeSun       = energyFeeSun + bandwidthFeeSun;

  // feeLimit: покрываем всю энергию + 20% запас. Min 15 TRX, max 100 TRX
  const feeLimitSun = Math.min(
    Math.max(Math.ceil(energyRequired * energyFeeSunPerUnit * 1.20), 15_000_000),
    100_000_000,
  );

  const sufficient  = trxBalanceSun >= totalFeeSun;
  const shortfallSun = sufficient ? 0 : totalFeeSun - trxBalanceSun;

  console.log(
    `[TRON quote] ${currency} ${fromAddress.slice(0, 8)}…: ` +
    `energy=${energyRequired}(avail=${energyAvailable}), ` +
    `bw=${bandwidthRequired}(avail=${bandwidthAvailable}), ` +
    `fee=${(totalFeeSun / 1e6).toFixed(3)} TRX, ` +
    `balance=${(trxBalanceSun / 1e6).toFixed(3)} TRX, ` +
    `feeLimit=${(feeLimitSun / 1e6).toFixed(2)} TRX, ` +
    `sufficient=${sufficient}`,
  );

  return {
    energyRequired,
    energyAvailable,
    energyShortfall,
    energyFeeSun,
    bandwidthRequired,
    bandwidthAvailable,
    bandwidthFeeSun,
    totalFeeSun,
    trxBalanceSun,
    feeLimitSun,
    sufficient,
    shortfallSun,
  };
}

// ── Ждём подтверждения TRON tx на блокчейне ───────────────────────────────
// Бросает если tx reverted on-chain (energy сожжена, USDT НЕ переведён).
// При timeout — только warn, tx вероятно всё равно подтвердится.
async function waitForTronTxSuccess(txHash: string, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 3_500));
    try {
      const info = await fetch("https://api.trongrid.io/wallet/gettransactioninfobyid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: txHash }),
        signal: AbortSignal.timeout(8_000),
      }).then(r => r.json() as Promise<any>);

      if (info && info.id) {
        // Транзакция попала в блок
        const contractResult = info.receipt?.result;
        if (contractResult && contractResult !== "SUCCESS") {
          throw new Error(
            `TRON_REVERT: tx откатился на блокчейне: ${contractResult} ` +
            `(txHash=${txHash}). TRX на газ потрачен, USDT НЕ переведён.`,
          );
        }
        return; // SUCCESS
      }
    } catch (err: any) {
      if (err.message?.startsWith("TRON_REVERT:")) throw err;
      // сетевая ошибка при polling — продолжаем
    }
  }
  console.warn(`[TRON] Таймаут ожидания подтверждения ${txHash} — tx вероятно подтвердится позже`);
}

// ── Main entry point ───────────────────────────────────────────────────────
export async function localTransfer(params: {
  network: string;          // BSC | ETH | ARBITRUM | POLYGON | TRON | TON | SOLANA
  currency: string;         // USDT | BNB | ETH | TRX | TON | SOL | MATIC | etc.
  privateKey: string;
  fromAddress: string;
  toAddress: string;
  amount: number;           // human-readable (e.g. 1.5 USDT)
  mode?: string;            // "standard" | "gasfree"
  gasfreeAddress?: string;  // stored gasFree address for this wallet (from provider)
}): Promise<TransferResult> {
  const { network, currency, privateKey, fromAddress, toAddress, amount, mode } = params;
  const cur = currency.toUpperCase();

  console.log(`[Blockchain] Transfer ${amount} ${cur} on ${network} (mode=${mode ?? "standard"}) from ${fromAddress} → ${toAddress}`);

  if (["BSC", "ETH", "ARBITRUM", "POLYGON"].includes(network)) {
    return evmTransfer({ network, currency: cur, privateKey, toAddress, amount });
  }
  if (network === "TRON") {
    if (mode === "gasfree") {
      return tronGasFreeTransfer({ currency: cur, privateKey, fromAddress, toAddress, amount });
    }
    return tronTransfer({ currency: cur, privateKey, fromAddress, toAddress, amount });
  }
  if (network === "TON") {
    return tonTransfer({ currency: cur, privateKey, fromAddress, toAddress, amount });
  }
  if (network === "SOLANA") {
    return solanaTransfer({ currency: cur, privateKey, toAddress, amount });
  }
  throw new Error(`Unsupported network for local transfer: ${network}`);
}

// ══════════════════════════════════════════════════════════════════════════
// EVM (BSC / ETH / ARBITRUM / POLYGON)
// ══════════════════════════════════════════════════════════════════════════
async function evmTransfer(p: {
  network: string;
  currency: string;
  privateKey: string;
  toAddress: string;
  amount: number;
}): Promise<TransferResult> {
  const { ethers } = await import("ethers");
  const rpcs = EVM_RPCS[p.network];
  if (!rpcs) throw new Error(`No RPC configured for ${p.network}`);

  let lastErr: any;
  for (const rpc of rpcs) {
    try {
      const provider = new ethers.JsonRpcProvider(rpc);
      const key = p.privateKey.startsWith("0x") ? p.privateKey : `0x${p.privateKey}`;
      const wallet = new ethers.Wallet(key, provider);

      let tx: any;
      if (p.currency === "USDT") {
        const cfg = USDT_CONTRACTS[p.network];
        if (!cfg) throw new Error(`No USDT contract for ${p.network}`);
        const contract = new ethers.Contract(cfg.address, ERC20_ABI, wallet);
        const amountWei = ethers.parseUnits(String(p.amount), cfg.decimals);
        tx = await contract.transfer(p.toAddress, amountWei);
      } else {
        // Native coin (BNB, ETH, MATIC, etc.)
        const amountWei = ethers.parseEther(String(p.amount));
        tx = await wallet.sendTransaction({ to: p.toAddress, value: amountWei });
      }

      console.log(`[EVM:${p.network}] tx submitted: ${tx.hash}`);
      return { txHash: tx.hash };
    } catch (err: any) {
      console.warn(`[EVM:${p.network}] RPC ${rpc} failed: ${err.message}`);
      lastErr = err;
    }
  }
  throw lastErr ?? new Error(`All RPCs failed for ${p.network}`);
}

// ══════════════════════════════════════════════════════════════════════════
// TRON — standard (requires TRX for energy)
// ══════════════════════════════════════════════════════════════════════════
async function tronTransfer(p: {
  currency: string;
  privateKey: string;
  fromAddress: string;   // адрес отправителя (нужен для pre-flight)
  toAddress: string;
  amount: number;
}): Promise<TransferResult> {
  const require = createRequire(import.meta.url);
  const TronWeb = require("tronweb");

  const tronWeb = new TronWeb({
    fullHost: "https://api.trongrid.io",
    privateKey: p.privateKey,
  });

  // Derive fromAddress from key if caller didn't provide it
  const fromAddress = p.fromAddress || tronWeb.defaultAddress.base58 as string;

  if (p.currency === "USDT") {
    const cfg = USDT_CONTRACTS["TRON"];
    const amountSun = BigInt(Math.round(p.amount * Math.pow(10, cfg.decimals)));

    // ── 1. Pre-flight: проверяем TRX баланс и энергию ─────────────────
    const quote = await getTronTransferQuote(fromAddress, p.toAddress, amountSun, "USDT");
    if (!quote.sufficient) {
      const needed    = (quote.totalFeeSun    / 1e6).toFixed(3);
      const available = (quote.trxBalanceSun  / 1e6).toFixed(3);
      const shortfall = (quote.shortfallSun   / 1e6).toFixed(3);
      throw new Error(
        `INSUFFICIENT_TRX: для отправки USDT нужно ~${needed} TRX на газ ` +
        `(energy×${quote.energyShortfall} + bandwidth×${quote.bandwidthRequired}), ` +
        `доступно ${available} TRX, нехватает ${shortfall} TRX`,
      );
    }
    // ──────────────────────────────────────────────────────────────────

    const parameter = [
      { type: "address", value: p.toAddress },
      { type: "uint256", value: amountSun.toString() },
    ];
    const { transaction } = await tronWeb.transactionBuilder.triggerSmartContract(
      cfg.address,
      "transfer(address,uint256)",
      { feeLimit: quote.feeLimitSun },   // динамический, не хардкод
      parameter,
    );
    const signed = await tronWeb.trx.sign(transaction, p.privateKey);
    const result = await tronWeb.trx.sendRawTransaction(signed);
    if (!result.result) {
      throw new Error(`TRON broadcast failed: ${JSON.stringify(result)}`);
    }
    const txHash: string = result.txid;

    // ── 2. Ждём on-chain подтверждения (детектируем откат) ─────────────
    await waitForTronTxSuccess(txHash, 60_000);
    // ──────────────────────────────────────────────────────────────────

    console.log(`[TRON] USDT tx confirmed: ${txHash}`);
    return { txHash };

  } else if (p.currency === "TRX") {
    const amountSun = Math.round(p.amount * 1_000_000);

    // ── Pre-flight для TRX перевода (проверяем bandwidth) ─────────────
    const quote = await getTronTransferQuote(fromAddress, p.toAddress, BigInt(amountSun), "TRX");
    if (!quote.sufficient) {
      const needed    = (quote.totalFeeSun   / 1e6).toFixed(3);
      const available = (quote.trxBalanceSun / 1e6).toFixed(3);
      const shortfall = (quote.shortfallSun  / 1e6).toFixed(3);
      throw new Error(
        `INSUFFICIENT_TRX: для отправки TRX нужно ~${needed} TRX на bandwidth, ` +
        `доступно ${available} TRX, нехватает ${shortfall} TRX`,
      );
    }
    // ──────────────────────────────────────────────────────────────────

    const unsignedTx = await tronWeb.transactionBuilder.sendTrx(p.toAddress, amountSun);
    const signed = await tronWeb.trx.sign(unsignedTx, p.privateKey);
    const result = await tronWeb.trx.sendRawTransaction(signed);
    if (!result.result) throw new Error(`TRON TRX broadcast failed: ${JSON.stringify(result)}`);
    const txHash: string = result.txid;

    console.log(`[TRON] TRX tx submitted: ${txHash}`);
    return { txHash };

  } else {
    throw new Error(`Unsupported TRON currency: ${p.currency}`);
  }
}

// ══════════════════════════════════════════════════════════════════════════
// TRON — GasFree (PermitTransfer EIP-712 via relayer, no TRX needed)
// ══════════════════════════════════════════════════════════════════════════
async function tronGasFreeTransfer(p: {
  currency: string;
  privateKey: string;
  fromAddress: string;
  toAddress: string;
  amount: number;
}): Promise<TransferResult> {
  // ── 0. Валидация конфига ────────────────────────────────────────────────
  if (!GASFREE_PROVIDER || !GASFREE_SERVICE_PROVIDER || !GASFREE_VERIFYING_CONTRACT) {
    const missing = [
      !GASFREE_PROVIDER           && "TRON_GASFREE_PROVIDER",
      !GASFREE_SERVICE_PROVIDER   && "TRON_GASFREE_SERVICE_PROVIDER",
      !GASFREE_VERIFYING_CONTRACT && "TRON_GASFREE_VERIFYING_CONTRACT",
    ].filter(Boolean).join(", ");
    throw new Error(`GasFree не настроен. Отсутствуют env-переменные: ${missing}`);
  }
  if (p.currency !== "USDT") {
    throw new Error(`GasFree поддерживает только USDT, получен: ${p.currency}`);
  }

  // ── 1. Верифицируем что private key соответствует fromAddress ───────────
  // Несоответствие гарантирует невалидную подпись (relayer вернёт ошибку после broadcast)
  const require = createRequire(import.meta.url);
  const TronWeb = require("tronweb");
  {
    const tronWeb = new TronWeb({ fullHost: "https://api.trongrid.io", privateKey: p.privateKey });
    const derivedAddress: string = tronWeb.defaultAddress.base58;
    if (derivedAddress !== p.fromAddress) {
      throw new Error(
        `GasFree: несоответствие ключа и адреса. ` +
        `Ключ принадлежит ${derivedAddress}, передан fromAddress=${p.fromAddress}. ` +
        `Подпись будет невалидной — перевод отменён.`,
      );
    }
  }

  const usdtContract = USDT_CONTRACTS["TRON"].address;
  const decimals     = USDT_CONTRACTS["TRON"].decimals;

  // ── 2. Параллельно: nonce/active и конфиг комиссий ─────────────────────
  const [accountInfo, tokenConfig] = await Promise.all([
    gasFreeRequest("GET", `/api/v1/address/${p.fromAddress}`),
    gasFreeRequest("GET", `/api/v1/config/token/all`),
  ]);

  const nonce: number    = accountInfo.nonce;
  const isActive: boolean = accountInfo.active ?? false;
  const allowSubmit: boolean = accountInfo.allowSubmit ?? true;

  if (!allowSubmit) {
    throw new Error(
      `GasFree: аккаунт ${p.fromAddress} не допущен к переводам (allowSubmit=false). ` +
      `Возможно аккаунт заблокирован провайдером.`,
    );
  }

  // Точное сравнение base58 (toLowerCase некорректен для case-sensitive base58)
  const tokenInfo = (tokenConfig.tokens ?? []).find(
    (t: any) => t.tokenAddress === usdtContract,
  );
  if (!tokenInfo) throw new Error("USDT не найден в конфиге GasFree провайдера");

  const activationFee = isActive ? BigInt(0) : BigInt(tokenInfo.activateFee ?? 0);
  const transferFee   = BigInt(tokenInfo.transferFee ?? 0);
  const maxFee        = transferFee + activationFee;

  console.log(
    `[GasFree] nonce=${nonce}, active=${isActive}, ` +
    `transferFee=${transferFee} (${Number(transferFee)/1e6} USDT), ` +
    `activationFee=${activationFee} (${Number(activationFee)/1e6} USDT), ` +
    `maxFee=${maxFee} (${Number(maxFee)/1e6} USDT)`,
  );

  // ── 3. Build and sign PermitTransfer EIP-712 ───────────────────────────
  const { secp256k1 }           = await import("@noble/curves/secp256k1.js");
  const { utils: TronWebUtils } = require("tronweb");

  const deadline  = Math.floor(Date.now() / 1_000) + 300; // 5 min
  const amountRaw = BigInt(Math.round(p.amount * Math.pow(10, decimals)));

  const domain = {
    name:              "GasFreeController",
    version:           "V1.0.0",
    chainId:           `${TRON_CHAIN_ID}`,
    verifyingContract: GASFREE_VERIFYING_CONTRACT,
  };

  const message = {
    token:           usdtContract,
    serviceProvider: GASFREE_SERVICE_PROVIDER,
    user:            p.fromAddress,
    receiver:        p.toAddress,
    value:           amountRaw.toString(),
    maxFee:          maxFee.toString(),
    deadline,
    version:         1,
    nonce,
  };

  const digest = TronWebUtils._TypedDataEncoder
    .hash(domain, PERMIT_712_TYPES, message)
    .slice(2); // remove 0x prefix

  const pkBytes   = Buffer.from(p.privateKey.replace(/^0x/, ""), "hex");
  const sig       = secp256k1.sign(digest, pkBytes, { lowS: true });
  const r         = sig.r.toString(16).padStart(64, "0");
  const s         = sig.s.toString(16).padStart(64, "0");
  const v         = (sig.recovery + 27).toString(16).padStart(2, "0");
  const signature = r + s + v; // hex без 0x (как в SDK)

  console.log(`[GasFree] Signing: user=${p.fromAddress}, receiver=${p.toAddress}, value=${amountRaw}, deadline=${deadline}`);

  // ── 4. Submit to relayer ───────────────────────────────────────────────
  const submitBody = { ...message, sig: signature };
  const submitResp = await gasFreeRequest("POST", "/api/v1/gasfree/submit", submitBody);

  const jobId: string = submitResp.id;
  console.log(`[GasFree] Submit OK, jobId=${jobId}`);

  // ── 5. Poll for on-chain txHash (up to 90 s) ──────────────────────────
  const txHash = await pollGasFreeResult(jobId, 90_000);

  console.log(`[TRON GasFree] tx confirmed: ${txHash}`);
  return { txHash };
}

// ── GasFree HTTP helper ────────────────────────────────────────────────────
// open.gasfree.io uses /tron/<path> in the URL AND in the HMAC message.
// E.g. path="/api/v1/config/token/all" → URL="/tron/api/v1/config/token/all"
//                                       → HMAC msg = "GET/tron/api/v1/config/token/all<ts>"
async function gasFreeRequest(method: string, path: string, body?: any): Promise<any> {
  const chainPrefix = "/tron";
  const fullPath    = chainPrefix + path;           // used in both URL and HMAC
  const url         = GASFREE_PROVIDER + fullPath;
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (GASFREE_API_KEY && GASFREE_API_SECRET) {
    const timestamp = Math.floor(Date.now() / 1_000);
    const msg       = method + fullPath + timestamp; // e.g. "GET/tron/api/v1/..."
    const hmacSig   = createHmac("sha256", GASFREE_API_SECRET)
      .update(msg)
      .digest("base64");
    headers["Timestamp"]     = `${timestamp}`;
    headers["Authorization"] = `ApiKey ${GASFREE_API_KEY}:${hmacSig}`;
  }

  const resp = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });

  const text = await resp.text();
  let data: any;
  try { data = JSON.parse(text); } catch {
    throw new Error(`GasFree API вернул не-JSON (${resp.status}): ${text.slice(0, 200)}`);
  }
  if (data.code !== 200) {
    throw new Error(`GasFree API ошибка: ${data.reason ?? data.message ?? JSON.stringify(data)}`);
  }
  return data.data;
}

// ── Poll relayer until txHash appears ─────────────────────────────────────
// API возвращает txnHash (основное поле) или txHash (fallback если API изменится)
async function pollGasFreeResult(jobId: string, timeoutMs: number): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let lastStatus: string | undefined;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 3_500));
    try {
      const result = await gasFreeRequest("GET", `/api/v1/gasfree/${jobId}`);
      const hash = result?.txnHash ?? result?.txHash;
      if (hash) return hash as string;
      // Log status transitions для диагностики
      const status = result?.status ?? result?.state;
      if (status && status !== lastStatus) {
        console.log(`[GasFree] jobId=${jobId} status → ${status}`);
        lastStatus = status;
      }
      // Ранний выход при terminal failure-статусах (чтобы не ждать полный timeout)
      if (typeof status === "string" && /fail|reject|cancel/i.test(status)) {
        throw new Error(`GasFree: задание отклонено релеером (jobId=${jobId}, status=${status})`);
      }
    } catch (err: any) {
      if (err.message?.includes("jobId=")) throw err; // propagate terminal errors
      // сетевая ошибка — продолжаем polling
    }
  }
  throw new Error(`GasFree: таймаут ожидания txHash для jobId=${jobId}`);
}

// ══════════════════════════════════════════════════════════════════════════
// Helper: получить gasFreeAddress для кошелька через GasFree API.
// gasFreeAddress — адрес куда клиенты отправляют USDT (не сам кошелёк!).
// Сначала пробуем API (надёжно), fallback — локальный SDK (если API не настроен).
// ══════════════════════════════════════════════════════════════════════════
export async function registerGasFreeWallet(address: string): Promise<string | null> {
  // ── Приоритет 1: GasFree API → GET /tron/api/v1/address/{address} ──────
  if (GASFREE_PROVIDER && GASFREE_API_KEY) {
    try {
      const info = await gasFreeRequest("GET", `/api/v1/address/${address}`);
      if (info?.gasFreeAddress) {
        console.log(`[GasFree] API: gasFreeAddress for ${address} → ${info.gasFreeAddress}`);
        return info.gasFreeAddress as string;
      }
    } catch (err: any) {
      console.warn(`[GasFree] API lookup failed for ${address}: ${err.message} — trying SDK fallback`);
    }
  }

  // ── Приоритет 2: локальный SDK (не требует API) ────────────────────────
  try {
    const require = createRequire(import.meta.url);
    const { TronGasFree } = require("@gasfree/gasfree-sdk");
    const gf = new TronGasFree({ chainId: 0x2b6653dc }); // TRON mainnet
    const gasFreeAddr: string = gf.generateGasFreeAddress(address);
    console.log(`[GasFree] SDK: gasFreeAddress for ${address} → ${gasFreeAddr}`);
    return gasFreeAddr;
  } catch (err: any) {
    console.warn(`[GasFree] SDK fallback failed for ${address}: ${err.message}`);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════════
// Helper: предварительная оценка GasFree комиссии (без подписи/отправки).
// Используется в check-gas для показа USDT-стоимости перед выплатой.
// ══════════════════════════════════════════════════════════════════════════
export interface GasFreeQuote {
  active: boolean;          // кошелёк уже активирован (activation fee = 0)
  allowSubmit: boolean;     // можно отправлять транзакции
  transferFeeUsdt: number;  // комиссия за перевод (всегда)
  activationFeeUsdt: number;// комиссия за активацию (только при active=false)
  totalFeeUsdt: number;     // итого спишется из суммы перевода
}

export async function getGasFreeQuote(fromAddress: string): Promise<GasFreeQuote> {
  const [accountInfo, tokenConfig] = await Promise.all([
    gasFreeRequest("GET", `/api/v1/address/${fromAddress}`),
    gasFreeRequest("GET", `/api/v1/config/token/all`),
  ]);

  const isActive    = accountInfo.active     ?? false;
  const allowSubmit = accountInfo.allowSubmit ?? true;
  const usdtContract = USDT_CONTRACTS["TRON"].address;

  const tokenInfo = (tokenConfig.tokens ?? []).find(
    (t: any) => t.tokenAddress === usdtContract,
  );

  const transferFeeUsdt   = Number(tokenInfo?.transferFee ?? 1_500_000) / 1e6;
  const activationFeeUsdt = isActive ? 0 : Number(tokenInfo?.activateFee ?? 1_500_000) / 1e6;

  console.log(
    `[GasFree quote] ${fromAddress.slice(0, 8)}…: ` +
    `active=${isActive}, transferFee=${transferFeeUsdt} USDT, ` +
    `activationFee=${activationFeeUsdt} USDT`,
  );

  return {
    active: isActive,
    allowSubmit,
    transferFeeUsdt,
    activationFeeUsdt,
    totalFeeUsdt: transferFeeUsdt + activationFeeUsdt,
  };
}

// ══════════════════════════════════════════════════════════════════════════
// Helper: fetch live USDT balance for a TRON address via TronGrid.
// Returns balance in human-readable USDT (e.g. 12.5).
// Returns 0 if the account has no USDT or does not exist yet.
// ══════════════════════════════════════════════════════════════════════════
export async function getTronUsdtBalance(address: string): Promise<number> {
  const BASE = "https://api.trongrid.io";
  const TRONGRID_KEY = process.env.TRONWEB_PRO_API_KEY ?? "";
  const headers: Record<string, string> = { "Accept": "application/json" };
  if (TRONGRID_KEY) headers["TRON-PRO-API-KEY"] = TRONGRID_KEY;

  const resp = await fetch(`${BASE}/v1/accounts/${address}`, {
    headers,
    signal: AbortSignal.timeout(10_000),
  });
  if (!resp.ok) {
    throw new Error(`TronGrid accounts API error ${resp.status} for ${address}`);
  }
  const data = await resp.json() as any;
  const accountData = data.data?.[0];
  if (!accountData) return 0; // account not activated / no txs yet

  // trc20 is an array of { [contractAddress]: balanceString } objects
  const trc20List: Array<Record<string, string>> = accountData.trc20 ?? [];
  const usdtContract = USDT_CONTRACTS["TRON"].address;
  const decimals = USDT_CONTRACTS["TRON"].decimals;
  for (const item of trc20List) {
    if (item[usdtContract] !== undefined) {
      return Number(item[usdtContract]) / Math.pow(10, decimals);
    }
  }
  return 0;
}

// ══════════════════════════════════════════════════════════════════════════
// TON
// ══════════════════════════════════════════════════════════════════════════
async function tonTransfer(p: {
  currency: string;
  privateKey: string;
  fromAddress: string;
  toAddress: string;
  amount: number;
}): Promise<TransferResult> {
  const { TonClient, WalletContractV4, internal, JettonMaster, toNano, Address, beginCell } = await import("@ton/ton");
  const { mnemonicToPrivateKey, keyPairFromSecretKey } = await import("@ton/crypto");

  const client = new TonClient({ endpoint: "https://toncenter.com/api/v2/jsonRPC" });

  let keyPair: { publicKey: Buffer; secretKey: Buffer };
  const pkHex = p.privateKey.replace(/^0x/, "");
  if (pkHex.length === 64) {
    // 32-byte seed — derive keypair
    const seed = Buffer.from(pkHex, "hex");
    keyPair = keyPairFromSecretKey(Buffer.concat([seed, seed]));
  } else if (p.privateKey.includes(" ")) {
    keyPair = await mnemonicToPrivateKey(p.privateKey.split(" "));
  } else {
    // 64-byte full keypair
    keyPair = keyPairFromSecretKey(Buffer.from(pkHex, "hex"));
  }

  const wallet = client.open(WalletContractV4.create({ publicKey: keyPair.publicKey, workchain: 0 }));
  const seqno  = await wallet.getSeqno();

  let txHash: string;

  if (p.currency === "USDT") {
    const usdtMaster      = Address.parse(USDT_CONTRACTS["TON"].address);
    const jettonMaster    = client.open(JettonMaster.create(usdtMaster));
    const jettonWalletAddr = await jettonMaster.getWalletAddress(wallet.address);
    const amount           = BigInt(Math.round(p.amount * 1_000_000));
    const forwardAmount    = toNano("0.01");
    const attachedTon      = toNano("0.05");

    const jettonPayload = beginCell()
      .storeUint(0xf8a7ea5, 32)
      .storeUint(0, 64)
      .storeCoins(amount)
      .storeAddress(Address.parse(p.toAddress))
      .storeAddress(wallet.address)
      .storeBit(false)
      .storeCoins(forwardAmount)
      .storeBit(false)
      .endCell();

    const transfer = wallet.createTransfer({
      seqno, secretKey: keyPair.secretKey,
      messages: [internal({ to: jettonWalletAddr, value: attachedTon, body: jettonPayload })],
    });
    await client.sendExternalMessage(wallet, transfer);
    txHash = Buffer.from(transfer.hash()).toString("hex");
  } else if (p.currency === "TON") {
    const transfer = wallet.createTransfer({
      seqno, secretKey: keyPair.secretKey,
      messages: [internal({ to: Address.parse(p.toAddress), value: toNano(String(p.amount)), bounce: false })],
    });
    await client.sendExternalMessage(wallet, transfer);
    txHash = Buffer.from(transfer.hash()).toString("hex");
  } else {
    throw new Error(`Unsupported TON currency: ${p.currency}`);
  }

  console.log(`[TON] tx submitted: ${txHash}`);
  return { txHash };
}

// ══════════════════════════════════════════════════════════════════════════
// SOLANA
// ══════════════════════════════════════════════════════════════════════════
async function solanaTransfer(p: {
  currency: string;
  privateKey: string;
  toAddress: string;
  amount: number;
}): Promise<TransferResult> {
  const { Connection, Keypair, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, sendAndConfirmTransaction } = await import("@solana/web3.js");
  const { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createTransferCheckedInstruction, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } = await import("@solana/spl-token");
  const bs58 = await import("bs58");

  const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");

  let keypair: InstanceType<typeof Keypair>;
  try {
    const decoded = bs58.default.decode(p.privateKey);
    keypair = Keypair.fromSecretKey(decoded);
  } catch {
    const bytes = Buffer.from(p.privateKey.replace(/^0x/, ""), "hex");
    keypair = Keypair.fromSecretKey(bytes);
  }

  let txHash: string;

  if (p.currency === "USDT") {
    const mintPubkey = new PublicKey(USDT_CONTRACTS["SOLANA"].address);
    const decimals   = USDT_CONTRACTS["SOLANA"].decimals;
    const toPubkey   = new PublicKey(p.toAddress);
    const fromAta    = await getAssociatedTokenAddress(mintPubkey, keypair.publicKey);
    const toAta      = await getAssociatedTokenAddress(mintPubkey, toPubkey);
    const amountRaw  = BigInt(Math.round(p.amount * Math.pow(10, decimals)));

    const tx = new Transaction();
    const toAtaInfo = await connection.getAccountInfo(toAta);
    if (!toAtaInfo) {
      tx.add(createAssociatedTokenAccountInstruction(
        keypair.publicKey, toAta, toPubkey, mintPubkey, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
      ));
    }
    tx.add(createTransferCheckedInstruction(fromAta, mintPubkey, toAta, keypair.publicKey, amountRaw, decimals));

    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = keypair.publicKey;
    txHash = await sendAndConfirmTransaction(connection, tx, [keypair]);
  } else if (p.currency === "SOL") {
    const toPubkey = new PublicKey(p.toAddress);
    const lamports = Math.round(p.amount * LAMPORTS_PER_SOL);
    const tx = new Transaction().add(
      SystemProgram.transfer({ fromPubkey: keypair.publicKey, toPubkey, lamports }),
    );
    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = keypair.publicKey;
    txHash = await sendAndConfirmTransaction(connection, tx, [keypair]);
  } else {
    throw new Error(`Unsupported Solana currency: ${p.currency}`);
  }

  console.log(`[Solana] tx submitted: ${txHash}`);
  return { txHash };
}
