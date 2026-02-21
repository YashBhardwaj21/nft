// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./IERC4907.sol";

/**
 * @title DAOMarketplaceMarket
 * @notice Handles listing and renting of ERC-4907 NFTs with true Escrow custody.
 */
contract DAOMarketplaceMarket is ReentrancyGuard, Ownable, Pausable, IERC721Receiver {
    struct Listing {
        address owner;
        address tokenAddress;
        uint256 tokenId;
        uint256 pricePerDay;
        uint64 minDuration;
        uint64 maxDuration;
        bytes32 metadataHash;
        bool isActive;
    }

    uint256 private _nextListingId;
    mapping(uint256 => Listing) public listings;
    
    // Platform fee basis points (e.g., 250 = 2.5%)
    uint256 public platformFeeBasisPoints = 250;
    address public treasury;

    event ListingCreated(
        uint256 indexed onChainListingId, 
        address indexed owner, 
        address indexed tokenAddress, 
        uint256 tokenId, 
        uint256 pricePerDay, 
        uint64 minDuration, 
        uint64 maxDuration, 
        bytes32 metadataHash
    );
    event ListingCancelled(uint256 indexed onChainListingId, address indexed tokenAddress, uint256 tokenId);
    event Rented(
        uint256 indexed onChainListingId, 
        address indexed renter, 
        address indexed tokenAddress, 
        uint256 tokenId, 
        uint64 expires, 
        uint256 totalPrice
    );
    event TreasuryUpdated(address newTreasury);
    event FeeUpdated(uint256 newFeeBasisPoints);

    constructor(address _treasury) Ownable(msg.sender) {
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury;
        _nextListingId = 1;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function setTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Invalid treasury");
        treasury = newTreasury;
        emit TreasuryUpdated(newTreasury);
    }

    function setPlatformFee(uint256 newFeeBasisPoints) external onlyOwner {
        require(newFeeBasisPoints <= 10000, "Fee cannot exceed 100%");
        platformFeeBasisPoints = newFeeBasisPoints;
        emit FeeUpdated(newFeeBasisPoints);
    }

    /**
     * @notice List an NFT for rent
     * @dev Caller must approve this contract AND the contract takes custody of the NFT.
     */
    function listNFT(
        address tokenAddress,
        uint256 tokenId,
        uint256 pricePerDay,
        uint64 minDuration,
        uint64 maxDuration,
        bytes32 metadataHash
    ) external nonReentrant whenNotPaused {
        require(pricePerDay > 0, "Price must be > 0");
        require(maxDuration >= minDuration, "Invalid duration");

        IERC721 token = IERC721(tokenAddress);
        require(token.ownerOf(tokenId) == msg.sender, "Not owner");
        
        // Escrow custody enforcement: transfer from owner to marketplace
        token.safeTransferFrom(msg.sender, address(this), tokenId);

        uint256 listingId = _nextListingId++;
        listings[listingId] = Listing({
            owner: msg.sender,
            tokenAddress: tokenAddress,
            tokenId: tokenId,
            pricePerDay: pricePerDay,
            minDuration: minDuration,
            maxDuration: maxDuration,
            metadataHash: metadataHash,
            isActive: true
        });

        emit ListingCreated(listingId, msg.sender, tokenAddress, tokenId, pricePerDay, minDuration, maxDuration, metadataHash);
    }

    /**
     * @notice Updates a listing's price or active status.
     * @dev Contract already holds custody.
     */
    function updateListing(
        uint256 listingId,
        uint256 pricePerDay,
        bool isActive
    ) external nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.owner == msg.sender, "Not owner");
        listing.pricePerDay = pricePerDay;
        listing.isActive = isActive;
    }

    /**
     * @notice Cancel a listing and return custody of the NFT back to the owner.
     */
    function cancelListing(uint256 listingId) external nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.isActive, "Listing not active");
        require(listing.owner == msg.sender || owner() == msg.sender, "Not owner or admin");

        // Prevent cancelling while someone is currently renting it
        uint64 userExpires = IERC4907(listing.tokenAddress).userExpires(listing.tokenId);
        require(userExpires < block.timestamp, "Cannot cancel while actively rented");

        listing.isActive = false;
        
        // Return custody to original owner
        IERC721(listing.tokenAddress).safeTransferFrom(address(this), listing.owner, listing.tokenId);

        emit ListingCancelled(listingId, listing.tokenAddress, listing.tokenId);
    }

    /**
     * @notice Rent an NFT.
     * @param listingId The ID of the listing to rent.
     * @param daysToRent Number of days to rent.
     */
    function rent(uint256 listingId, uint64 daysToRent) external payable nonReentrant whenNotPaused {
        Listing storage listing = listings[listingId];
        require(listing.isActive, "Listing not active");
        require(daysToRent >= listing.minDuration && daysToRent <= listing.maxDuration, "Invalid duration");

        // Ensure not currently rented
        uint64 userExpires = IERC4907(listing.tokenAddress).userExpires(listing.tokenId);
        require(userExpires < block.timestamp, "Already rented");

        uint256 totalPrice = listing.pricePerDay * daysToRent;
        require(msg.value >= totalPrice, "Insufficient payment");

        // Calculate expires
        uint64 expires = uint64(block.timestamp + (daysToRent * 1 days));

        // Interaction: Set User. The marketplace is the physical owner right now.
        IERC4907(listing.tokenAddress).setUser(listing.tokenId, msg.sender, expires);

        // Payout calculations
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

        emit Rented(listingId, msg.sender, listing.tokenAddress, listing.tokenId, expires, totalPrice);
    }

    /**
     * @dev Interface requirement to accept safeTransferFrom.
     */
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return this.onERC721Received.selector;
    }
}
