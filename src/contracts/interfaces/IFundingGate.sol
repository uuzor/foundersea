// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IFundingGate {
    function canFund(address investor) external view returns (bool);
}