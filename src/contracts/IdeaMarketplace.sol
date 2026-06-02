// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./interfaces/IIdeaToken.sol";

contract IdeaMarketplace is Ownable, EIP712 {
    using SafeERC20 for IERC20;

    uint256 public constant PROTOCOL_FEE_BPS = 250; // 2.5%
    address public treasury;
    address public usdy;

    struct Listing {
        address seller;
        address ideaToken;
        uint256 amount;
        uint256 askPricePerToken; // in USDY (6 decimals)
        uint256 expiry;
        bool active;
        address requiredHoldToken;
        uint256 requiredHoldAmount;
    }

    struct Bid {
        address bidder;
        address ideaToken;
        uint256 amount;
        uint256 bidPricePerToken;
        uint256 expiry;
        bool active;
    }

    mapping(uint256 => Listing) public listings;
    mapping(uint256 => Bid) public bids;
    uint256 public nextListingId;
    uint256 public nextBidId;

    mapping(address => uint256) public nonces;

    event ListingCreated(uint256 indexed listingId, address seller, address ideaToken, uint256 amount, uint256 price);
    event ListingAccepted(uint256 indexed listingId, address buyer, address seller, uint256 totalPrice);
    event BidPlaced(uint256 indexed bidId, address bidder, address ideaToken, uint256 amount, uint256 price);
    event BidAccepted(uint256 indexed bidId, address seller, address buyer, uint256 totalPrice);
    event SignedBidSettled(uint256 indexed bidId, address seller, address buyer);

    bytes32 public constant BID_TYPEHASH = keccak256(
        "Bid(address ideaToken,uint256 amount,uint256 bidPricePerToken,uint256 expiry,uint256 nonce)"
    );

    constructor(address _owner, address _treasury, address _usdy) Ownable(_owner) EIP712("FounderSea Marketplace", "1") {
        treasury = _treasury;
        usdy = _usdy;
    }

    function setTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
    }

    function createListing(
        address _ideaToken,
        uint256 _amount,
        uint256 _askPrice,
        uint256 _expiry,
        address _holdToken,
        uint256 _holdAmount
    ) external returns (uint256 id) {
        require(_amount > 0, "Invalid amount");
        require(IIdeaToken(_ideaToken).balanceOf(msg.sender) >= _amount, "Insufficient balance");
        
        id = nextListingId++;
        listings[id] = Listing({
            seller: msg.sender,
            ideaToken: _ideaToken,
            amount: _amount,
            askPricePerToken: _askPrice,
            expiry: _expiry,
            active: true,
            requiredHoldToken: _holdToken,
            requiredHoldAmount: _holdAmount
        });
        
        // Transfer tokens to marketplace (use transferFrom - requires approval)
        IERC20(_ideaToken).safeTransferFrom(msg.sender, address(this), _amount);
        
        emit ListingCreated(id, msg.sender, _ideaToken, _amount, _askPrice);
    }

    function acceptListing(uint256 listingId) external {
        Listing storage listing = listings[listingId];
        require(listing.active, "Listing not active");
        require(block.timestamp < listing.expiry, "Listing expired");
        
        // Check hold requirement
        if (listing.requiredHoldToken != address(0)) {
            require(
                IERC20(listing.requiredHoldToken).balanceOf(msg.sender) >= listing.requiredHoldAmount,
                "Hold requirement not met"
            );
        }
        
        uint256 totalPrice = (listing.amount * listing.askPricePerToken) / 1e6;
        uint256 protocolFee = (totalPrice * PROTOCOL_FEE_BPS) / 10000;
        uint256 sellerProceeds = totalPrice - protocolFee;
        
        // Transfer USDY from buyer
        IERC20(usdy).safeTransferFrom(msg.sender, treasury, protocolFee);
        IERC20(usdy).safeTransferFrom(msg.sender, listing.seller, sellerProceeds);
        
        // Transfer IdeaTokens to buyer
        IERC20(listing.ideaToken).safeTransfer(msg.sender, listing.amount);
        listing.active = false;
        
        emit ListingAccepted(listingId, msg.sender, listing.seller, totalPrice);
    }

    function placeBid(
        address _ideaToken,
        uint256 _amount,
        uint256 _bidPrice,
        uint256 _expiry
    ) external returns (uint256 id) {
        require(_amount > 0, "Invalid amount");
        
        // Check bidder has sufficient USDY for potential purchase
        uint256 totalBidValue = (_amount * _bidPrice) / 1e6;
        require(IERC20(usdy).balanceOf(msg.sender) >= totalBidValue, "Insufficient balance");
        
        id = nextBidId++;
        bids[id] = Bid({
            bidder: msg.sender,
            ideaToken: _ideaToken,
            amount: _amount,
            bidPricePerToken: _bidPrice,
            expiry: _expiry,
            active: true
        });
        
        emit BidPlaced(id, msg.sender, _ideaToken, _amount, _bidPrice);
    }

    function acceptBid(uint256 bidId) external {
        Bid storage bid = bids[bidId];
        require(bid.active, "Bid not active");
        require(block.timestamp < bid.expiry, "Bid expired");
        require(IIdeaToken(bid.ideaToken).balanceOf(msg.sender) >= bid.amount, "Insufficient tokens");
        
        uint256 totalPrice = (bid.amount * bid.bidPricePerToken) / 1e6;
        uint256 protocolFee = (totalPrice * PROTOCOL_FEE_BPS) / 10000;
        uint256 sellerProceeds = totalPrice - protocolFee;
        
        // Transfer tokens from seller to bidder
        IERC20(bid.ideaToken).safeTransferFrom(msg.sender, bid.bidder, bid.amount);
        
        // Transfer USDY
        IERC20(usdy).safeTransferFrom(bid.bidder, treasury, protocolFee);
        IERC20(usdy).safeTransferFrom(bid.bidder, msg.sender, sellerProceeds);
        
        bid.active = false;
        
        emit BidAccepted(bidId, msg.sender, bid.bidder, totalPrice);
    }

    // Settle an off-chain signed bid (gas-efficient)
    function settleSignedBid(
        address seller,
        Bid calldata bid,
        bytes calldata signature
    ) external {
        require(bid.active, "Bid not active");
        require(block.timestamp < bid.expiry, "Bid expired");
        
        // Verify EIP-712 signature
        bytes32 domainSeparator = _domainSeparatorV4();
        bytes32 structHash = keccak256(abi.encode(
            BID_TYPEHASH,
            bid.ideaToken,
            bid.amount,
            bid.bidPricePerToken,
            bid.expiry,
            nonces[seller]++
        ));
        
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        address signer = ECDSA.recover(digest, signature);
        require(signer == seller, "Invalid signature");
        
        uint256 totalPrice = (bid.amount * bid.bidPricePerToken) / 1e6;
        uint256 protocolFee = (totalPrice * PROTOCOL_FEE_BPS) / 10000;
        uint256 sellerProceeds = totalPrice - protocolFee;
        
        // Transfer tokens from seller to bidder
        IERC20(bid.ideaToken).safeTransferFrom(seller, bid.bidder, bid.amount);
        
        // Transfer USDY
        IERC20(usdy).safeTransferFrom(bid.bidder, treasury, protocolFee);
        IERC20(usdy).safeTransferFrom(bid.bidder, seller, sellerProceeds);
        
        // Note: bid.active cannot be modified as bid is calldata
        // The bid is considered settled
        
        emit SignedBidSettled(nextBidId, seller, bid.bidder);
    }

    function cancelListing(uint256 listingId) external {
        Listing storage listing = listings[listingId];
        require(listing.seller == msg.sender, "Not seller");
        require(listing.active, "Not active");
        
        IERC20(listing.ideaToken).safeTransfer(msg.sender, listing.amount);
        listing.active = false;
    }

    function cancelBid(uint256 bidId) external {
        Bid storage bid = bids[bidId];
        require(bid.bidder == msg.sender, "Not bidder");
        require(bid.active, "Not active");
        bid.active = false;
    }
}