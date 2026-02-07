import mongoose from 'mongoose';

export interface Rental extends mongoose.Document {
    nftId: string;
    renterId: string;
    ownerId: string;
    rentalPrice: number;
    duration: number; // in days
    startDate: Date;
    endDate: Date;
    status: 'active' | 'completed' | 'cancelled';
    transactionHash?: string; // For future blockchain integration
    createdAt: Date;
    updatedAt: Date;
}

const rentalSchema = new mongoose.Schema<Rental>({
    nftId: { type: String, required: true, ref: 'NFT' },
    renterId: { type: String, required: true, ref: 'User' },
    ownerId: { type: String, required: true, ref: 'User' },
    rentalPrice: { type: Number, required: true },
    duration: { type: Number, required: true },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, required: true },
    status: {
        type: String,
        enum: ['active', 'completed', 'cancelled'],
        default: 'active'
    },
    transactionHash: { type: String },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Pre-save middleware to update timestamps
rentalSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

export const RentalModel = mongoose.model<Rental>('Rental', rentalSchema);
