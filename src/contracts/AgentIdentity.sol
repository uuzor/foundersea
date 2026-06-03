// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract AgentIdentity is ERC721, Ownable {
    uint256 public agentId;
    string public agentName;
    string public modelId;
    uint256 public creationTime;

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
    mapping(DecisionType => uint256[]) public decisionsByType;
    
    address public aiAgent;

    event DecisionRecorded(
        uint256 indexed agentId,
        DecisionType indexed decisionType,
        uint256 indexed subjectId,
        uint256 confidence
    );
    event AgentMinted(address indexed owner, string name, string model);

    modifier onlyAIAgent() {
        require(msg.sender == aiAgent, "Only AI agent");
        _;
    }

    constructor(address _owner) ERC721("FounderSea AI Agent", "FSAA") Ownable(_owner) {}

    function mintAgent(string calldata name, string calldata _modelId) external onlyOwner returns (uint256) {
        require(agentId == 0, "Agent already minted");
        
        agentId = 1; // Only one agent per deployment
        agentName = name;
        modelId = _modelId;
        creationTime = block.timestamp;
        // Note: aiAgent is set via setAiAgent() after deployment, NOT here
        // This allows the backend to control the AI agent wallet separately
        
        _safeMint(owner(), agentId);
        emit AgentMinted(owner(), name, _modelId);
        
        return agentId;
    }

    function setAiAgent(address _aiAgent) external onlyOwner {
        require(agentId != 0 && ownerOf(agentId) != address(0), "Agent not minted yet");
        aiAgent = _aiAgent;
    }

    function recordDecision(
        DecisionType decisionType,
        uint256 subjectId,
        bytes32 inputHash,
        bytes32 outputHash,
        uint256 confidence,
        string calldata reasoningIpfsHash
    ) external onlyAIAgent {
        require(agentId != 0, "Agent not minted");
        
        decisions.push(Decision({
            timestamp: block.timestamp,
            decisionType: decisionType,
            subjectId: subjectId,
            inputHash: inputHash,
            outputHash: outputHash,
            confidence: confidence,
            reasoningIpfsHash: reasoningIpfsHash
        }));
        
        decisionsByType[decisionType].push(decisions.length - 1);
        
        emit DecisionRecorded(agentId, decisionType, subjectId, confidence);
    }

    function totalDecisions() external view returns (uint256) {
        return decisions.length;
    }

    function getDecision(uint256 index) external view returns (Decision memory) {
        require(index < decisions.length, "Index out of bounds");
        return decisions[index];
    }

    function getDecisionsByType(DecisionType dt) external view returns (uint256[] memory) {
        return decisionsByType[dt];
    }

    function getDecisionsBySubjectId(uint256 _subjectId) external view returns (Decision[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < decisions.length; i++) {
            if (decisions[i].subjectId == _subjectId) {
                count++;
            }
        }
        
        Decision[] memory result = new Decision[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < decisions.length; i++) {
            if (decisions[i].subjectId == _subjectId) {
                result[index] = decisions[i];
                index++;
            }
        }
        return result;
    }

    function getAverageConfidence(DecisionType dt) external view returns (uint256) {
        uint256[] storage indices = decisionsByType[dt];
        if (indices.length == 0) return 0;
        
        uint256 total = 0;
        for (uint256 i = 0; i < indices.length; i++) {
            total += decisions[indices[i]].confidence;
        }
        return total / indices.length;
    }

    function getDecisionCountByType() external view returns (uint256[8] memory counts) {
        for (uint256 i = 0; i < 8; i++) {
            counts[i] = decisionsByType[DecisionType(i)].length;
        }
    }

    function hashInput(bytes calldata data) external pure returns (bytes32) {
        return keccak256(data);
    }
}