# FounderSea Protocol
## Build Plan v3 — Mantle AI Awakening + MetaMask Cook-Off

> **"Own a piece of what gets built."**  
> A decentralized RWA protocol where ideas are tokenized, builders compete to build them,
> AI coordinates every decision, and token holders share in the revenue.

---

## 0. Core Design Principles

### What Lives On-Chain
Only things that need trustless enforcement:
- Token minting and ownership (IdeaToken)
- Fund locking and release (FundingPool)
- Funding gate logic (FundingGate)
- AI decision records (AgentIdentity — ERC-8004)
- P2P token marketplace settlements (IdeaMarketplace)
- DAO votes and AI voting delegation (DAOVoting)
- Revenue distribution (RevenueDistributor)

### What Lives Off-Chain
Everything that benefits from speed and iteration:
- Builder competition (applications, judging, leaderboard)
- AI reasoning and scoring details (stored on IPFS, hash on-chain)
- Builder profiles and portfolios
- Marketplace bid signatures (EIP-712, settled on-chain)
- DAO discussion and deliberation

### AI Philosophy
AI is not a helper. AI is a **decision-maker at every protocol stage**. Humans retain override rights but the default flow requires no human input. Every AI decision is recorded on Mantle (ERC-8004) creating a permanent, auditable intelligence layer.

---

## 1. Protocol Stages and AI Role at Each

```
STAGE 0 — IDEA CREATION
  Human: fills form, deposits $500 USDY
  AI:    scores idea → APPROVES or REJECTS (blocks funding round if rejected)
         records decision on-chain (ERC-8004)
  Result: idea visible on discovery feed with AI score

STAGE 1 — FUNDING ROUND
  Human: investors browse discovery feed
  AI:    ranks ideas by investment signal (feasibility × market × momentum)
         warns investors of risk factors on idea pages
  Result: IdeaTokens distributed to investors, FundingPool locked

STAGE 2 — BUILDER COMPETITION (off-chain)
  Human: builders apply with portfolio + proposal
  AI:    ranks all applicants → recommends top 5 shortlist
         DAO confirms shortlist (1-click approve or override)
  Builders build MVP in open competition (off-chain platform)
  AI:    reviews all final MVPs → produces ranked validation report
         recommends winner(s) + flags merger opportunity if applicable
  DAO:   votes on outcome (AI recommendation shown, AI votes count if delegated)
  Result: winner announced, BuilderAgreement signed on-chain

STAGE 3 — MILESTONE EXECUTION
  Human: builder submits each milestone
  AI:    validates deliverable against criteria
         auto-releases funds if confidence ≥ 75%
         flags for DAO review if 50–74%
         rejects and notifies builder if < 50%
  Result: funds released progressively, all decisions on-chain

STAGE 4 — REVENUE & GROWTH
  Human: product operates, earns revenue
  AI:    analyzes metrics → suggests pricing, features, growth strategy
         votes in DAO governance if token holders delegated AI vote
  Result: revenue distributed to IdeaToken holders, AI advisor visible

FUTURE (post-hackathon roadmap):
  AI agents submit to builder competition
  AI agents hold IdeaTokens, earn revenue, fund new ideas
  Fully autonomous venture loop
```

---

## 2. Smart Contracts (Lean Set)

```
IdeaFactory.sol          — creates IdeaToken + FundingPool + FundingGate per idea
IdeaToken.sol            — ERC-20, revenue share, gated minting
FundingGate.sol          — Open / Whitelist / MinHold / DAO Curated gate modes
FundingPool.sol          — locks USDY/mETH, milestone-based release, AI-delegated
BuilderAgreement.sol     — on-chain record of agreement + AI validation hashes
IdeaMarketplace.sol      — P2P listings, bids, EIP-712 settlement
DAOVoting.sol            — votes per IdeaToken, AI voting delegation (ERC-7715 style)
RevenueDistributor.sol   — proportional revenue claim for token holders
AgentIdentity.sol        — ERC-8004 NFT, immutable AI decision log on Mantle
```

No HackathonPool contract. Competition prize = Milestone 0 in FundingPool.

---

## 3. Contract Specifications

### 3.1 IdeaFactory.sol
```solidity
contract IdeaFactory {
    IERC20 public immutable USDY;
    uint256 public constant MIN_CREATOR_DEPOSIT = 500e6;  // $500 USDY
    uint256 public constant ABANDONMENT_FEE_BPS = 1000;   // 10% kept on abandon
    address public aiAgent;          // AI agent address — can approve/reject ideas

    struct IdeaConfig {
        string metadataIpfsHash;     // title, description, roadmap, category
        uint256 targetRaise;
        uint256 softCap;
        uint256 hardCap;
        uint256 fundingDeadline;
        uint256 competitionPrizeBps; // % of raise reserved as competition prize (Milestone 0)
        uint256 builderAllocBps;     // % of IdeaToken supply to winning builder
        GateType gateType;
        bytes gateParams;
    }

    mapping(uint256 => address) public ideaTokens;
    mapping(uint256 => address) public fundingPools;
    mapping(uint256 => bool) public aiApproved;

    event IdeaCreated(uint256 indexed ideaId, address creator, address ideaToken);
    event IdeaApprovedByAI(uint256 indexed ideaId, uint256 score);
    event IdeaRejectedByAI(uint256 indexed ideaId, string reasonIpfsHash);

    function createIdea(IdeaConfig calldata config) external returns (uint256 ideaId) {
        USDY.transferFrom(msg.sender, address(this), MIN_CREATOR_DEPOSIT);
        // Deploy IdeaToken, FundingPool, FundingGate
        // Emit IdeaCreated — funding round opens ONLY after AI approves
    }

    // Called by AI agent after scoring. If rejected, creator gets 90% back.
    function aiApproveIdea(uint256 ideaId, uint256 score, string calldata reasonHash)
        external onlyAIAgent {
        aiApproved[ideaId] = true;
        emit IdeaApprovedByAI(ideaId, score);
    }

    function aiRejectIdea(uint256 ideaId, string calldata reasonHash)
        external onlyAIAgent {
        // Refund 90% to creator, 10% to protocol treasury
        emit IdeaRejectedByAI(ideaId, reasonHash);
    }

    function abandonIdea(uint256 ideaId) external onlyCreator(ideaId) beforeFundingClose(ideaId) {
        // Same refund logic: 90% back, 10% fee
    }
}
```

### 3.2 IdeaToken.sol
```solidity
contract IdeaToken is ERC20 {
    address public immutable fundingPool;
    address public immutable revenueDistributor;
    address public ideaCreator;
    uint256 public builderAllocBps;       // 10–30%
    address public assignedBuilder;
    bool public builderAllocMinted;

    // Revenue accounting (pull-based, no loops)
    uint256 public revenuePerTokenStored; // scaled 1e18
    mapping(address => uint256) public revenueDebt;

    function earned(address account) public view returns (uint256) {
        return (balanceOf(account) * (revenuePerTokenStored - revenueDebt[account])) / 1e18;
    }
    function claimRevenue() external returns (uint256 amount);
    function notifyRevenue(uint256 amount) external onlyDistributor;

    // Gated minting — only FundingPool during funding round
    function mint(address to, uint256 amount) external onlyFundingPool;

    // Called once, after BuilderAgreement signed
    function mintBuilderAlloc(address builder) external onlyFundingPool;
}
```

### 3.3 FundingGate.sol
```solidity
enum GateType { OPEN, WHITELIST, MIN_HOLD, DAO_CURATED }

contract FundingGate {
    GateType public gateType;
    address public creator;

    // WHITELIST
    mapping(address => bool) public whitelist;

    // MIN_HOLD
    address public holdToken;
    uint256 public minHoldAmount;

    // DAO_CURATED
    address public daoApprover;
    mapping(address => bool) public daoApproved;

    function canFund(address investor) external view returns (bool) {
        if (gateType == GateType.OPEN) return true;
        if (gateType == GateType.WHITELIST) return whitelist[investor];
        if (gateType == GateType.MIN_HOLD)
            return IERC20(holdToken).balanceOf(investor) >= minHoldAmount;
        if (gateType == GateType.DAO_CURATED) return daoApproved[investor];
        return false;
    }

    function updateWhitelist(address[] calldata addrs, bool[] calldata states)
        external onlyCreator;
    function daoApprove(address investor) external onlyApprover;
}
```

### 3.4 FundingPool.sol
```solidity
contract FundingPool {
    IERC20 public fundingToken;     // USDY (Mantle) or USDC (Base)
    address public ideaToken;
    address public gate;
    address public aiAgent;         // delegated executor for auto-release
    address public dao;

    // Milestone 0 = competition prize for winning builder
    // Milestones 1..N = development phases
    struct Milestone {
        uint256 amount;
        uint256 deadline;
        bool released;
        bool aiValidated;
        uint256 aiConfidence;
        string validationIpfsHash;
    }

    Milestone[] public milestones;
    bool public fundingClosed;
    bool public builderAssigned;

    // Funding round
    function deposit(uint256 amount) external gateCheck {
        require(!fundingClosed);
        fundingToken.transferFrom(msg.sender, address(this), amount);
        IIdeaToken(ideaToken).mint(msg.sender, tokensForAmount(amount));
    }

    function closeFunding() external {
        // If softCap not met: full refund mode
        // If met: lock pool, carve out Milestone 0 (competition prize)
    }

    // AI agent calls this after milestone validation passes
    function releaseMilestone(uint256 index) external onlyAIAgent {
        Milestone storage m = milestones[index];
        require(m.aiValidated && m.aiConfidence >= 75 && !m.released);
        m.released = true;
        fundingToken.transfer(assignedBuilder, m.amount);
    }

    // DAO can override — release manually after review
    function daoReleaseMilestone(uint256 index) external onlyDAO;

    // DAO can slash builder stake on repeated failures
    function slashBuilder(uint256 amount) external onlyDAO;

    function setMilestoneValidated(
        uint256 index,
        uint256 confidence,
        string calldata ipfsHash
    ) external onlyAIAgent {
        milestones[index].aiValidated = confidence >= 50;
        milestones[index].aiConfidence = confidence;
        milestones[index].validationIpfsHash = ipfsHash;
    }
}
```

### 3.5 BuilderAgreement.sol
```solidity
contract BuilderAgreement {
    struct Agreement {
        uint256 ideaId;
        address[] builders;           // 1 (solo) or 2 (merger)
        string agreementIpfsHash;     // terms, roadmap, milestone criteria
        uint256 builderStake;         // USDY staked by builder
        bool creatorSigned;
        bool builderSigned;
        bool daoSigned;               // DAO signature (could be AI-delegated)
        uint256 signedAt;
    }

    mapping(uint256 => Agreement) public agreements;

    // All three parties must sign before FundingPool activates milestone releases
    function creatorSign(uint256 agreementId) external;
    function builderSign(uint256 agreementId) external;
    function daoSign(uint256 agreementId) external onlyDAO;    // AI can sign if delegated

    function isFullySigned(uint256 agreementId) public view returns (bool) {
        Agreement storage a = agreements[agreementId];
        return a.creatorSigned && a.builderSigned && a.daoSigned;
    }
}
```

### 3.6 DAOVoting.sol
```solidity
// Voting power = IdeaToken balance
// Key innovation: holders can delegate vote to AI agent
contract DAOVoting {
    address public aiAgent;

    // Per-token-holder delegation
    mapping(address => bool) public delegatedToAI;

    // Active proposals
    struct Proposal {
        uint256 ideaId;
        string descriptionIpfsHash;
        uint256 votingDeadline;
        uint256 yesVotes;
        uint256 noVotes;
        uint256 aiYesVotes;    // votes cast by AI on behalf of delegators
        uint256 aiNoVotes;
        bool executed;
        bool aiRecommendation; // AI's recommendation recorded on-chain
        uint256 aiConfidence;
    }

    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    // Token holder delegates their vote to AI for all future proposals
    function delegateToAI() external {
        delegatedToAI[msg.sender] = true;
        emit VoteDelegatedToAI(msg.sender);
    }

    function revokeDelegation() external {
        delegatedToAI[msg.sender] = false;
    }

    // Human vote
    function vote(uint256 proposalId, bool support) external {
        require(!delegatedToAI[msg.sender], "Vote delegated to AI");
        uint256 power = IIdeaToken(ideaToken).balanceOf(msg.sender);
        if (support) proposals[proposalId].yesVotes += power;
        else proposals[proposalId].noVotes += power;
        hasVoted[proposalId][msg.sender] = true;
    }

    // AI agent aggregates all delegated votes before deadline
    // Called once per proposal after AI analyzes it
    function castAIVotes(
        uint256 proposalId,
        bool support,
        uint256 confidence,
        string calldata reasoningIpfsHash
    ) external onlyAIAgent {
        // Sum up voting power of all addresses with delegatedToAI == true
        // Cast as block of yes/no votes
        // Record AI recommendation + confidence on-chain
    }

    function execute(uint256 proposalId) external afterDeadline(proposalId) {
        // Total yesVotes (human + AI) vs noVotes (human + AI)
    }
}
```

### 3.7 IdeaMarketplace.sol
```solidity
contract IdeaMarketplace {
    uint256 public constant PROTOCOL_FEE_BPS = 250; // 2.5%
    address public treasury;

    struct Listing {
        address seller;
        address ideaToken;
        uint256 amount;
        uint256 askPricePerToken;  // in USDY
        uint256 expiry;
        bool active;
        // Optional resale gate
        address requiredHoldToken;
        uint256 requiredHoldAmount;
    }

    struct Bid {
        address bidder;
        address ideaToken;
        uint256 amount;
        uint256 bidPricePerToken;
        uint256 expiry;
        bool active;
    }

    mapping(uint256 => Listing) public listings;
    mapping(uint256 => Bid) public bids;
    uint256 public nextListingId;
    uint256 public nextBidId;

    // EIP-712 for gas-efficient off-chain bids
    bytes32 public constant BID_TYPEHASH = keccak256(
        "Bid(address ideaToken,uint256 amount,uint256 bidPricePerToken,uint256 expiry,uint256 nonce)"
    );

    function createListing(
        address ideaToken, uint256 amount, uint256 askPrice,
        uint256 expiry, address holdToken, uint256 holdAmount
    ) external returns (uint256 id);

    function acceptListing(uint256 listingId) external;   // buyer accepts ask

    function placeBid(
        address ideaToken, uint256 amount, uint256 bidPrice, uint256 expiry
    ) external returns (uint256 id);

    function acceptBid(uint256 bidId) external;           // seller accepts bid

    // Settle an off-chain signed bid (gas-efficient)
    function settleSignedBid(Bid calldata bid, bytes calldata sig) external;

    function _settle(address seller, address buyer, address token, uint256 amount, uint256 total) internal {
        // ERC-20 IdeaToken: seller → buyer
        // USDY: buyer → seller (minus fee)
        // Fee: buyer → treasury
    }
}
```

### 3.8 AgentIdentity.sol (ERC-8004, Mantle only)
```solidity
contract AgentIdentity is ERC721 {
    // One NFT for FounderSea's AI agent — permanent identity on Mantle
    uint256 public agentId;

    enum DecisionType {
        IDEA_APPROVE,       // Stage 0
        IDEA_REJECT,        // Stage 0
        IDEA_RANK,          // Stage 1 (discovery feed ranking)
        BUILDER_RANK,       // Stage 2
        MVP_VALIDATE,       // Stage 2 (competition judging)
        MILESTONE_VALIDATE, // Stage 3
        DAO_VOTE,           // Stage 4
        REVENUE_ADVICE      // Stage 4
    }

    struct Decision {
        uint256 timestamp;
        DecisionType decisionType;
        uint256 subjectId;          // ideaId, agreementId, proposalId etc.
        bytes32 inputHash;          // keccak256 of inputs
        bytes32 outputHash;         // keccak256 of output JSON
        uint256 confidence;         // 0–100
        string reasoningIpfsHash;   // full reasoning stored on IPFS
    }

    Decision[] public decisions;

    event DecisionRecorded(
        uint256 indexed agentId,
        DecisionType indexed decisionType,
        uint256 indexed subjectId,
        uint256 confidence
    );

    function mintAgent(string calldata name, string calldata modelId)
        external onlyOwner returns (uint256);

    function recordDecision(
        DecisionType decisionType,
        uint256 subjectId,
        bytes32 inputHash,
        bytes32 outputHash,
        uint256 confidence,
        string calldata reasoningIpfsHash
    ) external onlyAIAgent;

    function totalDecisions() external view returns (uint256);
    function getDecision(uint256 index) external view returns (Decision memory);
}
```

---

## 4. AI Decision Layer — Full Specification

### 4.1 AI at Every Stage

| Stage | AI Service | Model | Trigger | Output | On-Chain Effect |
|-------|-----------|-------|---------|--------|-----------------|
| Idea creation | IdeaScorerService | kimi-k2-6 + web search | Idea submitted | Score 0–100, APPROVE/REJECT | `aiApproveIdea()` or `aiRejectIdea()` called |
| Discovery feed | IdeaRankerService | kimi-k2-6 | Hourly refresh | Ranked list with investment signals | Off-chain feed sort, score stored in DB |
| Investor warning | RiskAdvisorService | kimi-k2-6 | Idea page load | Risk flags, warnings | Displayed on idea page |
| Builder applications | BuilderRankerService | kimi-k2-6 | Application phase closes | Ranked applicants, shortlist recommendation | Top 5 flagged, DAO confirms |
| MVP judging | FinalJudgeService | claude-opus-4-7 | Final submissions in | Ranked MVPs, merger flag, winner rec. | DAO sees AI report before vote |
| DAO vote | AIVoterService | kimi-k2-6 | Proposal created | YES/NO recommendation + confidence | `castAIVotes()` for delegated holders |
| Milestone validation | MilestoneValidatorService | claude-opus-4-7 | Builder submits | PASS/FAIL/REVISION, confidence | `setMilestoneValidated()` → `releaseMilestone()` |
| Revenue advice | RevenueAdvisorService | kimi-k2-6 | Weekly cron | Pricing/feature/growth suggestions | Displayed to builder + DAO |
| Token pricing | MarketPricerService | kimi-k2-6 | Marketplace load | Fair value estimate, yield estimate | Shown on marketplace token card |

### 4.2 Idea Scorer
```typescript
const IDEA_SCORE_PROMPT = `
You are a Web3 venture analyst. A user is requesting tokenized funding for a product idea.
Critically evaluate it and return ONLY valid JSON. Do not approve weak ideas — rejection protects investors.

Schema:
{
  "feasibilityScore": 0-100,
  "marketSizeUSD": number,
  "competitionLevel": "low|medium|high",
  "uniquenessScore": 0-100,
  "estimatedBuildCostUSD": number,
  "estimatedTimeWeeks": number,
  "keyRisks": string[],          // max 5
  "investorWarnings": string[],  // shown to investors on idea page
  "recommendation": "APPROVE|REJECT",
  "overallScore": 0-100,
  "reasoning": string            // 2-3 sentences, shown publicly
}

Reject if: overallScore < 40, feasibilityScore < 35, or idea is clearly a scam/clone.

Idea title: {title}
Description: {description}
Category: {category}
Budget requested: {budget} USDY
Creator stake: $500 (committed — they have skin in game)
`;
// AI rejection blocks funding round from opening.
// Creator's $500 refunded 90% if rejected.
```

### 4.3 Builder Ranker
```typescript
const BUILDER_RANK_PROMPT = `
You are evaluating builder applicants for a funded Web3 project.
Rank all applicants and recommend a shortlist of up to 5.
Return ONLY valid JSON.

Schema:
{
  "rankings": [
    {
      "address": string,
      "overallScore": 0-100,
      "deliveryScore": 0-100,     // based on past completions
      "technicalScore": 0-100,    // portfolio quality
      "proposalScore": 0-100,     // how well their proposal fits this idea
      "stakeSignal": 0-100,       // stake amount as commitment signal
      "shortlistRecommend": boolean,
      "reasoning": string
    }
  ],
  "topPickAddress": string,
  "mergerCandidates": [string, string] | null,  // if two builders are complementary
  "summary": string
}

Idea spec: {ideaSpec}
Applicants: {applicants}
`;
```

### 4.4 MVP / Milestone Validator
```typescript
const VALIDATE_PROMPT = `
You are an autonomous technical reviewer for a decentralized funding protocol.
Your decision directly triggers or blocks fund release. Be rigorous.

Return ONLY valid JSON:
{
  "passed": boolean,
  "confidenceScore": 0-100,
  "completenessScore": 0-100,
  "qualityScore": 0-100,
  "issuesFound": string[],
  "requiredRevisions": string[] | null,  // null if passed, specific items if revision needed
  "recommendation": "RELEASE_FUNDS|REQUEST_REVISION|REJECT",
  "reasoning": string
}

Rules:
- RELEASE_FUNDS only if confidence >= 75 and all critical criteria met
- REQUEST_REVISION if confidence 50–74 or minor gaps
- REJECT if fundamentally incomplete or fraudulent

Milestone criteria: {criteria}
Submission: {submissionContent}
Roadmap context: {roadmap}
Past milestones passed: {pastMilestones}
`;

async function validateAndAct(agreementId: number, milestoneIndex: number, submission: string) {
  const result = await veniceValidate(submission, criteria);
  const reasoningIpfsHash = await pinata.pinJSON(result);
  const inputHash = keccak256(submission + criteria);
  const outputHash = keccak256(JSON.stringify(result));

  // Always record on-chain first
  await agentIdentity.recordDecision(
    DecisionType.MILESTONE_VALIDATE,
    agreementId,
    inputHash,
    outputHash,
    result.confidenceScore,
    reasoningIpfsHash
  );

  // Store in FundingPool
  await fundingPool.setMilestoneValidated(milestoneIndex, result.confidenceScore, reasoningIpfsHash);

  if (result.recommendation === "RELEASE_FUNDS") {
    await fundingPool.releaseMilestone(milestoneIndex);  // AI agent executes directly
    // On Base: route through 1Shot relayer instead
  } else if (result.recommendation === "REQUEST_REVISION") {
    await notifyBuilderRevision(agreementId, result.requiredRevisions);
    await flagForDAOReview(agreementId, result);
  } else {
    await notifyBuilderRejection(agreementId, result.reasoning);
  }
}
```

### 4.5 AI DAO Voter
```typescript
const DAO_VOTE_PROMPT = `
You are the AI governance agent for FounderSea protocol.
You vote on behalf of token holders who have delegated their votes to you.
Your mandate: vote to maximize long-term revenue for token holders.
Be decisive and transparent.

Return ONLY valid JSON:
{
  "vote": "YES|NO",
  "confidence": 0-100,
  "primaryReason": string,
  "risks": string[],
  "expectedOutcome": string,
  "reasoning": string           // full reasoning shown to delegators
}

Proposal: {proposalDescription}
Current product metrics: {metrics}
IdeaToken performance: {tokenPerformance}
Builder history: {builderHistory}
`;

async function processProposal(proposalId: number) {
  const proposal = await getProposal(proposalId);
  const context = await gatherProposalContext(proposal.ideaId);
  const result = await venice.vote(proposal, context);

  // Aggregate delegated voting power
  const delegatedPower = await getDelegatedVotingPower(proposal.ideaId);

  // Cast aggregated AI votes on-chain
  await daoVoting.castAIVotes(
    proposalId,
    result.vote === "YES",
    result.confidence,
    await pinata.pinJSON(result)  // full reasoning on IPFS
  );
}
```

### 4.6 Builder Competition Judge (off-chain flow, on-chain result)
```typescript
// Runs after all final MVP submissions come in
const FINAL_JUDGE_PROMPT = `
You are judging a builder competition for a Web3 product.
Multiple builders have submitted their MVPs. Rank them rigorously.
Your ranking informs the DAO vote — token holders' money depends on this.

Return ONLY valid JSON:
{
  "rankings": [
    {
      "builder": string,
      "technicalScore": 0-100,
      "completenessScore": 0-100,
      "designScore": 0-100,
      "innovationScore": 0-100,
      "overallScore": 0-100,
      "summary": string,
      "strengths": string[],
      "weaknesses": string[]
    }
  ],
  "winnerAddress": string,
  "mergerRecommendation": boolean,
  "mergerRationale": string | null,
  "recommendedOutcome": "SOLO_WINNER|MERGER",
  "reasoning": string
}

Idea spec: {ideaSpec}
Submissions: {submissions}       // array of {builder, githubUrl, demoUrl, description}
`;
// Result shown to DAO before they vote on winner + outcome type
// AI recommendation + confidence recorded on-chain via AgentIdentity
```

---

## 5. Builder Competition Flow (Off-Chain)

The competition runs on a simple off-chain web platform (no smart contract needed).

```
Week 1 — Applications open
  Builders submit: portfolio link, proposal doc, stake deposit (on-chain)
  AI runs BuilderRankerService → top 5 shortlisted
  DAO confirms shortlist (review AI reasoning, 1-click approve or replace)

Weeks 2–4 — Build sprint
  5 builders build simultaneously against published idea spec
  Weekly progress: builders submit a short update (optional, for visibility)
  No AI scoring of in-progress work — reduces gaming

Week 5 — Final submissions
  All builders submit: GitHub repo + live demo + 2-min video
  AI FinalJudgeService processes all 5 submissions
  Produces ranked report with scores + merger recommendation
  Report published publicly on idea page

Week 6 — DAO votes
  Proposal created on-chain: which builder/path to select
  AI recommendation shown prominently + reasoning
  AI casts aggregated delegated votes automatically
  Human token holders vote (or let AI vote for them)
  Outcome: SOLO_WINNER or MERGER

Post-vote — Agreement
  Winner(s) sign BuilderAgreement on-chain
  Competition prize (Milestone 0) locked in FundingPool
  Milestone 0 released when AI validates winner's MVP = production-ready
  (This is the same validation as any other milestone — no special path)
```

---

## 6. MetaMask Smart Accounts Integration

### DAO Treasury = Smart Account (Base deployment)
```typescript
import { toMetaMaskSmartAccount, Implementation } from "@metamask/smart-accounts-kit";

const daoTreasury = await toMetaMaskSmartAccount({
  client: publicClient,
  implementation: Implementation.Hybrid,
  deployParams: [daoOwnerAddress, [], [], []],
  signatory: { account: daoOwner },
});
// Set as owner of FundingPool + DAOVoting on Base
```

### ERC-7710 — AI Agent Delegated as Executor
```typescript
// DAO Smart Account delegates releaseMilestone rights to AI agent
const delegation = createDelegation({
  delegate: AI_AGENT_ADDRESS,
  delegator: daoTreasury.address,
  caveats: [
    allowedCallsCaveat([{
      target: FUNDING_POOL_BASE,
      selector: "releaseMilestone(uint256)",
    }]),
    valueLimitCaveat({ maxValue: 10_000n * 10n ** 6n }), // max 10k USDY per call
  ],
});
```

### ERC-7715 — Periodic Budget for Venice AI Costs
```typescript
const permission = await wallet_grantPermissions({
  permissions: [{
    type: "erc20-token-transfer",
    data: { token: USDC_BASE, allowance: "100000000" }, // 100 USDC/day
    policies: [{ type: "rate-limit", data: { count: 1, interval: "day" } }],
  }],
});
```

### x402 — Smart Account Pays Venice
```typescript
import { withPaymentInterceptor } from "@metamask/x402";
const paidFetch = withPaymentInterceptor(fetch, walletClient);
// Venice call paid automatically from DAO Smart Account treasury
const response = await paidFetch("https://api.venice.ai/api/v1/chat/completions", { ... });
```

---

## 7. 1Shot Relayer

All payouts routed through 1Shot on Base (gas-free for recipients):

```typescript
async function relayPayout(recipient: string, amount: bigint, delegation: Delegation[]) {
  const caps = await call("relayer_getCapabilities"); // always fresh
  const { targetAddress, acceptedTokens } = caps.chains[BASE_CHAIN_ID];

  const payoutTx = encodeReleaseMilestone(milestoneIndex);
  const feeTx = buildFeeTransfer(acceptedTokens[0], estimatedFee, targetAddress);

  const { jobId } = await call("relayer_sendTransaction", {
    delegationChain: delegation,
    transactions: [feeTx, payoutTx],
    destinationUrl: `${API_URL}/webhooks/payout`,
  });

  return jobId;
}
```

---

## 8. Frontend Pages

| Route | Purpose | Key AI Surface |
|-------|---------|----------------|
| `/create` | Idea form + funding config | Streaming AI score appears as user fills form |
| `/ideas` | Discovery feed | AI-ranked, investment signal badges |
| `/ideas/:id` | Idea detail: fund, track progress, trade | AI risk warnings, investor score breakdown |
| `/ideas/:id/compete` | Builder competition: apply, leaderboard, results | AI ranking table, final judge report, merger flag |
| `/milestone/:id` | Builder submits milestone | AI validation animation, confidence score, auto-release confirmation |
| `/marketplace` | IdeaToken P2P exchange | AI fair value estimate on every token card |
| `/marketplace/:token` | Token detail: bid, ask, revenue history | AI yield estimate, price driver analysis |
| `/dao/:ideaId` | Governance proposals | AI recommendation + confidence shown, delegation toggle |
| `/portfolio` | Wallet: ideas funded, tokens held, revenue | Revenue earned, AI advice per product |
| `/agent` | ERC-8004 decision log | All AI decisions, confidence history, decision type breakdown |

---

## 9. Build Plan — 13 Days

### STAGE 1 — Contracts + Scaffold (Days 1–2, June 2–3)

#### Day 1
- [ ] `forge init foundersea`; configure Mantle Sepolia + Base Sepolia in `foundry.toml`
- [ ] Install: `@openzeppelin/contracts`, `forge-std`
- [ ] Write + test all 8 contracts (no HackathonPool)
- [ ] `forge test` — all passing
- [ ] Deploy to Mantle Sepolia; save addresses

**Contracts to write:** IdeaFactory, IdeaToken, FundingGate, FundingPool, BuilderAgreement, DAOVoting, IdeaMarketplace, RevenueDistributor, AgentIdentity

#### Day 2
- [ ] `nest new foundersea-api`
- [ ] Modules: `idea`, `builder`, `milestone`, `dao`, `marketplace`
- [ ] `VeniceService`: OpenAI client → Venice, model selector (kimi-k2-6 default, claude-opus-4-7 for validation)
- [ ] `ContractService`: viem clients for both chains, AI agent wallet
- [ ] `PinataService`: pin reasoning, agreements, submissions
- [ ] Implement `IdeaScorerService` end-to-end
- [ ] Wire: POST /ideas → Venice scores → AI approves/rejects on-chain → AgentIdentity records
- [ ] Confirm DecisionRecorded event on Mantle Sepolia explorer

---

### STAGE 2 — Builder AI + Competition (Day 3, June 4)

- [ ] `BuilderRankerService` — Venice ranks applicants, shortlist recommendation
- [ ] `FinalJudgeService` — claude-opus-4-7 judges MVPs, merger detection
- [ ] Off-chain competition platform (minimal): apply page, submission page, leaderboard
  - Simple Next.js pages, data in DB (Postgres or Supabase)
  - No contract — builder stake deposit is the only on-chain action during application
- [ ] API: `POST /builders/apply`, `GET /builders/ranked/:ideaId`, `POST /builders/final`
- [ ] On-chain: AI records BUILDER_RANK and MVP_VALIDATE decisions via AgentIdentity
- [ ] `IdeaRankerService` — hourly rerank of discovery feed by AI signal

---

### STAGE 3 — Milestone Validator + Auto-Payout (Days 4–5, June 5–6)

#### Day 4
- [ ] `MilestoneValidatorService` — claude-opus-4-7, full validation pipeline
- [ ] Confidence routing: ≥75 auto-release, 50–74 DAO review, <50 reject
- [ ] Direct release on Mantle: AI agent calls `FundingPool.releaseMilestone()`
- [ ] Store reasoning on IPFS, hash on-chain
- [ ] Test: passing submission → USDY transferred on Mantle Sepolia
- [ ] Test: failing submission → rejection event, no transfer, builder notified

#### Day 5
- [ ] Deploy all contracts to Base Sepolia
- [ ] MetaMask Smart Account as DAO treasury
- [ ] ERC-7710 delegation: treasury → AI agent for releaseMilestone
- [ ] ERC-7715: periodic USDC budget for Venice API
- [ ] x402: wrap Venice fetch with payment interceptor
- [ ] 1Shot: `npx skills add 1Shot-API/skills/public-relayer`; replace direct call with relay
- [ ] Webhook: `POST /webhooks/payout` → update frontend status
- [ ] Test full Base Sepolia flow with MetaMask extension

---

### STAGE 4 — AI DAO Voter + Governance (Day 6, June 7)

- [ ] `AIVoterService` — Venice analyzes proposals, casts aggregated delegated votes
- [ ] `DAOVoting` contract wired to frontend
- [ ] Delegation UI: toggle "Let AI vote for me" on portfolio page
- [ ] Proposal page shows: AI recommendation badge, confidence %, full reasoning (expandable)
- [ ] Test: create proposal → AI casts delegated votes → vote passes/fails
- [ ] `MarketPricerService` — Venice estimates fair value for marketplace

---

### STAGE 5 — Gated Funding + Marketplace (Day 7, June 8)

- [ ] All 4 FundingGate modes tested
- [ ] Funding gate config UI in `/create`
- [ ] Gate check on deposit button (on-chain verify before UI enables)
- [ ] IdeaMarketplace: listings, bids, on-chain settlement
- [ ] EIP-712 off-chain bid signatures (gas-efficient)
- [ ] Marketplace frontend: token grid, token detail, bid/ask flow
- [ ] AI fair value shown on every token card
- [ ] Protocol fee (2.5%) routing to FounderSea treasury

---

### STAGE 6 — Frontend Polish (Day 8, June 9)

- [ ] All pages connected and functional on Mantle Sepolia
- [ ] Venice streaming (SSE) on idea scoring + milestone validation — show AI thinking in real-time
- [ ] `/agent` page: full ERC-8004 decision log, confidence history by decision type
- [ ] Human vs. AI demo setup for Mantle judging:
  - Scripted scenario: 3 builders, human picks randomly, AI picks by score
  - Both outcomes recorded on-chain; divergent results shown on `/agent`
- [ ] USDY yield integration: idle FundingPool → Agni Finance vault (Mantle RWA track)
- [ ] mETH accepted as secondary funding token
- [ ] Mobile responsive pass
- [ ] Apply for $110K Mantle computing credits: devhub.mantle.xyz

---

### STAGE 7 — Demo Videos (Days 9–10, June 10–11)

#### Mantle Demo (6–7 min)

```
[0:00] Hook: "What if a protocol could fund, compete-build, and govern a product — 
              with AI making every decision?"

[1:00] Idea creation: deposit $500 USDY → AI scores live (streaming) → APPROVED
       DecisionRecorded event on Mantle explorer

[2:00] Funding round: whitelist gate shown → investors deposit → IdeaTokens minted

[2:45] Builder competition (off-chain platform):
       5 applicants → AI ranks them with reasoning → shortlist set
       Final MVPs → AI judges → ranks all 5 → recommends merger of 1+2

[3:45] DAO vote: AI recommendation shown → delegated votes cast automatically
       Outcome: MERGER selected

[4:15] THE KILL SHOT: builder submits milestone →
       AI validates (confidence 91%) → 500 USDY released AUTOMATICALLY
       Transaction on Mantle explorer. No human approved this.

[5:00] AI DAO vote: proposal created → AI votes YES on behalf of delegators
       On-chain: aiYesVotes visible in DAOVoting contract

[5:30] Marketplace: IdeaToken listed → bid placed → AI fair value shown

[6:00] /agent page: 23 decisions recorded, avg confidence 84%, all types shown

[6:30] Close: 3-track entry — Agentic Wallets + AI DevTools + AI x RWA
       "Roadmap: AI agents will compete as builders and hold tokens"
```

#### MetaMask Cook-Off Demo (3–4 min)

```
[0:00] Hook: "The DAO treasury funds its own AI brain. Automatically."

[0:30] MetaMask Smart Account as DAO treasury — visible in MetaMask extension

[1:00] ERC-7710: DAO delegates milestone-release to AI agent — signing visible

[1:30] ERC-7715: grant periodic USDC budget for Venice API calls — visible

[2:00] AI validates milestone → x402 fires: Smart Account pays Venice API
       "Payment intercepted, 0.02 USDC sent from treasury" visible on screen

[2:30] 1Shot relay: payout transaction submitted, webhook fires
       Job status: PENDING → CONFIRMED shown in real-time

[3:00] IdeaToken trade via Smart Account on marketplace

[3:30] Close: 4 tracks — Best Agent, Best Venice AI, Best x402+ERC-7710, Best 1Shot
```

---

### STAGE 8 — Submission + Social (Days 11–13, June 12–15)

#### Day 11
- [ ] GitHub repo clean: README, .env.example, deployment docs
- [ ] Mantle submission (DoraHacks): 3-track, demo video, all contract addresses
- [ ] MetaMask submission (HackQuest): Cook-Off demo video, Base contracts, MetaMask evidence
- [ ] Both submitted before June 14 EOD (buffer before June 15 10:59 UTC deadline)

#### Days 12–13 — Social (5 posts for $100×5 MetaMask bonus)
1. "Day 1: deploying FounderSea on @Mantle_Official — tokenized RWA where AI makes every funding decision #TuringTest2026"
2. "AI just rejected a low-quality idea and blocked the funding round from opening. No human needed. FounderSea @Mantle_Official"
3. "AI validates milestone → 500 USDY auto-released. Builder didn't wait for a DAO vote. @MetaMaskDev @Mantle_Official"
4. "Token holders can now delegate their DAO votes to AI. AI votes to maximize their revenue. FounderSea governance."
5. "Submitted FounderSea to both @Mantle_Official AI Awakening + @MetaMaskDev Cook-Off. One codebase, $114K potential."

---

## 10. AI Decision Summary (Full Protocol Map)

| Decision | Human default | With AI delegation | Impact if wrong |
|----------|-------------|-------------------|-----------------|
| Approve/reject idea | DAO vote | AI approves automatically | Low — creator loses $50 fee |
| Rank discovery feed | Recency sort | AI investment signal rank | Low — just UX |
| Warn investors of risks | None | AI flags risks on idea page | Medium — investor protection |
| Shortlist builders | DAO manual review | AI recommends, DAO 1-click | Medium — can override |
| Judge MVPs | DAO reviews submissions | AI scores + ranks all, DAO sees report | Medium — DAO votes on top picks |
| DAO vote | Token holder vote | AI votes for delegated holders | High — AI mandate: maximize revenue |
| Milestone validation | DAO manual review | AI auto-releases ≥75%, flags rest | High — funds on the line |
| Revenue strategy | Builder decides | AI weekly advice | Low — advisory only |

---

## 11. Environment Variables

```bash
# Chains
MANTLE_SEPOLIA_RPC=https://rpc.sepolia.mantle.xyz
MANTLE_MAINNET_RPC=https://rpc.mantle.xyz
BASE_SEPOLIA_RPC=https://sepolia.base.org

# AI
VENICE_API_KEY=                    # venice.ai/settings/api
VENICE_BASE_URL=https://api.venice.ai/api/v1
VENICE_FAST_MODEL=kimi-k2-6
VENICE_SMART_MODEL=claude-opus-4-7

# Storage
PINATA_API_KEY=
PINATA_SECRET=

# Protocol
AI_AGENT_PRIVATE_KEY=              # dedicated wallet — executor for all AI decisions
FOUNDERSEA_TREASURY=               # 2.5% marketplace fees accumulate here
WEBHOOK_BASE_URL=                  # backend URL for 1Shot webhooks

# Deployed — Mantle Sepolia (fill after Day 1)
IDEA_FACTORY_MANTLE=
AGENT_IDENTITY_MANTLE=
DAO_VOTING_MANTLE=
IDEA_MARKETPLACE_MANTLE=

# Deployed — Base Sepolia (fill after Day 5)
IDEA_FACTORY_BASE=
FUNDING_POOL_BASE=
DAO_SMART_ACCOUNT=                 # MetaMask Smart Account address
```

---

## 12. Judging Checklist

### Mantle AI Awakening

| Requirement | How FounderSea meets it |
|-------------|------------------------|
| Autonomous AI decisions | AI approves ideas, ranks builders, validates milestones, votes in DAO — all auto-execute |
| On-chain AI benchmarking (ERC-8004) | AgentIdentity logs every decision type with confidence score |
| Human vs. AI mechanism | Scripted demo: AI picks better builder than random human selection |
| USDY + mETH (RWA track) | FundingPool accepts both; idle funds yield via Agni Finance |
| Agentic wallet economy | FundingPool operated by AI-delegated agent; DAO treasury = smart account |
| 3 tracks | Agentic Wallets + AI DevTools + AI x RWA |

### MetaMask Cook-Off

| Requirement | How FounderSea meets it |
|-------------|------------------------|
| Smart Accounts in main flow | DAO treasury = MetaMask Smart Account throughout |
| ERC-7710 delegation | AI agent delegated for milestone release — visible signing |
| ERC-7715 Advanced Permissions | Periodic USDC budget for Venice API |
| x402 + ERC-7710 (Best track) | Smart Account auto-pays Venice via x402 |
| Venice AI meaningful output | Scoring, ranking, validation, DAO votes all via Venice |
| 1Shot Relayer (Best track) | All payouts gas-free via 1Shot, webhook confirmation shown |
| No closed-source APIs | Venice uses open-weights models (compliant) |

---

## 13. Roadmap (Post-Hackathon — tell judges this)

**V2 — AI Agents as Builders**
- AI agents submit to builder competition alongside human builders
- Agent stakes tokens autonomously
- Agent delivers code via automated commits
- FounderSea becomes the first protocol where AI competes for capital

**V3 — Fully Autonomous Venture Loop**
- AI agents hold IdeaTokens, earn revenue, re-deploy capital into new ideas
- Human role: set macro parameters, override in edge cases
- AI coordinates the full capital → builder → product → revenue cycle

---

*FounderSea — Own a piece of what gets built.*  
*Plan v3 | June 2, 2026 | 13 days to deadline*
