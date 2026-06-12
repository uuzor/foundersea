// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IFundingPoolFactory {
    struct PoolResult {
        address fundingPool;
        address fundingGate;
    }
    
    function createFundingPool(
        uint256 ideaId,
        address usdy,
        address creator,
        uint256 hardCap,  // Removed softCap - continuous commitment model
        uint256 competitionPrizeBps,
        address treasury,
        address ideaFactory
    ) external returns (address fundingPool, address fundingGate);

    function setIdeaTokenOnPool(address fundingPool, address ideaToken) external;
}