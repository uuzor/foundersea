// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IIdeaToken is IERC20 {
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
    function mintBuilderAlloc(address builder) external;
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function isBuilderAllocMinted() external view returns (bool);
    function earned(address account) external view returns (uint256);
    function claimRevenue() external returns (uint256);
    function notifyRevenue(uint256 amount) external;
    function setRevenueSource(address source) external;
    function revenueSource() external view returns (address);
    function fundingPool() external view returns (address);
    function USDY() external view returns (address);
    function builderAllocBps() external view returns (uint256);
}