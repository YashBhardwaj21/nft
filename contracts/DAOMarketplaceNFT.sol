// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "./IERC4907.sol";

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
contract DAOMarketplaceNFT is ERC721URIStorage, IERC4907 {
    uint256 private _nextTokenId;

    struct UserInfo {
        address user;   // address of user role
        uint64 expires; // unix timestamp, user expires
    }

    mapping(uint256 => UserInfo) internal _users;

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

    /// @notice set the user and expires of a NFT
    /// @dev The zero address indicates there is no user
    /// @param tokenId The NFT to get the user address for
    /// @param user The new user of the NFT
    /// @param expires Unix timestamp, User expires
    function setUser(uint256 tokenId, address user, uint64 expires) public override {
        require(_isAuthorized(ownerOf(tokenId), msg.sender, tokenId), "ERC721: transfer caller is not owner nor approved");
        UserInfo storage info = _users[tokenId];
        info.user = user;
        info.expires = expires;
        emit UpdateUser(tokenId, user, expires);
    }

    /// @notice Get the user address of an NFT
    /// @dev The zero address indicates that there is no user or the user is expired
    /// @param tokenId The NFT to get the user address for
    /// @return The user address for this NFT
    function userOf(uint256 tokenId) public view override returns (address) {
        if (uint256(_users[tokenId].expires) >= block.timestamp) {
            return _users[tokenId].user;
        }
        return address(0);
    }

    /// @notice Get the user expires of an NFT
    /// @dev The zero value indicates that there is no user
    /// @param tokenId The NFT to get the user address for
    /// @return The user expires for this NFT
    function userExpires(uint256 tokenId) public view override returns (uint64) {
        return _users[tokenId].expires;
    }

    /// @dev See {IERC165-supportsInterface}.
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721URIStorage) returns (bool) {
        return interfaceId == type(IERC4907).interfaceId || super.supportsInterface(interfaceId);
    }
}
