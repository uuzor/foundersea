// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IIdeaToken.sol";
import "./interfaces/IFundingGate.sol";

contract FundingPool is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public fundingToken;
    address public ideaToken;
    address public gate;
    address public aiAgent;
    address public dao;
    address public builder;
    address public factory;

    uint256 public softCap;
    uint256 public hardCap;
    uint256 public raisedAmount;
    uint256 public competitionPrizeBps;
    
    bool public fundingClosed;
    bool public builderAssigned;

    // Competitor payouts: top 3 builders from MVP competition
    // Released when AI validates their MVPs above competition threshold
    struct CompetitorPayout {
        address builder;
        uint256 amount;
        bool released;
        uint256 aiConfidence;
        string validationIpfsHash;
    }
    
    CompetitorPayout[3] public competitorPayouts; // Exactly 3 slots
    bool public competitorsSet;
    
    // Development milestones (index 0 onwards, after winner selected)
    struct Milestone {
        uint256 amount;
        uint256 deadline;
        bool released;
        bool aiValidated;
        uint256 aiConfidence;
        string validationIpfsHash;
    }

    Milestone[] public milestones;
    
    uint256 public constant COMPETITION_THRESHOLD = 60;
    
    event Deposit(address indexed investor, uint256 amount, uint256 tokensMinted);
    event FundingClosed(bool softCapMet);
    event MilestoneReleased(uint256 index, uint256 amount);
    event MilestoneValidated(uint256 index, uint256 confidence);
    event CompetitorPayoutReleased(uint256 slot, address builder, uint256 amount);
    event BuilderAssigned(address indexed builder);

    modifier onlyAIAgent() {
        require(msg.sender == aiAgent, "Only AI agent");
        _;
    }

    constructor(
        address _fundingToken,
        address _gate,
        address _creator,
        uint256 _softCap,
        uint256 _hardCap,
        uint256 _competitionPrizeBps,
        address _factory
    ) Ownable(_creator) {
        require(_fundingToken != address(0), "Invalid token");
        fundingToken = IERC20(_fundingToken);
        gate = _gate;
        softCap = _softCap;
        hardCap = _hardCap;
        competitionPrizeBps = _competitionPrizeBps;
        factory = _factory;
    }

    function setAiAgent(address _aiAgent) external onlyOwner {
        aiAgent = _aiAgent;
    }

    function setDao(address _dao) external onlyOwner {
        dao = _dao;
    }

    // Called by factory after IdeaToken is deployed
    function setIdeaToken(address _ideaToken) external onlyOwner {
        require(_ideaToken != address(0), "Invalid idea token");
        ideaToken = _ideaToken;
    }

    function getFundingToken() external view returns (address) {
        return address(fundingToken);
    }

    // Funding round
    function deposit(uint256 amount) external {
        require(!fundingClosed, "Funding closed");
        require(raisedAmount + amount <= hardCap, "Exceeds hard cap");
        
        IFundingGate(gate).canFund(msg.sender);
        require(IFundingGate(gate).canFund(msg.sender), "Gate check failed");

        fundingToken.safeTransferFrom(msg.sender, address(this), amount);
        raisedAmount += amount;

        // Calculate tokens with bonding curve (early investors get more tokens)
        uint256 tokensToMint = tokensForAmount(amount);
        IIdeaToken(ideaToken).mint(msg.sender, tokensToMint);
        
        emit Deposit(msg.sender, amount, tokensToMint);
    }

    // Linear bonding curve: price increases from base to 2x as pool fills
    // Early investors pay less, taking more risk - aligns with RWA thesis
    function tokensForAmount(uint256 amount) public view returns (uint256) {
        if (hardCap == 0) return 0;
        
        uint256 basePrice = 1e6;
        // price = basePrice * (1 + raisedAmount / hardCap), capped at 2x
        uint256 price = basePrice * (hardCap + raisedAmount) / hardCap;
        if (price > 2 * basePrice) price = 2 * basePrice;
        
        return (amount * 1e6) / price;
    }

    function closeFunding() external onlyOwner {
        require(!fundingClosed, "Already closed");
        fundingClosed = true;
        
        bool metSoftCap = raisedAmount >= softCap;
        
        if (metSoftCap) {
            // Competition allocation is carved out, distributed to top 3 later
            // No milestone[0] created here - competitors are set separately
            emit FundingClosed(true);
        } else {
            emit FundingClosed(false);
        }
    }

    // Set top 3 competitors after funding closes
    // amounts should sum to competitionPrizeBps portion of raised
    function setCompetitorPayouts(
        address[3] calldata _builders,
        uint256[3] calldata _amounts
    ) external onlyOwner {
        require(fundingClosed, "Funding not closed");
        require(!competitorsSet, "Competitors already set");
        require(raisedAmount >= softCap, "Soft cap not met");
        
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

    function checkSoftCapMet() public view returns (bool) {
        return raisedAmount >= softCap;
    }

    function assignBuilder(address _builder, uint256[] memory milestoneAmounts, uint256[] memory milestoneDeadlines) 
        external onlyOwner {
        require(!builderAssigned, "Builder already assigned");
        builder = _builder;
        builderAssigned = true;
        
        // Add development milestones (starting from index 1, index 0 is competition prize)
        for (uint256 i = 0; i < milestoneAmounts.length; i++) {
            milestones.push(Milestone({
                amount: milestoneAmounts[i],
                deadline: milestoneDeadlines[i],
                released: false,
                aiValidated: false,
                aiConfidence: 0,
                validationIpfsHash: ""
            }));
        }
        
        emit BuilderAssigned(_builder);
    }

    // AI agent calls this after milestone validation passes
    function releaseMilestone(uint256 index) external onlyAIAgent {
        Milestone storage m = milestones[index];
        require(m.aiValidated && m.aiConfidence >= 75 && !m.released, "Validation not passed");
        require(builder != address(0), "No builder");
        m.released = true;
        fundingToken.safeTransfer(builder, m.amount);
        emit MilestoneReleased(index, m.amount);
    }

    // DAO can override — release manually after review
    function daoReleaseMilestone(uint256 index) external {
        require(msg.sender == dao, "Only DAO");
        Milestone storage m = milestones[index];
        require(!m.released, "Already released");
        m.released = true;
        fundingToken.safeTransfer(builder, m.amount);
        emit MilestoneReleased(index, m.amount);
    }

    // DAO can slash builder stake on repeated failures
    function slashBuilder(uint256 amount) external {
        require(msg.sender == dao, "Only DAO");
        // Implementation depends on builder stake mechanism
    }

    function setMilestoneValidated(
        uint256 index,
        uint256 confidence,
        string calldata ipfsHash
    ) external onlyAIAgent {
        require(index < milestones.length, "Invalid index");
        milestones[index].aiValidated = confidence >= 50;
        milestones[index].aiConfidence = confidence;
        milestones[index].validationIpfsHash = ipfsHash;
        emit MilestoneValidated(index, confidence);
    }

    // Refund if soft cap not met
    function refund() external {
        require(fundingClosed, "Funding not closed");
        require(!checkSoftCapMet(), "Soft cap met");
        
        uint256 balance = IIdeaToken(ideaToken).balanceOf(msg.sender);
        require(balance > 0, "No tokens");
        
        // Snapshot supply before burning
        uint256 currentSupply = IIdeaToken(ideaToken).totalSupply();
        
        // Burn user's tokens
        IIdeaToken(ideaToken).burn(msg.sender, balance);
        
        // Calculate refund proportionally
        uint256 refundAmount = balance * raisedAmount / currentSupply;
        fundingToken.safeTransfer(msg.sender, refundAmount);
    }

    function addMilestones(uint256[] memory amounts, uint256[] memory deadlines) external onlyOwner {
        require(amounts.length == deadlines.length, "Length mismatch");
        for (uint256 i = 0; i < amounts.length; i++) {
            milestones.push(Milestone({
                amount: amounts[i],
                deadline: deadlines[i],
                released: false,
                aiValidated: false,
                aiConfidence: 0,
                validationIpfsHash: ""
            }));
        }
    }

    function getMilestoneCount() external view returns (uint256) {
        return milestones.length;
    }
}