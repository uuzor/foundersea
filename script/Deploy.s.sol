// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/contracts/AgentIdentity.sol";
import "../src/contracts/IdeaFactory.sol";
import "../src/contracts/DAOVoting.sol";
import "../src/contracts/IdeaMarketplace.sol";

// Placeholder USDY address for Mantle Sepolia - will be updated with actual address
address constant USDY_PLACEHOLDER = 0x0000000000000000000000000000000000000001;

contract DeployMainnet is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deployer address:", deployer);
        console.log("Chain ID:", block.chainid);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy AgentIdentity (ERC-8004)
        console.log("Deploying AgentIdentity...");
        AgentIdentity agentIdentity = new AgentIdentity(deployer);
        console.log("AgentIdentity deployed:", address(agentIdentity));
        
        // Mint the AI agent
        agentIdentity.mintAgent("FounderSea AI", "kimi-k2-6");
        console.log("AI Agent minted");
        
        // Deploy IdeaFactory
        console.log("Deploying IdeaFactory...");
        address treasury = vm.envOr("FOUNDERSEA_TREASURY", deployer);
        IdeaFactory ideaFactory = new IdeaFactory(USDY_PLACEHOLDER, treasury, deployer);
        console.log("IdeaFactory deployed:", address(ideaFactory));
        
        // Set AI agent in IdeaFactory
        ideaFactory.setAiAgent(agentIdentity.aiAgent());
        ideaFactory.setAgentIdentity(address(agentIdentity));
        
        // Deploy DAOVoting
        console.log("Deploying DAOVoting...");
        DAOVoting daoVoting = new DAOVoting(deployer);
        console.log("DAOVoting deployed:", address(daoVoting));
        
        // Set AI agent in DAOVoting
        daoVoting.setAiAgent(agentIdentity.aiAgent());
        
        // Deploy IdeaMarketplace
        console.log("Deploying IdeaMarketplace...");
        address usdy = USDY_PLACEHOLDER;
        IdeaMarketplace marketplace = new IdeaMarketplace(deployer, treasury, usdy);
        console.log("IdeaMarketplace deployed:", address(marketplace));
        
        vm.stopBroadcast();
        
        // Output deployment addresses
        console.log("");
        console.log("========== DEPLOYMENT SUMMARY ==========");
        console.log("AgentIdentity:", address(agentIdentity));
        console.log("IdeaFactory:", address(ideaFactory));
        console.log("DAOVoting:", address(daoVoting));
        console.log("IdeaMarketplace:", address(marketplace));
        console.log("AI Agent:", agentIdentity.aiAgent());
        console.log("==========================================");
        
        // Save deployment addresses as constants for verification
        console.log("");
        console.log("DEPLOYED_CONTRACTS=", vm.toString(address(agentIdentity)), vm.toString(address(ideaFactory)));
    }
}