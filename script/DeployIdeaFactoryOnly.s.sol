// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {IdeaFactory} from "../src/contracts/IdeaFactory.sol";

contract DeployIdeaFactoryOnly is Script {
    function run() external {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(privateKey);
        
        vm.startBroadcast(privateKey);
        
        // Deploy with placeholder USDY
        address usdy = 0x0000000000000000000000000000000000000001;
        address treasury = deployer;
        
        IdeaFactory factory = new IdeaFactory(usdy, treasury, deployer);
        
        console2.log("IdeaFactory deployed:", address(factory));
        
        vm.stopBroadcast();
    }
}
