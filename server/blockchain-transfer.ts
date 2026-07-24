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
    return tronTransfer({ currency: cur, privateKey, toAddress, amount });
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
  toAddress: string;
  amount: number;
}): Promise<TransferResult> {
  const require = createRequire(import.meta.url);
  const TronWeb = require("tronweb");

  const tronWeb = new TronWeb({
    fullHost: "https://api.trongrid.io",
    privateKey: p.privateKey,
  });

  let txHash: string;

  if (p.currency === "USDT") {
    const cfg = USDT_CONTRACTS["TRON"];
    const amountSun = Math.round(p.amount * Math.pow(10, cfg.decimals));
    const parameter = [
      { type: "address", value: p.toAddress },
      { type: "uint256", value: amountSun },
    ];
    const { transaction } = await tronWeb.transactionBuilder.triggerSmartContract(
      cfg.address,
      "transfer(address,uint256)",
      { feeLimit: 30_000_000 },
      parameter,
    );
    const signed = await tronWeb.trx.sign(transaction, p.privateKey);
    const result = await tronWeb.trx.sendRawTransaction(signed);
    if (!result.result) throw new Error(`TRON broadcast failed: ${JSON.stringify(result)}`);
    txHash = result.txid;
  } else if (p.currency === "TRX") {
    const amountSun = Math.round(p.amount * 1_000_000);
    const unsignedTx = await tronWeb.transactionBuilder.sendTrx(p.toAddress, amountSun);
    const signed = await tronWeb.trx.sign(unsignedTx, p.privateKey);
    const result = await tronWeb.trx.sendRawTransaction(signed);
    if (!result.result) throw new Error(`TRON TRX broadcast failed: ${JSON.stringify(result)}`);
    txHash = result.txid;
  } else {
    throw new Error(`Unsupported TRON currency: ${p.currency}`);
  }

  console.log(`[TRON] tx submitted: ${txHash}`);
  return { txHash };
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
  if (!GASFREE_PROVIDER) {
    throw new Error(
      "GasFree не настроен. Задайте env-переменные: " +
      "TRON_GASFREE_PROVIDER, TRON_GASFREE_SERVICE_PROVIDER, TRON_GASFREE_VERIFYING_CONTRACT"
    );
  }
  if (p.currency !== "USDT") {
    throw new Error(`GasFree поддерживает только USDT, получен: ${p.currency}`);
  }

  const usdtContract = USDT_CONTRACTS["TRON"].address;
  const decimals = USDT_CONTRACTS["TRON"].decimals;

  // 1. Get account info (nonce) from provider
  const accountInfo = await gasFreeRequest("GET", `/api/v1/address/${p.fromAddress}`);
  const nonce: number = accountInfo.nonce;
  const isActive: boolean = accountInfo.active ?? false;

  // 2. Get fee from provider
  const tokenConfig = await gasFreeRequest("GET", `/api/v1/config/token/all`);
  const tokenInfo = (tokenConfig.tokens ?? []).find(
    (t: any) => t.tokenAddress?.toLowerCase() === usdtContract.toLowerCase()
  );
  if (!tokenInfo) throw new Error("USDT не найден в конфиге GasFree провайдера");

  const activationFee = isActive ? BigInt(0) : BigInt(tokenInfo.activateFee ?? 0);
  const transferFee   = BigInt(tokenInfo.transferFee ?? 0);
  const maxFee        = transferFee + activationFee;

  // 3. Build and sign PermitTransfer EIP-712 message
  const { secp256k1 }           = await import("@noble/curves/secp256k1");
  const require                 = createRequire(import.meta.url);
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
    .slice(2); // remove 0x

  const pkBytes  = Buffer.from(p.privateKey.replace(/^0x/, ""), "hex");
  const sig      = secp256k1.sign(digest, pkBytes, { lowS: true });
  const r        = sig.r.toString(16).padStart(64, "0");
  const s        = sig.s.toString(16).padStart(64, "0");
  const v        = (sig.recovery + 27).toString(16).padStart(2, "0");
  const signature = r + s + v; // without 0x prefix (as SDK does)

  // 4. Submit to relayer
  const submitBody = { ...message, sig: signature };
  const submitResp = await gasFreeRequest("POST", "/api/v1/gasfree/submit", submitBody);

  // submitResp.id is the relayer's internal job id; the actual txHash arrives later
  const jobId: string = submitResp.id;

  // 5. Poll for on-chain txHash (up to 60 s)
  const txHash = await pollGasFreeResult(jobId, 60_000);

  console.log(`[TRON GasFree] tx submitted: ${txHash}`);
  return { txHash };
}

// ── GasFree HTTP helper ────────────────────────────────────────────────────
async function gasFreeRequest(method: string, path: string, body?: any): Promise<any> {
  const url = GASFREE_PROVIDER + path;
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (GASFREE_API_KEY && GASFREE_API_SECRET) {
    const timestamp = Math.floor(Date.now() / 1_000);
    const prefix    = "/tron";
    const msg       = method + prefix + path + timestamp;
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
async function pollGasFreeResult(jobId: string, timeoutMs: number): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 3_000));
    try {
      const result = await gasFreeRequest("GET", `/api/v1/gasfree/${jobId}`);
      if (result?.txnHash) return result.txnHash as string;
    } catch {
      // keep polling
    }
  }
  throw new Error(`GasFree: таймаут ожидания txHash для jobId=${jobId}`);
}

// ══════════════════════════════════════════════════════════════════════════
// Helper: register wallet address with GasFree provider and return gasFreeAddress
// Call this when creating a new gasfree-mode TRON wallet.
// Returns null if GasFree is not configured.
// ══════════════════════════════════════════════════════════════════════════
export async function registerGasFreeWallet(address: string): Promise<string | null> {
  if (!GASFREE_PROVIDER) return null;
  try {
    const info = await gasFreeRequest("GET", `/api/v1/address/${address}`);
    return (info.gasFreeAddress as string) ?? null;
  } catch (err: any) {
    console.warn(`[GasFree] Could not register wallet ${address}: ${err.message}`);
    return null;
  }
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
