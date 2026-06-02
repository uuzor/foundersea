// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IFundingPool {
    function getFundingToken() external view returns (address);
    function deposit(uint256 amount) external;
    function closeFunding() external;
    function releaseMilestone(uint256 index) external;
    function daoReleaseMilestone(uint256 index) external;
    function slashBuilder(uint256 amount) external;
    function setMilestoneValidated(uint256 index, uint256 confidence, string calldata ipfsHash) external;
    function fundingClosed() external view returns (bool);
    function builderAssigned() external view returns (bool);
}