// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockUSDY
 * @notice Test token that mimics USDY (6 decimals, USD-pegged stablecoin).
 *         Used on Mantle Sepolia testnet where real USDY is not available.
 *         Anyone can mint up to 1,000,000 USDY per call for testing.
 */
contract MockUSDY is ERC20, Ownable {
    uint256 public constant FAUCET_AMOUNT = 1_000_000 * 1e6; // 1M USDY per faucet call
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 1e6; // 1B USDY cap

    event Faucet(address indexed recipient, uint256 amount);

    constructor(address _owner) ERC20("Mock USDY", "USDY") Ownable(_owner) {
        // Mint 10M to deployer for immediate testing
        _mint(_owner, 10_000_000 * 1e6);
    }

    /// @notice 6 decimals to match real USDY
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Anyone can call this to get 1M USDY for testing
    function faucet() external {
        require(totalSupply() + FAUCET_AMOUNT <= MAX_SUPPLY, "Faucet cap reached");
        _mint(msg.sender, FAUCET_AMOUNT);
        emit Faucet(msg.sender, FAUCET_AMOUNT);
    }

    /// @notice Owner can mint arbitrary amounts (for seeding test pools)
    function mint(address to, uint256 amount) external onlyOwner {
        require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds max supply");
        _mint(to, amount);
    }
}
