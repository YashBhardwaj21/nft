import { Request, Response } from 'express';
import { RentalModel } from '../models/Rental.js';
import { NFTModel } from '../models/NFT.js';
import { ListingModel } from '../models/Listing.js';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

// ABI load
const ABI_PATH = path.join(process.cwd(), '..', 'shared', 'DAOMarketplaceMarket.json');
let MARKETPLACE_ABI = [];
let MARKETPLACE_ADDRESS = process.env.MARKETPLACE_ADDRESS || '';

if (fs.existsSync(ABI_PATH)) {
    const data = JSON.parse(fs.readFileSync(ABI_PATH, 'utf8'));
    MARKETPLACE_ABI = data.abi || [];
    if (!MARKETPLACE_ADDRESS && data.address) MARKETPLACE_ADDRESS = data.address;
}

/**
 * Generate tx payload to rent a listing.
 * Accepts one of:
 *  - onChainListingId
 *  - listingId (DB draft/record id)
 *  - nftId (app id) -> resolves to active listing for that NFT
 */
export const rentFromListing = async (req: Request, res: Response) => {
    try {
        const { onChainListingId, listingId, nftId, days } = req.body;
        const renterWallet = (req as any).user?.id; // should be wallet address
        if (!renterWallet) return res.status(401).json({ status: 'error', error: 'Not authenticated' });

        if (!days || Number(days) <= 0) {
            return res.status(400).json({ status: 'error', error: 'Invalid rental duration (days) provided' });
        }

        // Resolve listing (chain-first)
        let listing = null;
        if (onChainListingId !== undefined && onChainListingId !== null) {
            listing = await ListingModel.findOne({ onChainListingId: Number(onChainListingId) });
        }
        if (!listing && listingId) {
            listing = await ListingModel.findOne({ id: listingId });
        }
        if (!listing && nftId) {
            // nftId is legacy app id; find NFT to map to tokenAddress/tokenId
            const nft = await NFTModel.findOne({ id: nftId });
            if (nft) {
                listing = await ListingModel.findOne({ tokenAddress: nft.tokenAddress, tokenId: nft.tokenId, status: { $in: ['active', 'confirmed'] } });
            }
        }

        if (!listing) return res.status(404).json({ status: 'error', error: 'Listing not found' });

        // Ensure listing is active/confirmed on-chain
        if (!['active', 'confirmed'].includes(listing.status)) {
            return res.status(400).json({ status: 'error', error: `Listing is not active (status=${listing.status})` });
        }

        if (!MARKETPLACE_ADDRESS || MARKETPLACE_ABI.length === 0) {
            return res.status(503).json({ status: 'error', error: 'Marketplace contract not configured on server' });
        }

        // pricePerDay should be stored as wei string in DB; fallback to parse Ether if legacy
        let pricePerDayWei;
        try {
            // First treat it as an ETH decimal string (e.g., "0.0004")
            pricePerDayWei = ethers.parseEther(String(listing.pricePerDay || listing.price));
        } catch (e) {
            // If parseEther fails, it might already be a Wei integer string (e.g., "400000000000000")
            try {
                pricePerDayWei = BigInt(String(listing.pricePerDay || listing.price));
            } catch (err) {
                return res.status(500).json({ status: 'error', error: 'Listing missing or invalid price information' });
            }
        }

        const totalPriceWei = pricePerDayWei * BigInt(Number(days));

        // Encode contract call
        const iface = new ethers.Interface(MARKETPLACE_ABI);
        // Use onChainListingId when calling contract
        const listingOnChainId = Number(listing.onChainListingId);
        const data = iface.encodeFunctionData('rent', [listingOnChainId, Number(days)]);

        return res.status(200).json({
            status: 'success',
            data: {
                to: MARKETPLACE_ADDRESS,
                data,
                value: totalPriceWei.toString(), // hex/string wei accepted by frontend wallet
                chainId: Number(process.env.CHAIN_ID || 11155111)
            }
        });
    } catch (err: any) {
        console.error('Rent generation error:', err);
        return res.status(500).json({ status: 'error', error: err.message || String(err) });
    }
};

/**
 * Record the transaction submission as "pending".
 * Frontend should call this immediately after sending the tx (fast path).
 * The ChainListener will reconcile and finalize when the event is confirmed on-chain.
 *
 * Required header: Idempotency-Key
 */
export const notifyRentalTx = async (req: Request, res: Response) => {
    try {
        const idempotencyKey = req.headers['idempotency-key'];
        if (!idempotencyKey) {
            return res.status(400).json({ status: 'error', error: 'Idempotency-Key header is required' });
        }

        const { onChainListingId, listingId, nftId, txHash, value } = req.body;
        const renterWallet = (req as any).user?.id;
        if (!renterWallet) return res.status(401).json({ status: 'error', error: 'Not authenticated' });

        if (!txHash) return res.status(400).json({ status: 'error', error: 'txHash is required' });

        // Resolve listing (prefer onChainListingId)
        let listing = null;
        if (onChainListingId !== undefined && onChainListingId !== null) {
            listing = await ListingModel.findOne({ onChainListingId: Number(onChainListingId) });
        }
        if (!listing && listingId) {
            listing = await ListingModel.findOne({ id: listingId });
        }
        if (!listing && nftId) {
            const nft = await NFTModel.findOne({ id: nftId });
            if (nft) {
                listing = await ListingModel.findOne({ tokenAddress: nft.tokenAddress, tokenId: nft.tokenId, status: { $in: ['active', 'confirmed'] } });
            }
        }

        if (!listing) {
            // still create a pending record keyed by txHash — chainListener can match later
            const pending = await RentalModel.findOneAndUpdate(
                { txHash },
                {
                    $setOnInsert: {
                        onChainListingId: onChainListingId ?? null,
                        tokenAddress: listing?.tokenAddress ?? null,
                        tokenId: listing?.tokenId ?? null,
                        renterWallet: renterWallet.toLowerCase(),
                        ownerWallet: listing?.seller ?? null,
                        totalPrice: value ? String(value) : listing?.pricePerDay ?? listing?.price ?? '0',
                        status: 'pending',
                        txHash,
                        logIndex: -1,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }
                },
                { upsert: true, new: true }
            );

            return res.status(200).json({ status: 'success', data: pending, message: 'Pending rental recorded (listing not found locally). ChainListener will reconcile.' });
        }

        // If listing exists, create pending rental tied to the listing data
        const pendingRental = await RentalModel.findOneAndUpdate(
            { txHash },
            {
                $setOnInsert: {
                    onChainListingId: listing.onChainListingId,
                    tokenAddress: listing.tokenAddress,
                    tokenId: listing.tokenId,
                    renterWallet: renterWallet.toLowerCase(),
                    ownerWallet: listing.seller ?? listing.sellerId ?? null,
                    totalPrice: value ? String(value) : listing.pricePerDay ?? listing.price ?? '0',
                    status: 'pending',
                    txHash,
                    logIndex: -1,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            },
            { upsert: true, new: true }
        );

        // Mark NFT as pending/rental-intent in DB (UI helps reflect this)
        try {
            await NFTModel.updateOne(
                { tokenAddress: listing.tokenAddress, tokenId: listing.tokenId },
                { $set: { status: 'pending', isEscrowed: true } }
            );
        } catch (e) {
            console.warn('Failed to mark NFT pending locally:', e);
        }

        return res.status(200).json({ status: 'success', data: pendingRental, message: 'Pending rental recorded. Waiting for confirmations.' });
    } catch (err: any) {
        console.error('notifyRentalTx error:', err);
        return res.status(500).json({ status: 'error', error: err.message || String(err) });
    }
};