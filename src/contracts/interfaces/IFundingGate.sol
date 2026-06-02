// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IFundingGate {
    function canFund(address investor) external view returns (bool);
}