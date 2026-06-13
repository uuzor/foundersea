// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console2.sol";
import "../src/contracts/IdeaFactory.sol";

contract UpdateFactoryUSDY is Script {
    function run() external {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(privateKey);
        
        // These addresses should be set via environment variables
        address factoryAddress = vm.envAddress("IDEA_FACTORY_ADDRESS");
        address usdyAddress = vm.envAddress("USDY_ADDRESS");
        
        console2.log("Factory Address:", factoryAddress);
        console2.log("USDY Address:", usdyAddress);
        
        IdeaFactory factory = IdeaFactory(factoryAddress);
        
        vm.startBroadcast(privateKey);
        
        // The constructor already sets USDY, but if you need to update:
        // factory.setUsdy(usdyAddress);
        
        vm.stopBroadcast();
        
        console2.log("Factory USDY (immutable):", address(factory.USDY()));
    }
}
