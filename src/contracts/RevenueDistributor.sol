// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IIdeaToken.sol";

contract RevenueDistributor is Ownable {
    using SafeERC20 for IERC20;

    struct TokenConfig {
        address ideaToken;
        address revenueToken; // USDY or USDC
        uint256 accumulatedRevenue; // per share (1e18 scaled)
        bool active;
    }

    mapping(address => TokenConfig) public tokenConfigs;
    address[] public registeredTokens;

    event RevenueDeposited(address indexed ideaToken, uint256 amount);
    event RevenueClaimed(address indexed holder, address indexed ideaToken, uint256 amount);

    constructor(address _owner) Ownable(_owner) {}

    function registerToken(address _ideaToken, address _revenueToken) external onlyOwner {
        require(!tokenConfigs[_ideaToken].active, "Already registered");
        
        tokenConfigs[_ideaToken] = TokenConfig({
            ideaToken: _ideaToken,
            revenueToken: _revenueToken,
            accumulatedRevenue: 0,
            active: true
        });
        registeredTokens.push(_ideaToken);
    }

    function depositRevenue(address _ideaToken, uint256 _amount) external {
        TokenConfig storage config = tokenConfigs[_ideaToken];
        require(config.active, "Token not registered");
        
        // Pull revenue tokens from sender
        IERC20(config.revenueToken).safeTransferFrom(msg.sender, address(this), _amount);
        
        // Distribute proportionally to token holders
        IIdeaToken token = IIdeaToken(_ideaToken);
        uint256 totalSupply = token.totalSupply();
        
        if (totalSupply > 0) {
            uint256 revenuePerShare = (_amount * 1e18) / totalSupply;
            config.accumulatedRevenue += revenuePerShare;
            
            // Notify the IdeaToken contract
            token.notifyRevenue(_amount);
        }
        
        emit RevenueDeposited(_ideaToken, _amount);
    }

    // Pull-based revenue claim - holder calls this to claim their share
    function claimRevenue(address _ideaToken) public returns (uint256 amount) {
        TokenConfig storage config = tokenConfigs[_ideaToken];
        require(config.active, "Token not registered");
        
        IIdeaToken token = IIdeaToken(_ideaToken);
        amount = token.earned(msg.sender);
        require(amount > 0, "Nothing to claim");
        
        // Transfer USDY directly to holder
        IERC20(config.revenueToken).safeTransfer(msg.sender, amount);
        
        emit RevenueClaimed(msg.sender, _ideaToken, amount);
    }

    // Batch claim for multiple tokens
    function claimRevenueBatch(address[] calldata _ideaTokens) external returns (uint256 totalClaimed) {
        for (uint256 i = 0; i < _ideaTokens.length; i++) {
            uint256 claimed = claimRevenue(_ideaTokens[i]);
            totalClaimed += claimed;
        }
    }

    function getPendingRevenue(address _ideaToken, address _holder) external view returns (uint256) {
        return IIdeaToken(_ideaToken).earned(_holder);
    }

    function getRegisteredTokens() external view returns (address[] memory) {
        return registeredTokens;
    }
}