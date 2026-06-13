// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console2.sol";
import "../src/contracts/IdeaFactory.sol";
import "../src/contracts/FundingPoolFactory.sol";
import "../src/contracts/IdeaTokenFactory.sol";

contract RedeployIdeaFactoryWithUSDY is Script {
    function run() external {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(privateKey);
        
        address usdyAddress = vm.envAddress("USDY_ADDRESS");
        address fundingPoolFactory = vm.envAddress("FUNDING_POOL_FACTORY");
        address ideaTokenFactory = vm.envAddress("IDEA_TOKEN_FACTORY");
        
        console2.log("Deployer:", deployer);
        console2.log("USDY Address:", usdyAddress);
        
        vm.startBroadcast(privateKey);
        
        // Deploy new IdeaFactory with correct USDY
        IdeaFactory ideaFactory = new IdeaFactory(usdyAddress, deployer, deployer);
        console2.log("IdeaFactory deployed:", address(ideaFactory));
        
        // Set factories
        ideaFactory.setFactories(fundingPoolFactory, ideaTokenFactory);
        console2.log("Factories set");
        
        vm.stopBroadcast();
        
        console2.log("");
        console2.log("==========================================");
        console2.log("  NEW IDEA FACTORY DEPLOYED");
        console2.log("==========================================");
        console2.log("IdeaFactory:", address(ideaFactory));
        console2.log("USDY:", usdyAddress);
        console2.log("==========================================");
    }
}
