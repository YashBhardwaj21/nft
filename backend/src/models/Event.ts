import mongoose from 'mongoose';

export interface BlockchainEvent {
    chainId?: number;
    contractAddress?: string;
    txHash: string;
    logIndex: number;
    blockNumber: number;

    status: 'pending' | 'processing' | 'processed' | 'failed';
    attempts: number;
    error?: string;

    data?: any;

    processedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const eventSchema = new mongoose.Schema<BlockchainEvent>({
    chainId: { type: Number },
    contractAddress: { type: String, lowercase: true },

    txHash: { type: String, required: true },
    logIndex: { type: Number, required: true },
    blockNumber: { type: Number, required: true },

    status: {
        type: String,
        enum: ['pending', 'processing', 'processed', 'failed'],
        default: 'pending',
        index: true
    },

    attempts: { type: Number, default: 0 },
    error: { type: String },

    data: { type: mongoose.Schema.Types.Mixed },

    processedAt: { type: Date },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

/**
 * TRUE EVENT IDENTITY
 * Prevents duplicates
 */
eventSchema.index(
    { txHash: 1, logIndex: 1 },
    { unique: true }
);

/**
 * Worker queue index
 */
eventSchema.index({ status: 1, blockNumber: 1 });

/**
 * Debugging/admin tools
 */
eventSchema.index({ eventName: 1 });
eventSchema.index({ processedAt: 1 });

export const EventModel = mongoose.model<BlockchainEvent>('Event', eventSchema);