# Crypto Wallet API Documentation

## Base URL
```
https://your-domain.com
```

## Authentication

All endpoints except `/api/register` and `/api/login` require JWT authentication.

**Header Format:**
```
Authorization: Bearer <your_jwt_token>
```

---

## Endpoints

### 1. Register / Login

Creates a new user or logs in existing user.

**URL:** `POST /api/register` or `POST /api/login`

**Authentication:** Not required

**Request Body:**
```json
{
    "unique_hash": "your_unique_identifier_minimum_20_characters"
}
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| unique_hash | string | Yes | Unique identifier (min 20 characters) |

**Response (Success - 200):**
```json
{
    "success": true,
    "message": "User registered successfully",
    "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
}
```

**Response (Error - 400):**
```json
{
    "error": "Invalid or missing unique_hash"
}
```

---

### 2. List Wallets

Returns all wallets for authenticated user.

**URL:** `POST /api/wallets`

**Authentication:** Required (Bearer Token)

**Request Body (Optional):**
```json
{
    "node": "TRON"
}
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| node | string | No | Filter by network name |
| mode | string | No | Filter by wallet mode ("standard" or "gasfree"). Default: "standard" |

**Filter GasFree wallets:**
```json
{
    "node": "TRON",
    "mode": "gasfree"
}
```

**Response (Success - 200):**
```json
{
    "success": true,
    "wallets": [
        {
            "id": 1,
            "address": "TXyz123...",
            "node_id": 1,
            "network": "TRON",
            "mode": "standard"
        }
    ]
}
```

---

### 3. Create Wallet

Generates a new wallet for specified blockchain network.

**URL:** `POST /api/wallet/create`

**Authentication:** Required (Bearer Token)

**Request Body (Standard):**
```json
{
    "node": "TRON"
}
```

**Request Body (GasFree mode):**
```json
{
    "node": "TRON",
    "mode": "gasfree"
}
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| node | string | Yes | Network name (see supported networks) |
| mode | string | No | Wallet mode: "standard" (default) or "gasfree". GasFree is only available for TRON network |

**Response (Success - Standard - 200):**
```json
{
    "address": "TXyz123abc...",
    "private_key": "abc123...",
    "node_id": 1,
    "created_at": "2025-02-19 12:00:00"
}
```

**Response (Success - GasFree - 200):**
```json
{
    "address": "TXyz123abc...",
    "private_key": "abc123...",
    "gasfree_address": "TGasFreeAddr...",
    "node_id": 1,
    "mode": "gasfree",
    "created_at": "2025-02-19 12:00:00"
}
```

**Response (Error - 400):**
```json
{
    "error": "GasFree mode is only supported for TRON network"
}
```

---

### 4. Transfer Funds

Transfers cryptocurrency between addresses.

**URL:** `POST /api/wallet/transfer`

**Authentication:** Required (Bearer Token)

**Request Body (Standard):**
```json
{
    "node": "TRON",
    "address_from": "TXyz123...",
    "address_to": "TAbc456...",
    "amount": 10.5,
    "symbol": "TRX"
}
```

**Request Body (GasFree mode - USDT only):**
```json
{
    "node": "TRON",
    "mode": "gasfree",
    "address_from": "TXyz123...",
    "address_to": "TAbc456...",
    "amount": 10.5,
    "symbol": "USDT"
}
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| node | string | Yes | Network name |
| address_from | string | Yes | Sender wallet address (EOA address) |
| address_to | string | Yes | Recipient wallet address |
| amount | float | Yes | Amount to transfer (must be > 0) |
| symbol | string | Yes | Coin symbol. For GasFree mode: only "USDT" is supported |
| mode | string | No | Transfer mode: "standard" (default) or "gasfree". GasFree only for TRON + USDT |

**Response (Success - Standard - 200):**
```json
{
    "success": true,
    "data": {
        "success": true,
        "message": "wallet.success.wallet_transfer_successful",
        "txid": "abc123def456...",
        "commission": 13.5
    }
}
```

**Response (Success - GasFree - 200):**
```json
{
    "success": true,
    "data": {
        "success": true,
        "message": "gasfree.response.transfer_submitted",
        "traceId": "unique-trace-id-123",
        "mode": "gasfree",
        "fee": 10.0,
        "fee_token": "USDT"
    }
}
```

**Response (Error - 400):**
```json
{
    "error": "GasFree mode only supports USDT transfers"
}
```

---

### 5. Check Wallet Balance

Returns all coin balances for a wallet address on specified network.

**URL:** `POST /api/wallet/balance`

**Authentication:** Required (Bearer Token)

**Request Body (Standard):**
```json
{
    "node": "TRON",
    "address": "TXyz123..."
}
```

**Request Body (GasFree mode):**
```json
{
    "node": "TRON",
    "mode": "gasfree",
    "address": "TXyz123..."
}
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| node | string | Yes | Network name (see supported networks) |
| address | string | Yes | Wallet address to check balance (EOA address for GasFree) |
| mode | string | No | Balance mode: "standard" (default) or "gasfree" |

**Response (Success - Standard - 200):**
```json
{
    "success": true,
    "network": "TRON",
    "address": "TXyz123...",
    "balances": [
        {
            "symbol": "TRX",
            "balance": "100.5",
            "is_native": true,
            "contract": null,
            "decimals": 6
        },
        {
            "symbol": "USDT",
            "balance": "250.0",
            "is_native": false,
            "contract": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
            "decimals": 6
        }
    ]
}
```

**Response (Success - GasFree - 200):**
```json
{
    "success": true,
    "network": "TRON",
    "mode": "gasfree",
    "address": "TXyz123...",
    "gasfree_address": "TGasFreeAddr...",
    "is_activated": true,
    "balances": [
        {
            "symbol": "USDT",
            "balance": "150.000000",
            "is_native": false,
            "contract": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
            "decimals": 6
        }
    ]
}
```

---

### 6. GasFree Transfer Status

Track the status of a GasFree transfer by its trace ID.

**URL:** `POST /api/wallet/gasfree/status`

**Authentication:** Required (Bearer Token)

**Request Body:**
```json
{
    "trace_id": "unique-trace-id-123"
}
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| trace_id | string | Yes | The trace ID returned from a GasFree transfer |

**Response (Success - 200):**
```json
{
    "success": true,
    "data": {
        "traceId": "unique-trace-id-123",
        "status": "SUCCESS",
        "txHash": "abc123...",
        "fee": "10000000"
    }
}
```

---

### 7. GasFree Fee Estimate

Get current GasFree transfer and activation fees.

**URL:** `POST /api/wallet/gasfree/fees`

**Authentication:** Required (Bearer Token)

**Request Body:** None (empty or `{}`)

**Response (Success - 200):**
```json
{
    "success": true,
    "data": {
        "transfer_fee": 10.0,
        "activation_fee": 10.0,
        "fee_token": "USDT"
    }
}
```

---

## GasFree Mode

### Overview

GasFree is a special mode for TRON wallets that allows USDT transfers without requiring TRX for gas fees. Instead, the gas fee is paid in USDT directly. This is powered by the GasFree service (https://gasfree.io).

### Key Points

1. **TRON only** - GasFree mode is only available for the TRON network
2. **USDT only** - GasFree wallets only support USDT transfers. No TRX, USDC, or other tokens
3. **Gas in USDT** - Transaction fees are paid in USDT, not TRX
4. **Activation fee** - First transfer from a new GasFree wallet incurs an activation fee (paid in USDT)
5. **EOA address** - The wallet address (EOA) is a standard TRON address. The GasFree address is derived from it
6. **traceId** - GasFree transfers return a `traceId` instead of a `txid`. Use the status endpoint to track the on-chain result

### Usage Flow

1. Create a GasFree wallet: `{"node": "TRON", "mode": "gasfree"}`
2. Send USDT to the GasFree address (returned in wallet creation or balance response)
3. Transfer USDT: `{"node": "TRON", "mode": "gasfree", "symbol": "USDT", ...}`
4. Track transfer: `{"trace_id": "..."}`

### Environment Variables

| Variable | Description |
|----------|-------------|
| GASFREE_API_KEY | API key from GasFree Developers Center |
| GASFREE_API_SECRET | API secret from GasFree Developers Center |
| GASFREE_ENV | Environment: "mainnet" (default) or "testnet" |

---

## Supported Networks

| Node ID | Network Name | Native Coin | Description |
|---------|--------------|-------------|-------------|
| 1 | TRON | TRX | TRON blockchain with TRC20 tokens (supports GasFree mode) |
| 2 | BSC | BNB | Binance Smart Chain with BEP20 tokens |
| 3 | TON | TON | The Open Network |
| 4 | ETH | ETH | Ethereum with ERC20 tokens |
| 5 | POLYGON | MATIC | Polygon (Matic) network |
| 6 | ARBITRUM | ARB | Arbitrum One Layer 2 |
| 7 | SOLANA | SOL | Solana blockchain |
| 8 | AVALANCHE | AVAX | Avalanche C-Chain |
| 9 | POLKADOT | DOT | Polkadot network |
| 10 | TEZOS | XTZ | Tezos blockchain |
| 11 | XRP | XRP | Ripple network |
| 12 | DOGECOIN | DOGE | Dogecoin blockchain |
| 13 | CARDANO | ADA | Cardano blockchain |
| 14 | MONERO | XMR | Monero privacy coin |

---

## Supported Coins

### TRON (Node ID: 1)
| Symbol | Type | Contract Address | Decimals |
|--------|------|------------------|----------|
| TRX | Native | - | 6 |
| USDT | TRC20 | TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t | 6 |
| USDC | TRC20 | TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8 | 6 |
| ETH | TRC20 | THb4CqiFdwNHsWsQCs4JhzwjMWys4aqCbF | 18 |

### TRON GasFree Mode
| Symbol | Type | Contract Address | Decimals | Notes |
|--------|------|------------------|----------|-------|
| USDT | TRC20 (GasFree) | TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t | 6 | Gas paid in USDT |

### BSC (Node ID: 2)
| Symbol | Type | Contract Address | Decimals |
|--------|------|------------------|----------|
| BNB | Native | - | 18 |
| BSC-USD | BEP20 | 0x55d398326f99059fF775485246999027B3197955 | 18 |

### TON (Node ID: 3)
| Symbol | Type | Contract Address | Decimals |
|--------|------|------------------|----------|
| TON | Native | - | 9 |
| USDT | Jetton | EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs | 6 |

### Ethereum (Node ID: 4)
| Symbol | Type | Contract Address | Decimals |
|--------|------|------------------|----------|
| ETH | Native | - | 18 |
| USDT | ERC20 | 0xdAC17F958D2ee523a2206206994597C13D831ec7 | 6 |
| USDC | ERC20 | 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 | 6 |

### Polygon (Node ID: 5)
| Symbol | Type | Contract Address | Decimals |
|--------|------|------------------|----------|
| MATIC | Native | - | 18 |
| USDT | ERC20 | 0xc2132D05D31c914a87C6611C10748AEb04B58e8F | 6 |
| USDC | ERC20 | 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174 | 6 |
| DAI | ERC20 | 0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063 | 18 |

### Arbitrum (Node ID: 6)
| Symbol | Type | Contract Address | Decimals |
|--------|------|------------------|----------|
| ARB | Native | - | 18 |
| USDT | ERC20 | 0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9 | 6 |
| USDC | ERC20 | 0xaf88d065e77c8cC2239327C5EDb3A432268e5831 | 6 |

### Solana (Node ID: 7)
| Symbol | Type | Decimals |
|--------|------|----------|
| SOL | Native | 9 |

### Avalanche (Node ID: 8)
| Symbol | Type | Decimals |
|--------|------|----------|
| AVAX | Native | 18 |

### Polkadot (Node ID: 9)
| Symbol | Type | Decimals |
|--------|------|----------|
| DOT | Native | 10 |

### Tezos (Node ID: 10)
| Symbol | Type | Decimals |
|--------|------|----------|
| XTZ | Native | 6 |

### XRP (Node ID: 11)
| Symbol | Type | Decimals |
|--------|------|----------|
| XRP | Native | 6 |

### Dogecoin (Node ID: 12)
| Symbol | Type | Decimals |
|--------|------|----------|
| DOGE | Native | 8 |

### Cardano (Node ID: 13)
| Symbol | Type | Decimals |
|--------|------|----------|
| ADA | Native | 6 |

### Monero (Node ID: 14)
| Symbol | Type | Decimals |
|--------|------|----------|
| XMR | Native | 12 |

---

## Error Codes

| HTTP Code | Description |
|-----------|-------------|
| 200 | Success |
| 400 | Bad Request (invalid parameters) |
| 401 | Unauthorized (invalid or missing token) |
| 404 | Not Found (endpoint not found) |
| 405 | Method Not Allowed |
| 500 | Internal Server Error |

---

## Postman Collection

### Environment Variables
Create these variables in Postman:
- `base_url`: Your API base URL
- `auth_token`: JWT token (set after login)

### Example Requests

**1. Login Request:**
```
POST {{base_url}}/api/login
Content-Type: application/json

{
    "unique_hash": "my_unique_device_hash_12345678"
}
```

**2. Create TRON Wallet (Standard):**
```
POST {{base_url}}/api/wallet/create
Authorization: Bearer {{auth_token}}
Content-Type: application/json

{
    "node": "TRON"
}
```

**3. Create TRON GasFree Wallet:**
```
POST {{base_url}}/api/wallet/create
Authorization: Bearer {{auth_token}}
Content-Type: application/json

{
    "node": "TRON",
    "mode": "gasfree"
}
```

**4. List All Wallets:**
```
POST {{base_url}}/api/wallets
Authorization: Bearer {{auth_token}}
Content-Type: application/json
```

**5. List GasFree Wallets Only:**
```
POST {{base_url}}/api/wallets
Authorization: Bearer {{auth_token}}
Content-Type: application/json

{
    "node": "TRON",
    "mode": "gasfree"
}
```

**6. Transfer TRX (Standard):**
```
POST {{base_url}}/api/wallet/transfer
Authorization: Bearer {{auth_token}}
Content-Type: application/json

{
    "node": "TRON",
    "address_from": "TXyz123...",
    "address_to": "TAbc456...",
    "amount": 10,
    "symbol": "TRX"
}
```

**7. Transfer USDT via GasFree:**
```
POST {{base_url}}/api/wallet/transfer
Authorization: Bearer {{auth_token}}
Content-Type: application/json

{
    "node": "TRON",
    "mode": "gasfree",
    "address_from": "TXyz123...",
    "address_to": "TAbc456...",
    "amount": 50,
    "symbol": "USDT"
}
```

**8. Check GasFree Transfer Status:**
```
POST {{base_url}}/api/wallet/gasfree/status
Authorization: Bearer {{auth_token}}
Content-Type: application/json

{
    "trace_id": "unique-trace-id-123"
}
```

**9. Get GasFree Fee Estimate:**
```
POST {{base_url}}/api/wallet/gasfree/fees
Authorization: Bearer {{auth_token}}
Content-Type: application/json
```

**10. Check GasFree Balance:**
```
POST {{base_url}}/api/wallet/balance
Authorization: Bearer {{auth_token}}
Content-Type: application/json

{
    "node": "TRON",
    "mode": "gasfree",
    "address": "TXyz123..."
}
```

**11. Check Standard Wallet Balance:**
```
POST {{base_url}}/api/wallet/balance
Authorization: Bearer {{auth_token}}
Content-Type: application/json

{
    "node": "ARBITRUM",
    "address": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"
}
```

---

## Wallet Address Formats

| Network | Address Format | Example |
|---------|----------------|---------|
| TRON | T... (Base58) | TJCnKsPa7y5okkXvQAidZBzqx3QyQ6sxMW |
| TRON GasFree | T... (Base58, derived from EOA) | TGasFreeXyz... |
| BSC/ETH/Polygon/Arbitrum/Avalanche | 0x... (Hex) | 0x742d35Cc6634C0532925a3b844Bc9e7595f8fC32 |
| TON | EQ... or UQ... (Base64) | EQDtFpEwcFAEcRe5mLVh2N6C0x-_hJEM7W61_JLnSF74p4q2 |
| Solana | Base58 | 7EYnhQoR9YM3N7UoaKRoA44Uy8JeaZV3qyouov87awMs |
| Polkadot | 1... (SS58) | 1FRMM8PEiWXYax7rpS6X4XZX1aAAxSWx1CrKTyrVYhV24fg |
| Tezos | tz1... (Base58Check) | tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb |
| XRP | r... (Base58) | rN7n3473SaZBCG4dFL83w7a1RXtXtbk2D9 |
| Dogecoin | D... (Base58Check) | D7DA74qzZUyh9cctCxWovPTEovUSjGzL2S |
| Cardano | addr1... (Bech32) | addr1qxck...xyz |
| Monero | 4... or 8... (Base58) | 49qD5hvrDyzMrdPGwLRKNf2RhGsZKeLeueVX6NHvCCRN... |

---

## Database Schema Changes (GasFree)

The `wallets` table has been extended with the following columns for GasFree support:

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| mode | VARCHAR(20) | 'standard' | Wallet mode: "standard" or "gasfree" |
| gasfree_address | VARCHAR(100) | NULL | GasFree derived address (only for gasfree wallets) |

**Migration SQL:**
```sql
ALTER TABLE wallets ADD COLUMN mode VARCHAR(20) DEFAULT 'standard';
ALTER TABLE wallets ADD COLUMN gasfree_address VARCHAR(100) DEFAULT NULL;
```
