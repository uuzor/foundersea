// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./IdeaToken.sol";

contract IdeaTokenFactory is Ownable {
    string public constant TOKEN_NAME_PREFIX = "FounderSea Idea ";
    string public constant TOKEN_SYMBOL_PREFIX = "FSID-";

    constructor(address initialOwner) Ownable(initialOwner) {}

    event IdeaTokenCreated(
        uint256 indexed ideaId,
        address ideaToken,
        address fundingPool,
        address creator
    );

    function createIdeaToken(
        uint256 ideaId,
        address fundingPool,
        address creator,
        uint256 builderAllocBps,
        address factory,
        address usdy
    ) external onlyOwner returns (IdeaToken token) {
        string memory tokenName = string(abi.encodePacked(TOKEN_NAME_PREFIX, _toString(ideaId)));
        string memory tokenSymbol = string(abi.encodePacked(TOKEN_SYMBOL_PREFIX, _toString(ideaId)));
        
        token = new IdeaToken(
            tokenName,
            tokenSymbol,
            fundingPool,
            creator,
            builderAllocBps,
            factory,
            usdy
        );
        
        emit IdeaTokenCreated(ideaId, address(token), fundingPool, creator);
    }

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits--;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}