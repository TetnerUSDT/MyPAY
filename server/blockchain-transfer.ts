/**
 * Local blockchain transfer module.
 * Signs and broadcasts transactions using stored private keys.
 * NO calls to external wallet APIs for transfers — only public node RPCs.
 */

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

// ── Result type ────────────────────────────────────────────────────────────
export interface TransferResult {
  txHash: string;
}

// ── Main entry point ───────────────────────────────────────────────────────
export async function localTransfer(params: {
  network: string;   // BSC | ETH | ARBITRUM | POLYGON | TRON | TON | SOLANA
  currency: string;  // USDT | BNB | ETH | TRX | TON | SOL | MATIC | etc.
  privateKey: string;
  fromAddress: string;
  toAddress: string;
  amount: number;    // human-readable (e.g. 1.5 USDT)
}): Promise<TransferResult> {
  const { network, currency, privateKey, fromAddress, toAddress, amount } = params;
  const cur = currency.toUpperCase();

  console.log(`[Blockchain] Transfer ${amount} ${cur} on ${network} from ${fromAddress} → ${toAddress}`);

  if (["BSC", "ETH", "ARBITRUM", "POLYGON"].includes(network)) {
    return evmTransfer({ network, currency: cur, privateKey, toAddress, amount });
  }
  if (network === "TRON") {
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

  // Try each RPC until one works
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
        // Native coin transfer (BNB, ETH, MATIC, etc.)
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
// TRON
// ══════════════════════════════════════════════════════════════════════════
async function tronTransfer(p: {
  currency: string;
  privateKey: string;
  toAddress: string;
  amount: number;
}): Promise<TransferResult> {
  // TronWeb is a CommonJS module — use createRequire in ESM context
  const { createRequire } = await import("module");
  const require = createRequire(import.meta.url);
  const TronWeb = require("tronweb");

  const tronWeb = new TronWeb({
    fullHost: "https://api.trongrid.io",
    privateKey: p.privateKey,
  });

  let txHash: string;

  if (p.currency === "USDT") {
    const cfg = USDT_CONTRACTS["TRON"];
    const amountSun = Math.round(p.amount * Math.pow(10, cfg.decimals)); // 6 decimals
    // ABI-encode: transfer(address,uint256)
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
    // Native TRX
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

  // Derive key pair from private key (hex string → Buffer)
  let keyPair: { publicKey: Buffer; secretKey: Buffer };
  const pkHex = p.privateKey.replace(/^0x/, "");
  if (pkHex.length === 64) {
    // 32-byte hex private key
    const secretKey = Buffer.from(pkHex, "hex");
    // In @ton/crypto, secretKey is 64 bytes (private+public concatenated) or 32 bytes seed
    keyPair = keyPairFromSecretKey(Buffer.concat([secretKey, secretKey])); // will derive public
  } else if (p.privateKey.includes(" ")) {
    // Mnemonic phrase
    keyPair = await mnemonicToPrivateKey(p.privateKey.split(" "));
  } else {
    // Try 64-byte hex (full keypair)
    const secretKey = Buffer.from(pkHex, "hex");
    keyPair = keyPairFromSecretKey(secretKey);
  }

  const wallet = client.open(WalletContractV4.create({ publicKey: keyPair.publicKey, workchain: 0 }));
  const seqno = await wallet.getSeqno();

  let txHash: string;

  if (p.currency === "USDT") {
    // Jetton transfer
    const usdtMaster = Address.parse(USDT_CONTRACTS["TON"].address);
    const jettonMaster = client.open(JettonMaster.create(usdtMaster));
    const jettonWalletAddr = await jettonMaster.getWalletAddress(wallet.address);

    const amount = BigInt(Math.round(p.amount * 1_000_000)); // 6 decimals
    const forwardAmount = toNano("0.01");
    const attachedTon = toNano("0.05"); // gas for jetton transfer

    const jettonTransferPayload = beginCell()
      .storeUint(0xf8a7ea5, 32)  // op: jetton transfer
      .storeUint(0, 64)           // query_id
      .storeCoins(amount)         // amount
      .storeAddress(Address.parse(p.toAddress))  // destination
      .storeAddress(wallet.address)              // response destination
      .storeBit(false)            // no custom payload
      .storeCoins(forwardAmount)  // forward ton amount
      .storeBit(false)            // no forward payload
      .endCell();

    const transfer = wallet.createTransfer({
      seqno,
      secretKey: keyPair.secretKey,
      messages: [
        internal({
          to: jettonWalletAddr,
          value: attachedTon,
          body: jettonTransferPayload,
        }),
      ],
    });
    await client.sendExternalMessage(wallet, transfer);
    txHash = Buffer.from(transfer.hash()).toString("hex");
  } else if (p.currency === "TON") {
    // Native TON transfer
    const transfer = wallet.createTransfer({
      seqno,
      secretKey: keyPair.secretKey,
      messages: [
        internal({
          to: Address.parse(p.toAddress),
          value: toNano(String(p.amount)),
          bounce: false,
        }),
      ],
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
  const { Connection, Keypair, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, clusterApiUrl } = await import("@solana/web3.js");
  const { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createTransferCheckedInstruction, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } = await import("@solana/spl-token");
  const bs58 = await import("bs58");

  const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");

  // Parse private key — support base58 or hex
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
    const decimals = USDT_CONTRACTS["SOLANA"].decimals;
    const toPubkey = new PublicKey(p.toAddress);

    const fromAta = await getAssociatedTokenAddress(mintPubkey, keypair.publicKey);
    const toAta   = await getAssociatedTokenAddress(mintPubkey, toPubkey);

    const amountRaw = BigInt(Math.round(p.amount * Math.pow(10, decimals)));

    const tx = new Transaction();

    // Create recipient ATA if it doesn't exist
    const toAtaInfo = await connection.getAccountInfo(toAta);
    if (!toAtaInfo) {
      tx.add(
        createAssociatedTokenAccountInstruction(
          keypair.publicKey, toAta, toPubkey, mintPubkey,
          TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
        ),
      );
    }

    tx.add(
      createTransferCheckedInstruction(
        fromAta, mintPubkey, toAta, keypair.publicKey, amountRaw, decimals,
      ),
    );

    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = keypair.publicKey;

    const { sendAndConfirmTransaction } = await import("@solana/web3.js");
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

    const { sendAndConfirmTransaction } = await import("@solana/web3.js");
    txHash = await sendAndConfirmTransaction(connection, tx, [keypair]);
  } else {
    throw new Error(`Unsupported Solana currency: ${p.currency}`);
  }

  console.log(`[Solana] tx submitted: ${txHash}`);
  return { txHash };
}
