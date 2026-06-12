// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IFundingGate.sol";

enum GateType { OPEN, WHITELIST, MIN_HOLD, DAO_CURATED }

contract FundingGate is Ownable {
    GateType public gateType;
    address public creator;
    address public dao;

    // WHITELIST
    mapping(address => bool) public whitelist;

    // MIN_HOLD
    address public holdToken;
    uint256 public minHoldAmount;

    // DAO_CURATED
    address public daoApprover;
    mapping(address => bool) public daoApproved;

    event GateTypeSet(GateType gateType);
    event WhitelistUpdated(address[] addrs, bool[] states);
    event DaoApproverSet(address daoApprover);
    event InvestorDaoApproved(address investor);

    constructor(address _creator, address _dao) Ownable(_creator) {
        creator = _creator;
        dao = _dao;
    }

    function setGateType(GateType _gateType, bytes calldata params) external onlyOwner {
        gateType = _gateType;
        
        if (_gateType == GateType.WHITELIST && params.length > 0) {
            // Params can contain initial whitelist addresses (not implemented - use updateWhitelist)
        }
        if (_gateType == GateType.MIN_HOLD && params.length >= 64) {
            (holdToken, minHoldAmount) = abi.decode(params, (address, uint256));
        }
        if (_gateType == GateType.DAO_CURATED && params.length >= 32) {
            (daoApprover) = abi.decode(params, (address));
        }
        
        emit GateTypeSet(_gateType);
    }

    function canFund(address investor) external view returns (bool) {
        if (gateType == GateType.OPEN) return true;
        if (gateType == GateType.WHITELIST) return whitelist[investor];
        if (gateType == GateType.MIN_HOLD)
            return IERC20(holdToken).balanceOf(investor) >= minHoldAmount;
        if (gateType == GateType.DAO_CURATED) return daoApproved[investor];
        return false;
    }

    function updateWhitelist(address[] calldata addrs, bool[] calldata states) 
        external onlyOwner {
        require(addrs.length == states.length, "Length mismatch");
        for (uint256 i = 0; i < addrs.length; i++) {
            whitelist[addrs[i]] = states[i];
        }
        emit WhitelistUpdated(addrs, states);
    }

    function daoApproveInvestor(address investor) external {
        require(msg.sender == daoApprover || msg.sender == dao, "Not authorized");
        daoApproved[investor] = true;
        emit InvestorDaoApproved(investor);
    }

    function setDaoApprover(address _approver) external onlyOwner {
        daoApprover = _approver;
        emit DaoApproverSet(_approver);
    }
}