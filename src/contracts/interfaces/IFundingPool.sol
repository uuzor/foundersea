// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IFundingPool {
    // Tranche state for continuous commitment model
    enum TrancheState { GENESIS, OPEN, CLOSED }
    
    function getFundingToken() external view returns (address);
    function deposit(uint256 amount) external;
    function genesisStake(address depositor, uint256 amount) external;
    function recordGenesisStake(address depositor, uint256 amount) external;
    function transitionToOpen() external;
    function closeFunding() external;
    function releaseMilestone(uint256 index) external;
    function daoReleaseMilestone(uint256 index) external;
    function slashCompetitorPayout(uint256 slot) external;
    function setMilestoneValidated(uint256 index, uint256 confidence, string calldata ipfsHash) external;
    function markAbandoned() external;
    function getTrancheState() external view returns (uint8);
    function builderAssigned() external view returns (bool);
    function raisedAmount() external view returns (uint256);
    function competitorPayouts(uint256 slot) external view returns (address builder, uint256 amount, bool released, uint256 aiConfidence, string memory validationIpfsHash);
    function competitorsSet() external view returns (bool);
}