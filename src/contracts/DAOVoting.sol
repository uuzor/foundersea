// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IIdeaToken.sol";

contract DAOVoting is Ownable {
    address public aiAgent;
    IIdeaToken public ideaToken;
    
    // Per-token-holder delegation
    mapping(address => bool) public delegatedToAI;
    address[] public delegatedHolders; // Track all delegated holders for power calculation
    
    // Active proposals
    struct Proposal {
        uint256 ideaId;
        string descriptionIpfsHash;
        uint256 votingDeadline;
        uint256 yesVotes;
        uint256 noVotes;
        uint256 aiYesVotes; // votes cast by AI on behalf of delegators
        uint256 aiNoVotes;
        bool executed;
        bool aiRecommendation; // AI's recommendation recorded on-chain
        uint256 aiConfidence;
        bool created;
        uint256 snapshotBlock; // Block at proposal creation for token balance snapshots
    }

    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(uint256 => bool) public aiHasVoted; // Prevent AI from voting multiple times
    
    uint256 public nextProposalId;
    uint256 public votingDuration = 7 days;
    
    event VoteDelegatedToAI(address indexed holder);
    event DelegationRevoked(address indexed holder);
    event ProposalCreated(uint256 indexed proposalId, uint256 ideaId);
    event VoteCast(uint256 indexed proposalId, address voter, bool support, uint256 power);
    event AIVotesCast(uint256 indexed proposalId, bool support, uint256 power, uint256 confidence);
    event ProposalExecuted(uint256 indexed proposalId, bool passed);

    modifier onlyAIAgent() {
        require(msg.sender == aiAgent, "Only AI agent");
        _;
    }

    constructor(address _owner) Ownable(_owner) {}

    function setAiAgent(address _aiAgent) external onlyOwner {
        require(_aiAgent != address(0), "Invalid AI agent");
        aiAgent = _aiAgent;
    }

    function setIdeaToken(address _ideaToken) external onlyOwner {
        ideaToken = IIdeaToken(_ideaToken);
    }

    // Token holder delegates their vote to AI for all future proposals
    function delegateToAI() external {
        require(!delegatedToAI[msg.sender], "Already delegated");
        delegatedToAI[msg.sender] = true;
        delegatedHolders.push(msg.sender);
        emit VoteDelegatedToAI(msg.sender);
    }

    function revokeDelegation() external {
        require(delegatedToAI[msg.sender], "Not delegated");
        delegatedToAI[msg.sender] = false;
        emit DelegationRevoked(msg.sender);
    }

    function createProposal(
        uint256 _ideaId,
        string calldata _descriptionIpfsHash,
        uint256 _customDuration
    ) external onlyOwner returns (uint256 proposalId) {
        proposalId = nextProposalId++;
        proposals[proposalId] = Proposal({
            ideaId: _ideaId,
            descriptionIpfsHash: _descriptionIpfsHash,
            votingDeadline: block.timestamp + (_customDuration > 0 ? _customDuration : votingDuration),
            yesVotes: 0,
            noVotes: 0,
            aiYesVotes: 0,
            aiNoVotes: 0,
            executed: false,
            aiRecommendation: false,
            aiConfidence: 0,
            created: true,
            snapshotBlock: block.number
        });
        emit ProposalCreated(proposalId, _ideaId);
    }

    // Human vote
    function vote(uint256 proposalId, bool support) external {
        require(proposals[proposalId].created, "Proposal not found");
        require(block.timestamp < proposals[proposalId].votingDeadline, "Voting ended");
        require(!delegatedToAI[msg.sender], "Vote delegated to AI");
        require(!hasVoted[proposalId][msg.sender], "Already voted");

        uint256 power = ideaToken.balanceOf(msg.sender);
        require(power > 0, "No voting power");

        if (support) {
            proposals[proposalId].yesVotes += power;
        } else {
            proposals[proposalId].noVotes += power;
        }
        hasVoted[proposalId][msg.sender] = true;
        
        emit VoteCast(proposalId, msg.sender, support, power);
    }

    // AI agent aggregates all delegated votes before deadline
    function castAIVotes(
        uint256 proposalId,
        bool support,
        uint256 confidence,
        string calldata /* reasoningIpfsHash - stored off-chain, hash recorded in events */
    ) external onlyAIAgent {
        require(proposals[proposalId].created, "Proposal not found");
        require(!aiHasVoted[proposalId], "AI already voted");
        require(!proposals[proposalId].executed, "Already executed");
        
        aiHasVoted[proposalId] = true;
        
        // Record AI recommendation
        proposals[proposalId].aiRecommendation = support;
        proposals[proposalId].aiConfidence = confidence;
        
        // Calculate total delegated voting power
        uint256 delegatedPower = _getTotalDelegatedPower();
        
        if (support) {
            proposals[proposalId].aiYesVotes = delegatedPower;
        } else {
            proposals[proposalId].aiNoVotes = delegatedPower;
        }
        
        emit AIVotesCast(proposalId, support, delegatedPower, confidence);
    }

    function _getTotalDelegatedPower() internal view returns (uint256) {
        uint256 totalPower;
        for (uint256 i = 0; i < delegatedHolders.length; i++) {
            if (delegatedToAI[delegatedHolders[i]]) {
                totalPower += ideaToken.balanceOf(delegatedHolders[i]);
            }
        }
        return totalPower;
    }

    function execute(uint256 proposalId) external {
        require(proposals[proposalId].created, "Proposal not found");
        require(block.timestamp >= proposals[proposalId].votingDeadline, "Voting not ended");
        require(!proposals[proposalId].executed, "Already executed");

        Proposal storage p = proposals[proposalId];
        p.executed = true;
        
        uint256 totalYes = p.yesVotes + p.aiYesVotes;
        uint256 totalNo = p.noVotes + p.aiNoVotes;
        bool passed = totalYes > totalNo;
        
        emit ProposalExecuted(proposalId, passed);
    }

    function getProposalStatus(uint256 proposalId) external view returns (
        uint256 yesVotes,
        uint256 noVotes,
        uint256 aiYesVotes,
        uint256 aiNoVotes,
        bool executed,
        bool votingActive
    ) {
        Proposal storage p = proposals[proposalId];
        return (
            p.yesVotes,
            p.noVotes,
            p.aiYesVotes,
            p.aiNoVotes,
            p.executed,
            block.timestamp < p.votingDeadline && !p.executed
        );
    }
}