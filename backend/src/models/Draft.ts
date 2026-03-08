import mongoose from 'mongoose';

const draftSchema = new mongoose.Schema({
    // WORKFLOW IDENTITY
    metadataHash: { type: String, required: true, index: true },
    creator: { type: String, required: true, lowercase: true, unique: true, sparse: true },

    // UI DATA
    name: { type: String, required: true },
    description: { type: String },
    image: { type: String, required: true },
    attributes: { type: Array, default: [] },

    // CHAIN HINTS
    fileHash: { type: String },
    imageCID: { type: String },
    metadataCID: { type: String },
    tokenURI: { type: String },

    // STATE
    status: {
        type: String,
        enum: ['PREPARED', 'MINTING', 'MINTED', 'ABANDONED'],
        default: 'PREPARED',
        index: true
    },

    expiresAt: { type: Date, required: true },
}, {
    timestamps: true
});

// Compound index for workflow matching
draftSchema.index({ metadataHash: 1, creator: 1 }, { unique: true });

// Auto-expire drafted assets after 48h
draftSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const DraftModel = mongoose.model('Draft', draftSchema);
