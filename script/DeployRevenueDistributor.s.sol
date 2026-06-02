// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/contracts/RevenueDistributor.sol";

contract DeployRevenueDistributor is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deployer:", deployer);
        console.log("Balance:", address(deployer).balance / 1e18, "MNT");
        
        vm.startBroadcast(deployerPrivateKey);
        RevenueDistributor rd = new RevenueDistributor(deployer);
        console.log("RevenueDistributor deployed:", address(rd));
        vm.stopBroadcast();
    }
}