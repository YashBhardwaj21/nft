// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./IERC4907.sol";

/**
 * @title DAOMarketplaceMarket
 * @notice Handles listing and renting of ERC-4907 NFTs.
 */
contract DAOMarketplaceMarket is ReentrancyGuard {
    struct Listing {
        address owner;
        address tokenAddress;
        uint256 tokenId;
        uint256 pricePerDay;
        uint64 minDuration;
        uint64 maxDuration;
        bool isActive;
    }

    uint256 private _nextListingId;
    mapping(uint256 => Listing) public listings;
    
    // Platform fee basis points (e.g., 250 = 2.5%)
    uint256 public platformFeeBasisPoints = 250;
    address public treasury;

    event ListingCreated(uint256 indexed listingId, address indexed owner, address indexed tokenAddress, uint256 tokenId, uint256 pricePerDay);
    event ListingCancelled(uint256 indexed listingId);
    event Rented(uint256 indexed listingId, address indexed renter, uint256 tokenId, uint64 expires, uint256 totalPrice);

    constructor(address _treasury) {
        treasury = _treasury;
        _nextListingId = 1;
    }

    /**
     * @notice List an NFT for rent.
     * @dev Owner must approve this contract as operator for the NFT.
     */
    function listNFT(
        address tokenAddress,
        uint256 tokenId,
        uint256 pricePerDay,
        uint64 minDuration,
        uint64 maxDuration
    ) external {
        IERC721 token = IERC721(tokenAddress);
        require(token.ownerOf(tokenId) == msg.sender, "Not owner");
        require(token.isApprovedForAll(msg.sender, address(this)) || token.getApproved(tokenId) == address(this), "Marketplace not approved");
        require(pricePerDay > 0, "Price must be > 0");
        require(maxDuration >= minDuration, "Invalid duration");

        uint256 listingId = _nextListingId++;
        listings[listingId] = Listing({
            owner: msg.sender,
            tokenAddress: tokenAddress,
            tokenId: tokenId,
            pricePerDay: pricePerDay,
            minDuration: minDuration,
            maxDuration: maxDuration,
            isActive: true
        });

        emit ListingCreated(listingId, msg.sender, tokenAddress, tokenId, pricePerDay);
    }

    /**
     * @notice Updates a listing.
     */
    function updateListing(
        uint256 listingId,
        uint256 pricePerDay,
        bool isActive
    ) external {
        Listing storage listing = listings[listingId];
        require(listing.owner == msg.sender, "Not owner");
        listing.pricePerDay = pricePerDay;
        listing.isActive = isActive;
    }

    /**
     * @notice Cancel a listing.
     */
    function cancelListing(uint256 listingId) external {
        Listing storage listing = listings[listingId];
        require(listing.owner == msg.sender, "Not owner");
        listing.isActive = false;
        emit ListingCancelled(listingId);
    }

    /**
     * @notice Rent an NFT.
     * @param listingId The ID of the listing to rent.
     * @param daysToRent Number of days to rent.
     */
    function rent(uint256 listingId, uint64 daysToRent) external payable nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.isActive, "Listing not active");
        require(daysToRent >= listing.minDuration && daysToRent <= listing.maxDuration, "Invalid duration");

        uint256 totalPrice = listing.pricePerDay * daysToRent;
        require(msg.value >= totalPrice, "Insufficient payment");

        // Check ownership again
        IERC721 token = IERC721(listing.tokenAddress);
        require(token.ownerOf(listing.tokenId) == listing.owner, "Owner changed");

        // Calculate expires
        uint64 expires = uint64(block.timestamp + (daysToRent * 1 days));

        // Interaction: Set User
        // This requires the marketplace to be an approved operator of the owner
        IERC4907(listing.tokenAddress).setUser(listing.tokenId, msg.sender, expires);

        // Payout
        uint256 platformFee = (totalPrice * platformFeeBasisPoints) / 10000;
        uint256 sellerAmount = totalPrice - platformFee;

        // Transfer to seller
        (bool sentSeller, ) = payable(listing.owner).call{value: sellerAmount}("");
        require(sentSeller, "Failed to send ETH to seller");

        // Transfer to treasury
        if (platformFee > 0) {
            (bool sentTreasury, ) = payable(treasury).call{value: platformFee}("");
            require(sentTreasury, "Failed to send fee to treasury");
        }

        // Refund excess
        if (msg.value > totalPrice) {
            (bool sentRefund, ) = payable(msg.sender).call{value: msg.value - totalPrice}("");
            require(sentRefund, "Failed to refund excess");
        }

        emit Rented(listingId, msg.sender, listing.tokenId, expires, totalPrice);
    }
}
