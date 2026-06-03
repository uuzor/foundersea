# FounderSea Protocol - Deployment Status

## Deployment Status (as of 2026-06-03)

### ✅ Completed
- Foundry project initialized with all chain configurations
- All 8 smart contracts written, compiled successfully
- All 31 tests passing
- Deployment scripts ready

### ⚠️ Pending - Requires Testnet Tokens

The deployment scripts are ready but require test tokens to broadcast transactions.

**Estimated deployment cost**: ~0.5 MNT/USDC per chain for all contracts

---

## Deployment Commands

### Deploy to Mantle Sepolia
```bash
# 1. Copy and fill in your .env
cp .env.example .env
# Edit .env with your PRIVATE_KEY and FOUNDERSEA_TREASURY

# 2. Load env vars
source .env

# 3. Deploy
forge script script/Deploy.s.sol:Deploy \
  --rpc-url mantleSepolia \
  --broadcast \
  --verify \
  --ledger
```

### Deploy to Base Sepolia
```bash
forge script script/Deploy.s.sol:Deploy \
  --rpc-url baseSepolia \
  --broadcast \
  --verify
```

### Deploy to Robinhood Chain Testnet
```bash
forge script script/Deploy.s.sol:Deploy \
  --rpc-url rhcTestnet \
  --broadcast
```

---

## Network Configuration

### Mantle Sepolia
- **Chain ID**: 5003
- **RPC**: https://rpc.sepolia.mantle.xyz
- **USDY**: Update with actual address after deployment

### Base Sepolia
- **Chain ID**: 84532
- **RPC**: https://sepolia.base.org
- **USDY**: Update with actual address after deployment

### Robinhood Chain Testnet
- **Chain ID**: 1300
- **RPC**: https://testnet.rpc.robinhood.com
- **Native Token**: RHC

---

## Contracts Overview

| Contract | Purpose |
|----------|---------|
| AgentIdentity (ERC-8004) | AI agent registry with decision tracking |
| IdeaFactory | Creates idea tokens, funding pools, and funding gates |
| IdeaToken | ERC-20 tokens for each idea with revenue accounting |
| FundingPool | Manages funding with milestone releases and competitor payouts |
| FundingGate | Access control for funding (OPEN/WHITELIST/MIN_HOLD/DAO_CURATED) |
| BuilderAgreement | Three-party agreements between creator/builder/DAO |
| DAOVoting | On-chain governance with AI voting delegation |
| IdeaMarketplace | Secondary trading for idea tokens with EIP-712 |

---

## Post-Deployment Steps

1. **Update .env** with deployed contract addresses
2. **Update IdeaFactory** with correct USDY addresses
3. **Verify contracts** on block explorers
4. **Update frontend** with contract addresses
5. **Test contract interactions** before going live
6. **Set AI agent address** in all contracts when backend is ready

---

## Getting Test Tokens

### Mantle Sepolia
Visit https://faucet.mantle.xyz

### Base Sepolia
Visit https://www.coinbase.com/faucets

### Robinhood Chain
Visit the RHC faucet (check PLANV2.md for link)