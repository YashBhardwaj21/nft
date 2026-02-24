// backend/src/services/chainListener.ts
import { ethers } from 'ethers';
import { EventModel } from '../models/Event.js';
import { SyncStateModel } from '../models/SyncState.js';
import fs from 'fs';
import path from 'path';

// Load ABIs
const NFT_ABI_PATH = path.join(process.cwd(), '..', 'shared', 'DAOMarketplaceNFT.json');
const MARKET_ABI_PATH = path.join(process.cwd(), '..', 'shared', 'DAOMarketplaceMarket.json');

interface QueuedEvent {
    eventName: string;
    blockNumber: number;
    logIndex: number;
    txHash: string;
    contractAddress: string;
    args: any;
}

// Delay helper for rate limiting (Tatum free plan: 3 req/s)
const rpcDelay = (ms = 500) => new Promise(r => setTimeout(r, ms));

export class ChainListener {
    private provider!: ethers.Provider;
    private nftContract: ethers.Contract | null = null;
    private marketContract: ethers.Contract | null = null;
    private isRunning = false;
    private lastProcessedBlock = 0;
    private lastRealtimeBlock = 0;
    private pollTimer: ReturnType<typeof setInterval> | null = null;

    constructor() { }

    private safeLoadAbi(filePath: string) {
        if (!fs.existsSync(filePath)) {
            console.warn(`âš ï¸  ABI file missing: ${filePath}`);
            return null;
        }
        try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            return data.abi || data;
        } catch (err) {
            console.error(`âŒ Failed to parse ABI ${filePath}:`, err);
            return null;
        }
    }

    public async start(provider: ethers.Provider) {
        if (this.isRunning) return;
        this.isRunning = true;
        this.provider = provider;

        const CONFIRMATIONS_N = parseInt(process.env.CONFIRMATIONS_N || '3', 10);
        const REORG_GUARD = parseInt(process.env.REORG_GUARD || '12', 10);
        const BATCH_SIZE = parseInt(process.env.BACKFILL_BATCH_SIZE || '10', 10);

        console.log(`[ChainListener] Config Loaded: CONFIRMATIONS_N=${CONFIRMATIONS_N}, REORG_GUARD=${REORG_GUARD}, BATCH_SIZE=${BATCH_SIZE}`);
        console.log(`ðŸš€ Starting Chain-First Listener (Confirmations required: ${CONFIRMATIONS_N})...`);

        try {
            const contractsReady = await this.initContracts();
            if (!contractsReady) {
                console.warn('âš ï¸  Chain Listener starting in DEGRADED mode (contracts not initialized)');
                (globalThis as any).ABIS_LOADED = false;
                return;
            }

            (globalThis as any).ABIS_LOADED = true;
            await this.loadState();
            await this.backfillEvents();
            await this.startRealtimePolling();
        } catch (error) {
            console.error('âŒ Chain Listener initialization failed:', error);
            this.isRunning = false;
            setTimeout(() => this.start(provider), 10000);
        }
    }

    private async initContracts(): Promise<boolean> {
        const nftAddress = process.env.CONTRACT_ADDRESS;
        const marketAddress = process.env.MARKETPLACE_ADDRESS;

        if (!nftAddress || !marketAddress) {
            console.warn('âš ï¸  CONTRACT_ADDRESS or MARKETPLACE_ADDRESS missing from .env');
            return false;
        }

        const nftAbi = this.safeLoadAbi(NFT_ABI_PATH);
        const marketAbi = this.safeLoadAbi(MARKET_ABI_PATH);

        if (!nftAbi || !marketAbi) {
            return false;
        }

        this.nftContract = new ethers.Contract(nftAddress, nftAbi, this.provider);
        this.marketContract = new ethers.Contract(marketAddress, marketAbi, this.provider);
        return true;
    }

    private async loadState() {
        try {
            const state = await SyncStateModel.findOne({ id: 'market_listener' });
            const REORG_GUARD = parseInt(process.env.REORG_GUARD || '12', 10);

            if (state) {
                this.lastProcessedBlock = Math.max(0, state.lastProcessedBlock - REORG_GUARD);
            } else {
                const currentBlock = await this.provider.getBlockNumber();
                this.lastProcessedBlock = Math.max(0, currentBlock - 100);
                await SyncStateModel.create({ id: 'market_listener', lastProcessedBlock: this.lastProcessedBlock });
            }
            console.log(`ðŸ“Œ Starting sync from block ${this.lastProcessedBlock}`);
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

    // â”€â”€ Backfill â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    private async backfillEvents() {
        console.log(`â³ Backfilling events from block ${this.lastProcessedBlock}...`);
        const latestBlock = await this.provider.getBlockNumber();
        const BATCH_SIZE = parseInt(process.env.BACKFILL_BATCH_SIZE || '10', 10);
        const MAX_RETRIES = parseInt(process.env.BACKFILL_MAX_RETRIES || '3', 10);

        for (let from = this.lastProcessedBlock; from <= latestBlock; from += BATCH_SIZE) {
            const to = Math.min(from + BATCH_SIZE - 1, latestBlock);
            let retries = 0;
            let success = false;

            while (retries <= MAX_RETRIES) {
                try {
                    await this.processBatch(from, to);
                    // Only advance lastProcessedBlock after FULL batch success
                    await this.saveState(to);
                    success = true;
                    break;
                } catch (err: any) {
                    retries++;
                    const delay = Math.min(1000 * Math.pow(2, retries), 30000);
                    console.warn(`[Backfill] Batch ${from}-${to} failed (attempt ${retries}/${MAX_RETRIES}): ${err.message}. Retrying in ${delay}ms...`);
                    if (retries > MAX_RETRIES) break;
                    await new Promise(r => setTimeout(r, delay));
                }
            }

            if (!success) {
                // Do NOT advance state â€” we'll retry from here on next restart
                console.error(`[Backfill] â›” Permanently failed batch ${from}-${to} after ${MAX_RETRIES} retries. Stopping backfill. Last safe block: ${this.lastProcessedBlock}`);
                return;
            }

            if (from % 10000 === 0) console.log(`[Backfill] Progress: block ${from}/${latestBlock}`);
        }

        console.log('âœ… Backfill complete');
    }

    /**
     * Process all four event types in a single block range.
     * Throws on any failure â€” caller handles retry logic.
     */
    private async processBatch(from: number, to: number) {
        if (!this.nftContract || !this.marketContract) return;

        // Mint events
        const mintFilter = this.nftContract.filters.NFTMinted?.();
        if (mintFilter) {
            const mintLogs = await this.nftContract.queryFilter(mintFilter, from, to);
            for (const log of (mintLogs as any[])) {
                if (!log.transactionHash) continue;
                await this.enqueueEvent({
                    eventName: 'NFTMinted',
                    blockNumber: log.blockNumber,
                    logIndex: log.index,
                    txHash: log.transactionHash,
                    contractAddress: String(this.nftContract.target),
                    args: {
                        tokenId: log.args.tokenId.toString(),
                        creator: log.args.creator,
                        tokenURI: log.args.tokenURI,
                        metadataHash: log.args.metadataHash
                    },
                });
            }
        }

        await rpcDelay(); // Rate limit: wait before next RPC call

        // ListingCreated events
        const listFilter = this.marketContract.filters.ListingCreated?.();
        if (listFilter) {
            const listLogs = await this.marketContract.queryFilter(listFilter, from, to);
            for (const log of (listLogs as any[])) {
                if (!log.transactionHash) continue;
                await this.enqueueEvent({
                    eventName: 'ListingCreated',
                    blockNumber: log.blockNumber,
                    logIndex: log.index,
                    txHash: log.transactionHash,
                    contractAddress: String(this.marketContract.target),
                    args: {
                        onChainListingId: log.args.onChainListingId.toString(),
                        seller: log.args.seller,
                        tokenAddress: log.args.tokenAddress,
                        tokenId: log.args.tokenId.toString(),
                        pricePerDay: log.args.pricePerDay.toString(),
                        minDuration: log.args.minDuration.toString(),
                        maxDuration: log.args.maxDuration.toString(),
                        metadataHash: log.args.metadataHash
                    },
                });
            }
        }

        await rpcDelay(); // Rate limit: wait before next RPC call

        // Rented events
        const rentFilter = this.marketContract.filters.Rented?.();
        if (rentFilter) {
            const rentLogs = await this.marketContract.queryFilter(rentFilter, from, to);
            for (const log of (rentLogs as any[])) {
                if (!log.transactionHash) continue;
                await this.enqueueEvent({
                    eventName: 'Rented',
                    blockNumber: log.blockNumber,
                    logIndex: log.index,
                    txHash: log.transactionHash,
                    contractAddress: String(this.marketContract.target),
                    args: {
                        onChainListingId: log.args.onChainListingId.toString(),
                        renter: log.args.renter,
                        tokenAddress: log.args.tokenAddress,
                        tokenId: log.args.tokenId.toString(),
                        expires: log.args.expires.toString(),
                        totalPrice: log.args.totalPrice.toString()
                    },
                });
            }
        }

        await rpcDelay(); // Rate limit: wait before next RPC call

        // ListingCancelled events
        const cancelFilter = this.marketContract.filters.ListingCancelled?.();
        if (cancelFilter) {
            const cancelLogs = await this.marketContract.queryFilter(cancelFilter, from, to);
            for (const log of (cancelLogs as any[])) {
                if (!log.transactionHash) continue;
                await this.enqueueEvent({
                    eventName: 'ListingCancelled',
                    blockNumber: log.blockNumber,
                    logIndex: log.index,
                    txHash: log.transactionHash,
                    contractAddress: String(this.marketContract.target),
                    args: {
                        onChainListingId: log.args.onChainListingId.toString(),
                        tokenAddress: log.args.tokenAddress,
                        tokenId: log.args.tokenId.toString()
                    },
                });
            }
        }
    }

    // â”€â”€ Real-time subscriptions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    // Manual timer-based polling to avoid overwhelming free-tier RPCs.
    // Uses setInterval instead of provider.on('block') to control request rate.
    private async startRealtimePolling() {
        if (!this.nftContract || !this.marketContract) return;

        // Default 30s for free-tier RPC (3 req/s limit with 4 event queries + getBlockNumber per tick)
        const pollMs = parseInt(process.env.REALTIME_POLL_INTERVAL_MS || '30000', 10);
        const MAX_RETRIES = parseInt(process.env.BACKFILL_MAX_RETRIES || '3', 10);

        this.lastRealtimeBlock = this.lastProcessedBlock;

        const pollOnce = async () => {
            if (!this.isRunning) return;

            try {
                const currentBlock = await this.provider.getBlockNumber();
                if (currentBlock <= this.lastRealtimeBlock) return;

                const from = this.lastRealtimeBlock + 1;
                const to = currentBlock;
                let retries = 0;

                while (retries <= MAX_RETRIES) {
                    try {
                        await rpcDelay(); // small pause before batch
                        await this.processBatch(from, to);
                        await this.saveState(to);
                        this.lastRealtimeBlock = to;
                        return;
                    } catch (err: any) {
                        retries++;
                        const delay = Math.min(2000 * Math.pow(2, retries), 60000);
                        console.warn(`[Realtime] Blocks ${from}-${to} failed (attempt ${retries}/${MAX_RETRIES}): ${err.message}. Retrying in ${delay}ms...`);
                        if (retries > MAX_RETRIES) break;
                        await new Promise(r => setTimeout(r, delay));
                    }
                }

                console.error(`[Realtime] Failed blocks ${from}-${to}. Will retry on next tick.`);
            } catch (err: any) {
                console.warn(`[Realtime] getBlockNumber failed: ${err.message}. Will retry on next tick.`);
            }
        };

        this.pollTimer = setInterval(pollOnce, pollMs);
        console.log(`Realtime listener started (timer-based polling, interval=${pollMs}ms)`);
    }

    private async enqueueEvent(ev: QueuedEvent) {
        if (typeof ev.logIndex !== 'number' || isNaN(ev.logIndex)) {
            console.warn(`[ChainListener] âš ï¸ Event ${ev.txHash} has invalid logIndex=${ev.logIndex}. Skipping.`);
            return;
        }
        try {
            await EventModel.updateOne(
                { txHash: ev.txHash, logIndex: ev.logIndex },
                {
                    $setOnInsert: {
                        blockNumber: ev.blockNumber,
                        contractAddress: ev.contractAddress.toLowerCase(),
                        eventName: ev.eventName,
                        args: ev.args,
                        status: 'pending',
                        retries: 0
                    }
                },
                { upsert: true }
            );
        } catch (err: any) {
            // E11000 = duplicate key â€” benign, event already in ledger
            if (err?.code !== 11000) {
                console.error('[ChainListener] Error enqueueing event:', err);
            }
        }
    }
}

export const chainListener = new ChainListener();

