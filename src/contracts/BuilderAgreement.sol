// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

contract BuilderAgreement is Ownable {
    struct Agreement {
        uint256 ideaId;
        address[] builders; // 1 (solo) or 2 (merger)
        string agreementIpfsHash; // terms, roadmap, milestone criteria
        uint256 builderStake; // USDY staked by builder
        bool creatorSigned;
        bool builderSigned;
        bool daoSigned; // DAO signature (could be AI-delegated)
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

    constructor(address _owner) Ownable(_owner) {}

    function createAgreement(
        uint256 _ideaId,
        address[] calldata _builders,
        string calldata _agreementIpfsHash,
        uint256 _builderStake
    ) external onlyOwner returns (uint256 agreementId) {
        require(_builders.length >= 1 && _builders.length <= 2, "Invalid builders count");
        
        agreementId = nextAgreementId++;
        agreements[agreementId] = Agreement({
            ideaId: _ideaId,
            builders: _builders,
            agreementIpfsHash: _agreementIpfsHash,
            builderStake: _builderStake,
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

    // All three parties must sign before FundingPool activates milestone releases
    function creatorSign(uint256 agreementId) external onlyOwner {
        Agreement storage a = agreements[agreementId];
        require(!a.creatorSigned, "Already signed");
        a.creatorSigned = true;
        _checkAndActivate(agreementId);
        emit AgreementSigned(agreementId, msg.sender);
    }

    function builderSign(uint256 agreementId) external {
        Agreement storage a = agreements[agreementId];
        require(isBuilder[msg.sender], "Not a builder");
        require(!a.builderSigned, "Already signed");
        a.builderSigned = true;
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