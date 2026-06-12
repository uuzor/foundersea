// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IIdeaTokenFactory {
    function createIdeaToken(
        uint256 ideaId,
        address fundingPool,
        address creator,
        uint256 builderAllocBps,
        address factory,
        address usdy
    ) external returns (address token);
}