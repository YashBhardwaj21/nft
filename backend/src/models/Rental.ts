import mongoose from 'mongoose';

export interface Rental extends mongoose.Document {
    // On-chain identity
    onChainListingId: number;
    tokenAddress: string;
    tokenId: string;

    // Wallet identities (NOT user ids)
    renterWallet: string;
    ownerWallet: string;

    // Economic data
    totalPrice: string; // store wei string to avoid precision loss

    // Time from blockchain
    startBlock?: number;
    startDate?: Date;
    expiresAt?: Date;

    // Lifecycle
    status: 'draft' | 'pending' | 'active' | 'confirmed' | 'expired' | 'cancelled';

    // Idempotency
    txHash: string;
    logIndex?: number;

    createdAt: Date;
    updatedAt: Date;
}

const rentalSchema = new mongoose.Schema<Rental>({
    onChainListingId: { type: Number },
    tokenAddress: { type: String, required: true, lowercase: true },
    tokenId: { type: String, required: true },

    renterWallet: { type: String, required: true, lowercase: true },
    ownerWallet: { type: String, lowercase: true },

    totalPrice: { type: String },

    startBlock: { type: Number },
    startDate: { type: Date, default: Date.now },
    expiresAt: { type: Date },

    status: {
        type: String,
        enum: ['draft', 'pending', 'active', 'confirmed', 'expired', 'cancelled'],
        default: 'pending'
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