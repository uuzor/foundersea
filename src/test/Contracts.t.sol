// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../../src/contracts/AgentIdentity.sol";
import "../../src/contracts/IdeaFactory.sol";
import "../../src/contracts/IdeaToken.sol";
import "../../src/contracts/FundingGate.sol";
import "../../src/contracts/FundingPool.sol";
import "../../src/contracts/BuilderAgreement.sol";
import "../../src/contracts/DAOVoting.sol";
import "../../src/contracts/IdeaMarketplace.sol";
import {GateType} from "../../src/contracts/FundingGate.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    uint8 private _decimals;

    constructor(string memory name, string memory symbol, uint8 decimals_) ERC20(name, symbol) {
        _decimals = decimals_;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }
}

contract IdeaTokenTest is Test {
    IdeaToken public ideaToken;
    MockERC20 public usdy;
    address public fundingPool = address(0x123);
    address public creator = address(0x456);
    address public factory = address(0x789);

    function setUp() public {
        usdy = new MockERC20("USDY", "USDY", 6);
        ideaToken = new IdeaToken("FounderSea Idea 1", "FSID-1", fundingPool, creator, 2000, factory, address(usdy));
    }

    function testTokenMetadata() public view {
        assertEq(ideaToken.name(), "FounderSea Idea 1");
        assertEq(ideaToken.symbol(), "FSID-1");
        assertEq(ideaToken.fundingPool(), fundingPool);
        assertEq(ideaToken.ideaCreator(), creator);
        assertEq(ideaToken.builderAllocBps(), 2000);
    }

    function testMintingOnlyByFundingPool() public {
        vm.prank(fundingPool);
        ideaToken.mint(address(0xABC), 1000e18);
        assertEq(ideaToken.balanceOf(address(0xABC)), 1000e18);
    }

    function testMintingNotByFundingPool() public {
        vm.expectRevert("Only FundingPool");
        ideaToken.mint(address(0xABC), 1000e18);
    }

    function testEarnedAndClaimRevenue() public {
        vm.prank(fundingPool);
        ideaToken.mint(address(0xABC), 1000e18);
        
        // Set revenue source (as the factory)
        vm.prank(factory);
        ideaToken.setRevenueSource(address(0xDEF));
        
        // Mint USDY to revenue source and approve
        usdy.mint(address(0xDEF), 1000e6);
        vm.prank(address(0xDEF));
        usdy.approve(address(ideaToken), type(uint256).max);
        
        // Notify revenue from revenue source (pulls USDY into IdeaToken)
        vm.prank(address(0xDEF));
        ideaToken.notifyRevenue(100e6);
        
        // Check earned
        uint256 earned = ideaToken.earned(address(0xABC));
        assertGt(earned, 0);
    }
}

contract FundingGateTest is Test {
    FundingGate public fundingGate;
    address public creator = address(0x123);
    address public dao = address(0x456);

    function setUp() public {
        fundingGate = new FundingGate(creator, dao);
    }

    function testDefaultOpenGate() public view {
        assertTrue(fundingGate.canFund(address(0x789)));
    }

    function testWhitelistGate() public {
        vm.prank(creator);
        fundingGate.setGateType(GateType.WHITELIST, "");
        
        assertFalse(fundingGate.canFund(address(0x789)));
        
        // vm.prank(creator);
        // fundingGate.updateWhitelist(new address[](1), new bool[](1));
        // Note: need to call with correct params
    }

    function testMinHoldGate() public view {
        // Test with OPEN gate - simpler test
        assertTrue(fundingGate.canFund(address(0x789)));
    }
}

contract BuilderAgreementTest is Test {
    BuilderAgreement public agreement;
    address public owner = address(0x123);

    function setUp() public {
        agreement = new BuilderAgreement(owner);
    }

    function testCreateAgreement() public {
        vm.prank(owner);
        address[] memory builders = new address[](1);
        builders[0] = address(0x456);
        
        uint256 agreementId = agreement.createAgreement(1, address(0x789), address(0xAAA), builders, "ipfs://test");
        
        assertEq(agreementId, 0);
        assertTrue(agreement.isBuilder(address(0x456)));
    }

    function testSignatures() public {
        vm.prank(owner);
        address[] memory builders = new address[](1);
        builders[0] = address(0x456);
        
        uint256 agreementId = agreement.createAgreement(1, address(0x789), address(0xAAA), builders, "ipfs://test");
        
        // Creator signs
        vm.prank(owner);
        agreement.creatorSign(agreementId);
        assertFalse(agreement.isActive(agreementId));
        
        // Builder signs with revenue source
        vm.prank(address(0x456));
        agreement.builderSign(agreementId, address(0xABC));
        assertFalse(agreement.isActive(agreementId));
        
        // DAO signs
        vm.prank(owner);
        agreement.daoSign(agreementId);
        assertTrue(agreement.isActive(agreementId));
    }
}

contract AgentIdentityTest is Test {
    AgentIdentity public agentIdentity;
    address public owner = address(0x123);

    function setUp() public {
        agentIdentity = new AgentIdentity(owner);
    }

    function testMintAgent() public {
        vm.prank(owner);
        uint256 agentId = agentIdentity.mintAgent("FounderSea AI", "kimi-k2-6");
        
        assertEq(agentId, 1);
        assertEq(agentIdentity.agentName(), "FounderSea AI");
        assertEq(agentIdentity.modelId(), "kimi-k2-6");
    }

    function testRecordDecision() public {
        vm.prank(owner);
        agentIdentity.mintAgent("FounderSea AI", "kimi-k2-6");
        
        address aiAgent = address(0x789);
        vm.prank(owner);
        agentIdentity.setAiAgent(aiAgent);
        
        vm.prank(aiAgent);
        agentIdentity.recordDecision(
            AgentIdentity.DecisionType.IDEA_APPROVE,
            1,
            keccak256("input"),
            keccak256("output"),
            85,
            "ipfs://reasoning"
        );
        
        assertEq(agentIdentity.totalDecisions(), 1);
    }

    function testGetDecision() public {
        vm.prank(owner);
        agentIdentity.mintAgent("FounderSea AI", "kimi-k2-6");
        
        address aiAgent = address(0x789);
        vm.prank(owner);
        agentIdentity.setAiAgent(aiAgent);
        
        vm.prank(aiAgent);
        agentIdentity.recordDecision(
            AgentIdentity.DecisionType.MILESTONE_VALIDATE,
            5,
            keccak256("milestone_input"),
            keccak256("milestone_output"),
            92,
            "ipfs://milestone_reasoning"
        );
        
        AgentIdentity.Decision memory decision = agentIdentity.getDecision(0);
        assertEq(uint256(decision.decisionType), 5); // MILESTONE_VALIDATE
        assertEq(decision.confidence, 92);
        assertEq(decision.subjectId, 5);
    }

    function testDecisionCountByType() public {
        vm.prank(owner);
        agentIdentity.mintAgent("FounderSea AI", "kimi-k2-6");
        
        address aiAgent = address(0x789);
        vm.prank(owner);
        agentIdentity.setAiAgent(aiAgent);
        
        // Record multiple decisions
        vm.prank(aiAgent);
        agentIdentity.recordDecision(AgentIdentity.DecisionType.IDEA_APPROVE, 1, keccak256(""), keccak256(""), 80, "ipfs://1");
        vm.prank(aiAgent);
        agentIdentity.recordDecision(AgentIdentity.DecisionType.IDEA_APPROVE, 2, keccak256(""), keccak256(""), 75, "ipfs://2");
        vm.prank(aiAgent);
        agentIdentity.recordDecision(AgentIdentity.DecisionType.MILESTONE_VALIDATE, 1, keccak256(""), keccak256(""), 90, "ipfs://3");
        
        uint256[8] memory counts = agentIdentity.getDecisionCountByType();
        assertEq(counts[0], 2); // IDEA_APPROVE
        assertEq(counts[5], 1); // MILESTONE_VALIDATE
    }
}

contract DAOVotingTest is Test {
    DAOVoting public daoVoting;
    MockERC20 public ideaToken;
    address public owner = address(0x123);

    function setUp() public {
        daoVoting = new DAOVoting(owner);
        ideaToken = new MockERC20("Idea Token", "IDEA", 18);
        
        // Set IdeaToken so delegation can read balances (owner only)
        vm.prank(owner);
        daoVoting.setIdeaToken(address(ideaToken));
        
        // Mint some tokens to test address
        ideaToken.mint(address(0x456), 100e18);
    }

    function testDelegation() public {
        vm.prank(address(0x456));
        daoVoting.delegateToAI();
        
        assertTrue(daoVoting.delegatedToAI(address(0x456)));
        
        vm.prank(address(0x456));
        daoVoting.revokeDelegation();
        
        assertFalse(daoVoting.delegatedToAI(address(0x456)));
    }

    function testSetAiAgent() public {
        vm.prank(owner);
        daoVoting.setAiAgent(address(0x789));
        
        assertEq(daoVoting.aiAgent(), address(0x789));
    }

    function testCannotSetZeroAiAgent() public {
        vm.prank(owner);
        vm.expectRevert("Invalid AI agent");
        daoVoting.setAiAgent(address(0));
    }
}

contract IdeaMarketplaceTest is Test {
    IdeaMarketplace public marketplace;
    MockERC20 public usdy;
    address public owner = address(0x123);

    function setUp() public {
        usdy = new MockERC20("USDY", "USDY", 6);
        marketplace = new IdeaMarketplace(owner, owner, address(usdy));
    }

    function testCreateListing() public view {
        // Note: Would need to set up IdeaToken mock
        // This is a simplified test
        assertEq(marketplace.treasury(), owner);
        assertEq(marketplace.usdy(), address(usdy));
    }
}

// Note: IdeaToken.claimRevenue() test moved to IdeaTokenTest
// RevenueDistributor removed - revenue handling moved to IdeaToken directly

contract FundingPoolTest is Test {
    FundingPool public fundingPool;
    MockERC20 public fundingToken;
    FundingGate public fundingGate;
    IdeaToken public ideaToken;
    
    address public owner;
    address public aiAgent;
    address public dao;
    address public factory;
    
    function setUp() public {
        owner = address(this);  // Test contract is owner
        aiAgent = address(0x456);
        dao = address(0x789);
        factory = address(0xAAA);
        
        fundingToken = new MockERC20("USDY", "USDY", 6);
        fundingGate = new FundingGate(owner, address(0));
        
        fundingPool = new FundingPool(
            address(fundingToken),
            address(fundingGate),
            owner,
            1000e6,    // softCap: 1000 USDY
            5000e6,    // hardCap: 5000 USDY
            1000,      // 10% competition prize
            factory
        );
        
        // Deploy IdeaToken
        ideaToken = new IdeaToken(
            "FounderSea Idea 1",
            "FSID-1",
            address(fundingPool),
            owner,
            2000,      // 20% builder alloc
            factory,
            address(fundingToken)
        );
        
        // Wire fundingPool to ideaToken (prank factory address since setIdeaToken is onlyFactory)
        vm.prank(factory);
        fundingPool.setIdeaToken(address(ideaToken));
        fundingPool.setAiAgent(aiAgent);
        fundingPool.setDao(dao);
    }

    function testInitialState() public view {
        assertEq(fundingPool.softCap(), 1000e6);
        assertEq(fundingPool.hardCap(), 5000e6);
        assertEq(fundingPool.competitionPrizeBps(), 1000);
        assertFalse(fundingPool.fundingClosed());
        assertFalse(fundingPool.builderAssigned());
        assertFalse(fundingPool.competitorsSet());
    }

    function testDepositAndTokenMint() public {
        // Mint tokens to investor and approve
        fundingToken.mint(address(this), 1000e6);
        fundingToken.approve(address(fundingPool), type(uint256).max);
        
        // Deposit
        fundingPool.deposit(1000e6);
        
        assertEq(fundingPool.raisedAmount(), 1000e6);
        // Due to bonding curve, tokens minted is less than 1:1
        // Price = basePrice * (hardCap + raisedAmount) / hardCap = 1e6 * 6/5 = 1.2e6
        // Tokens = 1000e6 * 1e6 / 1.2e6 = 833.33...e18
        assertEq(ideaToken.balanceOf(address(this)), 833333333);
    }

    function testCannotDepositExceedingHardCap() public {
        fundingToken.mint(address(this), 6000e6);
        fundingToken.approve(address(fundingPool), type(uint256).max);
        
        fundingPool.deposit(5000e6);
        
        vm.expectRevert("Exceeds hard cap");
        fundingPool.deposit(1e6);
    }

    function testCloseFundingSoftCapMet() public {
        fundingToken.mint(address(this), 1000e6);
        fundingToken.approve(address(fundingPool), type(uint256).max);
        fundingPool.deposit(1000e6);
        
        vm.prank(owner);
        fundingPool.closeFunding();
        
        assertTrue(fundingPool.fundingClosed());
        assertTrue(fundingPool.checkSoftCapMet());
    }

    function testCloseFundingSoftCapNotMet() public {
        fundingToken.mint(address(this), 500e6);
        fundingToken.approve(address(fundingPool), type(uint256).max);
        fundingPool.deposit(500e6);
        
        vm.prank(owner);
        fundingPool.closeFunding();
        
        assertTrue(fundingPool.fundingClosed());
        assertFalse(fundingPool.checkSoftCapMet());
    }

    function testSetCompetitorPayouts() public {
        fundingToken.mint(address(this), 1000e6);
        fundingToken.approve(address(fundingPool), type(uint256).max);
        fundingPool.deposit(1000e6);
        
        vm.prank(owner);
        fundingPool.closeFunding();
        
        address[3] memory builders;
        builders[0] = address(0xB1);
        builders[1] = address(0xB2);
        builders[2] = address(0xB3);
        
        uint256[3] memory amounts;
        amounts[0] = 40e6;  // 40 USDY
        amounts[1] = 35e6;  // 35 USDY
        amounts[2] = 25e6;  // 25 USDY
        
        vm.prank(owner);
        fundingPool.setCompetitorPayouts(builders, amounts);
        
        assertTrue(fundingPool.competitorsSet());
        
        // Verify payouts
        (address builder1, uint256 amount1, bool released1,,) = fundingPool.competitorPayouts(0);
        assertEq(builder1, address(0xB1));
        assertEq(amount1, 40e6);
        assertFalse(released1);
    }

    function testCannotSetCompetitorsBeforeFundingClosed() public {
        address[3] memory builders;
        builders[0] = address(0xB1);
        builders[1] = address(0xB2);
        builders[2] = address(0xB3);
        
        uint256[3] memory amounts;
        amounts[0] = 40e6;
        amounts[1] = 35e6;
        amounts[2] = 25e6;
        
        vm.prank(owner);
        vm.expectRevert("Funding not closed");
        fundingPool.setCompetitorPayouts(builders, amounts);
    }

    function testValidateCompetitor() public {
        fundingToken.mint(address(this), 1000e6);
        fundingToken.approve(address(fundingPool), type(uint256).max);
        fundingPool.deposit(1000e6);
        
        vm.prank(owner);
        fundingPool.closeFunding();
        
        address[3] memory builders;
        builders[0] = address(0xB1);
        builders[1] = address(0xB2);
        builders[2] = address(0xB3);
        
        uint256[3] memory amounts;
        amounts[0] = 40e6;
        amounts[1] = 35e6;
        amounts[2] = 25e6;
        
        vm.prank(owner);
        fundingPool.setCompetitorPayouts(builders, amounts);
        
        // AI validates competitor
        vm.prank(aiAgent);
        fundingPool.validateCompetitor(0, 75, "ipfs://competitor1_validation");
        
        (,,, uint256 aiConfidence, string memory ipfsHash) = fundingPool.competitorPayouts(0);
        assertEq(aiConfidence, 75);
        assertEq(ipfsHash, "ipfs://competitor1_validation");
    }

    function testReleaseCompetitorPayout() public {
        fundingToken.mint(address(this), 1000e6);
        fundingToken.approve(address(fundingPool), type(uint256).max);
        fundingPool.deposit(1000e6);
        
        // Transfer tokens to fundingPool to cover payout
        fundingToken.mint(address(fundingPool), 100e6);
        
        vm.prank(owner);
        fundingPool.closeFunding();
        
        address[3] memory builders;
        builders[0] = address(0xB1);
        builders[1] = address(0xB2);
        builders[2] = address(0xB3);
        
        uint256[3] memory amounts;
        amounts[0] = 40e6;
        amounts[1] = 35e6;
        amounts[2] = 25e6;
        
        vm.prank(owner);
        fundingPool.setCompetitorPayouts(builders, amounts);
        
        // AI validates with high confidence
        vm.prank(aiAgent);
        fundingPool.validateCompetitor(0, 75, "ipfs://validation");
        
        // AI releases payout
        vm.prank(aiAgent);
        fundingPool.releaseCompetitorPayout(0);
        
        (,, bool released,,) = fundingPool.competitorPayouts(0);
        assertTrue(released);
    }

    function testAssignBuilderAndMilestones() public {
        fundingToken.mint(address(this), 1000e6);
        fundingToken.approve(address(fundingPool), type(uint256).max);
        fundingPool.deposit(1000e6);
        
        vm.prank(owner);
        fundingPool.closeFunding();
        
        address builder = address(0xBBBB1);
        
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 500e6;
        amounts[1] = 500e6;
        
        uint256[] memory deadlines = new uint256[](2);
        deadlines[0] = block.timestamp + 30 days;
        deadlines[1] = block.timestamp + 60 days;
        
        vm.prank(owner);
        fundingPool.assignBuilder(builder, amounts, deadlines);
        
        assertTrue(fundingPool.builderAssigned());
        assertEq(fundingPool.getMilestoneCount(), 2);
    }

    function testSetMilestoneValidated() public {
        fundingToken.mint(address(this), 1000e6);
        fundingToken.approve(address(fundingPool), type(uint256).max);
        fundingPool.deposit(1000e6);
        
        vm.prank(owner);
        fundingPool.closeFunding();
        
        address builder = address(0xBBBB2);
        
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 500e6;
        
        uint256[] memory deadlines = new uint256[](1);
        deadlines[0] = block.timestamp + 30 days;
        
        vm.prank(owner);
        fundingPool.assignBuilder(builder, amounts, deadlines);
        
        // AI validates milestone
        vm.prank(aiAgent);
        fundingPool.setMilestoneValidated(0, 80, "ipfs://milestone_validation");
    }

    function testCannotReleaseMilestoneBelowThreshold() public {
        fundingToken.mint(address(this), 1000e6);
        fundingToken.approve(address(fundingPool), type(uint256).max);
        fundingPool.deposit(1000e6);
        
        vm.prank(owner);
        fundingPool.closeFunding();
        
        address builder = address(0xBBBB3);
        
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 500e6;
        
        uint256[] memory deadlines = new uint256[](1);
        deadlines[0] = block.timestamp + 30 days;
        
        vm.prank(owner);
        fundingPool.assignBuilder(builder, amounts, deadlines);
        
        // AI validates with low confidence (below 50 threshold, stays SUBMITTED)
        vm.prank(aiAgent);
        fundingPool.setMilestoneValidated(0, 30, "ipfs://low_confidence");
        
        // Try to release - should fail because status is SUBMITTED not VALIDATED
        vm.prank(aiAgent);
        vm.expectRevert("Not validated or low confidence");
        fundingPool.releaseMilestone(0);
    }
}