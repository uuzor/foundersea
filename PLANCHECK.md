

Great clarifications. Let me think through both of these carefully.

---

### Stage 2 incentive flow — top 3 from pool

The correct model: when the funding round closes and the pool locks, you carve out **4 milestone slots** upfront:

- **M0** — split among top 3 builders (competition prizes, released when AI validates their MVPs as "competition-grade")
- **M1, M2, M3...** — the winner's development milestones

So M0 isn't one payout — it's three smaller payouts. When the AI judges the MVPs and the DAO confirms the winner, the top 3 get their prizes from M0 allocation, then the winner proceeds to M1. The pool depletes by M0 total before development even starts, which is expected and should be shown clearly to investors during the funding round ("X% of raise reserved for builder competition").

This means `FundingPool` needs `competitorPayouts` — an array of `(address builder, uint256 amount, bool released)` separate from the main milestone array, released when AI validates each MVP above a competition threshold. The winner's M0 share can be folded into their M1 as a bonus, or paid separately — your call.

---

### Revenue distribution — no distributor contract

You're right to question this. The `RevenueDistributor` contract is the wrong model for a protocol where the product is built by an independent team that earns real revenue. Here's the correct framing:

The IdeaToken **is** the revenue claim. You don't need a contract to push revenue — you need a **standard that the product must implement**. The mechanism is:

The winning builder, when they ship the product, designates a **revenue address** in their `BuilderAgreement`. That address is the IdeaToken contract itself (or a simple splitter). The protocol's terms (enforced by the signed agreement) require the builder to route a percentage of product revenue to `IdeaToken.notifyRevenue()`. Token holders pull their share whenever they want.

In practice this means:

```solidity
// IdeaToken keeps this simple
function notifyRevenue(uint256 usdyAmount) external {
    require(msg.sender == authorizedRevenueSource, "Not authorized");
    IERC20(USDY).transferFrom(msg.sender, address(this), usdyAmount);
    revenuePerTokenStored += (usdyAmount * 1e18) / totalSupply();
}

function claimRevenue() external returns (uint256 amount) {
    _updateDebt(msg.sender);
    amount = pendingRevenue[msg.sender];
    pendingRevenue[msg.sender] = 0;
    IERC20(USDY).transfer(msg.sender, amount);
}
```

The `authorizedRevenueSource` is set in `BuilderAgreement` at signing — it's the product's payment contract, a multisig, or a Stripe-to-USDY bridge. The IdeaToken just receives USDY and accounts for it per-share. No distributor middleman.

The key insight: **the builder's product IS the revenue source**. The protocol can't enforce this on-chain (the product lives off-chain), but it can enforce it socially + legally through the signed `BuilderAgreement` — and the builder's reputation + staked tokens are the collateral. This is how real RWA works: the on-chain token represents a legal/social claim on off-chain cash flows, not a trustless automated one.---

### What changes in the contracts

**`FundingPool` — replace `milestones[0]` with a dedicated competitor payout struct:**

```solidity
struct CompetitorPayout {
    address builder;
    uint256 amount;
    bool released;
    uint256 aiConfidence;  // AI MVP validation score
}

CompetitorPayout[3] public competitorPayouts; // exactly 3 slots
uint256 public competitionAllocation;         // carved out at closeFunding()

function setCompetitorPayouts(
    address[3] calldata builders,
    uint256[3] calldata amounts  // must sum to competitionAllocation
) external onlyOwner { ... }

function releaseCompetitorPayout(uint256 slot) external onlyAIAgent {
    CompetitorPayout storage p = competitorPayouts[slot];
    require(p.aiConfidence >= COMPETITION_THRESHOLD && !p.released);
    p.released = true;
    fundingToken.safeTransfer(p.builder, p.amount);
}
```

The split ratio (40/35/25 or whatever) is set by the factory or the creator at config time, not hardcoded.

**`IdeaToken` — strip all revenue logic except the accounting core:**

```solidity
address public authorizedRevenueSource;  // set by BuilderAgreement at signing
IERC20 public immutable USDY;

function setRevenueSource(address source) external {
    require(msg.sender == address(buildingAgreement), "Only agreement");
    require(authorizedRevenueSource == address(0), "Already set");
    authorizedRevenueSource = source;
}

function notifyRevenue(uint256 amount) external {
    require(msg.sender == authorizedRevenueSource, "Not authorized");
    USDY.transferFrom(msg.sender, address(this), amount);
    if (totalSupply() > 0) {
        revenuePerTokenStored += (amount * 1e18) / totalSupply();
    }
}

function claimRevenue() external returns (uint256 amount) {
    _updateDebt(msg.sender);
    amount = pendingRevenue[msg.sender];
    require(amount > 0, "Nothing to claim");
    pendingRevenue[msg.sender] = 0;
    USDY.safeTransfer(msg.sender, amount);
}
```

Delete `RevenueDistributor.sol` entirely. The accounting lives in `IdeaToken`, the USDY balance lives in `IdeaToken`, the claim is a direct pull. Simple, auditable, one contract.

**`BuilderAgreement` — add `authorizeRevenueSource()` triggered at full signing:**

```solidity
function _checkAndActivate(uint256 agreementId) internal {
    Agreement storage a = agreements[agreementId];
    if (a.creatorSigned && a.builderSigned && a.daoSigned) {
        a.signedAt = block.timestamp;
        a.active = true;
        // Wire revenue source into IdeaToken
        IIdeaToken(ideaTokenAddress).setRevenueSource(a.revenueSource);
        emit AgreementActivated(agreementId);
    }
}
```

`a.revenueSource` is set by the builder when they sign — it's the address of their product's payment contract, a multisig, or even their own wallet if the product is simple. They can update it later via a DAO vote.

---

### The honest framing for judges and investors

The thing to say clearly in the demo: FounderSea doesn't automate revenue collection — it can't, because the revenue lives in the real world. What it does is create a **standardized on-chain revenue pipe**: any product built on FounderSea implements the `notifyRevenue()` interface, and the protocol makes that commitment enforceable through the agreement and the builder's staked collateral. That's the RWA primitive — a standardized, auditable, pull-based claim on real product cash flows. Closer to how a bond coupon works than how DeFi yield farming works, which is actually a stronger story for the RWA track.




Good call dropping the stake. The chat/board room idea is actually stronger — skin in the game for builders should be **reputation and time**, not capital. A builder who commits to 6 weeks of work and does calls with the founder has more real accountability than one who deposited $200 they may not even care about losing.

Let me audit the updated contracts first, then address what this means structurally.

---

### Updated contract audit — what's fixed, what remains

**Fixed from last round:**
- `FundingPool.setIdeaToken()` now wired in `IdeaFactory.createIdea()` ✓
- `FundingGate` param decoding uses `abi.decode` ✓
- `refund()` snapshots supply before burn ✓
- `DAOVoting._getTotalDelegatedPower()` now iterates `delegatedHolders` ✓
- `aiHasVoted` guard on `castAIVotes()` ✓
- `IdeaToken.claimRevenue()` now pays USDY correctly ✓
- `CompetitorPayout[3]` replacing old M0 ✓
- Bonding curve in `tokensForAmount()` ✓

**Remaining issues:**

**1. `IdeaToken.earned()` has a debt accounting bug.** When `_updateDebt` is called before reading `earned()`, it sets `revenueDebt[account] = revenuePerTokenStored`, so `earned()` returns zero immediately after. The `claimRevenue()` flow calls `_updateDebt` then `earned()` — always returns 0. Fix:

```solidity
function claimRevenue() external returns (uint256 amount) {
    amount = earned(msg.sender);           // read FIRST
    require(amount > 0, "Nothing to claim");
    revenueDebt[msg.sender] = revenuePerTokenStored;  // update AFTER
    USDY.safeTransfer(msg.sender, amount);
}
// delete _updateDebt entirely
```

**2. `IIdeaToken` interface declares `mintBuilderAlloc(address builder, uint256 amount)` with two params, but `IdeaToken.mintBuilderAlloc()` only takes `address builder`.** This will cause a compile error when `FundingPool` calls it via the interface. Remove `uint256 amount` from the interface signature.

**3. `IdeaToken.notifyRevenue()` doesn't actually pull USDY in.** It updates `revenuePerTokenStored` but never calls `USDY.transferFrom`. So the accounting grows but there's no real balance to pay out from. The revenue source needs to either pre-transfer USDY to the token contract before calling, or the function should pull it:

```solidity
function notifyRevenue(uint256 amount) external {
    require(msg.sender == revenueSource, "Only revenue source");
    require(totalSupply() > 0, "No supply");
    USDY.safeTransferFrom(msg.sender, address(this), amount);
    revenuePerTokenStored += (amount * 1e18) / totalSupply();
}
```

**4. `BuilderAgreement._checkAndActivate()` calls `IIdeaToken.setRevenueSource()` via low-level `.call()` and ignores failure.** If the call silently fails (wrong interface, wrong caller), revenue will never be wired. Since `IdeaToken.setRevenueSource()` requires `msg.sender == factory`, and `BuilderAgreement` is not the factory, this will always fail silently. Fix: either pass `factory` address into `BuilderAgreement` and let factory wire it, or change `setRevenueSource` to accept calls from `buildingAgreement` address instead. The cleanest approach: factory stores the agreement contract address and exposes a `wireRevenueSource(uint256 ideaId, address source)` function callable only by the registered `BuilderAgreement`.

**5. `DAOVoting.delegatedHolders` array is unbounded and never cleaned up on revoke.** `_getTotalDelegatedPower()` iterates the full array each time — if someone delegates then revokes, they remain in the array and just get skipped (the `if (delegatedToAI[...])` check handles this). Fine for a hackathon, but at 1000+ delegators this becomes a DoS vector. Note it as a known limitation and add an off-chain keeper suggestion in the README.

**6. `FundingPool.deposit()` calls `IFundingGate.canFund()` twice** — once ignoring the result, once checking it. The first call is dead code. Remove it.

**7. `FundingPool.slashBuilder()` is still empty.** Since you're dropping builder stake, this function has no purpose now. Either remove it or repurpose it as `slashCompetitorPayout(uint256 slot)` — a DAO-callable function that cancels a competitor's unreleased payout if they abandon. That's the only "slashing" that makes sense without a stake.

---

### Builder stake → builder reputation: what changes in the contracts

Without stake, the only on-chain commitment from a builder is:

- Their wallet address signed in `BuilderAgreement`
- Their `builderAllocBps` tokens they'll receive (vested incentive)
- Their reputation recorded in `AgentIdentity` (AI scores their deliverables permanently)

That's actually cleaner. Remove `builderStake` from `BuilderAgreement.Agreement` entirely. The field is now just noise.

The accountability mechanism becomes: builder's token allocation is minted only after `BuilderAgreement` is fully signed AND `mintBuilderAlloc()` is called — and those tokens vest implicitly through milestones (if they abandon, the DAO can freeze future milestone releases via governance, and the builder's unreleased token alloc stays unminted). You don't need a slash — you just never mint what they haven't earned.

---

### The board room / CEO model — what this unlocks

This framing is genuinely strong and worth leaning into hard in the demo. The mental model you're building is:

> Token holders are shareholders. The idea is a startup. The builder is a founding team. The DAO board room is the board meeting.

The chat room + meeting scheduler in the frontend makes this tangible — investors can literally schedule a check-in with the builder, review progress, and vote on governance proposals from a dashboard that feels like a lightweight board portal. That's a UX that no other on-chain protocol has attempted seriously.

A few things that follow from this framing:

The `DAOVoting` proposals should have **typed proposal categories** that mirror real board decisions — not just free text. Something like `enum ProposalType { BUILDER_SELECTION, MILESTONE_OVERRIDE, REVENUE_SOURCE_UPDATE, BUILDER_REMOVAL, PARAMETER_CHANGE }`. Each type has different quorum requirements and different on-chain effects. A `MILESTONE_OVERRIDE` passes 24h after the AI flagged something for DAO review. A `BUILDER_REMOVAL` requires 60% supermajority and a 7-day cooling period. This makes governance feel like governance, not just on-chain polling.

The `AgentIdentity` decision log becomes your **company ledger** — every AI decision about that idea (scored the pitch, ranked builders, validated milestone 2 at 88% confidence) is permanently readable. On the `/agent` page you can show this as a timeline per idea, which looks exactly like a board's audit trail.

The board room chat is off-chain (just a real-time chat with meeting links), but you can anchor key decisions to chain — when the board agrees to something in the chat, someone creates a formal proposal in `DAOVoting`. That's the bridge between social coordination and trustless enforcement, which is the whole game in decentralized governance. plancheck and planv2 , plan