// External wallet API service for creating crypto wallets

const WALLET_API_URL = process.env.WALLET_API_URL || 'https://demo.u-api.pro/api/wallet/create';
const WALLET_API_TOKEN = process.env.WALLET_API_KEY || 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiIzbm9kZXNfYXBpIiwic3ViIjoiNzUzNmQ5N2UzMWI2Y2EwZmZhZWUwNjk2OTQ2NjRiYjdmZTNlMTQ1ZTFkOGFlZDAwNzljNjQwYjBiZjBhNGE3YiIsImlhdCI6MTc1OTYwMzUwNX0.hP-1Mj72usja9-8e6f25paIbZtjfU6IaklHCm-uidYE';

// Map network names to API node names
const NETWORK_TO_NODE: Record<string, string> = {
  'BEP20': 'BSC',
  'TRC20': 'TRON',
  'TON': 'TON'
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
      'Authorization': WALLET_API_TOKEN
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
