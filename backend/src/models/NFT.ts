import mongoose from 'mongoose';
import { NFT } from '../types/index.js';

const nftSchema = new mongoose.Schema<NFT>({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String },
    image: { type: String, required: true },
    owner: { type: String, required: true, ref: 'User' }, // Reference to User ID
    collectionName: { type: String, required: true, default: 'DAO Collection' },
    creator: { type: String, required: true },
    price: { type: Number, required: true }, // Changed to Number for calcs
    rentalPrice: { type: Number, default: 0 },
    maxDuration: { type: Number, default: 30 }, // Max days for rent
    currency: { type: String, default: 'ETH' },

    // Rental Status & Escrow Logic
    status: { type: String, enum: ['available', 'rented', 'listing'], default: 'available' },
    isEscrowed: { type: Boolean, default: false }, // TRUE when rented
    renterWallet: { type: String, ref: 'User', default: null }, // Linked to User ID
    expiresAt: { type: Date, default: null }, // Auto-return date
    views: { type: Number, default: 0 },
    timeLeft: { type: String },
    rentalEndDate: { type: Date },

    // Chain Data (Minting)
    fileHash: { type: String }, // SHA-256 of raw image bytes
    tokenId: { type: String },
    tokenURI: { type: String },
    imageCID: { type: String },
    metadataCID: { type: String },
    mintTxHash: { type: String },
    blockNumber: { type: Number },
    mintStatus: { type: String, enum: ['draft', 'pending', 'confirmed', 'failed'], default: 'draft' },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

export const NFTModel = mongoose.model<NFT>('NFT', nftSchema);
