// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IFundingPoolFactory {
    struct PoolResult {
        address fundingPool;
        address fundingGate;
    }
    
    function createFundingPool(
        uint256 ideaId,
        address usdy,
        address creator,
        uint256 softCap,
        uint256 hardCap,
        uint256 competitionPrizeBps,
        address treasury
    ) external returns (address fundingPool, address fundingGate);

    function setIdeaTokenOnPool(address fundingPool, address ideaToken) external;
}