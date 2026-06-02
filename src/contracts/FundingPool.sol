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
    uint256 public tokenPrice; // tokens per 1e6 of funding token (USDY has 6 decimals)
    
    bool public fundingClosed;
    bool public builderAssigned;

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
    
    event Deposit(address indexed investor, uint256 amount, uint256 tokensMinted);
    event FundingClosed(bool softCapMet);
    event MilestoneReleased(uint256 index, uint256 amount);
    event MilestoneValidated(uint256 index, uint256 confidence);
    event BuilderAssigned(address indexed builder);

    modifier onlyAIAgent() {
        require(msg.sender == aiAgent, "Only AI agent");
        _;
    }

    constructor(
        address _fundingToken,
        address _ideaToken,
        address _gate,
        address _creator,
        uint256 _softCap,
        uint256 _hardCap,
        uint256 _competitionPrizeBps,
        address _factory
    ) Ownable(_creator) {
        require(_fundingToken != address(0), "Invalid token");
        require(_ideaToken != address(0), "Invalid idea token");
        fundingToken = IERC20(_fundingToken);
        ideaToken = _ideaToken;
        gate = _gate;
        softCap = _softCap;
        hardCap = _hardCap;
        competitionPrizeBps = _competitionPrizeBps;
        factory = _factory;
        tokenPrice = 1e6; // 1:1 initially
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
            // Create Milestone 0 (competition prize)
            uint256 prizeAmount = (raisedAmount * competitionPrizeBps) / 10000;
            milestones.push(Milestone({
                amount: prizeAmount,
                deadline: block.timestamp + 30 days,
                released: false,
                aiValidated: false,
                aiConfidence: 0,
                validationIpfsHash: ""
            }));
        }
        
        emit FundingClosed(metSoftCap);
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