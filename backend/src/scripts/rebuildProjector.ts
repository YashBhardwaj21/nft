import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { ethers } from 'ethers';

// Load env vars from the backend folder
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { NFTModel } from '../models/NFT.js';
import { ListingModel } from '../models/Listing.js';
import { RentalModel } from '../models/Rental.js';
import { EventModel } from '../models/Event.js';
import { SyncStateModel } from '../models/SyncState.js';

async function main() {
    console.log('🔄 Rebuilding Derived State from Event Ledger...');

    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI is required');

    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB');

    const rpcUrl = process.env.SEPOLIA_RPC || 'https://ethereum-sepolia-rpc.publicnode.com';
    const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, { batchMaxCount: 1 });
    const latestBlock = await provider.getBlockNumber();
    const startBlock = Math.max(0, latestBlock - 50000); // Only going back ~1 week

    // 1. Reset SyncState to startBlock
    await SyncStateModel.updateOne(
        { id: 'market_listener' },
        { $set: { lastProcessedBlock: startBlock } },
        { upsert: true }
    );
    console.log(`✅ SyncState reset to block ${startBlock} (latest is ${latestBlock})`);

    // 2. Mark ALL events as pending
    const res = await EventModel.updateMany(
        {},
        { $set: { status: 'pending', retries: 0 } }
    );
    console.log(`✅ ${res.modifiedCount} events marked as pending`);

    // 3. Clear chain-derived data (DANGER: doing this safely)
    // We only delete indexed NFTs (blockchain truth). DRAFT NFTs are user-local workflow state.
    await NFTModel.deleteMany({ tokenAddress: { $exists: true } });
    console.log('✅ Cleared indexed NFTs');

    // Only delete ACTIVE/RENTED/CANCELLED listings. DRAFT are user-local.
    await ListingModel.deleteMany({ status: { $in: ['ACTIVE', 'RENTED', 'CANCELLED'] } });
    console.log('✅ Cleared confirmed Listings');

    // Delete ALL Rentals (they are pure chain derivations)
    await RentalModel.deleteMany({});
    console.log('✅ Cleared Rentals');

    console.log('\n🎉 Rebuild prepared successfully!');
    console.log('Restart your backend server to allow the ChainProjector to replay all events from scratch.');

    process.exit(0);
}

main().catch(console.error);
