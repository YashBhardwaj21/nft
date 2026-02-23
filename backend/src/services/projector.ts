// backend/src/services/projector.ts
import mongoose from 'mongoose';
import { EventModel } from '../models/Event.js';
import { ListingModel } from '../models/Listing.js';
import { NFTModel } from '../models/NFT.js';
import { RentalModel } from '../models/Rental.js';
import { DraftModel } from '../models/Draft.js';
import { ethers } from 'ethers';

/**
 * Projector Service (Chain-First / Ledger-Only)
 * ─────────────────────────────────────────────────────────────────────────────
 * Sequential event worker that derives DB state ONLY from the Projector (Event ledger).
 * It enforces blockchain truth by identifying NFTs strictly by {tokenAddress, tokenId}.
 */

export class Projector {
    private isRunning: boolean = false;
    private provider: ethers.Provider | null = null;

    constructor() { }

    public async start(provider: ethers.Provider) {
        if (this.isRunning) return;
        this.isRunning = true;
        this.provider = provider;
        console.log(`[Projector] Started in Chain-First mode.`);
        this.processLoop();
    }

    public stop() {
        this.isRunning = false;
    }

    private async processLoop() {
        while (this.isRunning) {
            try {
                await this.processNextPending();
            } catch (err) {
                console.error("[Projector] Loop error:", err);
                await new Promise(r => setTimeout(r, 5000));
            }
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    private async processNextPending() {
        try {
            const event = await EventModel.findOne({ status: 'pending' })
                .sort({ blockNumber: 1, logIndex: 1 });

            if (!event) {
                // No pending events — sleep longer to avoid tight-looping
                await new Promise(r => setTimeout(r, 4000));
                return;
            }

            try {
                await this.applyEvent(event);

                event.status = 'processed';
                event.updatedAt = new Date();
                await event.save();
            } catch (err: any) {
                // Mark event as failed so it doesn't block the queue forever
                event.retries = (event.retries || 0) + 1;
                if (event.retries >= 5) {
                    event.status = 'failed';
                    console.error(`[Projector] Event permanently failed after ${event.retries} retries: ${err.message}`);
                }
                event.updatedAt = new Date();
                await event.save();
            }
        } catch (err: any) {
            console.error(`[Projector] Unexpected error: ${err.message}`);
        }
    }

    private async applyEvent(event: any) {
        const { eventName, args, txHash, blockNumber, contractAddress } = event;

        switch (eventName) {
            case 'NFTMinted':
                await this.handleNFTMinted(args, txHash, blockNumber, contractAddress);
                break;
            case 'ListingCreated':
                await this.handleListingCreated(args, txHash, blockNumber, contractAddress);
                break;
            case 'Rented':
                await this.handleRented(args, txHash, blockNumber);
                break;
            case 'ListingCancelled':
                await this.handleListingCancelled(args);
                break;
            default:
                console.log(`[Projector] Skipping unhandled event: ${eventName}`);
        }
    }

    /**
     * SELF-HEALING IDEMPOTENT UPDATE
     * Ensures we don't crash on duplicate index pollution from legacy runs.
     */
    private async safeUpdateNFT(filter: any, update: any) {
        try {
            await NFTModel.findOneAndUpdate(filter, update, { upsert: true });
        } catch (err: any) {
            if (err.code === 11000) {
                const fallbackFilter = {
                    tokenAddress: (update.$set.tokenAddress || filter.tokenAddress).toLowerCase(),
                    tokenId: update.$set.tokenId || filter.tokenId
                };
                await NFTModel.updateOne(fallbackFilter, update);
            } else throw err;
        }
    }

    private async handleNFTMinted(args: any, txHash: string, blockNumber: number, contractAddress: string) {
        const { tokenId, creator, metadataHash } = args;
        if (!creator || !contractAddress) return;

        const resolvedTokenAddress = contractAddress.toLowerCase();
        const resolvedTokenId = tokenId.toString();
        const resolvedCreator = creator.toLowerCase();

        // 1. Authoritative Identity Entry
        await this.safeUpdateNFT(
            { tokenAddress: resolvedTokenAddress, tokenId: resolvedTokenId },
            {
                $set: {
                    tokenAddress: resolvedTokenAddress,
                    tokenId: resolvedTokenId,
                    creator: resolvedCreator,
                    owner: resolvedCreator, // Initial owner is creator
                    metadataHash,
                    mintTxHash: txHash,
                    blockNumber,
                    updatedAt: new Date()
                }
            }
        );

        // 2. Draft Enrichment (Hint Only)
        await DraftModel.updateOne(
            { metadataHash, creator: resolvedCreator },
            { $set: { status: 'MINTED' } }
        );
    }

    private async handleListingCreated(args: any, txHash: string, blockNumber: number, contractAddress: string) {
        const { onChainListingId, seller, tokenAddress, tokenId, pricePerDay, minDuration, maxDuration, metadataHash } = args;
        if (!tokenAddress || !seller || !tokenId) return;

        const resolvedTokenAddress = tokenAddress.toLowerCase();
        const resolvedTokenId = tokenId.toString();
        const resolvedSeller = seller.toLowerCase();

        // OWNERSHIP SNAPSHOT: Ensure the seller actually owns the NFT at this block
        const nft = await NFTModel.findOne({
            tokenAddress: resolvedTokenAddress,
            tokenId: resolvedTokenId
        });

        if (!nft || (nft.owner !== resolvedSeller)) {
            console.warn(`[Projector] Listing ${onChainListingId} rejected: Seller ${resolvedSeller} does not own NFT ${resolvedTokenId}`);
            return;
        }

        // FACT: Listing exists and is ACTIVE, tied to a specific sellerAddress snapshot
        await ListingModel.findOneAndUpdate(
            { onChainListingId: Number(onChainListingId) },
            {
                $set: {
                    sellerAddress: resolvedSeller,
                    tokenAddress: resolvedTokenAddress,
                    tokenId: resolvedTokenId,
                    pricePerDay: pricePerDay?.toString(),
                    minDuration: Number(minDuration),
                    maxDuration: Number(maxDuration),
                    metadataHash,
                    status: 'ACTIVE',
                    txHash,
                    blockNumber,
                    confirmedAt: new Date()
                }
            },
            { upsert: true }
        );
    }

    private async handleRented(args: any, txHash: string, blockNumber: number) {
        const { onChainListingId, renter, expires, totalPrice } = args;

        const listing = await ListingModel.findOneAndUpdate(
            { onChainListingId: Number(onChainListingId) },
            { $set: { status: 'RENTED' } },
            { new: true }
        );

        if (!listing) return;

        await RentalModel.findOneAndUpdate(
            { txHash },
            {
                $set: {
                    onChainListingId: Number(onChainListingId),
                    listingId: listing._id.toString(),
                    tokenAddress: listing.tokenAddress.toLowerCase(),
                    tokenId: listing.tokenId.toString(),
                    renter: (renter || '').toLowerCase(),
                    owner: (listing.sellerAddress || '').toLowerCase(),
                    totalPrice: totalPrice?.toString(),
                    expiresAt: new Date(Number(expires) * 1000),
                    status: 'ACTIVE',
                    startBlock: blockNumber,
                    updatedAt: new Date()
                }
            },
            { upsert: true }
        );

        await NFTModel.updateOne(
            { tokenAddress: listing.tokenAddress.toLowerCase(), tokenId: listing.tokenId.toString() },
            {
                $set: {
                    renter: (renter || '').toLowerCase(),
                    expiresAt: new Date(Number(expires) * 1000),
                    updatedAt: new Date()
                }
            }
        );
    }

    private async handleListingCancelled(args: any) {
        const { onChainListingId } = args;
        await ListingModel.updateOne(
            { onChainListingId: Number(onChainListingId) },
            { $set: { status: 'CANCELLED' } }
        );
    }
}

export function createProjector() {
    return new Projector();
}
