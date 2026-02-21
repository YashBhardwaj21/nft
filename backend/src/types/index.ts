export interface NFT {
    id: string;
    name: string;
    description?: string;
    image: string;
    tokenId?: string;
    contractAddress?: string;
    owner: string;
    collectionName: string;
    creator: string;
    price: number;
    rentalPrice?: number;
    maxDuration?: number;
    currency: string;
    status: 'AVAILABLE' | 'RENTED' | 'LISTING';
    isEscrowed?: boolean;
    renterWallet?: string;
    expiresAt?: Date;
    likes: number;
    views?: number;
    metadata?: Record<string, any>;
    timeLeft?: string;
    rentalEndDate?: Date;

    // Chain Data (Minting)
    tokenAddress?: string;
    fileHash?: string;
    tokenURI?: string;
    imageCID?: string;
    metadataCID?: string;
    metadataHash?: string;
    mintTxHash?: string;
    blockNumber?: number;
    mintStatus?: 'DRAFT' | 'PENDING' | 'CONFIRMED' | 'FAILED';

    createdAt?: Date;
    updatedAt?: Date;
}

export interface Rental {
    id: string;
    listingId?: string;
    nftId: string;
    renter: string;
    owner: string;
    rentalPrice: number;
    duration: number;
    currency: string;
    startAt?: Date;
    expiresAt?: Date;
    status: 'PENDING' | 'ACTIVE';
    transactionHash?: string;
    createdAt?: Date;
}

export interface Listing {
    id: string;
    nftId: string;
    tokenAddress?: string; // Address of the NFT contract
    tokenId?: string; // Added for chain-first integration
    onChainListingId?: number; // Added to map to DAOMarketplaceMarket listingId
    seller: string;
    sellerId?: string;
    price: string;
    pricePerDay?: string;
    rentalPrice?: string;
    currency: string;
    type: 'sale' | 'rent';
    duration?: number;
    minDuration?: number;
    maxDuration?: number;
    metadataHash?: string;
    status: 'LOCAL_DRAFT' | 'PENDING_CREATE' | 'ACTIVE' | 'PENDING_CANCEL' | 'CANCELLED' | 'RENTED';
    views: number;
    likes: number;
    confirmed?: boolean;
    txHash?: string;
    blockNumber?: number;
    confirmedAt?: Date;
    tokenURI?: string;
    createdAt?: Date;
}

export interface User {
    id: string;
    username: string;
    email: string; // Made required to match schema
    password?: string; // Added for auth
    walletAddress?: string;
    nonce?: string; // Added for SIWE (Stores SHA-256 hash)
    nonceExpiresAt?: Date; // Added for SIWE expiration
    profileImage?: string;
    bio?: string;
    createdAt?: Date;
}

export interface UserStats {
    totalNFTs: number;
    totalValue: string;
    activeListings: number;
    totalRentals: number;
    totalEarnings?: string; // Added to match controller
    activeRentedOut?: number; // Added to match controller
    currency: string;
}

export interface ApiResponse<T = any> {
    status: 'success' | 'error';
    message?: string;
    data?: T;
    error?: string;
}
