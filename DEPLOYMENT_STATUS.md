# FounderSea Protocol - Mantle Sepolia Deployment

## Deployment Status (as of 2026-06-02)

### ✅ Completed
- Foundry project initialized with Mantle Sepolia configuration
- All 8 smart contracts written, compiled successfully
- All 20 tests passing

### ⚠️ Pending - Requires Testnet Tokens

The deployment scripts are ready but require MNT (Mantle Sepolia test tokens) to broadcast transactions.

**Estimated deployment cost**: ~0.5 MNT for all contracts

**To get test tokens:**
1. Visit https://faucet.mantle.xyz
2. Request MNT tokens for address: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`

### Deployment Commands

Once you have test tokens, run:

```bash
# Deploy AgentIdentity
forge script script/DeployAgentIdentity.s.sol:DeployAgentIdentity --rpc-url $MANTLE_SEPOLIA_RPC --broadcast --private-key $PRIVATE_KEY

# Deploy RevenueDistributor
forge script script/DeployRevenueDistributor.s.sol:DeployRevenueDistributor --rpc-url $MANTLE_SEPOLIA_RPC --broadcast --private-key $PRIVATE_KEY

# Deploy all remaining contracts
forge script script/Deploy.s.sol:DeployMainnet --rpc-url $MANTLE_SEPOLIA_RPC --broadcast --private-key $PRIVATE_KEY
```

### Expected Contract Addresses (Dry Run - Not Yet Deployed)

| Contract | Address |
|----------|---------|
| AgentIdentity | `0x52C7a9DDC1fE319a98Bd193b758Eaa4735738dDB` |
| IdeaFactory | `0x88197a5f983300d2a96a6D554248266f7144A6Ae` |
| RevenueDistributor | `0xB5AFb7CD0FaDDD27785dFb9bC02Cc5E4C3D4378e` |
| DAOVoting | `0xf44a9741E029783CEF812bAEd86b4f02B8391a2F` |
| IdeaMarketplace | `0xB7c61e6987144bC0E692E6Bde2B845B9e29D4cD9` |

## Environment Setup

Create `.env` file:
```
PRIVATE_KEY=<your_private_key>
FOUNDERSEA_TREASURY=<your_treasury_address>
MANTLE_SEPOLIA_RPC=https://rpc.sepolia.mantle.xyz
```

## Network Configuration

- **Network**: Mantle Sepolia Testnet
- **Chain ID**: 5003
- **RPC**: https://rpc.sepolia.mantle.xyz

## Contracts Overview

1. **AgentIdentity** (ERC-8004) - AI agent registry with decision tracking
2. **IdeaFactory** - Creates idea tokens and funding pools
3. **IdeaToken** - ERC-20 tokens for each idea
4. **FundingPool** - Manages funding with milestone releases
5. **FundingGate** - Access control for funding (Whitelist/MinHold/DAO)
6. **BuilderAgreement** - Three-party agreements between creator/builder/DAO
7. **DAOVoting** - On-chain governance with AI delegation
8. **IdeaMarketplace** - Secondary trading for idea tokens
9. **RevenueDistributor** - Proportional revenue distribution to token holders