// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./FundingGate.sol";
import "./FundingPool.sol";

contract FundingPoolFactory is Ownable {
    constructor(address initialOwner) Ownable(initialOwner) {}

    event FundingPoolCreated(
        uint256 indexed ideaId,
        address fundingPool,
        address fundingGate,
        uint256 softCap,
        uint256 hardCap
    );

    function createFundingPool(
        uint256 ideaId,
        IERC20 usdy,
        address creator,
        uint256 softCap,
        uint256 hardCap,
        uint256 competitionPrizeBps,
        address treasury
    ) external onlyOwner returns (FundingPool fundingPool, FundingGate gate) {
        gate = new FundingGate(creator, msg.sender);
        
        fundingPool = new FundingPool(
            address(usdy),
            address(gate),
            creator,
            softCap,
            hardCap,
            competitionPrizeBps,
            treasury
        );
        
        emit FundingPoolCreated(ideaId, address(fundingPool), address(gate), softCap, hardCap);
    }
}