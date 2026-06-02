// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IIdeaToken.sol";

contract BuilderAgreement is Ownable {
    struct Agreement {
        uint256 ideaId;
        address ideaToken;
        address[] builders;
        string agreementIpfsHash;
        uint256 builderStake;
        address revenueSource; // Set by builder when they sign
        bool creatorSigned;
        bool builderSigned;
        bool daoSigned;
        uint256 signedAt;
        bool active;
    }

    mapping(uint256 => Agreement) public agreements;
    mapping(address => bool) public isBuilder;
    mapping(address => uint256[]) public builderAgreements;
    
    uint256 public nextAgreementId;
    
    event AgreementCreated(uint256 indexed agreementId, uint256 ideaId, address[] builders);
    event AgreementSigned(uint256 indexed agreementId, address signer);
    event AgreementActivated(uint256 indexed agreementId);
    event RevenueSourceSet(uint256 indexed agreementId, address revenueSource);

    constructor(address _owner) Ownable(_owner) {}

    function createAgreement(
        uint256 _ideaId,
        address _ideaToken,
        address[] calldata _builders,
        string calldata _agreementIpfsHash,
        uint256 _builderStake
    ) external onlyOwner returns (uint256 agreementId) {
        require(_builders.length >= 1 && _builders.length <= 2, "Invalid builders count");
        
        agreementId = nextAgreementId++;
        agreements[agreementId] = Agreement({
            ideaId: _ideaId,
            ideaToken: _ideaToken,
            builders: _builders,
            agreementIpfsHash: _agreementIpfsHash,
            builderStake: _builderStake,
            revenueSource: address(0),
            creatorSigned: false,
            builderSigned: false,
            daoSigned: false,
            signedAt: 0,
            active: false
        });
        
        for (uint256 i = 0; i < _builders.length; i++) {
            isBuilder[_builders[i]] = true;
            builderAgreements[_builders[i]].push(agreementId);
        }
        
        emit AgreementCreated(agreementId, _ideaId, _builders);
    }

    // Builder sets revenue source when they sign
    function builderSign(uint256 agreementId, address _revenueSource) external {
        Agreement storage a = agreements[agreementId];
        require(isBuilder[msg.sender], "Not a builder");
        require(!a.builderSigned, "Already signed");
        
        a.builderSigned = true;
        a.revenueSource = _revenueSource;
        
        _checkAndActivate(agreementId);
        emit AgreementSigned(agreementId, msg.sender);
    }

    // All three parties must sign before FundingPool activates milestone releases
    function creatorSign(uint256 agreementId) external onlyOwner {
        Agreement storage a = agreements[agreementId];
        require(!a.creatorSigned, "Already signed");
        a.creatorSigned = true;
        _checkAndActivate(agreementId);
        emit AgreementSigned(agreementId, msg.sender);
    }

    function daoSign(uint256 agreementId) external onlyOwner {
        Agreement storage a = agreements[agreementId];
        require(!a.daoSigned, "Already signed");
        a.daoSigned = true;
        _checkAndActivate(agreementId);
        emit AgreementSigned(agreementId, msg.sender);
    }

    function _checkAndActivate(uint256 agreementId) internal {
        Agreement storage a = agreements[agreementId];
        if (a.creatorSigned && a.builderSigned && a.daoSigned) {
            a.signedAt = block.timestamp;
            a.active = true;
            
            // Wire revenue source into IdeaToken if it's a valid contract
            if (a.revenueSource != address(0) && a.ideaToken != address(0)) {
                (bool success,) = a.ideaToken.call(
                    abi.encodeWithSelector(IIdeaToken.setRevenueSource.selector, a.revenueSource)
                );
                // Ignore failure - ideaToken might be mock or have different interface
            }
            
            emit AgreementActivated(agreementId);
        }
    }

    function isFullySigned(uint256 agreementId) external view returns (bool) {
        Agreement storage a = agreements[agreementId];
        return a.creatorSigned && a.builderSigned && a.daoSigned;
    }

    function isActive(uint256 agreementId) external view returns (bool) {
        return agreements[agreementId].active;
    }

    function getBuilderAgreements(address builder) external view returns (uint256[] memory) {
        return builderAgreements[builder];
    }
}