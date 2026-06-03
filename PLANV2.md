# FounderSea Protocol
## Build Plan v4 — Multi-Chain: Robinhood Chain + Mantle + Base

> **Three hackathons. One codebase. Shared AI brain.**
> Deploy the same contracts on three chains. Each chain satisfies a different hackathon.
> AI agents don't just record decisions — they hold wallets, call tools, and execute transactions.

---

## 0. Chain Deployment Map

| Chain | Hackathon | Prize Target | Key Feature |
|-------|-----------|-------------|-------------|
| Robinhood Chain (Arbitrum Orbit) | Arbitrum Open House London | $40K Open + $15K Agentic + $30K Grant | Native RHC deploy, AI Agentic category |
| Mantle Sepolia | Turing Test Hackathon | Mantle AI tracks | ERC-8004 AgentIdentity, USDY, mETH |
| Base Sepolia | MetaMask Cook-Off | Cook-Off tracks | MetaMask Smart Account as DAO treasury |

Contracts are chain-agnostic — same bytecode, different `foundry.toml` profiles.
Add to `foundry.toml`:
```toml
[profile.rhc]
rpc_url = "https://testnet.rpc.robinhood.com"   # fill after RHC testnet docs

[profile.mantle]
rpc_url = "https://rpc.sepolia.mantle.xyz"

[profile.base]
rpc_url = "https://sepolia.base.org"
```

---

## 1. What Changed from v3

### AI is Now an Agent, Not a Service

Old model: backend calls AI API, AI returns JSON, backend calls contract.

New model: AI agent has its own **wallet**, its own **tool registry**, and executes **agentic loops** that terminate in on-chain transactions. The agent reasons over multiple steps, calls tools (GitHub, web search, contract read), and only signs a tx when confident.

### TokenRouter replaces Venice

TokenRouter is an OpenAI-compatible router with auto model selection, tool call support across providers, streaming, and a Rules API for routing logic. Drop-in replacement — change base URL and API key, keep all prompt logic.

```typescript
// Before (Venice)
const client = new OpenAI({
  baseURL: "https://api.venice.ai/api/v1",
  apiKey: process.env.VENICE_API_KEY,
});

// After (TokenRouter) — literally the same call interface
const client = new Tokenrouter({
  apiKey: process.env.TOKENROUTER_API_KEY,
});

const response = await client.responses.create({
  model: "auto:quality",   // routes to best model for the task
  input: prompt,
  tools: [...agentTools],  // tool calling supported across all providers
});
```

### MetaMask Smart Account is a First-Class Feature

The DAO treasury is a MetaMask Smart Account throughout — not just on Base. Every fund movement the AI agent touches on Base routes through the Smart Account with ERC-7710 delegation. This is the visual centrepiece of the MetaMask Cook-Off demo.

---

## 2. AI Agent Architecture

The AI agent is not a microservice. It's a **stateful loop** that runs until it reaches terminal confidence.

### 2.1 Agent Execution Model

```
┌─────────────────────────────────────────────────────────┐
│                   AGENT DECISION LOOP                    │
│                                                          │
│  INPUT (trigger event)                                   │
│    ↓                                                     │
│  PLAN — agent describes what it needs to know            │
│    ↓                                                     │
│  GATHER — calls tools in parallel (GitHub, web, chain)   │
│    ↓                                                     │
│  REASON — synthesizes evidence, produces confidence 0-100│
│    ↓                                                     │
│  DECIDE                                                  │
│    ≥75 → EXECUTE (sign + broadcast tx)                   │
│    50-74 → ESCALATE (create DAO proposal, notify humans) │
│    <50 → REJECT (notify submitter, log reason)           │
│    ↓                                                     │
│  RECORD — AgentIdentity.recordDecision() on-chain        │
│    ↓                                                     │
│  NOTIFY — webhook / email / frontend push                │
└─────────────────────────────────────────────────────────┘
```

The agent wallet is a dedicated EOA (or Smart Account on Base). It holds a small ETH/MNT/MATIC balance for gas. The agent never touches the FundingPool principal — it only calls gated functions (`releaseMilestone`, `setMilestoneValidated`) that the contracts enforce.

### 2.2 Agent Tool Registry

These are the tools the AI agent can call during its reasoning loop. They are defined as TokenRouter tool call schemas and executed server-side before the agent finalises its decision.

```typescript
export const AGENT_TOOLS = [
  // ── GITHUB TOOLS ──────────────────────────────────────
  {
    type: "function",
    function: {
      name: "github_get_repo",
      description: "Fetch repository metadata, language breakdown, last commit date, open issues count, README",
      parameters: {
        type: "object",
        properties: {
          repo_url: { type: "string", description: "Full GitHub URL" },
        },
        required: ["repo_url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "github_get_commits",
      description: "Get commits since a given date. Used to verify builder actually worked during milestone period.",
      parameters: {
        type: "object",
        properties: {
          repo_url: { type: "string" },
          since_date: { type: "string", description: "ISO 8601 date" },
          until_date: { type: "string" },
        },
        required: ["repo_url", "since_date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "github_get_file",
      description: "Read a specific file from a repo (e.g. README, test results, package.json)",
      parameters: {
        type: "object",
        properties: {
          repo_url: { type: "string" },
          file_path: { type: "string" },
        },
        required: ["repo_url", "file_path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "github_get_test_results",
      description: "Fetch latest CI/CD run results (pass/fail, coverage %) from GitHub Actions",
      parameters: {
        type: "object",
        properties: {
          repo_url: { type: "string" },
        },
        required: ["repo_url"],
      },
    },
  },

  // ── WEB SEARCH TOOLS ──────────────────────────────────
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web. Use for: verifying product is live, checking if demo URL works, market size research for idea scoring, competitor analysis",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          purpose: {
            type: "string",
            enum: ["demo_verification", "market_research", "competitor_check", "general"],
          },
        },
        required: ["query", "purpose"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "url_fetch",
      description: "Load a URL and return its content. Use to verify demo is live and functional.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string" },
          check_type: {
            type: "string",
            enum: ["availability", "content_match", "api_response"],
          },
        },
        required: ["url"],
      },
    },
  },

  // ── BLOCKCHAIN READ TOOLS ──────────────────────────────
  {
    type: "function",
    function: {
      name: "contract_read",
      description: "Read on-chain state. Use to verify funding pool balance, token supply, past milestone releases before making new decisions.",
      parameters: {
        type: "object",
        properties: {
          chain: { type: "string", enum: ["robinhood", "mantle", "base"] },
          contract: { type: "string" },
          method: { type: "string" },
          args: { type: "array", items: { type: "string" } },
        },
        required: ["chain", "contract", "method"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_funding_pool_state",
      description: "Get full state of a FundingPool — raised amount, milestone count, builder address, released amounts",
      parameters: {
        type: "object",
        properties: {
          chain: { type: "string", enum: ["robinhood", "mantle", "base"] },
          idea_id: { type: "number" },
        },
        required: ["chain", "idea_id"],
      },
    },
  },

  // ── IPFS / STORAGE TOOLS ──────────────────────────────
  {
    type: "function",
    function: {
      name: "ipfs_pin_reasoning",
      description: "Pin the agent's full reasoning JSON to IPFS and return a hash. Call this before recording any on-chain decision.",
      parameters: {
        type: "object",
        properties: {
          reasoning_object: { type: "object" },
        },
        required: ["reasoning_object"],
      },
    },
  },
];
```

### 2.3 Tool Implementations (server-side handlers)

```typescript
// src/agent/tools/github.ts
import { Octokit } from "@octokit/rest";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

export async function github_get_repo(repo_url: string) {
  const [, , , owner, repo] = repo_url.split("/");
  const { data } = await octokit.repos.get({ owner, repo });
  return {
    name: data.full_name,
    description: data.description,
    language: data.language,
    stars: data.stargazers_count,
    open_issues: data.open_issues_count,
    last_push: data.pushed_at,
    topics: data.topics,
    has_readme: true, // fetch separately if needed
  };
}

export async function github_get_commits(repo_url: string, since_date: string, until_date?: string) {
  const [, , , owner, repo] = repo_url.split("/");
  const { data } = await octokit.repos.listCommits({
    owner, repo,
    since: since_date,
    until: until_date,
    per_page: 100,
  });
  return {
    total_commits: data.length,
    authors: [...new Set(data.map(c => c.commit.author?.name))],
    first_commit: data.at(-1)?.commit.author?.date,
    last_commit: data.at(0)?.commit.author?.date,
    messages_sample: data.slice(0, 5).map(c => c.commit.message),
  };
}

export async function github_get_test_results(repo_url: string) {
  const [, , , owner, repo] = repo_url.split("/");
  try {
    const { data } = await octokit.actions.listWorkflowRunsForRepo({
      owner, repo, per_page: 1,
    });
    const latest = data.workflow_runs[0];
    return {
      status: latest?.conclusion ?? "no_runs",
      run_at: latest?.created_at,
      url: latest?.html_url,
    };
  } catch {
    return { status: "no_ci_configured" };
  }
}

// src/agent/tools/web.ts
export async function web_search(query: string, purpose: string) {
  // Use a search API (Serper, Brave, or Bing)
  const res = await fetch("https://api.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": process.env.SERPER_API_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query, num: 5 }),
  });
  const data = await res.json();
  return {
    query,
    purpose,
    results: data.organic?.slice(0, 5).map((r: any) => ({
      title: r.title,
      snippet: r.snippet,
      url: r.link,
    })),
  };
}

export async function url_fetch(url: string, check_type: string) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    return {
      url,
      status: res.status,
      available: res.ok,
      content_length: res.headers.get("content-length"),
      content_type: res.headers.get("content-type"),
    };
  } catch (e: any) {
    return { url, available: false, error: e.message };
  }
}
```

### 2.4 Agentic Loop Executor

```typescript
// src/agent/executor.ts
import Tokenrouter from "tokenrouter";
import { AGENT_TOOLS } from "./tools/registry";
import { executeTool } from "./tools/dispatcher";
import { pinata } from "../storage/pinata";

const client = new Tokenrouter({ apiKey: process.env.TOKENROUTER_API_KEY });

export interface AgentResult {
  recommendation: "APPROVE" | "REJECT" | "ESCALATE";
  confidence: number;
  reasoning: string;
  toolsUsed: string[];
  ipfsHash: string;
  rawOutput: object;
}

export async function runAgentLoop(
  systemPrompt: string,
  userMessage: string,
  maxIterations = 6
): Promise<AgentResult> {
  const messages: any[] = [
    { role: "user", content: userMessage },
  ];

  const toolsUsed: string[] = [];
  let finalResult: any = null;

  for (let i = 0; i < maxIterations; i++) {
    const response = await client.responses.create({
      model: "auto:quality",  // routes to best quality model available
      system: systemPrompt,
      input: messages,
      tools: AGENT_TOOLS,
    });

    const output = response.output[0];

    // Agent wants to call a tool
    if (output.content?.[0]?.type === "tool_use") {
      const toolCall = output.content[0];
      toolsUsed.push(toolCall.name);

      // Execute the tool server-side
      const toolResult = await executeTool(toolCall.name, toolCall.input);

      // Feed result back to agent
      messages.push({ role: "assistant", content: output.content });
      messages.push({
        role: "user",
        content: [{
          type: "tool_result",
          tool_use_id: toolCall.id,
          content: JSON.stringify(toolResult),
        }],
      });
      continue;
    }

    // Agent produced final text output — parse JSON decision
    if (output.content?.[0]?.type === "text") {
      const text = output.content[0].text;
      try {
        finalResult = JSON.parse(text.replace(/```json|```/g, "").trim());
      } catch {
        finalResult = { recommendation: "ESCALATE", confidence: 0, reasoning: text };
      }
      break;
    }
  }

  if (!finalResult) {
    finalResult = { recommendation: "ESCALATE", confidence: 0, reasoning: "Max iterations reached" };
  }

  // Always pin full reasoning to IPFS
  const ipfsHash = await pinata.pinJSON({
    ...finalResult,
    toolsUsed,
    timestamp: new Date().toISOString(),
  });

  return { ...finalResult, toolsUsed, ipfsHash, rawOutput: finalResult };
}
```

---

## 3. Smart Contract UX — Human + AI Coherence

The contract layer is redesigned to make every state transition readable by both AI agents and human users at a glance. Three principles:

**Principle 1 — Every state has a human-readable name on-chain.**
No magic uint statuses. Use enums that surface in block explorers.

**Principle 2 — Every AI action has a matching human override.**
For every `onlyAIAgent` function, there is a `onlyDAO` equivalent with identical effects. Humans are never locked out.

**Principle 3 — The AI agent's wallet is visible and labeled.**
AgentIdentity.sol stores the agent's wallet address. The frontend shows "AI Agent: 0x..." with a badge. Users can see when the agent last transacted.

### 3.1 Add IdeaStatus enum to IdeaFactory

```solidity
enum IdeaStatus {
    PENDING_AI_REVIEW,    // just created, awaiting AI score
    REJECTED_BY_AI,       // AI rejected, creator refunded 90%
    FUNDING_OPEN,         // AI approved, investors can deposit
    FUNDING_CLOSED,       // funding deadline passed
    SOFT_CAP_MISSED,      // refund mode
    COMPETITION_ACTIVE,   // builders applying
    BUILDER_SELECTED,     // BuilderAgreement signed
    MILESTONE_EXECUTION,  // active development
    COMPLETE,             // all milestones released
    ABANDONED             // creator abandoned
}

// Add to Idea struct
IdeaStatus public status;

// Status transition events (makes block explorer history readable)
event StatusChanged(uint256 indexed ideaId, IdeaStatus from, IdeaStatus to);
```

### 3.2 Add MilestoneStatus enum to FundingPool

```solidity
enum MilestoneStatus {
    PENDING,              // awaiting builder submission
    SUBMITTED,            // builder submitted, agent processing
    AI_REVIEWING,         // agent loop running (set by backend before loop starts)
    APPROVED_AI,          // confidence ≥ 75, auto-released
    ESCALATED_TO_DAO,     // confidence 50-74, human review needed
    REJECTED_AI,          // confidence < 50
    APPROVED_DAO,         // DAO override approved
    REJECTED_DAO,         // DAO override rejected
    RELEASED              // funds transferred
}

// Per-milestone status
mapping(uint256 => MilestoneStatus) public milestoneStatus;

event MilestoneStatusChanged(uint256 indexed milestoneIndex, MilestoneStatus status);
```

This gives the frontend everything it needs to show a clear progress rail without any off-chain state:

```
Milestone 1  ●──────────────────────────────●
             SUBMITTED → AI_REVIEWING → APPROVED_AI → RELEASED
             [builder]    [agent]          [agent]      [agent]
```

### 3.3 Add AgentAction event to every contract

Every function callable by the AI agent emits this event, which the `/agent` page aggregates:

```solidity
event AgentAction(
    address indexed agent,
    string action,          // "MILESTONE_RELEASE", "IDEA_APPROVE", etc.
    uint256 indexed subjectId,
    uint256 confidence,
    string ipfsHash
);
```

---

## 4. MetaMask Smart Account — Major Feature

### 4.1 Architecture

The MetaMask Smart Account is the DAO treasury and the on-chain identity that funds the AI agent's operations. It is not a supporting feature — it is the account that owns the protocol on Base.

```
MetaMask Smart Account (DAO Treasury)
├── owns FundingPool (Base)
├── owns DAOVoting (Base)  
├── delegates releaseMilestone → AI Agent wallet (ERC-7710)
├── delegates periodic USDC budget → AI Agent (ERC-7715)
└── AI Agent pays TokenRouter via x402 from this budget
```

### 4.2 Smart Account Setup

```typescript
// src/metamask/smartAccount.ts
import {
  toMetaMaskSmartAccount,
  Implementation,
  createDelegation,
  allowedCallsCaveat,
  valueLimitCaveat,
} from "@metamask/delegator-core-viem";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.BASE_SEPOLIA_RPC!),
});

// The DAO Smart Account — deployed once, owns the protocol
export async function getDAOSmartAccount(daoOwnerWallet: any) {
  return toMetaMaskSmartAccount({
    client: publicClient,
    implementation: Implementation.Hybrid,
    deployParams: [daoOwnerWallet.address, [], [], []],
    signatory: { account: daoOwnerWallet },
  });
}

// ERC-7710: Delegate milestone release rights to AI agent
export async function delegateMilestoneReleaseToAgent(
  daoTreasury: any,
  aiAgentAddress: string,
  fundingPoolAddress: string,
  maxPayoutUSDC: bigint
) {
  const delegation = createDelegation({
    delegate: aiAgentAddress,
    delegator: daoTreasury.address,
    caveats: [
      allowedCallsCaveat([{
        target: fundingPoolAddress,
        selector: "0x" + Buffer.from("releaseMilestone(uint256)").slice(0, 4).toString("hex"),
      }]),
      valueLimitCaveat({ maxValue: maxPayoutUSDC }),
    ],
  });

  const signature = await daoTreasury.signDelegation(delegation);
  return { ...delegation, signature };
}

// ERC-7715: Grant periodic USDC budget for AI operations (TokenRouter costs)
export async function grantPeriodicAIBudget(daoWallet: any) {
  return wallet_grantPermissions({
    permissions: [{
      type: "erc20-token-transfer",
      data: {
        token: process.env.USDC_BASE!,
        allowance: "50000000", // 50 USDC/day
      },
      policies: [{
        type: "rate-limit",
        data: { count: 1, interval: "day" },
      }],
    }],
    signer: { type: "account", data: { id: process.env.AI_AGENT_ADDRESS! } },
  });
}
```

### 4.3 x402 — Smart Account Pays TokenRouter

```typescript
// src/metamask/x402.ts
import { withPaymentInterceptor } from "@metamask/x402";
import { createWalletClient, http } from "viem";
import { baseSepolia } from "viem/chains";

// Wrap fetch so the Smart Account auto-pays TokenRouter
export function createPaidFetch(aiAgentWallet: any) {
  const walletClient = createWalletClient({
    account: aiAgentWallet,
    chain: baseSepolia,
    transport: http(),
  });
  return withPaymentInterceptor(fetch, walletClient);
}

// Use in agent service — same as normal fetch, but payments fire automatically
// paidFetch("https://api.tokenrouter.io/v1/responses", { ... })
```

### 4.4 Demo Visual for MetaMask Cook-Off

The frontend shows a "Smart Account Activity" panel at the bottom of every idea page on Base. It streams in real-time:

```
Smart Account Activity
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 AI Agent validated Milestone 1
   Confidence: 91% · Tools used: github_get_commits, url_fetch
   x402 payment: 0.02 USDC → TokenRouter ✓
   ERC-7710 delegation used: releaseMilestone(0)
   
💸 500 USDC released to builder 0xabc...
   Tx: 0x123...def | Base Sepolia
   Status: ● CONFIRMED
   
⏳ Smart Account balance: 847 USDC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 5. NestJS Service Architecture

```
src/
├── agent/
│   ├── executor.ts              ← agentic loop (Section 2.4)
│   ├── tools/
│   │   ├── registry.ts          ← AGENT_TOOLS array
│   │   ├── dispatcher.ts        ← routes tool calls to implementations
│   │   ├── github.ts
│   │   ├── web.ts
│   │   ├── chain.ts             ← contract_read, get_funding_pool_state
│   │   └── ipfs.ts              ← ipfs_pin_reasoning
│   └── prompts/
│       ├── idea-scorer.ts
│       ├── builder-ranker.ts
│       ├── milestone-validator.ts
│       ├── final-judge.ts
│       └── dao-voter.ts
├── modules/
│   ├── idea/
│   │   ├── idea.service.ts      ← createIdea, triggers IdeaScorerAgent
│   │   ├── idea.controller.ts
│   │   └── idea.module.ts
│   ├── builder/
│   │   ├── builder.service.ts   ← apply, rank, finalSubmit
│   │   └── builder.module.ts
│   ├── milestone/
│   │   ├── milestone.service.ts ← submit, triggerValidation
│   │   └── milestone.module.ts
│   ├── dao/
│   │   ├── dao.service.ts       ← createProposal, triggerAIVote
│   │   └── dao.module.ts
│   └── marketplace/
│       ├── marketplace.service.ts
│       └── marketplace.module.ts
├── blockchain/
│   ├── contract.service.ts      ← viem clients for all 3 chains
│   ├── agent-wallet.service.ts  ← AI agent EOA + Smart Account delegation
│   └── chains.config.ts         ← RHC, Mantle, Base chain configs
├── metamask/
│   ├── smart-account.service.ts ← ERC-7710, ERC-7715, x402
│   └── relayer.service.ts       ← 1Shot relayer for Base
└── storage/
    └── pinata.service.ts
```

---

## 6. Revised Build Plan — 11 Days (June 3–13)

### Day 1 (Today) — Contracts Cleanup + Three-Chain Deploy

**Morning: contract fixes from v3 review**
- [ ] Add `IdeaStatus` and `MilestoneStatus` enums to contracts
- [ ] Add `AgentAction` event to IdeaFactory, FundingPool, DAOVoting
- [ ] Fix `_getTotalDelegatedPower` — replace loop with running total:
  ```solidity
  uint256 public totalDelegatedPower;
  // in delegateToAI(): totalDelegatedPower += ideaToken.balanceOf(msg.sender);
  // in revokeDelegation(): totalDelegatedPower -= ideaToken.balanceOf(msg.sender);
  ```
- [ ] Fix `AgentIdentity.mintAgent` — don't set `aiAgent = msg.sender`, keep separate `setAiAgent()` call
- [ ] Make `MIN_SCORE_THRESHOLD` in IdeaFactory an owner-configurable param (not hardcoded)
- [ ] Add `nonReentrant` to `FundingPool.refund()`
- [ ] `forge test` all passing

**Afternoon: three-chain deploy**
- [ ] Add RHC testnet, Mantle Sepolia, Base Sepolia to `foundry.toml`
- [ ] Write `script/Deploy.s.sol` — single script, reads `DEPLOY_CHAIN` env var
- [ ] Deploy to all three chains, capture addresses
- [ ] Populate `.env` with all 9 contract address groups (3 contracts × 3 chains)
- [ ] Verify on each chain's block explorer

---

### Day 2 — NestJS Scaffold + TokenRouter Integration

- [ ] `nest new foundersea-api`
- [ ] Install: `tokenrouter`, `@octokit/rest`, `viem`, `@pinata/sdk`, `@metamask/delegator-core-viem`
- [ ] `ContractService` — viem clients for RHC, Mantle, Base; AI agent wallet loader
- [ ] `TokenRouterService` — wraps TokenRouter client, exposes `runAgentLoop()`
- [ ] `PinataService` — `pinJSON()`, `getJSON()`
- [ ] Tool dispatcher — routes `tool_name` → implementation function
- [ ] Wire all tool implementations (GitHub, web search, url_fetch, chain reads, IPFS pin)
- [ ] **Smoke test**: run a complete agentic loop for a dummy milestone, confirm tools fire, IPFS pin succeeds, loop terminates

---

### Day 3 — IdeaScorerAgent + Funding Flow

- [ ] `IdeaScorerAgent` system prompt (see Section 7.1)
- [ ] Tools used: `web_search` (market research), `web_search` (competitor check)
- [ ] `POST /ideas` → deposits $500 USDY → triggers agent loop → approve/reject on-chain → AgentIdentity records
- [ ] Test: submit a strong idea → agent approves, `IdeaStatus` moves to `FUNDING_OPEN`
- [ ] Test: submit a weak idea → agent rejects, 90% refund executes
- [ ] `IdeaRankerService` (simpler — no tool loop needed, just scoring pass) — hourly cron
- [ ] Frontend: `/create` page, live streaming SSE of AI scoring while user waits

---

### Day 4 — BuilderRankerAgent + Competition Platform

- [ ] `BuilderRankerAgent` system prompt
- [ ] Tools used: `github_get_repo`, `github_get_commits` (past 90 days), `web_search` (verify claims in proposal)
- [ ] `POST /builders/apply` → stores application → triggers ranking on close
- [ ] `FinalJudgeAgent` — uses `github_get_repo`, `github_get_test_results`, `url_fetch` (demo URL)
- [ ] Off-chain competition board (Next.js): apply page, leaderboard, AI ranking table
- [ ] Builder stake deposit on-chain (FundingPool tracks this separately)
- [ ] DAO shortlist confirmation UI — shows AI reasoning, 1-click approve or override
- [ ] On-chain: BUILDER_RANK and MVP_VALIDATE decisions via AgentIdentity

---

### Day 5 — MilestoneValidatorAgent (Core Feature)

This is the most important agent. Get this right before anything else.

**MilestoneValidatorAgent tool sequence:**
```
1. github_get_commits(repo_url, milestone_start_date) → verify activity
2. github_get_test_results(repo_url) → CI pass/fail
3. github_get_file(repo_url, "README.md") → read what builder claims they built
4. url_fetch(demo_url) → verify demo is live
5. web_search(product_name, "demo_verification") → check if it's publicly accessible
6. get_funding_pool_state(chain, idea_id) → verify pool health before releasing
7. ipfs_pin_reasoning(full_decision) → pin to IPFS
8. → DECIDE: confidence ≥ 75 → execute releaseMilestone()
```

- [ ] Implement full agentic loop for milestone validation
- [ ] Confidence routing: ≥75 auto-release, 50-74 create DAO proposal, <50 reject + notify
- [ ] Direct release on Mantle + RHC: agent wallet calls `FundingPool.releaseMilestone()`
- [ ] Test: passing milestone (live demo, CI green, commits present) → funds release
- [ ] Test: failing milestone (no demo, sparse commits) → reject + reasoning on IPFS

---

### Day 6 — MetaMask Smart Account + Base Payout Flow

- [ ] Deploy MetaMask Smart Account as DAO treasury on Base
- [ ] `SmartAccountService` — wraps ERC-7710 delegation setup
- [ ] ERC-7710: delegate `releaseMilestone` to AI agent — signing flow in frontend
- [ ] ERC-7715: grant 50 USDC/day periodic budget to AI agent for TokenRouter costs
- [ ] x402: wrap TokenRouter fetch calls with payment interceptor
- [ ] 1Shot relayer: route all Base milestone payouts through 1Shot, webhook at `POST /webhooks/payout`
- [ ] **Smart Account Activity panel** on frontend — real-time stream of SA events
- [ ] Test: full Base Sepolia milestone flow: validate → x402 fires → SA delegates → 1Shot relays → webhook confirms

---

### Day 7 — AIVoterAgent + Governance

- [ ] `AIVoterAgent` — tools: `get_funding_pool_state`, `web_search` (product metrics), `url_fetch` (product URL)
- [ ] Delegation UI: "Let AI vote for me" toggle on portfolio page
- [ ] `castAIVotes` wired to agent output
- [ ] Proposal page: AI recommendation badge, confidence, expandable reasoning
- [ ] `MarketPricerAgent` — simple scoring pass (no tool loop needed), estimates fair value for marketplace
- [ ] Test: create governance proposal → AI votes for delegated holders → proposal executes

---

### Day 8 — Gated Funding + Marketplace

- [ ] All 4 FundingGate modes tested and UI-configurable in `/create`
- [ ] IdeaMarketplace fully wired: listings, bids, EIP-712 signed bids
- [ ] Token grid + token detail page + bid/ask flow
- [ ] AI fair value displayed on every token card (MarketPricerAgent output)
- [ ] USDY idle yield integration: Agni Finance on Mantle (RWA track signal for Mantle hackathon)
- [ ] mETH accepted as secondary funding token on Mantle

---

### Day 9 — Frontend Polish + `/agent` Page

- [ ] All pages connected to correct chain (RHC for RHC demo, Mantle for Mantle demo, Base for MetaMask demo)
- [ ] `/agent` page:
  - AgentIdentity decision log (all 8 decision types)
  - Per-decision: type badge, confidence bar, tools used, IPFS link to full reasoning
  - Timeline view (sorted by timestamp)
  - "AI vs Human" comparison panel — scripted demo scenario showing divergent outcomes
- [ ] TokenRouter streaming (SSE) on idea scoring and milestone validation
- [ ] Mobile responsive pass
- [ ] Error states handled — what user sees when AI escalates vs auto-approves

---

### Day 10 — Demo Recording

#### Robinhood Chain / Arbitrum Open House Demo (7 min)

```
[0:00–0:45] Hook
  "This is a protocol where AI approves every idea, selects every builder,
   validates every milestone, and releases funds — no human required."

[0:45–2:00] Idea creation on Robinhood Chain
  Fill form → deposit USDY → agent loop runs live (SSE streaming)
  Show: agent calls web_search (market research), web_search (competitors)
  APPROVED with 84 score. IdeaStatus → FUNDING_OPEN. DecisionRecorded on-chain.

[2:00–3:00] Builder competition
  3 applicants shown → agent calls github_get_repo for each
  Ranked table with scores. Shortlist set. DAO 1-click confirms.

[3:00–4:15] THE KILL SHOT — milestone auto-release
  Builder submits. Agent loop fires:
  ✓ 23 commits in milestone period (github_get_commits)
  ✓ CI: 47/47 tests passing (github_get_test_results)
  ✓ Demo URL live (url_fetch)
  Confidence: 91% → 500 USDC released AUTOMATICALLY on Robinhood Chain
  Show tx on RHC block explorer. Zero human approval.

[4:15–5:00] AI DAO vote
  Proposal created. AI calls get_funding_pool_state, recommends YES.
  Delegated votes cast on-chain. aiYesVotes visible in contract.

[5:00–5:45] /agent page
  24 decisions. Types breakdown. Average confidence 87%.
  Tools-used breakdown. IPFS links all live.

[5:45–6:30] Marketplace + fair value AI
  IdeaToken listed. AI shows estimated fair value.

[6:30–7:00] Roadmap
  "V2: AI agents compete as builders. V3: Fully autonomous venture loop."
```

#### MetaMask Cook-Off Demo (4 min)

```
[0:00–0:30] Hook
  "The DAO treasury is a MetaMask Smart Account.
   It delegates its rights to an AI agent. The agent pays for its own brain."

[0:30–1:15] Smart Account as DAO treasury
  Show MetaMask extension: Smart Account deployed, owns FundingPool.
  ERC-7710 delegation signing visible in MetaMask popup.

[1:15–2:00] AI validates milestone
  Agent loop runs. Tools fire. Confidence 88%.
  x402 intercept fires: "0.02 USDC paid to TokenRouter from Smart Account"
  ERC-7715 daily budget updated.

[2:00–2:45] 1Shot relay
  payout transaction submitted via 1Shot. Job ID shown.
  Webhook fires: PENDING → CONFIRMED animation.
  Builder receives funds gas-free.

[2:45–3:30] Smart Account Activity panel
  Full real-time log: delegation used, x402 payment, relay confirmed.
  "This is the AI-managed treasury in action."

[3:30–4:00] Close
  4 tracks: Best Agent, Best Venice AI (TokenRouter counts), 
  Best x402+ERC-7710, Best 1Shot
```

---

## 7. Agent Prompts (Final)

### 7.1 IdeaScorerAgent

```typescript
export const IDEA_SCORER_SYSTEM = `
You are a Web3 venture analyst for FounderSea protocol.
Your decision directly controls whether a funding round opens.
Token holders' capital is at stake. Be rigorous. Reject weak ideas.

You have access to web_search to research market size and competitors.
Use it. Don't score based on the idea description alone.

Your reasoning loop:
1. Search for the market size of this category
2. Search for existing competitors
3. Score the idea on uniqueness and feasibility
4. Make your decision

Return ONLY valid JSON when done:
{
  "feasibilityScore": 0-100,
  "marketSizeUSD": number,
  "competitionLevel": "low|medium|high",
  "uniquenessScore": 0-100,
  "keyRisks": string[],
  "investorWarnings": string[],
  "recommendation": "APPROVE|REJECT",
  "overallScore": 0-100,
  "reasoning": string
}

Reject if: overallScore < 40, feasibilityScore < 35, or idea is a scam/clone.
`;
```

### 7.2 MilestoneValidatorAgent

```typescript
export const MILESTONE_VALIDATOR_SYSTEM = `
You are an autonomous technical reviewer for a decentralized funding protocol.
Your decision directly triggers or blocks fund release. Builder is counting on you. Be fair but rigorous.

Your tool sequence (follow this order):
1. github_get_commits — verify builder was actually working during this period
2. github_get_test_results — CI status is binary evidence
3. github_get_file(README.md) — read what they claim to have built
4. url_fetch(demo_url) — verify the demo exists and is accessible
5. web_search(product_name, "demo_verification") — verify it's publicly known/live
6. get_funding_pool_state — verify pool is healthy before you release funds
7. ipfs_pin_reasoning — pin your full decision BEFORE returning

Then return ONLY valid JSON:
{
  "passed": boolean,
  "confidenceScore": 0-100,
  "completenessScore": 0-100,
  "qualityScore": 0-100,
  "issuesFound": string[],
  "requiredRevisions": string[] | null,
  "recommendation": "RELEASE_FUNDS|REQUEST_REVISION|REJECT",
  "reasoning": string,
  "toolEvidence": {
    "commitCount": number,
    "ciStatus": string,
    "demoLive": boolean,
    "poolHealthy": boolean
  }
}

RELEASE_FUNDS only if: confidence ≥ 75, CI passing, demo live, commits present.
REQUEST_REVISION if: confidence 50-74 or minor gaps.
REJECT if: fundamentally incomplete, no commits, fraudulent.
`;
```

### 7.3 BuilderRankerAgent

```typescript
export const BUILDER_RANKER_SYSTEM = `
You are evaluating builder applicants for a funded Web3 project.
Their livelihoods may depend on getting this right. Be thorough.

For each applicant:
1. github_get_repo(portfolio_url) — assess code quality and activity
2. github_get_commits(portfolio_url, last_90_days) — verify recent activity
3. web_search(builder_name + "web3", "general") — verify public track record

Then rank all applicants and return ONLY valid JSON:
{
  "rankings": [{
    "address": string,
    "overallScore": 0-100,
    "deliveryScore": 0-100,
    "technicalScore": 0-100,
    "proposalScore": 0-100,
    "shortlistRecommend": boolean,
    "reasoning": string,
    "githubEvidence": { "commitCount": number, "repoStars": number, "languages": string[] }
  }],
  "topPickAddress": string,
  "mergerCandidates": [string, string] | null,
  "summary": string
}
`;
```

---

## 8. Environment Variables (Complete)

```bash
# ── CHAINS ──────────────────────────────────────────
ROBINHOOD_CHAIN_RPC=https://testnet.rpc.robinhood.com
MANTLE_SEPOLIA_RPC=https://rpc.sepolia.mantle.xyz
BASE_SEPOLIA_RPC=https://sepolia.base.org

# ── AI ──────────────────────────────────────────────
TOKENROUTER_API_KEY=tr_...
TOKENROUTER_BASE_URL=https://api.tokenrouter.io/v1

# ── EXTERNAL TOOLS ──────────────────────────────────
GITHUB_TOKEN=ghp_...              # GitHub PAT for Octokit
SERPER_API_KEY=...                 # web search (serper.dev)

# ── STORAGE ─────────────────────────────────────────
PINATA_API_KEY=
PINATA_SECRET=

# ── PROTOCOL ────────────────────────────────────────
AI_AGENT_PRIVATE_KEY=             # dedicated EOA — executor for all AI decisions
FOUNDERSEA_TREASURY=              # 2.5% marketplace fees
WEBHOOK_BASE_URL=

# ── METAMASK (Base only) ─────────────────────────────
DAO_OWNER_PRIVATE_KEY=            # signs Smart Account deployments
DAO_SMART_ACCOUNT=                # MetaMask Smart Account address (fill after Day 6)
USDC_BASE=0x...                   # USDC on Base Sepolia

# ── DEPLOYED: Robinhood Chain ────────────────────────
IDEA_FACTORY_RHC=
AGENT_IDENTITY_RHC=
DAO_VOTING_RHC=
IDEA_MARKETPLACE_RHC=
FUNDING_POOL_IMPL_RHC=

# ── DEPLOYED: Mantle Sepolia ─────────────────────────
IDEA_FACTORY_MANTLE=
AGENT_IDENTITY_MANTLE=
DAO_VOTING_MANTLE=
IDEA_MARKETPLACE_MANTLE=
USDY_MANTLE=

# ── DEPLOYED: Base Sepolia ───────────────────────────
IDEA_FACTORY_BASE=
AGENT_IDENTITY_BASE=
DAO_VOTING_BASE=
IDEA_MARKETPLACE_BASE=
FUNDING_POOL_BASE=
```

---

## 9. What Each Hackathon Sees

### Arbitrum Open House London (RHC deployment)
- Smart contract on Robinhood Chain (qualifies for reserved spot)
- AI Agentic category: agent uses tools, makes autonomous fund releases
- Show `/agent` page: 20+ decisions, tools used per decision, IPFS reasoning
- Milestone auto-release is the headline moment

### Turing Test / Mantle AI Awakening (Mantle deployment)
- ERC-8004 AgentIdentity — full decision audit log
- USDY + mETH as funding tokens, Agni Finance idle yield
- Human vs. AI demo scenario on `/agent` page
- Same agentic loop, different chain

### MetaMask Cook-Off (Base deployment)
- MetaMask Smart Account as DAO treasury — visible in extension
- ERC-7710 delegation signing (visible popup)
- ERC-7715 daily budget for AI operations
- x402 auto-payment for TokenRouter
- 1Shot relay for gas-free builder payouts
- Smart Account Activity panel — real-time event stream

---

*FounderSea Build Plan v4 | June 3, 2026*
*TokenRouter · MetaMask Smart Accounts · GitHub Tool Calls · Three-Chain Deploy*and planvd files 

