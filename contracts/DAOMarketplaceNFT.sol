// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "./IERC4907.sol";

/**
 * @title DAOMarketplaceNFT
 * @dev Minimal ERC-721 for the DAO Marketplace demo with Metadata Hash Verification (Option B).
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
    
    /// @notice Records the metadata hash provided at mint
    mapping(uint256 => bytes32) public tokenMetadataHash;

    /// @notice Emitted when a new NFT is minted with its metadata URI and Hash
    event NFTMinted(uint256 indexed tokenId, address indexed creator, string tokenURI, bytes32 metadataHash);

    constructor() ERC721("DAO Marketplace NFT", "DAONFT") {
        _nextTokenId = 1; // Start from 1
    }

    /**
     * @notice Mint a new NFT with the given metadata URI and pre-computed hash.
     * @param to           Recipient address (usually msg.sender)
     * @param uri          IPFS metadata URI (ipfs://Qm...)
     * @param metadataHash SHA256 Hash of the metadata/image content for backend verification
     * @return tokenId The ID of the newly minted token
     */
    function mint(address to, string memory uri, bytes32 metadataHash) public returns (uint256) {
        require(metadataHash != bytes32(0), "Metadata hash is required");
        require(bytes(uri).length > 0, "URI is required");

        uint256 tokenId = _nextTokenId;
        _nextTokenId++;

        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);

        creator[tokenId] = msg.sender;
        tokenMetadataHash[tokenId] = metadataHash;

        emit NFTMinted(tokenId, msg.sender, uri, metadataHash);

        return tokenId;
    }

    /**
     * @notice Returns the total number of tokens minted so far.
     */
    function totalSupply() public view returns (uint256) {
        return _nextTokenId - 1;
    }

    /// @notice set the user and expires of a NFT
    function setUser(uint256 tokenId, address user, uint64 expires) public override {
        require(_isAuthorized(ownerOf(tokenId), msg.sender, tokenId), "ERC721: transfer caller is not owner nor approved");
        UserInfo storage info = _users[tokenId];
        info.user = user;
        info.expires = expires;
        emit UpdateUser(tokenId, user, expires);
    }

    /// @notice Get the user address of an NFT
    function userOf(uint256 tokenId) public view override returns (address) {
        if (uint256(_users[tokenId].expires) >= block.timestamp) {
            return _users[tokenId].user;
        }
        return address(0);
    }

    /// @notice Get the user expires of an NFT
    function userExpires(uint256 tokenId) public view override returns (uint64) {
        return _users[tokenId].expires;
    }

    /// @dev See {IERC165-supportsInterface}.
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721URIStorage) returns (bool) {
        return interfaceId == type(IERC4907).interfaceId || super.supportsInterface(interfaceId);
    }
}
