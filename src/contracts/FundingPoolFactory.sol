// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./FundingGate.sol";
import "./FundingPool.sol";
import "./interfaces/IFundingPoolFactory.sol";

contract FundingPoolFactory is Ownable, IFundingPoolFactory {
    constructor(address initialOwner) Ownable(initialOwner) {}

    event FundingPoolCreated(
        uint256 indexed ideaId,
        address fundingPool,
        address fundingGate,
        uint256 hardCap
    );

    function createFundingPool(
        uint256 ideaId,
        address usdy,
        address creator,
        uint256 hardCap,  // Removed softCap - continuous commitment model
        uint256 competitionPrizeBps,
        address treasury,
        address ideaFactory
    ) external override returns (address fundingPool, address fundingGate) {
        address gate = address(new FundingGate(creator, msg.sender));

        // Deploy pool with factory as owner so factory can call updateFactory
        FundingPool pool = new FundingPool(
            usdy,
            gate,
            address(this),  // FundingPoolFactory becomes owner initially
            hardCap,
            competitionPrizeBps,
            treasury
        );
        
        // Update factory to IdeaFactory address and transfer ownership to treasury
        pool.updateFactory(ideaFactory, treasury);
        
        fundingPool = address(pool);
        fundingGate = gate;

        emit FundingPoolCreated(ideaId, fundingPool, fundingGate, hardCap);
    }

    function setIdeaTokenOnPool(address fundingPool, address ideaToken) external onlyOwner {
        FundingPool(fundingPool).setIdeaToken(ideaToken);
    }
}