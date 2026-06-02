// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IIdeaToken is IERC20 {
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
    function mintBuilderAlloc(address builder, uint256 amount) external;
    function builderAllocMinted() external view returns (bool);
    function earned(address account) external view returns (uint256);
    function notifyRevenue(uint256 amount) external;
    function fundingPool() external view returns (address);
}