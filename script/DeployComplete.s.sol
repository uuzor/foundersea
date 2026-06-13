// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console2.sol";
import "../src/contracts/AgentIdentity.sol";
import "../src/contracts/IdeaFactory.sol";
import "../src/contracts/DAOVoting.sol";
import "../src/contracts/IdeaMarketplace.sol";
import "../src/contracts/FundingPoolFactory.sol";
import "../src/contracts/IdeaTokenFactory.sol";
import "../src/contracts/BuilderAgreement.sol";
import "../src/contracts/MockUSDY.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title DeployComplete
 * @notice Complete deployment script with all critical initializations.
 * Deploys MockUSDY for testnet use (no real USDY needed).
 * Handles 5 critical dependencies:
 * 1. AgentIdentity.setAiAgent()
 * 2. IdeaFactory.setAiAgent()
 * 3. FundingPool.setAiAgent() [per-idea, done via backend]
 * 4. DAOVoting.setAiAgent()
 * 5. BuilderAgreement registration [per-idea, done via backend]
 */
contract DeployComplete is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address aiAgentAddress = vm.envOr("AI_AGENT_ADDRESS", deployer); // Fallback to deployer for testing

        console2.log("==========================================");
        console2.log("       FOUNDERSEA COMPLETE DEPLOY");
        console2.log("==========================================");
        console2.log("Deployer:", deployer);
        console2.log("AI Agent:", aiAgentAddress);
        console2.log("Chain ID:", block.chainid);
        console2.log("");

        vm.startBroadcast(deployerPrivateKey);

        // ========== PHASE 0: MOCK USDY ==========
        console2.log("PHASE 0: Deploying MockUSDY...");

        MockUSDY mockUSDY = new MockUSDY(deployer);
        console2.log(" MockUSDY:", address(mockUSDY));
        console2.log(" Deployer USDY balance:", mockUSDY.balanceOf(deployer));

        // Mint 1M USDY to AI agent so it can cover test deposits if needed
        mockUSDY.mint(aiAgentAddress, 1_000_000 * 1e6);
        console2.log(" Minted 1M USDY to AI agent:", aiAgentAddress);

        address usdyAddress = address(mockUSDY);

        // ========== PHASE 1: FACTORY CONTRACTS ==========
        console2.log("");
        console2.log("PHASE 1: Deploying factory contracts...");

        FundingPoolFactory fundingPoolFactory = new FundingPoolFactory(deployer);
        console2.log(" FundingPoolFactory:", address(fundingPoolFactory));

        IdeaTokenFactory ideaTokenFactory = new IdeaTokenFactory(deployer);
        console2.log(" IdeaTokenFactory:", address(ideaTokenFactory));

        // ========== PHASE 2: AGENT IDENTITY (MUST COME BEFORE SETTING AI) ==========
        console2.log("");
        console2.log("PHASE 2: Deploying AgentIdentity...");

        AgentIdentity agentIdentity = new AgentIdentity(deployer);
        console2.log(" AgentIdentity:", address(agentIdentity));

        // CRITICAL: Mint agent BEFORE setAiAgent()
        agentIdentity.mintAgent("FounderSea AI", "TokenRouter");
        console2.log(" Agent minted (ID: 1)");

        // CRITICAL DEPENDENCY #3: Set AI Agent on AgentIdentity
        agentIdentity.setAiAgent(aiAgentAddress);
        console2.log(" AI Agent set on AgentIdentity:", aiAgentAddress);

        // ========== PHASE 3: IDEA FACTORY ==========
        console2.log("");
        console2.log("PHASE 3: Deploying IdeaFactory...");

        address treasury = vm.envOr("FOUNDERSEA_TREASURY", deployer);

        IdeaFactory ideaFactory = new IdeaFactory(usdyAddress, treasury, deployer);
        console2.log(" IdeaFactory:", address(ideaFactory));

        // Wire factories to IdeaFactory
        ideaFactory.setFactories(address(fundingPoolFactory), address(ideaTokenFactory));
        console2.log(" Factories wired to IdeaFactory");

        // CRITICAL DEPENDENCY #1: Set AI Agent on IdeaFactory
        ideaFactory.setAiAgent(aiAgentAddress);
        console2.log(" AI Agent set on IdeaFactory:", aiAgentAddress);

        ideaFactory.setAgentIdentity(address(agentIdentity));
        console2.log(" AgentIdentity set on IdeaFactory");

        // ========== PHASE 4: DAO VOTING ==========
        console2.log("");
        console2.log("PHASE 4: Deploying DAOVoting...");

        DAOVoting daoVoting = new DAOVoting(deployer);
        console2.log(" DAOVoting:", address(daoVoting));

        // CRITICAL DEPENDENCY #5: Set AI Agent on DAOVoting
        daoVoting.setAiAgent(aiAgentAddress);
        console2.log(" AI Agent set on DAOVoting:", aiAgentAddress);

        // ========== PHASE 5: MARKETPLACE ==========
        console2.log("");
        console2.log("PHASE 5: Deploying IdeaMarketplace...");

        IdeaMarketplace marketplace = new IdeaMarketplace(deployer, treasury, usdyAddress);
        console2.log(" IdeaMarketplace:", address(marketplace));

        // ========== PHASE 6: BUILDER AGREEMENT ==========
        console2.log("");
        console2.log("PHASE 6: Deploying BuilderAgreement...");

        BuilderAgreement builderAgreement = new BuilderAgreement(deployer);
        console2.log(" BuilderAgreement:", address(builderAgreement));

        vm.stopBroadcast();

        // ========== OUTPUT DEPLOYMENT ADDRESSES ==========
        console2.log("");
        console2.log("==========================================");
        console2.log("         DEPLOYMENT COMPLETE");
        console2.log("==========================================");
        console2.log("MockUSDY:", address(mockUSDY));
        console2.log("AgentIdentity:", address(agentIdentity));
        console2.log("IdeaFactory:", address(ideaFactory));
        console2.log("FundingPoolFactory:", address(fundingPoolFactory));
        console2.log("IdeaTokenFactory:", address(ideaTokenFactory));
        console2.log("DAOVoting:", address(daoVoting));
        console2.log("IdeaMarketplace:", address(marketplace));
        console2.log("BuilderAgreement:", address(builderAgreement));
        console2.log("Treasury:", treasury);
        console2.log("USDY (MockUSDY):", usdyAddress);
        console2.log("==========================================");

        // ========== VERIFICATION CHECKLIST ==========
        console2.log("");
        console2.log("CRITICAL CHECKS:");
        console2.log(" 1. AgentIdentity.setAiAgent() called");
        console2.log(" 2. IdeaFactory.setAiAgent() called");
        console2.log(" 3. DAOVoting.setAiAgent() called");
        console2.log("");
        console2.log("PER-IDEA SETUP (Done in backend after createIdea):");
        console2.log("  - FundingPool.setAiAgent() [NEW pool each time]");
        console2.log("  - IdeaFactory.registerBuilderAgreement()");
        console2.log("  - DAOVoting.setIdeaToken() [once after first idea]");
        console2.log("");
        console2.log("==========================================");
        console2.log("NEXT STEPS:");
        console2.log("==========================================");
        console2.log("1. Update backend/.env with these addresses:");
        console2.log("");
        console2.log("   # Mantle Sepolia Addresses");
        console2.log("   IDEA_FACTORY_MANTLE=", address(ideaFactory));
        console2.log("   AGENT_IDENTITY_MANTLE=", address(agentIdentity));
        console2.log("   DAO_VOTING_MANTLE=", address(daoVoting));
        console2.log("   IDEA_MARKETPLACE_MANTLE=", address(marketplace));
        console2.log("   FUNDING_POOL_FACTORY_MANTLE=", address(fundingPoolFactory));
        console2.log("   IDEA_TOKEN_FACTORY_MANTLE=", address(ideaTokenFactory));
        console2.log("   BUILDER_AGREEMENT_MANTLE=", address(builderAgreement));
        console2.log("   USDY_MANTLE=", usdyAddress);
        console2.log("   AI_AGENT_ADDRESS=", aiAgentAddress);
        console2.log("");
        console2.log("   # MockUSDY faucet: call faucet() to get 1M USDY for testing");
        console2.log("   # Deployer already has 10M USDY, AI agent has 1M USDY");
        console2.log("");
        console2.log("2. Backend must call per-idea setup:");
        console2.log("   - After IdeaFactory.createIdea():");
        console2.log("     - Get fundingPool from IdeaFactory");
        console2.log("     - Call FundingPool.setAiAgent(AI_AGENT_ADDRESS)");
        console2.log("     - Call IdeaFactory.registerBuilderAgreement(ideaId, agreementAddress)");
        console2.log("");
        console2.log("3. One-time after first idea:");
        console2.log("   - Get ideaToken from IdeaFactory");
        console2.log("   - Call DAOVoting.setIdeaToken(ideaTokenAddress)");
        console2.log("");
        console2.log("4. Test flow:");
        console2.log("   - Create an idea");
        console2.log("   - Call IdeaFactory.aiApproveIdea()");
        console2.log("   - Verify AgentIdentity.recordDecision() logged");
        console2.log("==========================================");
    }
}
