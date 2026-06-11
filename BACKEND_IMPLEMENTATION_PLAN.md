# Backend Implementation Plan — 9 Days to Demo

**Date**: June 6, 2026 | **Deadline**: June 15 | **Status**: Contracts deployed ✅

---

## Overview

You have **working smart contracts on Mantle Sepolia testnet**. Now you need to wire the backend to:
1. **Call contract functions** (create idea, validate milestone, record decisions)
2. **Trigger AI agents** (idea scorer, milestone validator)
3. **Handle per-idea initialization** (FundingPool.setAiAgent, registerBuilderAgreement)

**Critical path**: 3 core backend services → 3 API endpoints → test → demo

---

## Deployed Contract Addresses (Mantle Sepolia)

```
IDEA_FACTORY_MANTLE=0x82dA219b34634AB07a33279580Fc5D434850DEe3
AGENT_IDENTITY_MANTLE=0x16A60b905d229f884D91Aa01af42a6D8dB539c75
DAO_VOTING_MANTLE=0xDa662a4E956B1e8f4DcDD7f5DE325efbCdc45b83
IDEA_MARKETPLACE_MANTLE=0x8d1912D815a5a72B13594534767b5CaE958D3fEF
FUNDING_POOL_FACTORY_MANTLE=0x9B52C2C17Cda23790E3820BBD4209EC9d2035798
IDEA_TOKEN_FACTORY_MANTLE=0xbC06555DE508c3F4fb62512753D3845a33A6c99a
BUILDER_AGREEMENT_MANTLE=0x94BF2AD1A35066D396Af247985f1e5A0C68bd1c4
USDY_MANTLE=0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34
AI_AGENT_ADDRESS=0xC83e035cA2c5bad4f6421DD4E2ABaA4C86c143ec
```

---

## Phase 1: Core Backend Services (Day 6-7)

### Service 1: ContractService (viem client setup)

**File**: `backend/src/blockchain/contract.service.ts`

Handles:
- Viem publicClient (read-only)
- Viem walletClient for AI agent (write operations)
- Contract instances (IdeaFactory, FundingPool, AgentIdentity, etc.)

```typescript
import { publicClient, walletClient } from 'viem';

@Injectable()
export class ContractService {
  // Public client for reads
  getPublicClient() { return publicClient; }
  
  // AI agent wallet for writes (setAiAgent, recordDecision, etc.)
  getAIAgentWallet() { return walletClient; }
  
  // Contract instances
  getIdeaFactory(ideaFactoryAddress) { /* viem contract */ }
  getFundingPool(fundingPoolAddress) { /* viem contract */ }
  getAgentIdentity(agentIdentityAddress) { /* viem contract */ }
  // ... etc
}
```

### Service 2: IdeaService (business logic)

**File**: `backend/src/ideas/idea.service.ts`

Handles:
- `createIdea()` → IdeaFactory.createIdea() on-chain
- `approveIdea()` → IdeaFactory.aiApproveIdea() (AI agent calls)
- `setupNewIdea()` → FundingPool.setAiAgent() + registerBuilderAgreement()

```typescript
@Injectable()
export class IdeaService {
  constructor(
    private contractService: ContractService,
    private agentService: AgentService,
  ) {}

  async createIdea(dto: CreateIdeaDto) {
    const factory = this.contractService.getIdeaFactory(...);
    
    // Call IdeaFactory.createIdea()
    const hash = await factory.write.createIdea([{
      metadataIpfsHash: ipfsHash,
      softCap: dto.softCap,
      hardCap: dto.hardCap,
      // ... other config
    }]);
    
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const ideaId = /* parse IdeaCreated event */;
    
    return { ideaId };
  }

  async approveIdea(ideaId: bigint, score: number, reasonHash: string) {
    const factory = this.contractService.getIdeaFactory(...);
    const aiWallet = this.contractService.getAIAgentWallet();
    
    // AI agent approves
    const hash = await factory.write.aiApproveIdea(
      [ideaId, BigInt(score), reasonHash],
      { account: aiWallet }
    );
    
    await publicClient.waitForTransactionReceipt({ hash });
    
    // Record decision on AgentIdentity
    await this.recordDecision('IDEA_APPROVE', ideaId, score);
  }

  async setupNewIdea(ideaId: bigint, builderAgreementAddress: string) {
    // CRITICAL: Per-idea setup
    const factory = this.contractService.getIdeaFactory(...);
    const idea = await factory.read.getIdea([ideaId]);
    const fundingPoolAddress = idea[2];
    
    // Step 1: Set AI agent on FundingPool
    const fundingPool = this.contractService.getFundingPool(fundingPoolAddress);
    const hash1 = await fundingPool.write.setAiAgent(
      [this.configService.get('AI_AGENT_ADDRESS')],
      { account: this.contractService.getAIAgentWallet() }
    );
    await publicClient.waitForTransactionReceipt({ hash: hash1 });
    
    // Step 2: Register BuilderAgreement
    const hash2 = await factory.write.registerBuilderAgreement(
      [ideaId, builderAgreementAddress],
      { account: await this.getCreatorWallet() } // Creator must sign
    );
    await publicClient.waitForTransactionReceipt({ hash: hash2 });
  }
}
```

### Service 3: AgentService (AI decision orchestration)

**File**: `backend/src/agents/agent.service.ts`

Handles:
- Run TokenRouter agentic loops (already implemented)
- Record decisions on AgentIdentity
- Trigger milestone validation

```typescript
@Injectable()
export class AgentService {
  constructor(
    private tokenRouterService: TokenRouterService,
    private contractService: ContractService,
  ) {}

  async scoreIdea(ideaId: bigint, title: string, description: string) {
    // 1. Run AI agent loop via TokenRouter
    const result = await this.tokenRouterService.runAgentLoop(
      IDEA_SCORER_PROMPT,
      { title, description, ideaId }
    );
    
    const { score, reasoning, approved } = result;
    
    // 2. Record decision on AgentIdentity
    const agentId = this.contractService.getAgentIdentity(...);
    const hash = await agentId.write.recordDecision(
      [
        'IDEA_APPROVE', // DecisionType
        ideaId,
        keccak256(/* input */),
        keccak256(JSON.stringify(result)),
        score,
        ipfsHash, // reasoning on IPFS
      ],
      { account: this.contractService.getAIAgentWallet() }
    );
    await publicClient.waitForTransactionReceipt({ hash });
    
    return { approved, score, reasoning };
  }

  async validateMilestone(ideaId: bigint, milestoneIndex: number, submission: string) {
    // 1. Run validation agent
    const result = await this.tokenRouterService.runAgentLoop(
      MILESTONE_VALIDATOR_PROMPT,
      { submission, ideaId, milestoneIndex }
    );
    
    const { passed, confidence, reasoning } = result;
    
    // 2. Call FundingPool.setMilestoneValidated()
    const fundingPool = await this.getFundingPoolForIdea(ideaId);
    const hash1 = await fundingPool.write.setMilestoneValidated(
      [milestoneIndex, confidence, ipfsHash],
      { account: this.contractService.getAIAgentWallet() }
    );
    await publicClient.waitForTransactionReceipt({ hash: hash1 });
    
    // 3. Auto-release if confidence >= 75
    if (confidence >= 75) {
      const hash2 = await fundingPool.write.releaseMilestone(
        [milestoneIndex],
        { account: this.contractService.getAIAgentWallet() }
      );
      await publicClient.waitForTransactionReceipt({ hash: hash2 });
    }
    
    // 4. Record decision on AgentIdentity
    await this.recordDecision('MILESTONE_VALIDATE', ideaId, confidence);
    
    return { passed, confidence, autoReleased: confidence >= 75 };
  }

  private async recordDecision(decisionType: string, subjectId: bigint, confidence: number) {
    const agentId = this.contractService.getAgentIdentity(...);
    const hash = await agentId.write.recordDecision(
      [decisionType, subjectId, ..., confidence, ipfsHash],
      { account: this.contractService.getAIAgentWallet() }
    );
    await publicClient.waitForTransactionReceipt({ hash });
  }
}
```

---

## Phase 2: API Endpoints (Day 7-8)

### Endpoint 1: POST /ideas (Create & Score Idea)

```typescript
@Post()
@UseGuards(AuthGuard)
async createIdea(
  @Body() dto: CreateIdeaDto,
  @Req() req: any
) {
  const userId = req.user.id;
  
  // 1. Create idea on-chain
  const { ideaId, ideaTokenAddress, fundingPoolAddress } = 
    await this.ideaService.createIdea(dto);
  
  // 2. CRITICAL: Setup new idea (FundingPool.setAiAgent + registerBuilderAgreement)
  const builderAgreement = await this.createBuilderAgreement(ideaId);
  await this.ideaService.setupNewIdea(ideaId, builderAgreement.address);
  
  // 3. ONE-TIME: Setup DAOVoting after first idea
  if (ideaId === 1n) {
    await this.daoVotingService.setIdeaToken(ideaTokenAddress);
  }
  
  // 4. Trigger AI scoring (async)
  this.agentService.scoreIdea(ideaId, dto.title, dto.description)
    .then(({ approved, score }) => {
      if (approved) {
        this.ideaService.approveIdea(ideaId, score, ipfsHash);
      }
    });
  
  return { ideaId, status: 'PENDING_AI_REVIEW' };
}
```

### Endpoint 2: POST /milestones/validate (Submit & Validate Milestone)

```typescript
@Post(':ideaId/validate')
async validateMilestone(
  @Param('ideaId') ideaId: string,
  @Body() dto: ValidateMilestoneDto
) {
  // 1. Trigger AI validation
  const { passed, confidence, autoReleased } = 
    await this.agentService.validateMilestone(
      BigInt(ideaId),
      dto.milestoneIndex,
      dto.submissionContent
    );
  
  return {
    milestoneIndex: dto.milestoneIndex,
    confidence,
    passed,
    autoReleased,
    message: autoReleased 
      ? 'Funds released automatically' 
      : 'Milestone flagged for DAO review'
  };
}
```

### Endpoint 3: GET /agent/decisions (Read AgentIdentity Log)

```typescript
@Get('decisions')
async getDecisions(
  @Query('ideaId') ideaId?: string,
  @Query('limit') limit: number = 50
) {
  const agentId = this.contractService.getAgentIdentity(...);
  
  // Get all decisions or filter by idea
  let decisions;
  if (ideaId) {
    decisions = await agentId.read.getDecisionsBySubjectId([BigInt(ideaId)]);
  } else {
    const count = await agentId.read.totalDecisions();
    decisions = await agentId.read.getDecision([
      // Paginate, return last N
    ]);
  }
  
  return {
    count: decisions.length,
    decisions: decisions.map(d => ({
      type: d.decisionType,
      subjectId: d.subjectId,
      confidence: d.confidence,
      timestamp: d.timestamp,
      reasoningHash: d.reasoningIpfsHash
    }))
  };
}
```

---

## Phase 3: Testing & Verification (Day 8-9)

### Test Scenario 1: Create Idea & Auto-Approve

```bash
# 1. POST /ideas
curl -X POST http://localhost:3000/ideas \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "title": "DeFi Lending Protocol",
    "description": "A decentralized lending platform...",
    "softCap": "1000000000", // 1000 USDY
    "hardCap": "5000000000"  // 5000 USDY
  }'

# Response:
# { ideaId: 1, status: "PENDING_AI_REVIEW" }

# 2. Watch logs for AI scoring (async)
# logs show: IdeaScorerAgent running... → confidence 84

# 3. Check on-chain:
# IdeaFactory.getIdea(1) → status = APPROVED, aiScore = 84

# 4. Check AgentIdentity:
# GET /agent/decisions → shows IDEA_APPROVE decision
```

### Test Scenario 2: Milestone Validation & Auto-Release

```bash
# 1. GET /ideas/1 to find fundingPoolAddress
# 2. Investor deposits USDY → FundingPool.deposit()
# 3. Creator assigns builder → FundingPool.assignBuilder(builder, [milestones])

# 4. Builder submits milestone
curl -X POST http://localhost:3000/ideas/1/milestones/0/submit \
  -d '{ submissionContent: "github.com/builder/repo, features: ..." }'

# 5. AI validates
curl -X POST http://localhost:3000/ideas/1/milestones/0/validate \
  -d '{ milestoneIndex: 0, submissionContent: "..." }'

# Response:
# { confidence: 91, passed: true, autoReleased: true }

# 6. Check on-chain:
# FundingPool.milestones[0].status = RELEASED
# USDY transferred to builder

# 7. Check AgentIdentity:
# GET /agent/decisions → shows MILESTONE_VALIDATE decision
```

---

## Implementation Checklist

### Day 6 (Today)
- [ ] Update .env.local with deployed contract addresses
- [ ] Create ContractService with viem clients
- [ ] Generate ABI TypeScript types from deployed contracts

### Day 7
- [ ] Implement IdeaService (createIdea, approveIdea, setupNewIdea)
- [ ] Implement AgentService (scoreIdea, validateMilestone, recordDecision)
- [ ] Wire contracts service to ideas controller
- [ ] Test: `createIdea` → on-chain creation works

### Day 8
- [ ] Implement POST /ideas endpoint
- [ ] Implement POST /milestones/:ideaId/validate endpoint
- [ ] Implement GET /agent/decisions endpoint
- [ ] Test all 3 scenarios above

### Day 9
- [ ] End-to-end test: create idea → AI approves → fund → assign builder → validate milestone
- [ ] Verify AgentIdentity log has ≥5 decisions
- [ ] Record demo video

---

## Critical Per-Idea Dependencies

Every call to `POST /ideas` **MUST** trigger:

```typescript
1. IdeaFactory.createIdea()
   ↓
2. FundingPool.setAiAgent(AI_AGENT_ADDRESS)  ← NEW pool per idea
   ↓
3. IdeaFactory.registerBuilderAgreement(ideaId, builderAgreement)
   ↓
4. DAOVoting.setIdeaToken(ideaToken) ← ONE-TIME after first idea
```

If any step is missed, the subsequent calls fail.

---

## Summary

| Component | Status | Owner |
|-----------|--------|-------|
| Contracts | ✅ Deployed | Done |
| ContractService | ⏳ To-Do | Backend |
| IdeaService | ⏳ To-Do | Backend |
| AgentService | ⏳ Partial | Backend (TokenRouter already works) |
| API Endpoints | ⏳ To-Do | Backend |
| End-to-End Test | ⏳ To-Do | QA |
| Demo | ⏳ To-Do | All |

**You are here**: Ready to implement Phase 1 backend services.

Next step: Create ContractService with viem clients.

