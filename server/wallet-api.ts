// External wallet API service for creating crypto wallets

const WALLET_API_URL = process.env.WALLET_API_URL || 'https://pay.swiftx.online/api/wallet/create';
const WALLET_API_TOKEN = process.env.WALLET_API_KEY || '';

// Map network names to API node names
const NETWORK_TO_NODE: Record<string, string> = {
  'BEP20': 'BSC',
  'TRC20': 'TRON',
  'TON': 'TON',
  'Polygon': 'POLYGON'
};

export interface WalletCreateResponse {
  address: string;
  private_key: string;
  node_id: number;
  created_at: string;
}

export async function createWalletViaAPI(network: string): Promise<WalletCreateResponse> {
  const node = NETWORK_TO_NODE[network];
  
  if (!node) {
    throw new Error(`Unsupported network: ${network}`);
  }

  const response = await fetch(WALLET_API_URL, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${WALLET_API_TOKEN}`
    },
    body: JSON.stringify({ node })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create wallet: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data as WalletCreateResponse;
}
