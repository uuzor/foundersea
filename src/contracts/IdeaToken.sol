// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IIdeaToken.sol";
import "./interfaces/IFundingPool.sol";

contract IdeaToken is ERC20, Ownable {
    address public immutable fundingPool;
    address public revenueDistributor;
    address public ideaCreator;
    uint256 public builderAllocBps; // 10–30%
    address public assignedBuilder;
    bool public _builderAllocMinted;

    // Revenue accounting (pull-based, no loops)
    uint256 public revenuePerTokenStored; // scaled 1e18
    mapping(address => uint256) public revenueDebt;

    // Immutable for immutable vars
    address public immutable factory;

    modifier onlyFundingPool() {
        require(msg.sender == fundingPool, "Only FundingPool");
        _;
    }

    constructor(
        string memory name,
        string memory symbol,
        address _fundingPool,
        address _ideaCreator,
        uint256 _builderAllocBps,
        address _factory
    ) ERC20(name, symbol) Ownable(_ideaCreator) {
        require(_fundingPool != address(0), "Invalid funding pool");
        require(_builderAllocBps >= 1000 && _builderAllocBps <= 30000, "Invalid builder alloc");
        fundingPool = _fundingPool;
        ideaCreator = _ideaCreator;
        builderAllocBps = _builderAllocBps;
        factory = _factory;
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

    function claimRevenue() external returns (uint256 amount) {
        amount = earned(msg.sender);
        require(amount > 0, "Nothing to claim");
        revenueDebt[msg.sender] = revenuePerTokenStored;
        IERC20(address(this)).transfer(msg.sender, amount);
    }

    function notifyRevenue(uint256 amount) external {
        require(msg.sender == revenueDistributor, "Only distributor");
        if (totalSupply() == 0) return;
        revenuePerTokenStored += (amount * 1e18) / totalSupply();
    }

    // Note: claimRevenue was removed - RevenueDistributor handles all USDY payouts
    // The token just tracks revenuePerTokenStored for the earned() view function

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
        require(!_builderAllocMinted, "Already minted");
        _builderAllocMinted = true;
        uint256 mintAmount = (totalSupply() * builderAllocBps) / 10000;
        _mint(builder, mintAmount);
    }

    function builderAllocMinted() external view returns (bool) {
        return _builderAllocMinted;
    }

    // Revenue distributor can call this to push revenue to this contract
    function notifyRevenueToContract(uint256 amount) external {
        require(msg.sender == revenueDistributor, "Only distributor");
        if (totalSupply() == 0) return;
        revenuePerTokenStored += (amount * 1e18) / totalSupply();
    }
}