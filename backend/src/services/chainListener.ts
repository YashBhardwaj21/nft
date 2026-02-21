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
import { getDynamicProvider } from '../utils/provider.js';

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

        this.provider = getDynamicProvider();

        console.log(`🚀 Starting Chain-First Listener (Confirmations required: ${CONFIRMATIONS_N})...`);

        try {
            await this.initContracts();
            await this.loadState();
            await this.backfillEvents();
            this.subscribeToEvents();
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
                                tokenId: (log as any).args[0].toString(),
                                creator: (log as any).args[1],
                                tokenURI: (log as any).args[2],
                                metadataHash: (log as any).args[3]
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
                                onChainListingId: (log as any).args[0].toString(),
                                renter: (log as any).args[1],
                                tokenAddress: (log as any).args[2],
                                tokenId: (log as any).args[3].toString(),
                                expires: (log as any).args[4].toString(),
                                totalPrice: (log as any).args[5].toString()
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
                                onChainListingId: (log as any).args[0].toString(),
                                tokenAddress: (log as any).args[1],
                                tokenId: (log as any).args[2].toString()
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
}

export const chainListener = new ChainListener();