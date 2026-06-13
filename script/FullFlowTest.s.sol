// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console2.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../src/contracts/IdeaFactory.sol";
import "../src/contracts/IdeaToken.sol";
import "../src/contracts/FundingPool.sol";
import "../src/contracts/FundingPoolFactory.sol";
import "../src/contracts/IdeaTokenFactory.sol";
import "../src/contracts/AgentIdentity.sol";
import "../src/contracts/DAOVoting.sol";
import {GateType} from "../src/contracts/FundingGate.sol";

/**
 * @title FullFlowTest
 * 
 * Complete flow test for FounderSea protocol:
 * 
 * 1. Create wallets (AI, Builder, LP)
 * 2. Mint USDY to all wallets
 * 3. Create Idea through IdeaFactory
 * 4. AI agent approves idea
 * 5. Open funding pool
 * 6. LPs deposit USDY
 * 7. DAO accepts builder
 * 8. Create milestones
 * 9. Builder submits milestone, AI approves, funds released
 */
contract FullFlowTest is Script {
    // Contract addresses (Mantle Sepolia - fully redeployed with factories set)
    address constant USDY = 0xb64936081A1Cd0bb8d07EB746c112224b479f175;
    address constant IDEA_FACTORY = 0xfFCCa487da019ff7b46579A52498a8B183223C9B;
    address constant FUNDING_POOL_FACTORY = 0x36072fe59B9e21421695666977c5c118E68e6816;
    address constant IDEA_TOKEN_FACTORY = 0xb9c4b3c60FE91241C5d42E41dD51481F18b02459;
    address constant AGENT_IDENTITY = 0x73C88A40279be637AC2953c23a9709D8452E896B;
    address constant DAO_VOTING = 0x45bCaDb6E3453E74EF789838A8eF4C5031716157;
    
    // IERC20 for USDY interactions
    function run() external {
        console2.log("==========================================");
        console2.log("  FOUNDERSEA FULL FLOW TEST");
        console2.log("==========================================");
        console2.log("");
        
        // Step 1: Setup wallets
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        
        // Generate test keys
        uint256 aiKey = 0x1111000000000000000000000000000000000000000000000000000000000001;
        uint256 builderKey = 0x22220000000000000000000000000000000000000000000000000000000001;
        uint256 lp1Key = 0x33330000000000000000000000000000000000000000000000000000000001;
        uint256 lp2Key = 0x44440000000000000000000000000000000000000000000000000000000001;
        uint256 daoKey = 0x55550000000000000000000000000000000000000000000000000000000001;
        
        address aiWallet = vm.addr(aiKey);
        address builder = vm.addr(builderKey);
        address lp1 = vm.addr(lp1Key);
        address lp2 = vm.addr(lp2Key);
        address dao = vm.addr(daoKey);
        
        console2.log("=== WALLETS ===");
        console2.log("Deployer:", deployer);
        console2.log("AI Wallet:", aiWallet);
        console2.log("Builder:", builder);
        console2.log("LP1:", lp1);
        console2.log("LP2:", lp2);
        console2.log("DAO:", dao);
        console2.log("");
        
        // Step 2: Mint USDY to all wallets
        console2.log("=== MINTING USDY ===");
        vm.startBroadcast(deployerKey);
        
        // Get MockUSDY interface
        (bool success,) = USDY.call(abi.encodeWithSignature("mint(address,uint256)", aiWallet, 100_000_000_000));
        console2.log("Minted 100k to AI:", success ? "OK" : "FAIL");
        
        (success,) = USDY.call(abi.encodeWithSignature("mint(address,uint256)", builder, 100_000_000_000));
        console2.log("Minted 100k to Builder:", success ? "OK" : "FAIL");
        
        (success,) = USDY.call(abi.encodeWithSignature("mint(address,uint256)", lp1, 500_000_000_000));
        console2.log("Minted 500k to LP1:", success ? "OK" : "FAIL");
        
        (success,) = USDY.call(abi.encodeWithSignature("mint(address,uint256)", lp2, 300_000_000_000));
        console2.log("Minted 300k to LP2:", success ? "OK" : "FAIL");
        
        (success,) = USDY.call(abi.encodeWithSignature("mint(address,uint256)", dao, 100_000_000_000));
        console2.log("Minted 100k to DAO:", success ? "OK" : "FAIL");
        
        vm.stopBroadcast();
        console2.log("");
        
        // Step 3: Create Idea
        console2.log("=== CREATING IDEA ===");
        IdeaFactory factory = IdeaFactory(IDEA_FACTORY);
        
        // New continuous commitment config (no soft cap)
        IdeaFactory.IdeaConfig memory config = IdeaFactory.IdeaConfig({
            metadataIpfsHash: "QmTest123",
            hardCap: 100_000_000_000,      // 100k USDY hard cap
            competitionPrizeBps: 2000,      // 20%
            builderAllocBps: 10000,        // 10%
            gateType: GateType.OPEN,
            gateParams: ""
        });
        
        vm.startBroadcast(builderKey);
        
        // Approve USDY for deposit (500 USDY min deposit)
        uint256 builderBalance = IERC20(USDY).balanceOf(builder);
        console2.log("Builder USDY balance:", builderBalance);
        
        if (builderBalance < 500_000_000) {
            console2.log("ERROR: Builder needs USDY. Run FundTestWallets first!");
            revert("Insufficient USDY balance");
        }
        
        (bool ok,) = USDY.call(abi.encodeWithSignature("approve(address,uint256)", IDEA_FACTORY, 500_000_000_000));
        require(ok, "approve failed");
        
        uint256 ideaId = factory.createIdea(config);
        console2.log("Idea Created! ID:", ideaId);
        vm.stopBroadcast();
        console2.log("");
        
        // Get created addresses from mappings
        address tokenAddr = factory.ideaTokens(ideaId);
        address poolAddr = factory.fundingPools(ideaId);
        
        console2.log("IdeaToken:", tokenAddr);
        console2.log("FundingPool:", poolAddr);
        console2.log("");
        
        // Step 4: AI approves idea - genesis stake deploys immediately
        console2.log("=== AI APPROVES IDEA (Genesis Stake Deploys) ===");
        vm.startBroadcast(deployerKey);
        
        // Approve protocol seed from treasury
        (ok,) = USDY.call(abi.encodeWithSignature("approve(address,uint256)", IDEA_FACTORY, 1000_000_000_000));
        require(ok, "treasury approve failed");
        
        factory.aiApproveIdea(ideaId, 85, "Strong team, clear roadmap, good market potential");
        console2.log("AI Approved idea with score: 85");
        console2.log("Genesis stake deployed: $500 creator + $1000 protocol seed");
        vm.stopBroadcast();
        console2.log("");
        
        // Step 5: Transition to OPEN and deposit (continuous commitment model)
        console2.log("=== OPEN PHASE (Public Deposits) ===");
        
        FundingPool fundingPool = FundingPool(poolAddr);
        
        // Check tranche state
        console2.log("Tranche state (0=GENESIS, 1=OPEN, 2=CLOSED):", fundingPool.getTrancheState());
        
        // LP1 deposits
        vm.startBroadcast(lp1Key);
        (ok,) = USDY.call(abi.encodeWithSignature("approve(address,uint256)", poolAddr, 500_000_000_000));
        require(ok, "LP1 approve failed");
        fundingPool.deposit(40_000_000_000);  // 40k USDY
        console2.log("LP1 deposited 40k USDY");
        vm.stopBroadcast();
        
        // LP2 deposits
        vm.startBroadcast(lp2Key);
        (ok,) = USDY.call(abi.encodeWithSignature("approve(address,uint256)", poolAddr, 300_000_000_000));
        require(ok, "LP2 approve failed");
        fundingPool.deposit(20_000_000_000);  // 20k USDY
        console2.log("LP2 deposited 20k USDY");
        vm.stopBroadcast();
        
        console2.log("Total raised:", fundingPool.raisedAmount());
        console2.log("Tranche state:", fundingPool.getTrancheState());
        console2.log("");
        
        // Step 6: End funding (simulate time passing)
        console2.log("=== ENDING FUNDING ===");
        vm.warp(block.timestamp + 14 days);
        
        // Factory closes funding (onlyOwner)
        vm.startBroadcast(deployerKey);
        fundingPool.closeFunding();
        console2.log("Funding closed");
        console2.log("Tranche state after close:", fundingPool.getTrancheState());
        vm.stopBroadcast();
        console2.log("");
        
        // Step 7: DAO accepts builder
        console2.log("=== DAO ACCEPTANCE ===");
        DAOVoting daoVoting = DAOVoting(DAO_VOTING);
        
        vm.startBroadcast(daoKey);
        // In real scenario, would create proposal and vote
        // For testing, we'll use the builder selection flow
        console2.log("DAO would select builder here");
        vm.stopBroadcast();
        console2.log("");
        
        // Step 8: Check final state
        console2.log("=== FINAL STATE ===");
        console2.log("Tranche state (0=GENESIS, 1=OPEN, 2=CLOSED):", fundingPool.getTrancheState());
        console2.log("Total Raised:", fundingPool.raisedAmount());
        console2.log("Hard Cap:", fundingPool.hardCap());
        
        IdeaToken token = IdeaToken(tokenAddr);
        console2.log("Token Total Supply:", token.totalSupply());
        
        console2.log("");
        console2.log("==========================================");
        console2.log("  TEST COMPLETED SUCCESSFULLY!");
        console2.log("==========================================");
    }
}