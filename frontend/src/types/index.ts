export interface NFT {
    id: string;
    name: string;
    description?: string;
    image: string;
    price: number;
    rentalPrice: number;
    currency: string;
    collection: string;
    collectionName?: string;
    creator: string;
    owner?: string;
    tokenId?: string;
    tokenAddress?: string;
    contractAddress?: string;
    status: 'available' | 'rented' | 'listing' | 'listed';
    isEscrowed?: boolean;
    maxDuration?: number;
    renterWallet?: string;
    expiresAt?: Date;
    likes?: number;
    views?: number;
    timeLeft?: string;
    rentalEndDate?: Date;
    mintStatus?: 'draft' | 'pending' | 'confirmed' | 'failed';
    metadataHash?: string;
    mintTxHash?: string;
}

export interface User {
    id: string;
    username: string;
    email: string;
    walletAddress?: string;
    profileImage?: string;
}

export interface ApiResponse<T> {
    status: 'success' | 'error';
    data: T;
    message?: string;
    error?: string;
}

export interface Listing {
    id: string;
    nftId?: string;
    nft: NFT;
    tokenAddress?: string;
    tokenId?: string;
    onChainListingId?: number;
    price: number;
    rentalPrice: number;
    duration: number;
    seller: string; // sellerId or seller object
    createdAt: Date;
    metadataHash?: string;
    status: 'draft' | 'pending' | 'confirmed' | 'cancelled' | 'failed';
}

export interface RentalHistoryItem {
    id: string;
    nftId: string;
    nftName: string;
    nftImage: string;
    startDate: string;
    endDate?: string;
    price: number;
    status: string; // 'returned', 'active', etc.
}

export interface EarningHistoryItem {
    id: string;
    date: string;
    amount: number;
    source: string;
}

export interface UserStats {
    totalNFTs: number;
    totalValue: number;
    activeListings: number;
    totalRentals: number;
    totalEarnings: number;
    activeRentedOut: number;
}
