// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./interfaces/IFundingPoolFactory.sol";
import "./interfaces/IFundingPool.sol";
import "./interfaces/IIdeaTokenFactory.sol";
import "./interfaces/IIdeaToken.sol";
import "./FundingPool.sol";
import "./FundingGate.sol";
import {GateType as FactoryGateType, GateType} from "./FundingGate.sol";

contract IdeaFactory is Ownable {
    using SafeERC20 for IERC20;
    using Strings for uint256;
    
    // ============================================
    // STATUS ENUMS
    // ============================================
    
    enum IdeaStatus {
        PENDING,      // Just created, awaiting AI review
        APPROVED,     // AI approved, genesis stake can deploy, building starts
        REJECTED,     // AI rejected
        ABANDONED,    // Creator abandoned
        ACTIVE,       // Builder assigned, in development
        COMPLETED,    // All milestones done
        FAILED        // Builder abandoned or other failure
    }

    // ============================================
    // CORE STATE
    // ============================================
    
    IERC20 public immutable USDY;
    uint256 public constant MIN_CREATOR_DEPOSIT = 500e6; // $500 USDY - genesis stake
    uint256 public constant PROTOCOL_SEED_AMOUNT = 1000e6; // $1000 USDY - protocol seed per idea
    uint256 public constant ABANDONMENT_FEE_BPS = 1000; // 10% kept on abandon
    
    address public aiAgent;
    address public treasury;
    address public agentIdentity;
    IFundingPoolFactory public fundingPoolFactory;
    IIdeaTokenFactory public ideaTokenFactory;
    
    // Idea configuration (continuous commitment model - no soft cap)
    struct IdeaConfig {
        string metadataIpfsHash;     // title, description, roadmap, category
        uint256 hardCap;            // Upper bound for fundraising
        uint256 competitionPrizeBps; // % of raise reserved as competition prize
        uint256 builderAllocBps;     // % of IdeaToken supply to winning builder
        FactoryGateType gateType;
        bytes gateParams;
    }

    struct Idea {
        address creator;
        address ideaToken;
        address fundingPool;
        address fundingGate;
        IdeaStatus status;
        uint256 aiScore;
        string approvalReasonHash;
        IdeaConfig config;
    }

    mapping(uint256 => Idea) public ideas;
    mapping(uint256 => address) public ideaTokens;
    mapping(uint256 => address) public fundingPools;
    mapping(uint256 => address) public builderAgreements;
    mapping(uint256 => bool) public aiApproved;
    mapping(address => uint256[]) public creatorIdeas;
    
    uint256 public nextIdeaId;
    
    // ============================================
    // EVENTS
    // ============================================
    
    event IdeaCreated(uint256 indexed ideaId, address creator, address ideaToken, address fundingPool);
    event IdeaApprovedByAI(uint256 indexed ideaId, uint256 score);
    event IdeaRejectedByAI(uint256 indexed ideaId, string reasonIpfsHash);
    event IdeaAbandoned(uint256 indexed ideaId, uint256 refundAmount);
    event FundingPoolConfigured(uint256 indexed ideaId, address fundingPool);
    event RevenueSourceWired(uint256 indexed ideaId, address revenueSource);
    event GenesisStakeDeployed(uint256 indexed ideaId, uint256 creatorDeposit, uint256 protocolSeed);
    event TransitionedToActive(uint256 indexed ideaId);

    constructor(
        address _usdy, 
        address _treasury, 
        address _owner
    ) Ownable(_owner) {
        require(_usdy != address(0), "Invalid USDY");
        USDY = IERC20(_usdy);
        treasury = _treasury != address(0) ? _treasury : _owner;
    }

    function setTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
    }

    function setAiAgent(address _aiAgent) external onlyOwner {
        aiAgent = _aiAgent;
    }

    function setAgentIdentity(address _agentIdentity) external onlyOwner {
        agentIdentity = _agentIdentity;
    }
    
    modifier onlyAIAgent() {
        require(msg.sender == aiAgent, "Only AI agent");
        _;
    }

    function setFactories(address _fundingPoolFactory, address _ideaTokenFactory) external onlyOwner {
        fundingPoolFactory = IFundingPoolFactory(_fundingPoolFactory);
        ideaTokenFactory = IIdeaTokenFactory(_ideaTokenFactory);
    }

    function createIdea(IdeaConfig calldata config) external returns (uint256 ideaId) {
        require(config.hardCap > 0, "Invalid hard cap");
        require(config.builderAllocBps >= 1000 && config.builderAllocBps <= 30000, "Invalid builder alloc");
        require(config.competitionPrizeBps <= 5000, "Invalid competition prize");
        
        // Transfer minimum deposit (creator's genesis stake)
        USDY.safeTransferFrom(msg.sender, address(this), MIN_CREATOR_DEPOSIT);

        ideaId = nextIdeaId++;

        // Deploy FundingPool and FundingGate via factory (no soft cap)
        (address fundingPool, address fundingGate) = _deployFundingPool(
            ideaId, 
            config.hardCap, 
            config.competitionPrizeBps,
            config.gateType,
            config.gateParams
        );

        // Deploy IdeaToken via factory
        address ideaToken = _deployIdeaToken(ideaId, fundingPool, msg.sender, config.builderAllocBps);

        // Wire FundingPool to IdeaToken
        FundingPool(fundingPool).setIdeaToken(ideaToken);

        // Create the idea
        ideas[ideaId] = Idea({
            creator: msg.sender,
            ideaToken: ideaToken,
            fundingPool: fundingPool,
            fundingGate: fundingGate,
            status: IdeaStatus.PENDING,
            aiScore: 0,
            approvalReasonHash: "",
            config: config
        });

        ideaTokens[ideaId] = ideaToken;
        fundingPools[ideaId] = fundingPool;
        creatorIdeas[msg.sender].push(ideaId);

        emit IdeaCreated(ideaId, msg.sender, ideaToken, fundingPool);
        emit FundingPoolConfigured(ideaId, fundingPool);
    }

    function _deployFundingPool(
        uint256 ideaId,
        uint256 hardCap,
        uint256 competitionPrizeBps,
        FactoryGateType gateType,
        bytes memory gateParams
    ) internal returns (address fundingPool, address fundingGate) {
        (address fp, address fg) = fundingPoolFactory.createFundingPool(
            ideaId,
            address(USDY),
            msg.sender,
            hardCap,
            competitionPrizeBps,
            treasury,
            address(this)
        );
        
        if (gateType != FactoryGateType.OPEN) {
            FundingGate(fg).setGateType(GateType(gateType), gateParams);
        }
        
        return (fp, fg);
    }

    function _deployIdeaToken(
        uint256 ideaId,
        address fundingPool,
        address creator,
        uint256 builderAllocBps
    ) internal returns (address) {
        return ideaTokenFactory.createIdeaToken(
            ideaId,
            fundingPool,
            creator,
            builderAllocBps,
            address(this),
            address(USDY)
        );
    }

    // Called by AI agent after scoring. If approved, deploy genesis stake + transition to active.
    // Building starts immediately - no waiting for crowd raise
    function aiApproveIdea(uint256 ideaId, uint256 score, string calldata reasonHash)
        external {
        require(msg.sender == aiAgent, "Only AI agent");
        require(ideas[ideaId].status == IdeaStatus.PENDING, "Not pending");
        require(score >= 50, "Score too low"); // Minimum score threshold
        
        ideas[ideaId].status = IdeaStatus.APPROVED;
        ideas[ideaId].aiScore = score;
        ideas[ideaId].approvalReasonHash = reasonHash;
        aiApproved[ideaId] = true;
        
        // Deploy genesis stake: creator deposit + protocol seed
        // Building starts immediately on AI approval
        _deployGenesisStake(ideaId);
        
        emit IdeaApprovedByAI(ideaId, score);
    }
    
    // Deploy genesis stake: creator's $500 + protocol's $1000 = $1500 for first milestone
    function _deployGenesisStake(uint256 ideaId) internal {
        Idea storage idea = ideas[ideaId];
        address fundingPool = idea.fundingPool;
        
        // Transfer protocol seed from treasury to funding pool
        USDY.safeTransferFrom(treasury, fundingPool, PROTOCOL_SEED_AMOUNT);
        
        // Approve funding pool to pull creator's deposit from factory
        USDY.approve(fundingPool, MIN_CREATOR_DEPOSIT);
        
        // Call genesis stake on funding pool for creator's deposit
        IFundingPool(fundingPool).genesisStake(idea.creator, MIN_CREATOR_DEPOSIT);
        
        // Note: The treasury deposit was already transferred to funding pool in step 1
        // The funding pool's genesisStake already tracks the raised amount correctly
        // We just need to record the treasury's share as genesis stake
        IFundingPool(fundingPool).recordGenesisStake(treasury, PROTOCOL_SEED_AMOUNT);
        
        emit GenesisStakeDeployed(ideaId, MIN_CREATOR_DEPOSIT, PROTOCOL_SEED_AMOUNT);
    }

    function aiRejectIdea(uint256 ideaId, string calldata reasonHash) external {
        require(msg.sender == aiAgent, "Only AI agent");
        require(ideas[ideaId].status == IdeaStatus.PENDING, "Not pending");
        
        ideas[ideaId].status = IdeaStatus.REJECTED;
        
        // Refund 90% to creator, 10% to treasury
        uint256 refundAmount = (MIN_CREATOR_DEPOSIT * (10000 - ABANDONMENT_FEE_BPS)) / 10000;
        USDY.safeTransfer(ideas[ideaId].creator, refundAmount);
        USDY.safeTransfer(treasury, MIN_CREATOR_DEPOSIT - refundAmount);
        
        emit IdeaRejectedByAI(ideaId, reasonHash);
    }

    function abandonIdea(uint256 ideaId) external {
        require(ideas[ideaId].creator == msg.sender, "Not creator");
        require(ideas[ideaId].status == IdeaStatus.PENDING, "Not pending");
        
        ideas[ideaId].status = IdeaStatus.ABANDONED;
        
        // Same refund logic: 90% back, 10% fee
        uint256 refundAmount = (MIN_CREATOR_DEPOSIT * (10000 - ABANDONMENT_FEE_BPS)) / 10000;
        USDY.safeTransfer(msg.sender, refundAmount);
        USDY.safeTransfer(treasury, MIN_CREATOR_DEPOSIT - refundAmount);
        
        emit IdeaAbandoned(ideaId, refundAmount);
    }
    
    // Update status - simplified for continuous commitment model
    function updateIdeaStatus(uint256 ideaId, IdeaStatus newStatus) external onlyOwner {
        IdeaStatus current = ideas[ideaId].status;
        
        // Validate transitions
        if (newStatus == IdeaStatus.ACTIVE) {
            require(current == IdeaStatus.APPROVED, "Must be approved first");
        } else if (newStatus == IdeaStatus.COMPLETED) {
            require(current == IdeaStatus.ACTIVE, "Must be active first");
        } else if (newStatus == IdeaStatus.FAILED) {
            require(current == IdeaStatus.ACTIVE, "Must be active first");
        }
        
        ideas[ideaId].status = newStatus;
        if (newStatus == IdeaStatus.ACTIVE) {
            emit TransitionedToActive(ideaId);
        }
    }
    
    // Called by AI agent to transition approved idea to ACTIVE (after builder assigned)
    function transitionToActive(uint256 ideaId) external onlyAIAgent {
        require(ideas[ideaId].status == IdeaStatus.APPROVED, "Not approved");
        
        ideas[ideaId].status = IdeaStatus.ACTIVE;
        
        // Transition funding pool to OPEN (from GENESIS)
        IFundingPool(ideas[ideaId].fundingPool).transitionToOpen();
        
        emit TransitionedToActive(ideaId);
    }
    
    function getIdeaStatus(uint256 ideaId) external view returns (IdeaStatus) {
        return ideas[ideaId].status;
    }

    function isIdeaApproved(uint256 ideaId) external view returns (bool) {
        return aiApproved[ideaId];
    }

    function getIdea(uint256 ideaId) external view returns (
        address creator,
        address ideaToken,
        address fundingPool,
        address fundingGate,
        IdeaStatus status,
        uint256 aiScore,
        string memory approvalReasonHash
    ) {
        Idea storage idea = ideas[ideaId];
        return (
            idea.creator,
            idea.ideaToken,
            idea.fundingPool,
            idea.fundingGate,
            idea.status,
            idea.aiScore,
            idea.approvalReasonHash
        );
    }

    function getCreatorIdeas(address creator) external view returns (uint256[] memory) {
        return creatorIdeas[creator];
    }

    // Called by BuilderAgreement after all parties sign
    // This wires the revenue source into IdeaToken (only callable by registered agreement)
    function wireRevenueSource(uint256 ideaId, address revenueSource) external {
        require(msg.sender == builderAgreements[ideaId], "Only registered agreement");
        require(ideas[ideaId].ideaToken != address(0), "Idea not created");
        
        IIdeaToken(ideas[ideaId].ideaToken).setRevenueSource(revenueSource);
        emit RevenueSourceWired(ideaId, revenueSource);
    }

    // Register a builder agreement for an idea
    function registerBuilderAgreement(uint256 ideaId, address agreement) external {
        require(ideas[ideaId].creator == msg.sender, "Not creator");
        require(builderAgreements[ideaId] == address(0), "Already registered");
        builderAgreements[ideaId] = agreement;
    }
}