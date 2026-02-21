// backend/src/services/chainListener.ts
import { ethers } from 'ethers';
import { NFTModel } from '../models/NFT.js';
import { ListingModel } from '../models/Listing.js';
import { RentalModel } from '../models/Rental.js';
import { EventModel } from '../models/Event.js';
import { SyncStateModel } from '../models/SyncState.js';
import fs from 'fs';
import path from 'path';
import { getJSON } from './ipfs.service.js';
import { sha256 } from '../crypto/sha256.js';

// Load ABIs
const NFT_ABI_PATH = path.join(process.cwd(), '..', 'shared', 'DAOMarketplaceNFT.json');
const MARKET_ABI_PATH = path.join(process.cwd(), '..', 'shared', 'DAOMarketplaceMarket.json');

// Configuration
const CONFIRMATIONS_N = parseInt(process.env.CONFIRMATIONS_N || '3', 10);
const REORG_GUARD = 12; // Blocks to look back on restart to catch missed reorgs

interface QueuedEvent {
    type: 'Mint' | 'List' | 'Cancel' | 'Rent';
    blockNumber: number;
    logIndex: number;
    txHash: string;
    data: any;
    processed: boolean;
    attempts: number;
}

export class ChainListener {
    private provider!: ethers.Provider;
    private nftContract: ethers.Contract | null = null;
    private marketContract: ethers.Contract | null = null;
    private isRunning = false;
    private lastProcessedBlock = 0;

    constructor() { }

    public async start() {
        if (this.isRunning) return;
        this.isRunning = true;

        // Prefer WebSocket, fallback to HTTP
        const rpcUrl = process.env.RPC_URL || process.env.SEPOLIA_RPC || 'https://rpc.sepolia.org';
        if (rpcUrl.startsWith('ws')) {
            this.provider = new ethers.WebSocketProvider(rpcUrl);
        } else {
            this.provider = new ethers.JsonRpcProvider(rpcUrl);
        }

        console.log(`🚀 Starting Chain-First Listener (Confirmations required: ${CONFIRMATIONS_N})...`);

        try {
            await this.initContracts();
            await this.loadState();
            await this.backfillEvents();
            this.subscribeToEvents();

            // Start the worker loop
            this.processQueueLoop();
        } catch (error) {
            console.error('❌ Chain Listener initialization failed:', error);
            this.isRunning = false;
            // Retry init after delay
            setTimeout(() => this.start(), 10000);
        }
    }

    private async initContracts() {
        const nftAddress = process.env.CONTRACT_ADDRESS;
        const marketAddress = process.env.MARKETPLACE_ADDRESS;

        if (!nftAddress || !marketAddress) {
            throw new Error('Contract addresses missing from ENV');
        }

        const nftAbi = JSON.parse(fs.readFileSync(NFT_ABI_PATH, 'utf8')).abi;
        const marketAbi = JSON.parse(fs.readFileSync(MARKET_ABI_PATH, 'utf8')).abi;

        this.nftContract = new ethers.Contract(nftAddress, nftAbi, this.provider);
        this.marketContract = new ethers.Contract(marketAddress, marketAbi, this.provider);
    }

    private async loadState() {
        try {
            const state = await SyncStateModel.findOne({ id: 'market_listener' });
            if (state) {
                // Apply reorg guard on restart
                this.lastProcessedBlock = Math.max(0, state.lastProcessedBlock - REORG_GUARD);
            } else {
                const currentBlock = await this.provider.getBlockNumber();
                this.lastProcessedBlock = Math.max(0, currentBlock - 100); // Arbitrary safe start
                await SyncStateModel.create({ id: 'market_listener', lastProcessedBlock: this.lastProcessedBlock });
            }
            console.log(`📌 Starting sync from block ${this.lastProcessedBlock}`);
        } catch (error) {
            console.error('Failed to load state:', error);
            const currentBlock = await this.provider.getBlockNumber();
            this.lastProcessedBlock = Math.max(0, currentBlock - 100);
        }
    }

    private async saveState(blockNumber: number) {
        if (blockNumber > this.lastProcessedBlock) {
            this.lastProcessedBlock = blockNumber;
            try {
                await SyncStateModel.updateOne(
                    { id: 'market_listener' },
                    { $set: { lastProcessedBlock: blockNumber, updatedAt: new Date() } },
                    { upsert: true }
                );
            } catch (err) {
                console.error('Failed to save state:', err);
            }
        }
    }

    // ==========================================
    // Event Ingestion
    // ==========================================

    private async backfillEvents() {
        console.log(`⏳ Backfilling events from ${this.lastProcessedBlock}...`);
        const latestBlock = await this.provider.getBlockNumber();

        // Adjust BATCH_SIZE to your provider; keep small for free tiers
        const BATCH_SIZE = 10;

        for (let from = this.lastProcessedBlock; from <= latestBlock; from += BATCH_SIZE) {
            const to = Math.min(from + BATCH_SIZE - 1, latestBlock);
            if (from % 10000 === 0) console.log(`Backfilling ${from} to ${to}...`);

            try {
                // Mint events from NFT contract
                const mintFilter = this.nftContract!.filters.NFTMinted?.();
                if (mintFilter) {
                    const mintLogs = await this.nftContract!.queryFilter(mintFilter, from, to);
                    for (const log of mintLogs) {
                        if (!log.transactionHash) continue;
                        this.enqueueEvent({
                            type: 'Mint',
                            blockNumber: log.blockNumber,
                            logIndex: log.index,
                            txHash: log.transactionHash,
                            data: {
                                tokenId: log.args[0].toString(),
                                creator: log.args[1],
                                tokenURI: log.args[2],
                                metadataHash: log.args[3]
                            },
                            processed: false,
                            attempts: 0
                        });
                    }
                }

                // ListingCreated events from Market contract
                const listFilter = this.marketContract!.filters.ListingCreated?.();
                if (listFilter) {
                    const listLogs = await this.marketContract!.queryFilter(listFilter, from, to);
                    for (const log of listLogs) {
                        if (!log.transactionHash) continue;
                        this.enqueueEvent({
                            type: 'List',
                            blockNumber: log.blockNumber,
                            logIndex: log.index,
                            txHash: log.transactionHash,
                            data: {
                                onChainListingId: (log as any).args[0].toString(),
                                owner: (log as any).args[1],
                                tokenAddress: (log as any).args[2],
                                tokenId: (log as any).args[3].toString(),
                                pricePerDay: (log as any).args[4].toString(),
                                minDuration: (log as any).args[5].toString(),
                                maxDuration: (log as any).args[6].toString(),
                                metadataHash: (log as any).args[7]
                            },
                            processed: false,
                            attempts: 0
                        });
                    }
                }

                // Rented events
                const rentFilter = this.marketContract!.filters.Rented?.();
                if (rentFilter) {
                    const rentLogs = await this.marketContract!.queryFilter(rentFilter, from, to);
                    for (const log of rentLogs) {
                        if (!log.transactionHash) continue;
                        this.enqueueEvent({
                            type: 'Rent',
                            blockNumber: log.blockNumber,
                            logIndex: log.index,
                            txHash: log.transactionHash,
                            data: {
                                onChainListingId: log.args[0].toString(),
                                renter: log.args[1],
                                tokenAddress: log.args[2],
                                tokenId: log.args[3].toString(),
                                expires: log.args[4].toString(),
                                totalPrice: log.args[5].toString()
                            },
                            processed: false,
                            attempts: 0
                        });
                    }
                }

                // ListingCancelled events
                const cancelFilter = this.marketContract!.filters.ListingCancelled?.();
                if (cancelFilter) {
                    const cancelLogs = await this.marketContract!.queryFilter(cancelFilter, from, to);
                    for (const log of cancelLogs) {
                        if (!log.transactionHash) continue;
                        this.enqueueEvent({
                            type: 'Cancel',
                            blockNumber: log.blockNumber,
                            logIndex: log.index,
                            txHash: log.transactionHash,
                            data: {
                                onChainListingId: log.args[0].toString(),
                                tokenAddress: log.args[1],
                                tokenId: log.args[2].toString()
                            },
                            processed: false,
                            attempts: 0
                        });
                    }
                }

                await this.saveState(to);
            } catch (err: any) {
                console.error(`Backfill failed at range ${from}-${to}:`, err.message || err);
                // In production, implement backoff and retries here
                break;
            }
        }
        console.log('✅ Backfill complete');
    }

    private subscribeToEvents() {
        // Subscribe to Minted
        this.nftContract!.on('NFTMinted', (tokenId, creator, tokenURI, metadataHash, event) => {
            if (!event || !event.transactionHash) return;
            this.enqueueEvent({
                type: 'Mint',
                blockNumber: event.blockNumber,
                logIndex: event.logIndex,
                txHash: event.transactionHash,
                data: { tokenId: tokenId.toString(), creator, tokenURI, metadataHash },
                processed: false,
                attempts: 0
            });
        });

        // Subscribe to ListingCreated
        this.marketContract!.on('ListingCreated', (...args) => {
            const event = args[args.length - 1];
            if (!event || !event.transactionHash) return;
            this.enqueueEvent({
                type: 'List',
                blockNumber: event.blockNumber,
                logIndex: event.index,
                txHash: event.transactionHash,
                data: {
                    onChainListingId: args[0].toString(),
                    owner: args[1],
                    tokenAddress: args[2],
                    tokenId: args[3].toString(),
                    pricePerDay: args[4].toString(),
                    minDuration: args[5].toString(),
                    maxDuration: args[6].toString(),
                    metadataHash: args[7]
                },
                processed: false,
                attempts: 0
            });
        });

        // Subscribe to ListingCancelled
        this.marketContract!.on('ListingCancelled', (...args) => {
            const event = args[args.length - 1];
            if (!event || !event.transactionHash) return;
            this.enqueueEvent({
                type: 'Cancel',
                blockNumber: event.blockNumber,
                logIndex: event.index,
                txHash: event.transactionHash,
                data: { onChainListingId: args[0].toString(), tokenAddress: args[1], tokenId: args[2].toString() },
                processed: false,
                attempts: 0
            });
        });

        // Subscribe to Rented
        this.marketContract!.on('Rented', (...args) => {
            const event = args[args.length - 1];
            if (!event || !event.transactionHash) return;
            this.enqueueEvent({
                type: 'Rent',
                blockNumber: event.blockNumber,
                logIndex: event.index,
                txHash: event.transactionHash,
                data: { onChainListingId: args[0].toString(), renter: args[1], tokenAddress: args[2], tokenId: args[3].toString(), expires: args[4].toString(), totalPrice: args[5].toString() },
                processed: false,
                attempts: 0
            });
        });
    }

    private async enqueueEvent(ev: QueuedEvent) {
        try {
            await EventModel.updateOne(
                { txHash: ev.txHash, logIndex: ev.logIndex },
                {
                    $setOnInsert: {
                        blockNumber: ev.blockNumber,
                        type: ev.type,
                        data: ev.data,
                        status: 'pending',
                        attempts: 0,
                        createdAt: new Date()
                    }
                },
                { upsert: true }
            );
        } catch (err) {
            console.error('Error enqueueing event:', err);
        }
    }

    // ==========================================
    // Worker Loop
    // ==========================================

    private async processQueueLoop() {
        while (this.isRunning) {
            try {
                const currentBlock = await this.provider.getBlockNumber();
                const readyEvents = await EventModel.find({
                    status: 'pending',
                    blockNumber: { $lte: currentBlock - CONFIRMATIONS_N }
                }).sort({ blockNumber: 1, logIndex: 1 }).limit(100);

                if (readyEvents.length === 0) {
                    await new Promise(res => setTimeout(res, 5000));
                    continue;
                }

                for (const evDoc of readyEvents) {
                    await this.processEventIdempotent(evDoc);
                }

                await new Promise(res => setTimeout(res, 3000));
            } catch (error) {
                console.error('Error in queue processing loop:', error);
                await new Promise(res => setTimeout(res, 5000));
            }
        }
    }

    private async processEventIdempotent(evDoc: any) {
        try {
            console.log(`=== Processing [${evDoc.type}] Tx: ${evDoc.txHash} (Block: ${evDoc.blockNumber}) ===`);

            if (evDoc.type === 'Mint') {
                const { tokenId, creator, tokenURI, metadataHash } = evDoc.data;
                const tokenAddress = (this.nftContract!.target as string).toLowerCase();

                // Try to find the existing draft by the transaction hash
                const draftNft = await NFTModel.findOne({ mintTxHash: evDoc.txHash });

                if (draftNft) {
                    // Update the existing draft with chain data
                    draftNft.tokenId = tokenId.toString();
                    draftNft.tokenAddress = tokenAddress;
                    draftNft.owner = creator.toLowerCase();
                    draftNft.creator = creator.toLowerCase();
                    draftNft.tokenURI = tokenURI;
                    draftNft.mintStatus = 'confirmed';
                    draftNft.blockNumber = evDoc.blockNumber;
                    draftNft.updatedAt = new Date();
                    await draftNft.save();
                } else {
                    // Fallback: Create a new canonical record if no draft exists
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
                                mintStatus: 'confirmed' as const,
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
                        { upsert: true }
                    );
                }

                // verify metadata if possible
                this.verifyMetadataAsync(tokenAddress, tokenId.toString(), tokenURI, metadataHash);

            } else if (evDoc.type === 'List') {
                const { onChainListingId, owner, tokenAddress, tokenId, pricePerDay, minDuration, maxDuration, metadataHash } = evDoc.data;
                const tokenAddr = tokenAddress.toLowerCase();

                // Try to find an existing draft by txHash. This is the critical linkage.
                const draftListing = await ListingModel.findOne({ txHash: evDoc.txHash, status: { $in: ['draft', 'pending'] } });

                if (draftListing) {
                    // Update the existing draft — this prevents duplicate records
                    draftListing.onChainListingId = Number(onChainListingId);
                    draftListing.tokenAddress = tokenAddr;
                    draftListing.tokenId = tokenId.toString();
                    draftListing.sellerId = owner.toLowerCase();
                    draftListing.price = ethers.formatEther(pricePerDay);
                    draftListing.rentalPrice = ethers.formatEther(pricePerDay);
                    draftListing.minDuration = Number(minDuration);
                    draftListing.maxDuration = Number(maxDuration);
                    draftListing.metadataHash = metadataHash;
                    draftListing.status = 'confirmed';
                    draftListing.confirmed = true;
                    draftListing.txHash = evDoc.txHash;
                    draftListing.blockNumber = evDoc.blockNumber;
                    draftListing.confirmedAt = new Date();
                    draftListing.type = 'rent';
                    await draftListing.save();
                } else {
                    // Fallback: No draft found — create a canonical on-chain listing record
                    await ListingModel.updateOne(
                        { onChainListingId: Number(onChainListingId), tokenAddress: tokenAddr },
                        {
                            $set: {
                                tokenId: tokenId.toString(),
                                sellerId: owner.toLowerCase(),
                                price: ethers.formatEther(pricePerDay),
                                rentalPrice: ethers.formatEther(pricePerDay),
                                currency: 'ETH',
                                minDuration: Number(minDuration),
                                maxDuration: Number(maxDuration),
                                metadataHash,
                                status: 'confirmed' as const,
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
                        { upsert: true }
                    );
                }

                // Update NFT status to listing / escrowed
                await NFTModel.updateOne(
                    { tokenAddress: tokenAddr, tokenId: tokenId.toString() },
                    { $set: { status: 'listing', isEscrowed: true } }
                );

                // If the draft had a tokenURI saved, verify metadata hash
                if (draftListing && draftListing.tokenURI) {
                    this.verifyMetadataAsync(tokenAddr, tokenId.toString(), draftListing.tokenURI, metadataHash);
                }

            } else if (evDoc.type === 'Cancel') {
                const { onChainListingId, tokenAddress, tokenId } = evDoc.data;
                const tokenAddr = tokenAddress.toLowerCase();

                await ListingModel.updateOne(
                    { onChainListingId: Number(onChainListingId), tokenAddress: tokenAddr },
                    { $set: { status: 'cancelled' as const } }
                );

                await NFTModel.updateOne(
                    { tokenAddress: tokenAddr, tokenId: tokenId.toString() },
                    { $set: { status: 'available', isEscrowed: false } }
                );

            } else if (evDoc.type === 'Rent') {
                const { onChainListingId, renter, tokenAddress, tokenId, expires } = evDoc.data;
                const tokenAddr = tokenAddress.toLowerCase();
                const expiryDate = new Date(Number(expires) * 1000);

                // Update Listing: mark as rented and track current renter
                await ListingModel.updateOne(
                    { onChainListingId: Number(onChainListingId), tokenAddress: tokenAddr },
                    {
                        $set: {
                            status: 'rented',
                            currentRenter: renter.toLowerCase(),
                            rentedUntil: expiryDate,
                            lastRentTxHash: evDoc.txHash
                        }
                    }
                );

                // Update NFT to rented state
                await NFTModel.updateOne(
                    { tokenAddress: tokenAddr, tokenId: tokenId.toString() },
                    {
                        $set: {
                            status: 'rented',
                            renterWallet: renter.toLowerCase(),
                            expiresAt: expiryDate,
                            rentalEndDate: expiryDate,
                            isEscrowed: true
                        }
                    }
                );

                // ===== NEW: finalize associated Rental record by txHash =====
                const rentalUpdate = await RentalModel.findOneAndUpdate(
                    { txHash: evDoc.txHash },
                    {
                        $set: {
                            status: 'confirmed',
                            renterWallet: renter.toLowerCase(),
                            expiresAt: expiryDate,
                            logIndex: evDoc.logIndex,
                            startBlock: evDoc.blockNumber,
                            onChainListingId: Number(onChainListingId)
                        }
                    },
                    { new: true }
                );

                // If rental record not found, create a minimal record for audit
                if (!rentalUpdate) {
                    await RentalModel.create({
                        onChainListingId: Number(onChainListingId),
                        tokenAddress: tokenAddr,
                        tokenId: tokenId.toString(),
                        txHash: evDoc.txHash,
                        renterWallet: renter.toLowerCase(),
                        status: 'confirmed',
                        expiresAt: expiryDate,
                        logIndex: evDoc.logIndex,
                        startBlock: evDoc.blockNumber,
                        createdAt: new Date(),
                    });
                }
            }

            // Mark as processed
            evDoc.status = 'processed';
            await evDoc.save();

            this.saveState(evDoc.blockNumber);

        } catch (error: any) {
            evDoc.attempts = (evDoc.attempts || 0) + 1;
            console.error(`Failed to process event ${evDoc.txHash} (Attempt ${evDoc.attempts}):`, error.message || error);
            if (evDoc.attempts >= 5) {
                console.error(`☠️ Dead event dropped: ${evDoc.txHash}`);
                evDoc.status = 'failed';
                evDoc.error = error.message || String(error);
            }
            await evDoc.save();
        }
    }

    private async verifyMetadataAsync(tokenAddress: string, tokenId: string, tokenURI: string, providedHash: string) {
        try {
            if (!tokenURI || !tokenURI.startsWith('http')) return;
            const metadataStr = await getJSON(tokenURI);
            const computedHash = '0x' + sha256(metadataStr);
            if (computedHash !== providedHash) {
                console.warn(`⚠️ Metadata hash mismatch for NFT ${tokenAddress}/${tokenId}`);
                // Optionally flag NFTModel with isCompromised: true if defined
                await NFTModel.updateOne(
                    { tokenAddress, tokenId },
                    { $set: { metadataVerified: false, metadataHashMismatch: true } }
                );
            } else {
                await NFTModel.updateOne(
                    { tokenAddress, tokenId },
                    { $set: { metadataVerified: true } }
                );
            }
        } catch (e: any) {
            console.error(`Failed to verify metadata for ${tokenId}:`, e.message || e);
        }
    }
}

export const chainListener = new ChainListener();