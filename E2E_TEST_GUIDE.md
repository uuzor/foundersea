# FounderSea End-to-End Protocol Test

## Overview

This document describes the complete end-to-end protocol flow for FounderSea, combining smart contract interactions with backend API calls to test the entire idea creation → funding → builder selection → milestone validation lifecycle.

## Architecture

### Components

1. **Smart Contracts (On-Chain)** - Deployed on Mantle Sepolia Testnet
   - `IdeaFactory`: Creates ideas, manages idea state, registers builders
   - `FundingPool`: Handles capital raising per idea
   - `IdeaToken`: ERC721 token representing idea ownership
   - `AgentIdentity`: Records AI agent decisions and scores
   - `DAOVoting`: Governance for budget allocation
   - `BuilderAgreement`: Contract between platform and builders
   - `MockUSDY`: Test ERC20 for funding
   - `IdeaMarketplace`: Secondary market for ideas

2. **Backend (NestJS API)** - Running on port 3000
   - `CreateIdeaService`: Orchestrates idea creation flow
   - `DeploymentService`: Handles per-idea setup (FundingPool.setAiAgent, registerBuilderAgreement)
   - `AgentService`: AI scoring and milestone validation
   - `ContractService`: Blockchain interaction wrapper using Viem

3. **Test Wallet**
   - Private Key: `0x2aba88c7ff57e32862767df9fbee5ce8ff7214457d630d3ffc47ce6a9b62c9f3`
   - Address (Creator): `0x2aba88c7ff57e32862767df9fbee5ce8ff7214457d630d3ffc47ce6a9b62c9f3`
   - AI Agent: `0xC83e035cA2c5bad4f6421DD4E2ABaA4C86c143ec`

## Complete Protocol Flow

### Phase 1: Create Idea On-Chain + Backend Verification

**Smart Contract Flow:**
```
User calls IdeaFactory.createIdea(metadata)
  ↓
IdeaFactory creates:
  - idea ID
  - FundingPool instance (via FundingPoolFactory)
  - IdeaToken instance (via IdeaTokenFactory)
  ↓
Returns: ideaId, fundingPoolAddress, ideaTokenAddress
```

**Backend Verification:**
```
POST /ideas
{
  "title": "AI Health Monitor",
  "description": "Health monitoring system",
  "category": "HealthTech",
  "fundingGoal": 100000,
  "softCap": "50000000000000000000",  // wei
  "hardCap": "200000000000000000000",  // wei
  "milestones": [...]
}
  ↓
Backend:
1. Uploads metadata to Pinata (or keccak256 fallback)
2. Calls IdeaFactory.createIdea() on-chain via wallet
3. Waits for transaction receipt
4. Parses IdeaCreated event to extract deployed contract addresses
5. Calls DeploymentService.setupNewIdea():
   - FundingPool.setAiAgent(AI_AGENT_ADDRESS)
   - IdeaFactory.registerBuilderAgreement(ideaId, builderAddress)
6. Returns: ideaId, fundingPoolAddress, ideaTokenAddress, status
```

**Test Command:**
```bash
curl -X POST http://localhost:3000/ideas \
  -H "Content-Type: application/json" \
  -d '{
    "title": "AI Health Monitor",
    "description": "...",
    "fundingGoal": 100000
  }'

Response:
{
  "success": true,
  "ideaId": "1",
  "fundingPoolAddress": "0x...",
  "ideaTokenAddress": "0x...",
  "transactionHash": "0x...",
  "status": "PENDING_AI_REVIEW"
}
```

### Phase 2: Verify Idea Details

**Backend Reads From Contract:**
```
GET /ideas/{ideaId}
  ↓
Backend calls IdeaFactory.getIdea(ideaId)
  ↓
Returns: creator, ideaToken, fundingPool, fundingGate, status, aiScore, approvalReasonHash
```

**Test Command:**
```bash
curl http://localhost:3000/ideas/1 | jq .

Response:
{
  "success": true,
  "data": {
    "ideaId": "1",
    "creator": "0x2aba88c7...",
    "ideaToken": "0x...",
    "fundingPool": "0x...",
    "status": 0,
    "aiScore": 0,
    "approvalReasonHash": ""
  }
}
```

### Phase 3: Fund Idea with MockUSDY (On-Chain)

**Smart Contract Transaction Flow:**
```
1. User calls MockUSDY.approve(fundingPoolAddress, amount)
   - Allows FundingPool to spend USDY tokens

2. User calls FundingPool.fund(amount)
   - Deposits USDY into pool
   - Updates raisedAmount
   - Checks against softCap and hardCap

3. Pool State After Funding:
   - raisedAmount: X USDY
   - fundingClosed: false
   - builderAssigned: false
   - competitorsSet: false
```

**Test Script (Foundry/Cast):**
```bash
# Approve MockUSDY for spending
cast send $USDY_ADDRESS "approve(address,uint256)" \
  $FUNDING_POOL 100ether \
  --private-key $PRIVATE_KEY \
  --rpc-url $RPC_URL

# Fund the pool
cast send $FUNDING_POOL "fund(uint256)" \
  100ether \
  --private-key $PRIVATE_KEY \
  --rpc-url $RPC_URL

# Check pool state
cast call $FUNDING_POOL "raisedAmount()" --rpc-url $RPC_URL
cast call $FUNDING_POOL "softCap()" --rpc-url $RPC_URL
cast call $FUNDING_POOL "hardCap()" --rpc-url $RPC_URL
```

### Phase 4: Close Funding

**Smart Contract Flow:**
```
1. Creator or AI agent calls FundingPool.closeFunding()
   - Checks raisedAmount >= softCap
   - Sets fundingClosed = true
   - Locks pool from further funding

2. Triggers distribution or next phase
```

**Test Script:**
```bash
cast send $FUNDING_POOL "closeFunding()" \
  --private-key $PRIVATE_KEY \
  --rpc-url $RPC_URL
```

### Phase 5: AI Scores Idea (Backend Async)

**Backend Flow:**
```
POST /ideas (creates idea)
  ↓
Calls AgentService.scoreIdea() asynchronously
  ↓
Backend generates:
  - AI score (0-100)
  - Reasoning hash
  - Records decision via AgentIdentity.recordDecision()
  ↓
If score > threshold:
  - Calls IdeaFactory.aiApproveIdea(ideaId, score, reasonHash)
  ↓
Decision stored on-chain in AgentIdentity
```

**Test Command:**
```bash
# Get decisions for an idea
curl "http://localhost:3000/ideas/agent/decisions?ideaId=1&limit=5" | jq .

Response:
{
  "success": true,
  "data": [
    {
      "index": 0,
      "type": "IDEA_SCORED",
      "subjectId": "1",
      "confidence": 82,
      "timestamp": "2026-06-11T...",
      "reasoning Hash": "0x...",
      "inputHash": "0x...",
      "outputHash": "0x..."
    }
  ],
  "total": 1
}
```

### Phase 6: Select Builder (On-Chain or AI)

**Options:**

**A. AI Selects:**
```
AgentService decides based on scoring
  ↓
Calls IdeaFactory.setBuilder(ideaId, builderAddress)
  ↓
BuilderAgreement activated
```

**B. Manual Selection:**
```
Platform admin/creator selects builder
  ↓
Creates BuilderAgreement with terms
  ↓
Builder accepted via signature
```

**Smart Contract State:**
```
FundingPool.builderAssigned = true
IdeaFactory.builder = builderAddress
BuilderAgreement active
```

### Phase 7: Milestone Validation

**Backend Flow:**
```
POST /ideas/{ideaId}/milestones/{index}/validate
{
  "submissionContent": "Completed MVP dashboard with...",
  "evidence": "https://github.com/.../releases/tag/v0.1.0"
}
  ↓
Backend:
1. Uploads submission to Pinata
2. Calls AgentService.validateMilestone()
3. AI returns: passed (bool), confidence (0-100)
4. If confidence >= 75:
   - Calls FundingPool.setMilestoneValidated(index, confidence, reasoningHash)
   - Auto-releases funds to builder
5. Records decision in AgentIdentity

Returns:
{
  "passed": true,
  "confidence": 88,
  "autoReleased": true,
  "reasoning": "MVP dashboard meets all requirements...",
  "transactionHash": "0x..."
}
```

**Test Command:**
```bash
curl -X POST http://localhost:3000/ideas/1/milestones/0/validate \
  -H "Content-Type: application/json" \
  -d '{
    "submissionContent": "MVP dashboard completed with real-time monitoring",
    "evidence": "https://github.com/example/project/releases/tag/v0.1.0"
  }'
```

### Phase 8: List All Ideas

**Backend:**
```
GET /ideas?limit=10&offset=0
  ↓
Iterates IdeaFactory.ideaCount down to last N ideas
  ↓
Returns array of ideas with all metadata
```

**Test Command:**
```bash
curl "http://localhost:3000/ideas?limit=10" | jq .

Response:
{
  "success": true,
  "count": 1,
  "data": [
    {
      "ideaId": "1",
      "creator": "0x2aba88c7...",
      "title": "AI Health Monitor",
      "status": 0,
      "aiScore": 82,
      ...
    }
  ]
}
```

## Running the E2E Test

### Prerequisites

1. Backend running: `npm run start` (port 3000)
2. Contracts deployed on Mantle Sepolia
3. Private key configured in `.env`
4. USDY tokens available in test wallet

### Run Full Test Script

```bash
bash backend/e2e-full-protocol.sh
```

This script:
- Verifies backend and contract addresses
- Creates an idea via POST /ideas
- Retrieves idea details via GET /ideas/:ideaId
- Lists all ideas via GET /ideas
- Validates milestones via POST /ideas/:ideaId/milestones/:index/validate
- Retrieves agent decisions via GET /ideas/agent/decisions

### Manual Testing

```bash
# 1. Create idea
curl -X POST http://localhost:3000/ideas \
  -H "Content-Type: application/json" \
  -d @idea.json

# 2. Verify idea
curl http://localhost:3000/ideas/1

# 3. Fund on-chain (using Cast/Foundry)
cast send $FUNDING_POOL "fund(uint256)" 100ether

# 4. Validate milestone
curl -X POST http://localhost:3000/ideas/1/milestones/0/validate \
  -H "Content-Type: application/json" \
  -d @milestone.json

# 5. Get decisions
curl http://localhost:3000/ideas/agent/decisions?ideaId=1

# 6. List all
curl http://localhost:3000/ideas
```

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/ideas` | POST | Create idea (on-chain) |
| `/ideas` | GET | List all ideas |
| `/ideas/:ideaId` | GET | Get idea details |
| `/ideas/:ideaId/milestones/:index/validate` | POST | Validate milestone |
| `/ideas/agent/decisions` | GET | Get agent decisions |

## Environment Variables

```
# Blockchain
RPC_URL=https://rpc.sepolia.mantle.xyz
MANTLE_SEPOLIA_RPC=https://rpc.sepolia.mantle.xyz

# Wallet
AI_AGENT_PRIVATE_KEY=0x...

# Contract Addresses
IDEA_FACTORY_MANTLE=0x82dA219b34634AB07a33279580Fc5D434850DEe3
FUNDING_POOL_FACTORY_MANTLE=0x9B52C2C17Cda23790E3820BBD4209EC9d2035798
IDEA_TOKEN_FACTORY_MANTLE=0xbC06555DE508c3F4fb62512753D3845a33A6c99a
USDY_MANTLE=0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34
AGENT_IDENTITY_MANTLE=0x16A60b905d229f884D91Aa01af42a6D8dB539c75
DAO_VOTING_MANTLE=0xDa662a4E956B1e8f4DcDD7f5DE325efbCdc45b83
BUILDER_AGREEMENT_MANTLE=0x94BF2AD1A35066D396Af247985f1e5A0C68bd1c4

# Pinata (Optional)
PINATA_API_KEY=...
PINATA_SECRET=...
PINATA_JWT=...
```

## Troubleshooting

### RPC Error: "rpc method not whitelisted"

**Issue:** `eth_sendTransaction` not allowed by RPC provider

**Solution:** Ensure wallet client is using `privateKey` account signing (not relying on `eth_sendTransaction`). Viem's `writeContract` with account should handle local signing automatically.

### Backend 500 Error on POST /ideas

**Check:**
1. Backend logs: `tail -f /tmp/backend.log`
2. Contract address valid on network
3. Private key configured and non-zero balance
4. RPC connection working

### Milestone Validation Fails

**Check:**
1. Idea exists (GET /ideas/:ideaId returns success)
2. Milestone index is valid (0, 1, 2, ...)
3. AI agent is authorized to call FundingPool

## Next Steps

1. ✅ Backend running with real ABIs
2. ✅ All 5 API endpoints implemented
3. ✅ Contract interactions working
4. 🔄 Fix RPC signing issue and run full E2E test
5. ⏳ Build frontend connected to all APIs
6. ⏳ Integrate Foundry for on-chain funding/closing steps

