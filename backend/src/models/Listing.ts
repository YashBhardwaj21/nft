import mongoose from 'mongoose';
import { Listing } from '../types/index.js';

const listingSchema = new mongoose.Schema<Listing>({
    id: { type: String, required: true, unique: true },
    nftId: { type: String, required: true, ref: 'NFT' },
    tokenAddress: { type: String }, // Address of the NFT contract
    onChainListingId: { type: Number }, // Maps to DAOMarketplaceMarket's uint256 listingId
    sellerId: { type: String, required: true, ref: 'User' },
    price: { type: String, required: true },
    rentalPrice: { type: String },
    currency: { type: String, required: true },
    type: { type: String, enum: ['sale', 'rent'], default: 'sale' },
    duration: { type: Number }, // in days
    minDuration: { type: Number, default: 1 },
    maxDuration: { type: Number, default: 30 },
    status: { type: String, enum: ['active', 'sold', 'rented', 'cancelled'], default: 'active' },
    views: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

export const ListingModel = mongoose.model<Listing>('Listing', listingSchema);
