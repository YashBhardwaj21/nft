// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

/**
 * @title DAOMarketplaceNFT
 * @dev Minimal ERC-721 for the DAO Marketplace demo on Sepolia.
 *
 * Features:
 *   - Anyone can mint (free testnet demo)
 *   - Each token stores its tokenURI (IPFS metadata pointer)
 *   - `creator` mapping records who called mint (for attribution verification)
 *   - Auto-incrementing token IDs
 *
 * The backend chainListener cross-checks:
 *   creator[tokenId] == DB.creator   → prevents attribution fraud
 *   tokenURI(tokenId) == DB.tokenURI → prevents metadata swap
 */
contract DAOMarketplaceNFT is ERC721URIStorage {
    uint256 private _nextTokenId;

    /// @notice Records which address called mint for each token
    mapping(uint256 => address) public creator;

    /// @notice Emitted when a new NFT is minted with its metadata URI
    event NFTMinted(uint256 indexed tokenId, address indexed creator, string tokenURI);

    constructor() ERC721("DAO Marketplace NFT", "DAONFT") {
        _nextTokenId = 1; // Start from 1 (0 is special in many UIs)
    }

    /**
     * @notice Mint a new NFT with the given metadata URI.
     * @param to      Recipient address (usually msg.sender)
     * @param uri     IPFS metadata URI (ipfs://Qm...)
     * @return tokenId The ID of the newly minted token
     */
    function mint(address to, string memory uri) public returns (uint256) {
        uint256 tokenId = _nextTokenId;
        _nextTokenId++;

        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);

        creator[tokenId] = msg.sender;

        emit NFTMinted(tokenId, msg.sender, uri);

        return tokenId;
    }

    /**
     * @notice Returns the total number of tokens minted so far.
     */
    function totalSupply() public view returns (uint256) {
        return _nextTokenId - 1;
    }
}
