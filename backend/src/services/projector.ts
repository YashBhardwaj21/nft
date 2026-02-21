import mongoose from 'mongoose';
import { ethers } from 'ethers';
import { EventModel } from '../models/Event.js';
import { NFTModel } from '../models/NFT.js';
import { ListingModel } from '../models/Listing.js';
import { RentalModel } from '../models/Rental.js';
import fetch from 'node-fetch';
import { createHash } from 'crypto';
import { getDynamicProvider } from '../utils/provider.js';

// Minimal JSON fetcher for metadata hash verification
async function getJSON(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.text();
    return data;
}

function sha256(content: string): string {
    return createHash('sha256').update(content).digest('hex');
}

/**
 * The Projector sequentially processes events from the Event ledger
 * and applies them to the derived models (NFT, Listing, Rental) atomically.
 */
class ChainProjector {
    private isRunning = false;
    private CONFIRMATIONS_N = 2; // Matches ChainListener setting

    public async start() {
        if (this.isRunning) return;
        this.isRunning = true;

        console.log(`🎬 Projector started, polling Event model...`);
        this.processQueueLoop();
    }

    public stop() {
        this.isRunning = false;
        console.log('🛑 Projector stopped.');
    }

    private async processQueueLoop() {
        while (this.isRunning) {
            try {
                // Get highest confirmed block directly from RPC (could also just read from the chainListener,
                // but for independence we can query it here, or omit CONFIRMATIONS check here if chainlistener only saves confirmed).
                // Wait, chainListener saves instantly. So Projector enforces confirmation block wait.
                const provider = getDynamicProvider();
                const currentBlock = await provider.getBlockNumber();

                // Fetch ready events in order
                const readyEvents = await EventModel.find({
                    status: 'pending',
                    blockNumber: { $lte: currentBlock - this.CONFIRMATIONS_N }
                }).sort({ blockNumber: 1, logIndex: 1 }).limit(50);

                if (readyEvents.length === 0) {
                    await new Promise(res => setTimeout(res, 5000));
                    continue;
                }

                for (const evDoc of readyEvents) {
                    await this.processEventWithTransaction(evDoc);
                }

                await new Promise(res => setTimeout(res, 2000));
            } catch (error) {
                console.error('Error in projector loop:', error);
                await new Promise(res => setTimeout(res, 5000));
            }
        }
    }

    private async processEventWithTransaction(evDoc: any) {
        // Start a MongoDB session for the transaction
        const session = await mongoose.startSession();

        try {
            console.log(`[Projector] -> Processing [${evDoc.type}] Tx: ${evDoc.txHash} (Block: ${evDoc.blockNumber})`);

            // Note: MongoDB Transactions require a Replica Set.
            // If running a standalone mongo locally, this .withTransaction will throw.
            await session.withTransaction(async () => {
                const nftContractRaw = process.env.CONTRACT_ADDRESS;
                if (!nftContractRaw) throw new Error('CONTRACT_ADDRESS missing');
                const MARKET_ADDRESS = process.env.MARKETPLACE_ADDRESS;

                // Process the event based on type
                if (evDoc.type === 'Mint') {
                    await this.handleMint(evDoc, session, nftContractRaw);
                } else if (evDoc.type === 'List') {
                    await this.handleList(evDoc, session);
                } else if (evDoc.type === 'Cancel') {
                    await this.handleCancel(evDoc, session);
                } else if (evDoc.type === 'Rent') {
                    await this.handleRent(evDoc, session);
                }

                // Mark event as processed within the same transaction
                await EventModel.updateOne(
                    { _id: evDoc._id },
                    { $set: { status: 'processed', processedAt: new Date() } },
                    { session }
                );
            });

        } catch (error: any) {
            evDoc.attempts = (evDoc.attempts || 0) + 1;
            console.error(`[Projector] ❌ Failed to process ${evDoc.txHash} (Attempt ${evDoc.attempts}):`, error.message);

            if (evDoc.attempts >= 5) {
                console.error(`[Projector] ☠️ Event marked failed: ${evDoc.txHash}`);
                try {
                    await EventModel.updateOne(
                        { _id: evDoc._id },
                        { $set: { status: 'failed', error: error.message || String(error) } }
                    );
                } catch (e) { console.error('Failed to mark event failed', e); }
            } else {
                try {
                    await EventModel.updateOne(
                        { _id: evDoc._id },
                        { $set: { attempts: evDoc.attempts } }
                    );
                } catch (e) { console.error('Failed to update event attempts', e); }
            }
        } finally {
            await session.endSession();
        }
    }

    private async handleMint(evDoc: any, session: mongoose.ClientSession, nftContractAddress: string) {
        const { tokenId, creator, tokenURI, metadataHash } = evDoc.data;
        const tokenAddress = nftContractAddress.toLowerCase();

        // Draft-matching strategy priority:
        // 1. txHash directly matches what frontend sent
        // 2. metadataHash uniquely matches exactly ONE draft
        // 3. (Fallback) Upsert canonical chain state

        let mappedMint = await NFTModel.findOne({ mintTxHash: evDoc.txHash, mintStatus: { $in: ['DRAFT', 'PENDING'] } }).session(session);

        if (!mappedMint && metadataHash) {
            // Check if metadataHash precisely matches one draft
            const draftMatches = await NFTModel.find({ metadataHash, mintStatus: { $in: ['DRAFT', 'PENDING'] } }).session(session);
            if (draftMatches.length === 1) {
                mappedMint = draftMatches[0];
            }
        }

        if (mappedMint) {
            mappedMint.tokenId = tokenId.toString();
            mappedMint.tokenAddress = tokenAddress;
            mappedMint.owner = creator.toLowerCase();
            mappedMint.creator = creator.toLowerCase();
            mappedMint.tokenURI = tokenURI;
            mappedMint.mintStatus = 'CONFIRMED';
            mappedMint.blockNumber = evDoc.blockNumber;
            mappedMint.updatedAt = new Date();
            await mappedMint.save({ session });
        } else {
            // Fallback canonical upsert
            await NFTModel.updateOne(
                { tokenAddress, tokenId: tokenId.toString() },
                {
                    $set: {
                        owner: creator.toLowerCase(),
                        creator: creator.toLowerCase(),
                        tokenURI: tokenURI,
                        metadataHash: metadataHash,
                        mintTxHash: evDoc.txHash,
                        blockNumber: evDoc.blockNumber,
                        mintStatus: 'CONFIRMED',
                        updatedAt: new Date()
                    },
                    $setOnInsert: {
                        id: `nft_${tokenId}_${Date.now()}`,
                        name: `Token #${tokenId}`,
                        image: '',
                        price: 0,
                        fileHash: ''
                    }
                },
                { upsert: true, session }
            );
        }

        // Trigger asynchronous metadata verification outside transaction
        this.verifyMetadataAsync(tokenAddress, tokenId.toString(), tokenURI, metadataHash);
    }

    private async handleList(evDoc: any, session: mongoose.ClientSession) {
        const { onChainListingId, owner, tokenAddress, tokenId, pricePerDay, minDuration, maxDuration, metadataHash } = evDoc.data;
        const tokenAddr = tokenAddress.toLowerCase();

        // Match draft by txHash or fallback to tokenAddress + tokenId + PENDING_CREATE
        let draftListing = await ListingModel.findOne({ txHash: evDoc.txHash, status: { $in: ['LOCAL_DRAFT', 'PENDING_CREATE'] } }).session(session);

        if (!draftListing) {
            // Check for a pending create on this specific token by this owner
            draftListing = await ListingModel.findOne({
                tokenAddress: tokenAddr,
                tokenId: tokenId.toString(),
                seller: owner.toLowerCase(),
                status: 'PENDING_CREATE'
            }).session(session);
        }

        if (draftListing) {
            draftListing.onChainListingId = Number(onChainListingId);
            draftListing.tokenAddress = tokenAddr;
            draftListing.tokenId = tokenId.toString();
            draftListing.seller = owner.toLowerCase();
            draftListing.sellerId = owner.toLowerCase();
            draftListing.price = ethers.formatEther(pricePerDay);
            draftListing.pricePerDay = ethers.formatEther(pricePerDay);
            draftListing.rentalPrice = ethers.formatEther(pricePerDay);
            draftListing.minDuration = Number(minDuration);
            draftListing.maxDuration = Number(maxDuration);
            if (metadataHash) draftListing.metadataHash = metadataHash;
            draftListing.status = 'ACTIVE';
            draftListing.confirmed = true;
            draftListing.txHash = evDoc.txHash;
            draftListing.blockNumber = evDoc.blockNumber;
            draftListing.confirmedAt = new Date();
            draftListing.type = 'rent';
            await draftListing.save({ session });
        } else {
            await ListingModel.updateOne(
                { onChainListingId: Number(onChainListingId), tokenAddress: tokenAddr },
                {
                    $set: {
                        tokenId: tokenId.toString(),
                        seller: owner.toLowerCase(),
                        sellerId: owner.toLowerCase(),
                        price: ethers.formatEther(pricePerDay),
                        pricePerDay: ethers.formatEther(pricePerDay),
                        rentalPrice: ethers.formatEther(pricePerDay),
                        currency: 'ETH',
                        minDuration: Number(minDuration),
                        maxDuration: Number(maxDuration),
                        metadataHash,
                        status: 'ACTIVE',
                        confirmed: true,
                        txHash: evDoc.txHash,
                        blockNumber: evDoc.blockNumber,
                        confirmedAt: new Date(),
                        type: 'rent',
                        source: 'chain'
                    },
                    $setOnInsert: {
                        id: `list_${onChainListingId}_${Date.now()}`
                    }
                },
                { upsert: true, session }
            );
        }

        // Update NFT using the same transaction
        await NFTModel.updateOne(
            { tokenAddress: tokenAddr, tokenId: tokenId.toString() },
            { $set: { status: 'LISTING', isEscrowed: true } },
            { session }
        );

        if (draftListing && draftListing.tokenURI) {
            this.verifyMetadataAsync(tokenAddr, tokenId.toString(), draftListing.tokenURI, metadataHash);
        }
    }

    private async handleCancel(evDoc: any, session: mongoose.ClientSession) {
        const { onChainListingId, tokenAddress, tokenId } = evDoc.data;
        const tokenAddr = tokenAddress.toLowerCase();

        await ListingModel.updateOne(
            { onChainListingId: Number(onChainListingId), tokenAddress: tokenAddr },
            { $set: { status: 'CANCELLED' } },
            { session }
        );

        await NFTModel.updateOne(
            { tokenAddress: tokenAddr, tokenId: tokenId.toString() },
            { $set: { status: 'AVAILABLE', isEscrowed: false } },
            { session }
        );
    }

    private async handleRent(evDoc: any, session: mongoose.ClientSession) {
        const { onChainListingId, renter, tokenAddress, tokenId, expires } = evDoc.data;
        const tokenAddr = tokenAddress.toLowerCase();
        const expiryDate = new Date(Number(expires) * 1000);

        await ListingModel.updateOne(
            { onChainListingId: Number(onChainListingId), tokenAddress: tokenAddr },
            {
                $set: {
                    status: 'RENTED',
                    currentRenter: renter.toLowerCase(),
                    rentedUntil: expiryDate,
                    lastRentTxHash: evDoc.txHash
                }
            },
            { session }
        );

        await NFTModel.updateOne(
            { tokenAddress: tokenAddr, tokenId: tokenId.toString() },
            {
                $set: {
                    status: 'RENTED',
                    renterWallet: renter.toLowerCase(),
                    expiresAt: expiryDate,
                    rentalEndDate: expiryDate,
                    isEscrowed: true
                }
            },
            { session }
        );

        const rentalUpdate = await RentalModel.findOneAndUpdate(
            { txHash: evDoc.txHash },
            {
                $set: {
                    status: 'ACTIVE',
                    renter: renter.toLowerCase(),
                    expiresAt: expiryDate,
                    logIndex: evDoc.logIndex,
                    startBlock: evDoc.blockNumber,
                    onChainListingId: Number(onChainListingId)
                }
            },
            { new: true, session, upsert: false } // Avoid blind upsert here incase multiple rents in one tx
        );

        if (!rentalUpdate) {
            // Must define it fully for the schema
            const newRental = new RentalModel({
                onChainListingId: Number(onChainListingId),
                listingId: `list_${onChainListingId}`, // approximation
                tokenAddress: tokenAddr,
                tokenId: tokenId.toString(),
                txHash: evDoc.txHash,
                renter: renter.toLowerCase(),
                owner: '0x0000000000000000000000000000000000000000', // fallback if owner is unknown
                status: 'ACTIVE',
                expiresAt: expiryDate,
                logIndex: evDoc.logIndex,
                startBlock: evDoc.blockNumber,
                createdAt: new Date(),
            });
            await newRental.save({ session });
        }
    }

    private async verifyMetadataAsync(tokenAddress: string, tokenId: string, tokenURI: string, providedHash: string) {
        try {
            if (!tokenURI || !tokenURI.startsWith('http')) return;
            const metadataStr = await getJSON(tokenURI);
            const computedHash = '0x' + sha256(metadataStr);
            if (computedHash !== providedHash) {
                console.warn(`[Projector] ⚠️ Metadata hash mismatch for NFT ${tokenAddress}/${tokenId}`);
            }
        } catch (e: any) {
            console.error(`[Projector] Failed to verify metadata for ${tokenId}:`, e.message);
        }
    }
}

export const projector = new ChainProjector();
