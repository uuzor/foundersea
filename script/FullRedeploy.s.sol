// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console2.sol";
import "../src/contracts/IdeaTokenFactory.sol";
import "../src/contracts/IdeaFactory.sol";
import "../src/contracts/FundingPoolFactory.sol";

contract FullRedeploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address usdy = vm.envAddress("USDY_ADDRESS");
        
        console2.log("==========================================");
        console2.log("  FULL REDEPLOY (no onlyOwner on factories)");
        console2.log("==========================================");
        
        vm.startBroadcast(deployerKey);
        
        // Deploy new FundingPoolFactory
        FundingPoolFactory fundingPoolFactory = new FundingPoolFactory(deployer);
        console2.log("FundingPoolFactory:", address(fundingPoolFactory));
        
        // Deploy new IdeaTokenFactory  
        IdeaTokenFactory ideaTokenFactory = new IdeaTokenFactory(deployer);
        console2.log("IdeaTokenFactory:", address(ideaTokenFactory));
        
        // Deploy new IdeaFactory
        IdeaFactory ideaFactory = new IdeaFactory(usdy, deployer, deployer);
        console2.log("IdeaFactory:", address(ideaFactory));
        
        // Set factories on IdeaFactory FIRST (deployer is still owner)
        ideaFactory.setFactories(address(fundingPoolFactory), address(ideaTokenFactory));
        console2.log("Factories set on IdeaFactory");
        
        // Set AI agent address
        ideaFactory.setAiAgent(deployer);  // Using deployer as AI for testing
        console2.log("AI Agent set");
        
        // Transfer ownership of factories to IdeaFactory
        fundingPoolFactory.transferOwnership(address(ideaFactory));
        ideaTokenFactory.transferOwnership(address(ideaFactory));
        console2.log("Ownership transferred to IdeaFactory");
        
        console2.log("==========================================");
        
        vm.stopBroadcast();
    }
}