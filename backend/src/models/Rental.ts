import mongoose from 'mongoose';

export interface Rental extends mongoose.Document {
    // On-chain identity
    onChainListingId: number;
    listingId?: string;
    tokenAddress: string;
    tokenId: string;

    // Wallet identities (NOT user ids)
    renter: string;
    owner: string;

    // Economic data
    totalPrice: string; // store wei string to avoid precision loss

    // Time from blockchain
    startBlock?: number;
    startAt?: Date;
    expiresAt?: Date;

    // Lifecycle
    status: 'PENDING' | 'ACTIVE';

    // Idempotency
    txHash: string;
    logIndex?: number;

    createdAt: Date;
    updatedAt: Date;
}

const rentalSchema = new mongoose.Schema<Rental>({
    onChainListingId: { type: Number },
    listingId: { type: String }, // added to satisfy prompt
    tokenAddress: { type: String, required: true, lowercase: true },
    tokenId: { type: String, required: true },

    renter: { type: String, required: true, lowercase: true }, // renamed from renterWallet
    owner: { type: String, lowercase: true }, // renamed from ownerWallet

    totalPrice: { type: String },

    startBlock: { type: Number },
    startAt: { type: Date, default: Date.now }, // renamed from startDate
    expiresAt: { type: Date },

    status: {
        type: String,
        enum: ['PENDING', 'ACTIVE'],
        default: 'PENDING'
    },

    txHash: { type: String, required: true },
    logIndex: { type: Number },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

/**
 * Prevent duplicate processing of same blockchain event
 * Sparse allows pending records with no logIndex to coexist
 */
rentalSchema.index({ txHash: 1, logIndex: 1 }, { unique: true, sparse: true });

/**
 * Fast queries:
 * - user's rentals
 * - NFT rental history
 */
rentalSchema.index({ renterWallet: 1 });
rentalSchema.index({ ownerWallet: 1 });
rentalSchema.index({ tokenAddress: 1, tokenId: 1 });

export const RentalModel = mongoose.model<Rental>('Rental', rentalSchema);