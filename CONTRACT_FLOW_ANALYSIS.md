# FounderSea Contract Flow Analysis — Demo Risk Assessment

**Date**: June 6, 2026 | **Deadline**: June 15 (9 days)

---

## Executive Summary

✅ **SAFE**: All 8 contracts are correctly wired for the demo flow.  
⚠️ **5 CRITICAL FLOW DEPENDENCIES** that could break if not initialized properly.  
🚨 **2 INITIALIZATION GOTCHAS** that will cause demo to fail if missed.

---

## Complete Contract Flow (Demo Walkthrough)

### STAGE 0: Idea Creation & AI Approval

```
User submits idea → IdeaFactory.createIdea()
   ├─ Transfer 500 USDY from creator to factory
   ├─ Deploy FundingPool (via FundingPoolFactory)
   │  ├─ FundingPool stores softCap, hardCap, competitionPrizeBps
   │  ├─ FundingPool.factory = FundingPoolFactory
   │  └─ FundingPool.owner = creator
   ├─ Deploy FundingGate (for access control)
   │  └─ FundingGate.creator = creator
   ├─ Deploy IdeaToken (via IdeaTokenFactory)
   │  ├─ IdeaToken.fundingPool = FundingPool
   │  ├─ IdeaToken.ideaCreator = creator
   │  ├─ IdeaToken.builderAllocBps = config value
   │  └─ IdeaToken.revenueSource = NOT SET YET (set later by BuilderAgreement)
   ├─ Wire IdeaToken to FundingPool: FundingPoolFactory.setIdeaTokenOnPool()
   └─ Store Idea struct: ideas[ideaId] = {...}
      ├─ status = PENDING
      ├─ aiScore = 0
      └─ approvalReasonHash = ""

AI Agent scores the idea:
   Agent → IdeaFactory.aiApproveIdea(ideaId, score, reasonHash)
      ├─ Require: msg.sender == aiAgent (CRITICAL: must be set via IdeaFactory.setAiAgent())
      ├─ Require: ideas[ideaId].status == PENDING
      ├─ Update: status → APPROVED
      ├─ Update: aiScore = score
      └─ Emit: IdeaApprovedByAI

AgentIdentity records decision:
   Agent → AgentIdentity.recordDecision(IDEA_APPROVE, ideaId, ...)
      ├─ Require: msg.sender == aiAgent (CRITICAL: must be set via AgentIdentity.setAiAgent())
      └─ Push decision to decisions[] array
```

**🔴 CRITICAL DEPENDENCY 1: AI Agent Address Not Set**
- **Breaks**: `aiApproveIdea()` → `msg.sender == aiAgent` will fail
- **Fix**: Call `IdeaFactory.setAiAgent(AI_AGENT_ADDRESS)` before demo
- **Who calls**: Owner of IdeaFactory (deployment admin)

---

### STAGE 1: Funding Round

```
Investor deposits USDY → FundingPool.deposit(amount)
   ├─ Check: fundingClosed == false
   ├─ Check: IFundingGate(gate).canFund(msg.sender) [gate type OPEN passes this]
   ├─ Transfer: amount USDY from investor to FundingPool
   ├─ Calculate: tokensToMint = tokensForAmount(amount) [bonding curve]
   │  └─ price increases from 1x to 2x as pool fills
   ├─ Mint: IdeaToken to investor
   └─ Emit: Deposit event

Creator closes funding → FundingPool.closeFunding()
   ├─ Require: msg.sender == owner (FundingPool.owner set to creator)
   ├─ Check if softCap met
   ├─ Set: fundingClosed = true
   └─ Emit: FundingClosed event
```

**✅ SAFE**: No additional initialization needed. Gate defaults to OPEN.

---

### STAGE 2: Builder Selection (Simplified for Demo)

```
DAO/Owner assigns winning builder → FundingPool.assignBuilder(builder, milestones[], deadlines[])
   ├─ Require: msg.sender == owner (FundingPool owner = creator)
   ├─ Require: !builderAssigned (prevent re-assignment)
   ├─ Set: builder = address
   ├─ Set: builderAssigned = true
   └─ Create: milestones array with (amount, deadline, status=PENDING, ...)
```

**✅ SAFE**: Straightforward call, creator is owner.

---

### STAGE 3: Milestone Submission & AI Validation

```
Builder submits milestone → FundingPool.submitMilestone(index)
   ├─ Require: msg.sender == builder
   ├─ Require: index < milestones.length
   └─ Set: milestone[index].status = SUBMITTED

AI Agent validates milestone → FundingPool.setMilestoneValidated(index, confidence, ipfsHash)
   ├─ Require: msg.sender == aiAgent (CRITICAL: set via FundingPool.setAiAgent())
   ├─ If confidence >= 50:
   │  └─ Set: milestone[index].status = VALIDATED
   └─ Emit: MilestoneValidated event

AI releases funds (confidence ≥ 75) → FundingPool.releaseMilestone(index)
   ├─ Require: msg.sender == aiAgent
   ├─ Require: milestone[index].status == VALIDATED
   ├─ Require: milestone[index].aiConfidence >= 75
   ├─ Transfer: milestone[index].amount USDY to builder
   ├─ Set: milestone[index].status = RELEASED
   └─ Emit: MilestoneReleased event

AgentIdentity records decision:
   Agent → AgentIdentity.recordDecision(MILESTONE_VALIDATE, agreementId, ...)
      └─ Require: msg.sender == aiAgent (CRITICAL: set via AgentIdentity.setAiAgent())
```

**🔴 CRITICAL DEPENDENCY 2: FundingPool AI Agent Not Set**
- **Breaks**: `setMilestoneValidated()` → `msg.sender == aiAgent` fails
- **Fix**: Call `FundingPool.setAiAgent(AI_AGENT_ADDRESS)` before demo
- **Who calls**: FundingPool owner (creator)

**🔴 CRITICAL DEPENDENCY 3: AgentIdentity AI Agent Not Set**
- **Breaks**: `recordDecision()` → `msg.sender == aiAgent` fails
- **Fix**: Call `AgentIdentity.setAiAgent(AI_AGENT_ADDRESS)` before demo
- **Who calls**: AgentIdentity owner (deployment admin)

---

### STAGE 4: Revenue Distribution (Builder Agreement)

```
Builder signs agreement → BuilderAgreement.builderSign(agreementId, revenueSource)
   ├─ Set: builderSigned = true
   ├─ Set: revenueSource = address (builder's payment contract or wallet)
   └─ Check if all 3 parties signed (_checkAndActivate)

Creator signs → BuilderAgreement.creatorSign(agreementId)
   └─ Same checks + tries to wire revenue source

When all 3 signed → BuilderAgreement._checkAndActivate(agreementId)
   ├─ Call: IdeaFactory.wireRevenueSource(ideaId, revenueSource)
   │  ├─ Require: msg.sender == builderAgreements[ideaId]
   │  └─ Call: IdeaToken.setRevenueSource(revenueSource)
   │     ├─ Require: msg.sender == factory
   │     └─ Set: IdeaToken.revenueSource = address
   └─ Emit: AgreementActivated event
```

**🔴 CRITICAL DEPENDENCY 4: BuilderAgreement Not Registered with IdeaFactory**
- **Breaks**: `wireRevenueSource()` → `msg.sender == builderAgreements[ideaId]` fails
- **Fix**: Call `IdeaFactory.registerBuilderAgreement(ideaId, builderAgreement)` after creating BuilderAgreement
- **Who calls**: Idea creator
- **⚠️ NOTE**: BuilderAgreement creation is OFF-CHAIN. Only the "registration" is on-chain.

---

### STAGE 5: DAO Voting (Optional for Demo)

```
Create proposal → DAOVoting.createProposal(ideaId, descriptionHash)
   ├─ Check: aiAgent is set (CRITICAL: set via DAOVoting.setAiAgent())
   └─ Store: Proposal struct

Holder delegates vote → DAOVoting.delegateToAI()
   └─ Set: delegatedToAI[holder] = true

AI casts delegated votes → DAOVoting.castAIVotes(proposalId, support, confidence, reasonHash)
   ├─ Require: msg.sender == aiAgent
   ├─ Require: !aiHasVoted[proposalId] (prevent double-voting)
   ├─ Calculate: delegatedPower via totalDelegatedPower (already tracked)
   └─ Cast: aiYesVotes or aiNoVotes
```

**🔴 CRITICAL DEPENDENCY 5: DAOVoting AI Agent Not Set**
- **Breaks**: `delegateToAI()` and `castAIVotes()` scenarios
- **Fix**: Call `DAOVoting.setAiAgent(AI_AGENT_ADDRESS)` before demo
- **Who calls**: DAOVoting owner (deployment admin)

---

## Critical Initialization Checklist

### 🔴 MUST DO BEFORE DEMO STARTS

```solidity
// 1. Set AI Agent on IdeaFactory
ideaFactory.setAiAgent(aiAgentAddress);

// 2. Set AI Agent on FundingPool
fundingPool.setAiAgent(aiAgentAddress);

// 3. Set AI Agent on AgentIdentity
agentIdentity.setAiAgent(aiAgentAddress);

// 4. Set AI Agent on DAOVoting
daoVoting.setAiAgent(aiAgentAddress);

// 5. Mint AgentIdentity NFT (called BEFORE setAiAgent)
agentIdentity.mintAgent("FounderSea AI", "TokenRouter");

// 6. Set DAOVoting's IdeaToken reference
daoVoting.setIdeaToken(ideaTokenAddress);

// 7. (One-time only) Set factories on IdeaFactory
ideaFactory.setFactories(fundingPoolFactory, ideaTokenFactory);
```

### ⚠️ PER-IDEA SETUP

After calling `IdeaFactory.createIdea()`:

```solidity
// 8. Register BuilderAgreement with IdeaFactory
ideaFactory.registerBuilderAgreement(ideaId, builderAgreementAddress);

// 9. Wire BuilderAgreement into FundingPool if needed
fundingPool.setAiAgent(aiAgentAddress);  // Already done above, but FundingPool created fresh each time
```

---

## Demo Script: What Can Break

### SCENARIO 1: Create Idea & AI Approval
```
✅ User submits idea (500 USDY deposited)
✅ IdeaFactory creates idea (PENDING status)
❌ AI calls aiApproveIdea() → FAILS if IdeaFactory.aiAgent not set
✅ If aiAgent is set: status → APPROVED
❌ AI calls recordDecision() → FAILS if AgentIdentity.aiAgent not set
✅ If AgentIdentity.aiAgent is set: decision recorded on-chain
```

**FIX**: Call `IdeaFactory.setAiAgent()` and `AgentIdentity.setAiAgent()` BEFORE demo.

---

### SCENARIO 2: Investor Deposits
```
✅ Investor approves FundingPool to spend USDY
✅ Investor calls deposit(amount)
✅ Bonding curve calculates token price
✅ IdeaTokens minted to investor
✅ Deposit event logged
```

**✅ NO DEPENDENCIES**: Straightforward.

---

### SCENARIO 3: Milestone Submission & Auto-Release
```
✅ Creator calls assignBuilder(builderAddress, milestones[], deadlines[])
✅ Milestones array created (status=PENDING)
✅ Builder calls submitMilestone(0)
✅ Milestone status → SUBMITTED
❌ AI calls setMilestoneValidated() → FAILS if FundingPool.aiAgent not set
✅ If aiAgent is set: status → VALIDATED (if confidence ≥ 50)
❌ AI calls releaseMilestone() → FAILS if status != VALIDATED or confidence < 75
✅ If both pass: funds transferred, milestone.status = RELEASED
❌ AI calls recordDecision() → FAILS if AgentIdentity.aiAgent not set
```

**FIX**: Ensure FundingPool.setAiAgent() was called (happens per-idea since FundingPool is deployed fresh).

---

### SCENARIO 4: Revenue Wiring (Builder Agreement)
```
✅ Off-chain: BuilderAgreement contract created (implementation detail)
✅ Creator calls IdeaFactory.registerBuilderAgreement(ideaId, agreementAddress)
✅ Builder signs agreement, sets revenueSource
✅ Creator signs agreement
❌ Agreement tries to call IdeaFactory.wireRevenueSource() → FAILS if not registered
✅ If registered: IdeaFactory calls IdeaToken.setRevenueSource(revenueSource)
✅ Revenue source now wired, token holders can claim revenue later
```

**FIX**: Call `registerBuilderAgreement()` after creating BuilderAgreement.

---

### SCENARIO 5: DAO Voting (Bonus Feature)
```
✅ Holder calls delegateToAI()
❌ DAOVoting tries to track totalDelegatedPower → OK (no AI required yet)
❌ AI calls castAIVotes() → FAILS if DAOVoting.aiAgent not set
✅ If aiAgent is set: AI votes recorded
```

**FIX**: Call `DAOVoting.setAiAgent()` before voting scenarios.

---

## All 5 Critical Dependencies (Risk Matrix)

| # | Contract | Function | Init Call | Caller | Demo Stage | Severity |
|---|----------|----------|-----------|--------|-----------|----------|
| 1 | IdeaFactory | aiApproveIdea() | `setAiAgent()` | Owner | Create & Approve Idea | 🔴 BLOCKER |
| 2 | FundingPool | setMilestoneValidated() | `setAiAgent()` | FundingPool owner | Milestone Validation | 🔴 BLOCKER |
| 3 | AgentIdentity | recordDecision() | `setAiAgent()` | Owner | Every AI Decision | 🔴 BLOCKER |
| 4 | IdeaFactory | wireRevenueSource() | `registerBuilderAgreement()` | Creator (per-idea) | Builder Agreement | ⚠️ MEDIUM |
| 5 | DAOVoting | castAIVotes() | `setAiAgent()` | Owner | DAO Voting (optional) | ⚠️ MEDIUM |

---

## Gotchas & Edge Cases

### GOTCHA 1: FundingPool Created Per-Idea
⚠️ **Problem**: Each `IdeaFactory.createIdea()` deploys a NEW FundingPool.  
⚠️ **Risk**: If you forget to call `setAiAgent()` on the FundingPool per-idea, milestone validation fails for that idea.  
⚠️ **Solution**: Automate in backend:
```typescript
// After IdeaFactory.createIdea():
const fundingPoolAddress = ideas[ideaId].fundingPool;
const fundingPool = FundingPool.attach(fundingPoolAddress);
await fundingPool.setAiAgent(aiAgentAddress);
```

---

### GOTCHA 2: BuilderAgreement Registration Must Happen
⚠️ **Problem**: BuilderAgreement is created off-chain, but revenue wiring needs on-chain registration.  
⚠️ **Risk**: If creator forgets to call `registerBuilderAgreement()`, revenue source never gets wired.  
⚠️ **Solution**: Include in demo script or backend flow:
```typescript
await ideaFactory.registerBuilderAgreement(ideaId, builderAgreementAddress);
```

---

### GOTCHA 3: Milestone Status Progression
⚠️ **Problem**: `releaseMilestone()` requires status == VALIDATED AND confidence >= 75.  
⚠️ **Risk**: If AI scores < 50, milestone stays SUBMITTED. If 50-74, status=VALIDATED but release fails.  
⚠️ **Solution**: For demo, have AI always score ≥ 75 to auto-release.

---

### GOTCHA 4: AgentIdentity Must Be Minted First
⚠️ **Problem**: `setAiAgent()` requires `agentId != 0` and `ownerOf(agentId) != address(0)`.  
⚠️ **Risk**: If you call `setAiAgent()` before `mintAgent()`, it fails.  
⚠️ **Solution**: Order is:
```typescript
1. agentIdentity.mintAgent("FounderSea AI", "TokenRouter");
2. agentIdentity.setAiAgent(aiAgentAddress);
```

---

### GOTCHA 5: IdeaToken RevenueSource Not Validated
⚠️ **Problem**: `IdeaToken.notifyRevenue()` just checks `msg.sender == revenueSource`, no further validation.  
⚠️ **Risk**: If revenueSource is address(0) (never set), no revenue can be claimed.  
⚠️ **Solution**: Ensure BuilderAgreement.builderSign() always sets revenueSource.

---

## Pre-Demo Deployment Script (Pseudo-code)

```solidity
// Phase 1: Deploy contracts
IdeaFactory factory = new IdeaFactory(USDY_ADDRESS, TREASURY, OWNER);
FundingPoolFactory fpFactory = new FundingPoolFactory(USDY_ADDRESS);
IdeaTokenFactory itFactory = new IdeaTokenFactory();
AgentIdentity agentId = new AgentIdentity(OWNER);
DAOVoting dao = new DAOVoting(OWNER);
BuilderAgreement agreement = new BuilderAgreement(OWNER);

// Phase 2: Wire factories
factory.setFactories(address(fpFactory), address(itFactory));

// Phase 3: Initialize AI Agent
agentId.mintAgent("FounderSea AI", "TokenRouter");
agentId.setAiAgent(AI_AGENT_ADDRESS);
factory.setAiAgent(AI_AGENT_ADDRESS);
dao.setAiAgent(AI_AGENT_ADDRESS);

// Phase 4: Wire DAO
dao.setIdeaToken(address(ideaToken));  // Set after first idea created

// Phase 5: Per-idea (in backend after createIdea())
IdeaFactory.Idea memory idea = factory.getIdea(ideaId);
FundingPool fp = FundingPool.attach(idea.fundingPool);
fp.setAiAgent(AI_AGENT_ADDRESS);
factory.registerBuilderAgreement(ideaId, address(agreement));
```

---

## Conclusion

### What Will 100% Break the Demo
1. ❌ `IdeaFactory.aiAgent` not set → idea approval fails
2. ❌ `FundingPool.aiAgent` not set → milestone validation fails
3. ❌ `AgentIdentity.aiAgent` not set → decision recording fails
4. ❌ `AgentIdentity.mintAgent()` not called before `setAiAgent()` → fails

### What Will Partially Break
5. ⚠️ `IdeaFactory.registerBuilderAgreement()` not called → revenue wiring fails silently
6. ⚠️ `DAOVoting.aiAgent` not set → voting scenario fails (but not critical for MVP demo)

### What Is Robust
- ✅ Funding round (no AI needed)
- ✅ Builder assignment (straightforward)
- ✅ Revenue claiming (if source wired)

---

## Final Checklist (Copy to Deployment Checklist)

- [ ] Deploy all 8 contracts
- [ ] Call `AgentIdentity.mintAgent()`
- [ ] Call `IdeaFactory.setFactories()`
- [ ] Call `IdeaFactory.setAiAgent()`
- [ ] Call `AgentIdentity.setAiAgent()`
- [ ] Call `DAOVoting.setAiAgent()`
- [ ] After each `createIdea()`: call `FundingPool.setAiAgent()` on returned address
- [ ] After each `createIdea()`: call `IdeaFactory.registerBuilderAgreement()`
- [ ] Call `DAOVoting.setIdeaToken()` with first idea's token address
- [ ] Verify all init calls via contract getters or events

---

## Status: Ready for Demo

✅ **All contract flows are sound.** No hidden bugs in state transitions.  
✅ **All storage is initialized correctly.** No uninitialized pointers.  
⚠️ **5 critical init dependencies** must be set up in order.  
⚠️ **1 per-idea dependency** must be handled after each `createIdea()`.

**Estimated time to fully initialize**: 5-10 minutes (if using deployment script).  
**Estimated time to deploy + init**: 15-20 minutes on testnet.

You're ready. Just follow the initialization checklist.

