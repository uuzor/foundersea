// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./IdeaToken.sol";
import "./FundingGate.sol";
import "./FundingPool.sol";
import "./interfaces/IIdeaToken.sol";
import {GateType as FactoryGateType} from "./FundingGate.sol";

contract IdeaFactory is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable USDY;
    uint256 public constant MIN_CREATOR_DEPOSIT = 500e6; // $500 USDY
    uint256 public constant ABANDONMENT_FEE_BPS = 1000; // 10% kept on abandon
    address public aiAgent;
    address public treasury;
    address public agentIdentity;

    // Token name and symbol prefix
    string public constant TOKEN_NAME_PREFIX = "FounderSea Idea ";
    string public constant TOKEN_SYMBOL_PREFIX = "FSID-";

    struct IdeaConfig {
        string metadataIpfsHash;     // title, description, roadmap, category
        uint256 targetRaise;
        uint256 softCap;
        uint256 hardCap;
        uint256 fundingDeadline;
        uint256 competitionPrizeBps; // % of raise reserved as competition prize (Milestone 0)
        uint256 builderAllocBps;     // % of IdeaToken supply to winning builder
        FactoryGateType gateType;
        bytes gateParams;
    }

    struct Idea {
        address creator;
        address ideaToken;
        address fundingPool;
        address fundingGate;
        bool aiApproved;
        uint256 aiScore;
        string approvalReasonHash;
        bool rejected;
        bool abandoned;
        IdeaConfig config;
    }

    mapping(uint256 => Idea) public ideas;
    mapping(uint256 => address) public ideaTokens;
    mapping(uint256 => address) public fundingPools;
    mapping(uint256 => address) public builderAgreements;
    mapping(uint256 => bool) public aiApproved;
    mapping(address => uint256[]) public creatorIdeas;
    
    uint256 public nextIdeaId;
    
    event IdeaCreated(uint256 indexed ideaId, address creator, address ideaToken, address fundingPool);
    event IdeaApprovedByAI(uint256 indexed ideaId, uint256 score);
    event IdeaRejectedByAI(uint256 indexed ideaId, string reasonIpfsHash);
    event IdeaAbandoned(uint256 indexed ideaId, uint256 refundAmount);
    event FundingPoolConfigured(uint256 indexed ideaId, address fundingPool);
    event RevenueSourceWired(uint256 indexed ideaId, address revenueSource);

    constructor(address _usdy, address _treasury, address _owner) Ownable(_owner) {
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

    function createIdea(IdeaConfig calldata config) external returns (uint256 ideaId) {
        require(config.softCap <= config.hardCap, "Invalid caps");
        require(config.targetRaise >= config.softCap, "Invalid target");
        require(config.builderAllocBps >= 1000 && config.builderAllocBps <= 30000, "Invalid builder alloc");
        require(config.competitionPrizeBps <= 5000, "Invalid competition prize");
        
        // Transfer minimum deposit
        USDY.safeTransferFrom(msg.sender, address(this), MIN_CREATOR_DEPOSIT);

        ideaId = nextIdeaId++;
        
        // Generate token name and symbol
        string memory tokenName = string(abi.encodePacked(TOKEN_NAME_PREFIX, _toString(ideaId)));
        string memory tokenSymbol = string(abi.encodePacked(TOKEN_SYMBOL_PREFIX, _toString(ideaId)));

        // Deploy FundingGate
        FundingGate fundingGate = new FundingGate(msg.sender, address(this));
        if (config.gateType != FactoryGateType.OPEN) {
            fundingGate.setGateType(GateType(config.gateType), config.gateParams);
        }

        // Deploy FundingPool
        FundingPool fundingPool = new FundingPool(
            address(USDY),
            address(fundingGate),
            msg.sender,
            config.softCap,
            config.hardCap,
            config.competitionPrizeBps,
            address(this)
        );

        // Deploy IdeaToken
        IdeaToken ideaToken = new IdeaToken(
            tokenName,
            tokenSymbol,
            address(fundingPool),
            msg.sender,
            config.builderAllocBps,
            address(this),
            address(USDY)
        );

        // Wire FundingPool to IdeaToken (must happen before any deposits)
        fundingPool.setIdeaToken(address(ideaToken));

        // Create the idea
        ideas[ideaId] = Idea({
            creator: msg.sender,
            ideaToken: address(ideaToken),
            fundingPool: address(fundingPool),
            fundingGate: address(fundingGate),
            aiApproved: false,
            aiScore: 0,
            approvalReasonHash: "",
            rejected: false,
            abandoned: false,
            config: config
        });

        ideaTokens[ideaId] = address(ideaToken);
        fundingPools[ideaId] = address(fundingPool);
        creatorIdeas[msg.sender].push(ideaId);

        emit IdeaCreated(ideaId, msg.sender, address(ideaToken), address(fundingPool));
        emit FundingPoolConfigured(ideaId, address(fundingPool));
    }

    // Called by AI agent after scoring. If rejected, creator gets 90% back.
    function aiApproveIdea(uint256 ideaId, uint256 score, string calldata reasonHash)
        external {
        require(msg.sender == aiAgent, "Only AI agent");
        require(!ideas[ideaId].aiApproved && !ideas[ideaId].rejected, "Already processed");
        require(score >= 50, "Score too low"); // Minimum score threshold
        
        ideas[ideaId].aiApproved = true;
        ideas[ideaId].aiScore = score;
        ideas[ideaId].approvalReasonHash = reasonHash;
        aiApproved[ideaId] = true;
        
        emit IdeaApprovedByAI(ideaId, score);
    }

    function aiRejectIdea(uint256 ideaId, string calldata reasonHash) external {
        require(msg.sender == aiAgent, "Only AI agent");
        require(!ideas[ideaId].rejected, "Already rejected");
        
        ideas[ideaId].rejected = true;
        
        // Refund 90% to creator, 10% to treasury
        uint256 refundAmount = (MIN_CREATOR_DEPOSIT * (10000 - ABANDONMENT_FEE_BPS)) / 10000;
        USDY.safeTransfer(ideas[ideaId].creator, refundAmount);
        USDY.safeTransfer(treasury, MIN_CREATOR_DEPOSIT - refundAmount);
        
        emit IdeaRejectedByAI(ideaId, reasonHash);
    }

    function abandonIdea(uint256 ideaId) external {
        require(ideas[ideaId].creator == msg.sender, "Not creator");
        require(!ideas[ideaId].aiApproved && !ideas[ideaId].rejected, "Already processed");
        require(!ideas[ideaId].abandoned, "Already abandoned");
        require(!ideas[ideaId].aiApproved, "Cannot abandon approved idea");
        
        // Check that funding hasn't started (no deposits)
        // This is a simplified check - in production you'd check the funding pool state
        
        ideas[ideaId].abandoned = true;
        
        // Same refund logic: 90% back, 10% fee
        uint256 refundAmount = (MIN_CREATOR_DEPOSIT * (10000 - ABANDONMENT_FEE_BPS)) / 10000;
        USDY.safeTransfer(msg.sender, refundAmount);
        USDY.safeTransfer(treasury, MIN_CREATOR_DEPOSIT - refundAmount);
        
        emit IdeaAbandoned(ideaId, refundAmount);
    }

    function isIdeaApproved(uint256 ideaId) external view returns (bool) {
        return aiApproved[ideaId];
    }

    function getIdea(uint256 ideaId) external view returns (
        address creator,
        address ideaToken,
        address fundingPool,
        address fundingGate,
        bool aiApprovedFlag,
        uint256 aiScore,
        bool rejected,
        bool abandoned
    ) {
        Idea storage idea = ideas[ideaId];
        return (
            idea.creator,
            idea.ideaToken,
            idea.fundingPool,
            idea.fundingGate,
            idea.aiApproved,
            idea.aiScore,
            idea.rejected,
            idea.abandoned
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

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}