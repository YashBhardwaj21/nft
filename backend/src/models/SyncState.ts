import mongoose from 'mongoose';

export interface SyncState {
    id: string;
    lastProcessedBlock: number;
    updatedAt: Date;
}

const syncStateSchema = new mongoose.Schema<SyncState>({
    id: { type: String, required: true, unique: true },
    lastProcessedBlock: { type: Number, required: true },
    updatedAt: { type: Date, default: Date.now }
});

export const SyncStateModel = mongoose.model<SyncState>('SyncState', syncStateSchema);
