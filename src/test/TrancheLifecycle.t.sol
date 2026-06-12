// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "forge-std/console2.sol";
import {MockUSDY} from "../contracts/MockUSDY.sol";
import {MockAIAgent} from "../contracts/mock/MockAIAgent.sol";
import {IdeaFactory} from "../contracts/IdeaFactory.sol";
import {FundingPool} from "../contracts/FundingPool.sol";
import {FundingPoolFactory} from "../contracts/FundingPoolFactory.sol";
import {IdeaTokenFactory} from "../contracts/IdeaTokenFactory.sol";
import {GateType} from "../contracts/FundingGate.sol";

/**
 * Full Lifecycle Test for Continuous Commitment Tranches
 * Tests: GENESIS -> OPEN -> CLOSED flow
 */
contract TrancheLifecycleTest is Test {
    // Contracts
    MockUSDY public usdy;
    IdeaFactory public factory;
    MockAIAgent public aiAgent;
    FundingPoolFactory public fundingPoolFactory;
    IdeaTokenFactory public ideaTokenFactory;
    FundingPool public fundingPool; // Will be set after idea creation
    
    // Test addresses
    address public creator = address(0x1);
    address public treasury = address(0x2);
    address public lp1 = address(0x3);
    address public lp2 = address(0x4);
    address public builder = address(0x5);
    
    // Constants
    uint256 public constant MIN_CREATOR_DEPOSIT = 500e6; // $500 USDY
    uint256 public constant PROTOCOL_SEED_AMOUNT = 1000e6; // $1000 USDY
    uint256 public constant HARD_CAP = 100_000e6; // 100k USDY
    
    function setUp() public {
        // Deploy mock USDY
        usdy = new MockUSDY(treasury);
        
        // Deploy AI Agent
        aiAgent = new MockAIAgent();
        
        // Deploy factories
        fundingPoolFactory = new FundingPoolFactory(treasury);
        ideaTokenFactory = new IdeaTokenFactory(treasury);
        
        // Deploy factory with factories pre-configured
        factory = new IdeaFactory(
            address(usdy),
            treasury,
            address(aiAgent)  // aiAgent is owner
        );
        
        // Set factories and aiAgent (needed for deploying pools/tokens) - owner (aiAgent) calls
        vm.prank(address(aiAgent));
        factory.setFactories(address(fundingPoolFactory), address(ideaTokenFactory));
        vm.prank(address(aiAgent));
        factory.setAiAgent(address(aiAgent));
        
        // Mint USDY to test addresses (treasury is owner)
        vm.prank(treasury);
        usdy.mint(creator, 10_000e6);
        vm.prank(treasury);
        usdy.mint(lp1, 100_000e6);
        vm.prank(treasury);
        usdy.mint(lp2, 100_000e6);
        
        // Mint protocol seed amount to treasury for aiApproveIdea
        vm.prank(treasury);
        usdy.mint(treasury, 1_000_000e6);
    }
    
    function testTrancheLifecycle() public {
        console2.log("==============================================");
        console2.log("  FounderSea Tranche Lifecycle Test");
        console2.log("==============================================");
        console2.log("");
        
        // ============================================
        // STEP 1: Creator creates idea
        // ============================================
        console2.log("[STEP 1] Creator creates idea...");
        
        IdeaFactory.IdeaConfig memory config = IdeaFactory.IdeaConfig({
            metadataIpfsHash: "QmTestIdea123",
            hardCap: HARD_CAP,
            competitionPrizeBps: 2000,      // 20%
            builderAllocBps: 10000,         // 10%
            gateType: GateType.OPEN,
            gateParams: ""
        });
        
        // Creator approves USDY for deposit
        vm.startPrank(creator);
        usdy.approve(address(factory), MIN_CREATOR_DEPOSIT);
        
        uint256 ideaId = factory.createIdea(config);
        vm.stopPrank();
        console2.log("  Idea Created! ID:", ideaId);
        
        // Get deployed addresses using getIdea function
        (
            ,
            ,
            address fundingPoolAddr,
            ,
            ,
            ,
            
        ) = factory.getIdea(ideaId);
        
        fundingPool = FundingPool(fundingPoolAddr);
        
        // Set aiAgent and dao on funding pool (owner is treasury)
        vm.prank(treasury);
        fundingPool.setAiAgent(address(aiAgent));
        vm.prank(treasury);
        fundingPool.setDao(treasury);
        
        console2.log("  FundingPool:", fundingPoolAddr);
        console2.log("  Tranche State (0=GENESIS):", fundingPool.getTrancheState());
        console2.log("  Raised Amount:", fundingPool.raisedAmount());
        console2.log("");
        
        // ============================================
        // STEP 2: AI approves idea -> Genesis stake deploys
        // ============================================
        console2.log("[STEP 2] AI approves idea (genesis stake deploys)...");
        
        // Treasury approves USDY for protocol seed
        vm.prank(treasury);
        usdy.approve(address(factory), PROTOCOL_SEED_AMOUNT);
        
        // AI approves idea - this triggers _deployGenesisStake internally
        vm.prank(address(aiAgent));
        factory.aiApproveIdea(ideaId, 85, "ipfs://approval-reason");
        
        // Check state after approval
        console2.log("  Idea Status (1=APPROVED):", uint8(factory.getIdeaStatus(ideaId)));
        console2.log("  FundingPool raisedAmount:", fundingPool.raisedAmount());
        
        // Verify genesis stake amounts
        // Creator's deposit + protocol seed = $1500 total in genesis
        uint256 expectedGenesis = MIN_CREATOR_DEPOSIT + PROTOCOL_SEED_AMOUNT;
        console2.log("  Expected Genesis Total:", expectedGenesis);
        console2.log("  Actual Raised:", fundingPool.raisedAmount());
        console2.log("");
        
        // ============================================
        // STEP 3: Builder assigned, transition to OPEN
        // ============================================
        console2.log("[STEP 3] Assign builder, transition to OPEN...");
        
        // Set builder on funding pool
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 50_000e6;  // $50k for milestone 1
        amounts[1] = 50_000e6;  // $50k for milestone 2
        
        uint256[] memory deadlines = new uint256[](2);
        deadlines[0] = block.timestamp + 30 days;
        deadlines[1] = block.timestamp + 60 days;
        
        // Treasury is owner of FundingPool
        vm.startPrank(treasury);
        fundingPool.assignBuilder(builder, amounts, deadlines);
        vm.stopPrank();
        
        // AI agent transitions idea to active (this also calls transitionToOpen on pool)
        vm.startPrank(address(aiAgent));
        factory.transitionToActive(ideaId);
        vm.stopPrank();
        
        console2.log("  Builder assigned:", builder);
        console2.log("  Tranche State (1=OPEN):", fundingPool.getTrancheState());
        console2.log("");
        
        // ============================================
        // STEP 4: LPs deposit (continuous commitment)
        // ============================================
        console2.log("[STEP 4] LPs deposit (continuous commitment)...");
        
        // LP1 deposits
        vm.startPrank(lp1);
        usdy.approve(address(fundingPool), type(uint256).max);
        fundingPool.deposit(20_000e6);
        vm.stopPrank();
        console2.log("  LP1 deposited 20k USDY");
        console2.log("  Total Raised:", fundingPool.raisedAmount());
        
        // LP2 deposits
        vm.startPrank(lp2);
        usdy.approve(address(fundingPool), type(uint256).max);
        fundingPool.deposit(30_000e6);
        vm.stopPrank();
        console2.log("  LP2 deposited 30k USDY");
        console2.log("  Total Raised:", fundingPool.raisedAmount());
        console2.log("");
        
        // ============================================
        // STEP 5: Set competitors (contestants)
        // ============================================
        console2.log("[STEP 5] Set competition contestants...");
        
        address[3] memory builders = [address(0xA1), address(0xA2), address(0xA3)];
        uint256[3] memory compAmounts = [uint256(40e6), uint256(35e6), uint256(25e6)]; // 100 USDY total
        
        vm.startPrank(treasury);
        fundingPool.setCompetitorPayouts(builders, compAmounts);
        vm.stopPrank();
        console2.log("  Competitors set");
        console2.log("");
        
        // ============================================
        // STEP 6: Milestone validation and release
        // ============================================
        console2.log("[STEP 6] Milestone submission and validation...");
        
        // Builder submits milestone
        vm.startPrank(builder);
        fundingPool.submitMilestone(0);
        vm.stopPrank();
        console2.log("  Milestone 0 submitted");
        
        // AI validates milestone
        vm.startPrank(address(aiAgent));
        fundingPool.setMilestoneValidated(0, 85, "ipfs://milestone1-validation");
        
        // Start timelock for large release (50k >= 10k threshold)
        fundingPool.startTimelock(0);
        vm.stopPrank();
        
        // DAO approves and warps time past timelock
        vm.startPrank(treasury);
        fundingPool.daoApproveMilestone(0);
        vm.stopPrank();
        
        // Warp past 48h timelock
        vm.warp(block.timestamp + 48 hours + 1);
        
        // AI releases milestone after timelock expires
        vm.startPrank(address(aiAgent));
        fundingPool.releaseMilestone(0);
        vm.stopPrank();
        console2.log("  Milestone 0 validated, approved, and released (confidence: 85)");
        console2.log("");
        
        // ============================================
        // STEP 7: Close funding (hard cap or governance)
        // ============================================
        console2.log("[STEP 7] Close funding...");
        
        // Move time forward
        vm.warp(block.timestamp + 14 days);
        
        // Close funding (owner is treasury)
        vm.startPrank(treasury);
        fundingPool.closeFunding();
        vm.stopPrank();
        
        console2.log("  Tranche State (2=CLOSED):", fundingPool.getTrancheState());
        console2.log("  Final Raised:", fundingPool.raisedAmount());
        console2.log("");
        
        // ============================================
        // SUMMARY
        // ============================================
        console2.log("==============================================");
        console2.log("  LIFECYCLE TEST COMPLETE!");
        console2.log("==============================================");
        console2.log("");
        console2.log("Summary:");
        console2.log("  - Idea created with hardCap:", HARD_CAP);
        console2.log("  - Genesis stake deployed:", expectedGenesis);
        console2.log("  - LPs committed:", fundingPool.raisedAmount() - expectedGenesis);
        console2.log("  - Total raised:", fundingPool.raisedAmount());
        console2.log("");
        console2.log("Tranche States:");
        console2.log("  1. GENESIS (0): Initial state, genesis stake deployed");
        console2.log("  2. OPEN (1): Public deposits accepted");
        console2.log("  3. CLOSED (2): Hard cap hit or governance closed");
        console2.log("");
        
        // Assertions
        assertEq(uint8(factory.getIdeaStatus(ideaId)), 4, "Idea should be COMPLETED"); // 4 = COMPLETED
        assertEq(uint8(fundingPool.getTrancheState()), 2, "Tranche should be CLOSED");
        assertGt(fundingPool.raisedAmount(), expectedGenesis, "Should have raised more than genesis stake");
    }
}
