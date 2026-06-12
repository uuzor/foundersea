// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IIdeaToken.sol";

contract IdeaToken is ERC20, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    IERC20 public USDY;
    address public immutable fundingPool;
    address public revenueSource; // Set by BuilderAgreement at signing
    address public ideaCreator;
    uint256 public builderAllocBps;
    address public assignedBuilder;
    bool public builderAllocMinted;

    // Revenue accounting (pull-based)
    uint256 public revenuePerTokenStored;
    mapping(address => uint256) public revenueDebt;
    address public revenueDistributor;

    address public immutable factory;

    modifier onlyFundingPool() {
        require(msg.sender == fundingPool, "Only FundingPool");
        _;
    }

    // Revenue accounting fix: snapshot both parties' debt at transfer time
    // This prevents transferred tokens from claiming revenue they didn't earn
    // Override _update for OpenZeppelin v5.x compatibility
    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0)) {
            revenueDebt[from] = revenuePerTokenStored;
        }
        if (to != address(0)) {
            revenueDebt[to] = revenuePerTokenStored;
        }
        super._update(from, to, value);
    }

    constructor(
        string memory name,
        string memory symbol,
        address _fundingPool,
        address _ideaCreator,
        uint256 _builderAllocBps,
        address _factory,
        address _usdy
    ) ERC20(name, symbol) Ownable(_ideaCreator) {
        require(_fundingPool != address(0), "Invalid funding pool");
        require(_builderAllocBps >= 1000 && _builderAllocBps <= 30000, "Invalid builder alloc");
        fundingPool = _fundingPool;
        ideaCreator = _ideaCreator;
        builderAllocBps = _builderAllocBps;
        factory = _factory;
        USDY = IERC20(_usdy);
    }

    // Called by BuilderAgreement when fully signed
    function setRevenueSource(address source) external {
        require(msg.sender == factory, "Only factory");
        require(revenueSource == address(0), "Already set");
        revenueSource = source;
    }

    function setRevenueDistributor(address distributor) external onlyOwner {
        require(revenueDistributor == address(0), "Already set");
        revenueDistributor = distributor;
    }

    function earned(address account) public view returns (uint256) {
        uint256 balance = balanceOf(account);
        if (balance == 0) return 0;
        return (balance * (revenuePerTokenStored - revenueDebt[account])) / 1e18;
    }

    // Revenue source calls this when product earns USDY (pulls USDY into this contract)
    function notifyRevenue(uint256 amount) external {
        require(msg.sender == revenueSource, "Only revenue source");
        if (totalSupply() == 0) return;
        USDY.safeTransferFrom(msg.sender, address(this), amount);
        revenuePerTokenStored += (amount * 1e18) / totalSupply();
    }

    // Token holders call this to claim their share
    function claimRevenue() external nonReentrant returns (uint256 amount) {
        amount = earned(msg.sender);
        require(amount > 0, "Nothing to claim");
        revenueDebt[msg.sender] = revenuePerTokenStored;
        USDY.safeTransfer(msg.sender, amount);
    }

    // Gated minting — only FundingPool during funding round
    function mint(address to, uint256 amount) external onlyFundingPool {
        _mint(to, amount);
    }

    // Gated burn — only FundingPool for refunds
    function burn(address from, uint256 amount) external onlyFundingPool {
        _burn(from, amount);
    }

    // Called once, after BuilderAgreement signed
    function mintBuilderAlloc(address builder) external onlyFundingPool {
        require(!builderAllocMinted, "Already minted");
        builderAllocMinted = true;
        uint256 mintAmount = (totalSupply() * builderAllocBps) / 10000;
        _mint(builder, mintAmount);
    }

    function isBuilderAllocMinted() external view returns (bool) {
        return builderAllocMinted;
    }
}