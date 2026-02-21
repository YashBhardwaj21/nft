import mongoose from 'mongoose';
import { NFT } from '../types/index.js';

const nftSchema = new mongoose.Schema<NFT>({
    // -------- CANONICAL IDENTITY (SOURCE OF TRUTH) --------
    tokenAddress: { type: String, lowercase: true, index: true },
    tokenId: { type: String, index: true },

    // Optional legacy app id (kept but NOT primary identity)
    id: { type: String, required: true, unique: true },

    // -------- METADATA --------
    name: { type: String },
    description: { type: String },
    image: { type: String },
    collectionName: { type: String, default: 'DAO Collection' },

    creator: { type: String, lowercase: true },
    owner: { type: String, lowercase: true }, // always wallet address

    tokenURI: { type: String },
    imageCID: { type: String },
    metadataCID: { type: String },
    metadataHash: { type: String },

    // -------- MINT STATE --------
    mintTxHash: { type: String },
    blockNumber: { type: Number },
    mintStatus: {
        type: String,
        enum: ['draft', 'pending', 'confirmed', 'failed'],
        default: 'draft',
        index: true
    },

    // -------- RENTAL STATE (CHAIN MIRROR) --------
    status: {
        type: String,
        enum: ['available', 'listing', 'rented'],
        default: 'available',
        index: true
    },

    isEscrowed: { type: Boolean, default: false },

    renterWallet: { type: String, lowercase: true, default: null },
    expiresAt: { type: Date, default: null },

    // -------- VERIFICATION --------
    fileHash: { type: String },

    // -------- ANALYTICS --------
    views: { type: Number, default: 0 },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

/**
 * TRUE PRIMARY KEY
 * One blockchain NFT = one DB document
 */
nftSchema.index(
    { tokenAddress: 1, tokenId: 1 },
    { unique: true, sparse: true }
);

/**
 * Only delete unconfirmed drafts
 */
nftSchema.index(
    { createdAt: 1 },
    {
        expireAfterSeconds: 172800,
        partialFilterExpression: { mintStatus: 'draft' }
    }
);

export const NFTModel = mongoose.model<NFT>('NFT', nftSchema);