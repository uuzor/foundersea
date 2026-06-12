// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * Mock AI Agent for testing
 * Simulates the AI agent that approves ideas and validates milestones
 */
contract MockAIAgent {
    bool public shouldApprove = true;
    uint256 public approvalScore = 85;
    string public lastReasonHash;
    
    // Event for testing
    event IdeaApproved(uint256 indexed ideaId, uint256 score, string reasonHash);
    event MilestoneValidated(uint256 indexed ideaId, uint256 indexed milestoneIndex, uint256 confidence);
    
    function setApprovalResult(bool _shouldApprove, uint256 _score) external {
        shouldApprove = _shouldApprove;
        approvalScore = _score;
    }
    
    function approveIdea(uint256 ideaId, uint256 score, string calldata reasonHash) external returns (bool) {
        lastReasonHash = reasonHash;
        emit IdeaApproved(ideaId, score, reasonHash);
        return shouldApprove;
    }
    
    function validateMilestone(
        uint256 ideaId,
        uint256 milestoneIndex,
        uint256 confidence,
        string calldata ipfsHash
    ) external returns (bool) {
        emit MilestoneValidated(ideaId, milestoneIndex, confidence);
        return confidence >= 75;
    }
    
    function validateBuilder(
        address builder,
        uint256 confidence,
        string calldata ipfsHash
    ) external pure returns (bool) {
        return confidence >= 70;
    }
}