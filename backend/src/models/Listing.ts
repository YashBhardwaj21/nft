import mongoose from 'mongoose';
import { Listing } from '../types/index.js';

const listingSchema = new mongoose.Schema<Listing>({
    // -------- CHAIN IDENTITY (PRIMARY KEY) --------
    onChainListingId: { type: Number },
    tokenAddress: { type: String, required: true, lowercase: true },
    tokenId: { type: String, required: true },

    // Optional local draft reference (NOT identity)
    id: { type: String, unique: true, sparse: true },
    nftId: { type: String },

    // -------- OWNER --------
    seller: { type: String, required: true, lowercase: true },
    sellerId: { type: String }, // Legacy compatibility

    // -------- ECONOMICS --------
    pricePerDay: { type: String }, // store wei string
    price: { type: String }, // Legacy compatibility
    rentalPrice: { type: String }, // Legacy compatibility
    minDuration: { type: Number, required: true },
    maxDuration: { type: Number, required: true },
    duration: { type: Number }, // Legacy compatibility
    currency: { type: String, default: 'ETH' },

    // -------- STATE --------
    status: {
        type: String,
        enum: ['LOCAL_DRAFT', 'PENDING_CREATE', 'ACTIVE', 'PENDING_CANCEL', 'CANCELLED', 'RENTED'],
        default: 'LOCAL_DRAFT',
        index: true
    },

    txHash: { type: String },
    blockNumber: { type: Number },
    confirmedAt: { type: Date },

    // -------- VERIFICATION --------
    metadataHash: { type: String },
    tokenURI: { type: String },
    type: { type: String, default: 'rent' },

    // -------- ANALYTICS --------
    views: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },

    createdAt: { type: Date, default: Date.now }
});

/**
 * TRUE UNIQUE LISTING
 * One on-chain listing = one DB document
 */
listingSchema.index(
    { onChainListingId: 1, tokenAddress: 1 },
    {
        unique: true,
        partialFilterExpression: {
            onChainListingId: { $exists: true, $ne: null }
        }
    }
);

/**
 * Fast lookup by NFT
 */
listingSchema.index(
    { tokenAddress: 1, tokenId: 1, status: 1 }
);

/**
 * Only delete drafts that never got a tx
 */
listingSchema.index(
    { createdAt: 1 },
    {
        expireAfterSeconds: 172800,
        partialFilterExpression: { status: 'draft' }
    }
);

export const ListingModel = mongoose.model<Listing>('Listing', listingSchema);