// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console2.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDY is ERC20 {
    uint8 private _decimals;
    
    constructor(uint8 decimals_) ERC20("Mock USDY", "USDY") {
        _decimals = decimals_;
    }
    
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
    
    function decimals() public view override returns (uint8) {
        return _decimals;
    }
}

contract DeployMockUSDY is Script {
    function run() external {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(privateKey);
        
        vm.startBroadcast(privateKey);
        
        MockUSDY usdy = new MockUSDY(6); // 6 decimals like USDC/USDT
        console2.log("MockUSDY deployed:", address(usdy));
        
        // Mint some tokens to deployer for testing
        usdy.mint(deployer, 1_000_000 * 1e6); // 1M tokens
        console2.log("Minted 1M tokens to deployer");
        
        vm.stopBroadcast();
        
        console2.log("");
        console2.log("==========================================");
        console2.log("  MOCK USDY DEPLOYMENT SUMMARY");
        console2.log("==========================================");
        console2.log("MockUSDY Address:", address(usdy));
        console2.log("Deployer:", deployer);
        console2.log("==========================================");
    }
}
