// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/contracts/AgentIdentity.sol";

contract DeployAgentIdentity is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deployer address:", deployer);
        console.log("Balance:", address(deployer).balance);
        
        vm.startBroadcast(deployerPrivateKey);
        
        AgentIdentity agentIdentity = new AgentIdentity(deployer);
        console.log("AgentIdentity deployed:", address(agentIdentity));
        
        agentIdentity.mintAgent("FounderSea AI", "kimi-k2-6");
        console.log("AI Agent minted. AI Agent address:", agentIdentity.aiAgent());
        
        vm.stopBroadcast();
    }
}