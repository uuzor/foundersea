// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console2.sol";
import "../src/contracts/AgentIdentity.sol";
import "../src/contracts/IdeaFactory.sol";
import "../src/contracts/DAOVoting.sol";
import "../src/contracts/IdeaMarketplace.sol";

contract Deploy is Script {
    // USDY addresses - update with actual addresses after deployment
    // These are placeholder addresses - replace with real USDY addresses
    address constant USDY_MANTLE_SEPOLIA = 0x0000000000000000000000000000000000000001;
    address constant USDY_BASE_SEPOLIA = 0x0000000000000000000000000000000000000002;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deployer address:", deployer);
        console.log("Chain ID:", block.chainid);
        console.log("");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy AgentIdentity (ERC-8004)
        console.log("Deploying AgentIdentity...");
        AgentIdentity agentIdentity = new AgentIdentity(deployer);
        console.log("AgentIdentity deployed:", address(agentIdentity));
        
        // Mint the AI agent
        agentIdentity.mintAgent("FounderSea AI", "kimi-k2-6");
        console.log("AI Agent minted. Agent ID:", agentIdentity.agentId());
        
        // Deploy IdeaFactory
        console.log("Deploying IdeaFactory...");
        address treasury = vm.envOr("FOUNDERSEA_TREASURY", deployer);
        
        // Use placeholder USDY - will need to be updated after deployment
        address usdyAddress = USDY_MANTLE_SEPOLIA;
        if (block.chainid == 84532) {
            // Base Sepolia
            usdyAddress = USDY_BASE_SEPOLIA;
        }
        
        IdeaFactory ideaFactory = new IdeaFactory(usdyAddress, treasury, deployer);
        console.log("IdeaFactory deployed:", address(ideaFactory));
        
        // Set AI agent in IdeaFactory
        address aiAgentAddr = vm.envOr("AI_AGENT_ADDRESS", address(0));
        if (aiAgentAddr != address(0)) {
            ideaFactory.setAiAgent(aiAgentAddr);
            console.log("AI Agent set in IdeaFactory");
        }
        ideaFactory.setAgentIdentity(address(agentIdentity));
        console.log("AgentIdentity set in IdeaFactory");
        
        // Deploy DAOVoting
        console.log("Deploying DAOVoting...");
        DAOVoting daoVoting = new DAOVoting(deployer);
        console.log("DAOVoting deployed:", address(daoVoting));
        
        // Set AI agent in DAOVoting
        if (aiAgentAddr != address(0)) {
            daoVoting.setAiAgent(aiAgentAddr);
            console.log("AI Agent set in DAOVoting");
        }
        
        // Deploy IdeaMarketplace
        console.log("Deploying IdeaMarketplace...");
        IdeaMarketplace marketplace = new IdeaMarketplace(deployer, treasury, usdyAddress);
        console.log("IdeaMarketplace deployed:", address(marketplace));
        
        vm.stopBroadcast();
        
        // Output deployment summary
        console.log("");
        console.log("==========================================");
        console.log("       DEPLOYMENT SUMMARY");
        console.log("==========================================");
        console.log("AgentIdentity:", address(agentIdentity));
        console.log("IdeaFactory:", address(ideaFactory));
        console.log("DAOVoting:", address(daoVoting));
        console.log("IdeaMarketplace:", address(marketplace));
        console.log("Treasury:", treasury);
        console.log("USDY:", usdyAddress);
        console.log("==========================================");
        console.log("");
        console.log("NEXT STEPS:");
        console.log("1. Update .env with deployed addresses:");
        console.log("   IDEA_FACTORY=<factory_address>");
        console.log("   AGENT_IDENTITY=<agent_identity_address>");
        console.log("   DAO_VOTING=<dao_voting_address>");
        console.log("   IDEA_MARKETPLACE=<marketplace_address>");
        console.log("");
        console.log("2. Update IdeaFactory with correct USDY address");
        console.log("3. Set AI agent address if not set via env");
        console.log("==========================================");
    }
}