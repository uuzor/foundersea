// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IIdeaToken.sol";
import "./interfaces/IFundingGate.sol";

contract FundingPool is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // ============================================
    // STATE ENUMS
    // ============================================
    
    // Tranche state for continuous commitment model
    // GENESIS -> OPEN -> CLOSED (replaces soft-cap/hard-cap binary)
    enum TrancheState {
        GENESIS,  // Building started with creator deposit + protocol seed
        OPEN,     // Public deposits accepted, milestone proof events
        CLOSED    // Hard cap hit, governance vote, or builder completed final milestone
    }
    
    // Milestone status enum for clean state machine
    enum MilestoneStatus {
        PENDING,    // Created, awaiting submission
        SUBMITTED,  // Builder submitted, awaiting AI validation
        VALIDATED,  // AI validated, funds ready for release
        RELEASED,   // Funds released to builder
        DISPUTED    // Under dispute resolution
    }

    // ============================================
    // CORE STATE
    // ============================================
    
    IERC20 public fundingToken;
    address public ideaToken;
    address public gate;
    address public aiAgent;
    address public dao;
    address public builder;
    address public factory;
    
    TrancheState public trancheState;

    uint256 public hardCap;
    uint256 public raisedAmount;
    uint256 public competitionPrizeBps;
    
    bool public builderAssigned;
    
    // Genesis stake tracking
    uint256 public genesisAmount;        // Creator's deposit + protocol seed
    uint256 public genesisMintedTokens;  // Tokens minted to genesis depositors

    // AI trust model: tiered release thresholds
    uint256 public constant LARGE_RELEASE_THRESHOLD = 10_000e6; // $10k USDY - requires DAO + timelock
    uint256 public constant TIMELOCK_DURATION = 48 hours;
    
    mapping(uint256 => uint256) public timelockExpiry;   // Milestone index => expiry timestamp
    mapping(uint256 => bool) public daoApproved;          // Milestone index => DAO approval flag

    // ============================================
    // COMPETITOR & MILESTONE STRUCTURES
    // ============================================
    
    // Competitor payouts: top 3 builders from MVP competition
    struct CompetitorPayout {
        address builder;
        uint256 amount;
        bool released;
        uint256 aiConfidence;
        string validationIpfsHash;
    }
    
    CompetitorPayout[3] public competitorPayouts; // Exactly 3 slots
    bool public competitorsSet;
    
    // Development milestones
    struct Milestone {
        uint256 amount;
        uint256 deadline;
        MilestoneStatus status;
        uint256 aiConfidence;
        string validationIpfsHash;
    }

    Milestone[] public milestones;
    
    uint256 public constant COMPETITION_THRESHOLD = 60;
    
    // Refund tracking for tranche-aware model
    uint256 public lastValidatedMilestone;      // Index of last validated milestone (for refund cutoff)
    bool public builderAbandoned;               // Flag when builder is marked abandoned
    uint256 public openTrancheDeposits;         // Total deposits made during OPEN tranche

    // ============================================
    // EVENTS
    // ============================================
    
    event TrancheTransition(TrancheState from, TrancheState to);
    event Deposit(address indexed investor, uint256 amount, uint256 tokensMinted);
    event GenesisStake(address indexed depositor, uint256 amount, uint256 tokensMinted);
    event FundingClosed(bool raisedHardCap, uint256 totalRaised);
    event MilestoneReleased(uint256 index, uint256 amount);
    event MilestoneValidated(uint256 index, uint256 confidence);
    event CompetitorPayoutReleased(uint256 slot, address builder, uint256 amount);
    event BuilderAssigned(address indexed builder);
    event RefundProcessed(address indexed investor, uint256 amount, uint256 tokensBurned);
    event TimelockStarted(uint256 indexed index, uint256 expiry);
    event MilestoneDaoApproved(uint256 indexed index);

    modifier onlyAIAgent() {
        require(msg.sender == aiAgent, "Only AI agent");
        _;
    }

    constructor(
        address _fundingToken,
        address _gate,
        address _creator,
        uint256 _hardCap,
        uint256 _competitionPrizeBps,
        address _factory
    ) Ownable(_creator) {
        require(_fundingToken != address(0), "Invalid token");
        require(_hardCap > 0, "Invalid hard cap");
        fundingToken = IERC20(_fundingToken);
        gate = _gate;
        hardCap = _hardCap;
        competitionPrizeBps = _competitionPrizeBps;
        factory = _factory;
        trancheState = TrancheState.GENESIS; // Start in genesis state
    }

    // Update factory address and optionally transfer ownership (called by current factory or owner)
    function updateFactory(address _factory, address newOwner) external {
        require(msg.sender == factory || msg.sender == owner(), "Only factory or owner");
        require(_factory != address(0), "Invalid factory");
        factory = _factory;
        if (newOwner != address(0) && newOwner != owner()) {
            transferOwnership(newOwner);
        }
    }

    function setAiAgent(address _aiAgent) external onlyOwner {
        aiAgent = _aiAgent;
    }

    function setDao(address _dao) external onlyOwner {
        dao = _dao;
    }

    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory");
        _;
    }

    // Called by factory after IdeaToken is deployed
    function setIdeaToken(address _ideaToken) external onlyFactory {
        require(_ideaToken != address(0), "Invalid idea token");
        ideaToken = _ideaToken;
    }

    function getFundingToken() external view returns (address) {
        return address(fundingToken);
    }

    // ============================================
    // GENESIS STAKE & DEPOSITS
    // ============================================
    
    // Genesis stake: creator deposit + protocol seed, deploys immediately on AI approval
    // Unlocks Tranche 0, allows building to start without waiting for crowd
    function genesisStake(address depositor, uint256 amount) external onlyFactory nonReentrant {
        require(trancheState == TrancheState.GENESIS, "Not in genesis");
        require(amount > 0, "Invalid amount");
        
        fundingToken.safeTransferFrom(msg.sender, address(this), amount);
        raisedAmount += amount;
        genesisAmount += amount;
        
        // Calculate tokens at genesis price (1:1 for genesis to reward early commitment)
        uint256 tokensToMint = (amount * 1e6) / 1e6; // 1:1 ratio for genesis
        IIdeaToken(ideaToken).mint(depositor, tokensToMint);
        genesisMintedTokens += tokensToMint;
        
        emit GenesisStake(depositor, amount, tokensToMint);
    }
    
    // Record genesis stake without token transfer (for protocol treasury deposit already received)
    function recordGenesisStake(address depositor, uint256 amount) external onlyFactory {
        require(trancheState == TrancheState.GENESIS, "Not in genesis");
        require(amount > 0, "Invalid amount");
        
        raisedAmount += amount;
        genesisAmount += amount;
        
        // Calculate tokens at genesis price (1:1 for genesis)
        uint256 tokensToMint = (amount * 1e6) / 1e6; // 1:1 ratio for genesis
        IIdeaToken(ideaToken).mint(depositor, tokensToMint);
        genesisMintedTokens += tokensToMint;
    }
    
    // Public deposits only in OPEN tranche
    // Early investors get better rates via bonding curve
    function deposit(uint256 amount) external nonReentrant {
        require(trancheState == TrancheState.OPEN, "Not accepting deposits");
        require(raisedAmount + amount <= hardCap, "Exceeds hard cap");
        require(IFundingGate(gate).canFund(msg.sender), "Gate check failed");
        require(amount > 0, "Invalid amount");

        fundingToken.safeTransferFrom(msg.sender, address(this), amount);
        raisedAmount += amount;
        openTrancheDeposits += amount;

        // Calculate tokens with bonding curve (early investors get more tokens)
        uint256 tokensToMint = tokensForAmount(amount);
        IIdeaToken(ideaToken).mint(msg.sender, tokensToMint);
        
        emit Deposit(msg.sender, amount, tokensToMint);
        
        // Auto-close if hard cap reached
        if (raisedAmount >= hardCap) {
            _closeFunding(true);
        }
    }

    // Linear bonding curve: price increases from base to 2x as pool fills
    // Applies during OPEN tranche only - rewards early investors who bet on execution
    function tokensForAmount(uint256 amount) public view returns (uint256) {
        if (hardCap == 0) return 0;
        
        uint256 basePrice = 1e6;
        // price = basePrice * (1 + raisedAmount / hardCap), capped at 2x
        uint256 price = basePrice * (hardCap + raisedAmount) / hardCap;
        if (price > 2 * basePrice) price = 2 * basePrice;
        
        return (amount * 1e6) / price;
    }
    
    // ============================================
    // TRANCHE TRANSITIONS
    // ============================================
    
    // Transition to OPEN: called by AI when first milestone is released
    // This signals the market that building has started and proof events are live
    function transitionToOpen() external onlyFactory {
        require(trancheState == TrancheState.GENESIS, "Not in genesis");
        trancheState = TrancheState.OPEN;
        emit TrancheTransition(TrancheState.GENESIS, TrancheState.OPEN);
    }
    
    // Close funding: hard cap hit, governance vote, or final milestone complete
    function closeFunding() external onlyOwner {
        require(trancheState == TrancheState.OPEN, "Not open");
        _closeFunding(raisedAmount >= hardCap);
    }
    
    function _closeFunding(bool raisedHardCap) internal {
        trancheState = TrancheState.CLOSED;
        emit FundingClosed(raisedHardCap, raisedAmount);
    }
    
    // Get tranche state as uint8 for external reading
    function getTrancheState() external view returns (uint8) {
        return uint8(trancheState);
    }

    // Set top 3 competitors after funding is OPEN or CLOSED
    // amounts should sum to competitionPrizeBps portion of raised
    function setCompetitorPayouts(
        address[3] calldata _builders,
        uint256[3] calldata _amounts
    ) external onlyOwner {
        require(trancheState != TrancheState.GENESIS, "Still in genesis");
        require(!competitorsSet, "Competitors already set");
        
        competitorsSet = true;
        for (uint256 i = 0; i < 3; i++) {
            competitorPayouts[i].builder = _builders[i];
            competitorPayouts[i].amount = _amounts[i];
            competitorPayouts[i].released = false;
        }
    }

    // AI validates competitor's MVP
    function validateCompetitor(
        uint256 slot,
        uint256 confidence,
        string calldata ipfsHash
    ) external onlyAIAgent {
        require(slot < 3, "Invalid slot");
        CompetitorPayout storage p = competitorPayouts[slot];
        require(p.builder != address(0), "Competitor not set");
        p.aiConfidence = confidence;
        p.validationIpfsHash = ipfsHash;
    }

    // AI releases payout when MVP validated above threshold
    function releaseCompetitorPayout(uint256 slot) external onlyAIAgent {
        require(slot < 3, "Invalid slot");
        CompetitorPayout storage p = competitorPayouts[slot];
        require(p.aiConfidence >= COMPETITION_THRESHOLD, "Threshold not met");
        require(!p.released, "Already released");
        
        p.released = true;
        fundingToken.safeTransfer(p.builder, p.amount);
        emit CompetitorPayoutReleased(slot, p.builder, p.amount);
    }

    function assignBuilder(address _builder, uint256[] memory milestoneAmounts, uint256[] memory milestoneDeadlines) 
        external onlyOwner {
        require(!builderAssigned, "Builder already assigned");
        builder = _builder;
        builderAssigned = true;
        
        // Add development milestones
        for (uint256 i = 0; i < milestoneAmounts.length; i++) {
            milestones.push(Milestone({
                amount: milestoneAmounts[i],
                deadline: milestoneDeadlines[i],
                status: MilestoneStatus.PENDING,
                aiConfidence: 0,
                validationIpfsHash: ""
            }));
        }
        
        emit BuilderAssigned(_builder);
    }

    // AI agent calls this after milestone validation passes
    // Large releases require DAO approval + 48h timelock for security
    function releaseMilestone(uint256 index) external onlyAIAgent nonReentrant {
        Milestone storage m = milestones[index];
        require(m.status == MilestoneStatus.VALIDATED && m.aiConfidence >= 75, "Not validated or low confidence");
        require(builder != address(0), "No builder");
        
        // Large releases (≥ $10k USDY) require DAO approval + timelock
        if (m.amount >= LARGE_RELEASE_THRESHOLD) {
            require(daoApproved[index], "DAO approval required");
            require(timelockExpiry[index] > 0 && block.timestamp >= timelockExpiry[index], "Timelock active");
        }
        
        m.status = MilestoneStatus.RELEASED;
        fundingToken.safeTransfer(builder, m.amount);
        emit MilestoneReleased(index, m.amount);
    }

    // DAO can override — release manually after review
    function daoReleaseMilestone(uint256 index) external {
        require(msg.sender == dao, "Only DAO");
        Milestone storage m = milestones[index];
        require(m.status == MilestoneStatus.VALIDATED, "Not validated");
        m.status = MilestoneStatus.RELEASED;
        fundingToken.safeTransfer(builder, m.amount);
        emit MilestoneReleased(index, m.amount);
    }
    
    // DAO approves large milestone release and starts timelock
    // Called by AI agent after validation to trigger the timelock process
    function startTimelock(uint256 index) external onlyAIAgent {
        require(index < milestones.length, "Invalid index");
        require(milestones[index].amount >= LARGE_RELEASE_THRESHOLD, "Below threshold");
        require(timelockExpiry[index] == 0, "Timelock already started");
        timelockExpiry[index] = block.timestamp + TIMELOCK_DURATION;
        emit TimelockStarted(index, timelockExpiry[index]);
    }
    
    // DAO approves large milestone release (required before timelock expires)
    function daoApproveMilestone(uint256 index) external {
        require(msg.sender == dao, "Only DAO");
        require(index < milestones.length, "Invalid index");
        require(milestones[index].amount >= LARGE_RELEASE_THRESHOLD, "Below threshold");
        daoApproved[index] = true;
        emit MilestoneDaoApproved(index);
    }

    // DAO can slash competitor payout if they abandon
    function slashCompetitorPayout(uint256 slot) external {
        require(msg.sender == dao, "Only DAO");
        require(slot < 3, "Invalid slot");
        require(!competitorPayouts[slot].released, "Already released");
        // Mark as slashed - amount will be redistributed or returned to pool
        competitorPayouts[slot].amount = 0;
    }

    function setMilestoneValidated(
        uint256 index,
        uint256 confidence,
        string calldata ipfsHash
    ) external onlyAIAgent {
        require(index < milestones.length, "Invalid index");
        Milestone storage m = milestones[index];
        m.status = confidence >= 50 ? MilestoneStatus.VALIDATED : MilestoneStatus.SUBMITTED;
        m.aiConfidence = confidence;
        m.validationIpfsHash = ipfsHash;
        emit MilestoneValidated(index, confidence);
    }
    
    // Mark milestone as submitted (builder calls this when they complete work)
    function submitMilestone(uint256 index) external {
        require(msg.sender == builder, "Only builder");
        require(index < milestones.length, "Invalid index");
        Milestone storage m = milestones[index];
        require(m.status == MilestoneStatus.PENDING, "Not pending");
        m.status = MilestoneStatus.SUBMITTED;
    }
    
    // Get milestone status as enum value
    function getMilestoneStatus(uint256 index) external view returns (MilestoneStatus) {
        require(index < milestones.length, "Invalid index");
        return milestones[index].status;
    }

    // ============================================
    // REFUNDS (Tranche-aware)
    // ============================================
    
    // Tranche-aware refund: only deposits made after last validated milestone
    // are eligible for refund if builder abandons
    // Genesis depositors took risk, they don't get bailed out
    function refund() external {
        require(builderAbandoned, "Builder not abandoned");
        require(trancheState == TrancheState.CLOSED, "Not closed");
        
        uint256 balance = IIdeaToken(ideaToken).balanceOf(msg.sender);
        require(balance > 0, "No tokens");
        
        uint256 currentSupply = IIdeaToken(ideaToken).totalSupply();
        require(currentSupply > 0, "No supply");
        
        // Calculate refund proportionally from OPEN tranche deposits
        // Only deposits made AFTER the last validated milestone get refunded
        uint256 refundAmount = (balance * openTrancheDeposits) / currentSupply;
        require(refundAmount > 0, "No refund due");
        
        // Burn tokens
        IIdeaToken(ideaToken).burn(msg.sender, balance);
        
        // Send refund
        fundingToken.safeTransfer(msg.sender, refundAmount);
        
        emit RefundProcessed(msg.sender, refundAmount, balance);
    }
    
    // Mark builder as abandoned (called by DAO or factory after timeout)
    function markAbandoned() external {
        require(msg.sender == dao || msg.sender == factory, "Not authorized");
        require(!builderAbandoned, "Already marked");
        require(builderAssigned, "No builder assigned");
        builderAbandoned = true;
        _closeFunding(false);
    }
    
    // Record last validated milestone (called when milestone validated)
    function recordValidatedMilestone(uint256 index) external onlyFactory {
        lastValidatedMilestone = index;
    }

    function addMilestones(uint256[] memory amounts, uint256[] memory deadlines) external onlyOwner {
        require(amounts.length == deadlines.length, "Length mismatch");
        for (uint256 i = 0; i < amounts.length; i++) {
            milestones.push(Milestone({
                amount: amounts[i],
                deadline: deadlines[i],
                status: MilestoneStatus.PENDING,
                aiConfidence: 0,
                validationIpfsHash: ""
            }));
        }
    }

    function getMilestoneCount() external view returns (uint256) {
        return milestones.length;
    }
}