export interface NFT {
    id: string;
    name: string;
    description?: string;
    image: string;
    tokenId?: string;
    contractAddress?: string;
    owner: string;
    collection: string;
    creator: string;
    price: number; // Changed to number
    rentalPrice?: number; // Changed to number
    maxDuration?: number; // New
    currency: string;
    status: 'available' | 'rented' | 'listing' | 'listed';
    isEscrowed?: boolean; // New
    renterWallet?: string; // New
    expiresAt?: Date; // New
    likes: number;
    views?: number;
    metadata?: Record<string, any>;
    timeLeft?: string;
    rentalEndDate?: Date;

    // Chain Data (Minting)
    fileHash?: string;
    tokenURI?: string;
    imageCID?: string;
    metadataCID?: string;
    mintTxHash?: string;
    blockNumber?: number;
    mintStatus?: 'draft' | 'pending' | 'confirmed' | 'failed';

    createdAt?: Date;
    updatedAt?: Date;
}

export interface Rental {
    id: string;
    nftId: string;
    renterId: string;
    ownerId: string;
    rentalPrice: number; // Changed to number
    duration: number;
    currency: string;
    startDate: Date;
    endDate: Date;
    status: 'active' | 'completed' | 'cancelled';
    transactionHash?: string;
    createdAt?: Date;
}

export interface Listing {
    id: string;
    nftId: string;
    sellerId: string;
    price: string;
    rentalPrice?: string;
    currency: string;
    type: 'sale' | 'rent'; // New
    duration?: number; // in days
    status: 'active' | 'sold' | 'cancelled';
    views: number;
    likes: number;
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
