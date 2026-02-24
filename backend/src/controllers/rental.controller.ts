import { Request, Response } from 'express';
import { RentalModel } from '../models/Rental.js';
import { NFTModel } from '../models/NFT.js';
import { ListingModel } from '../models/Listing.js';
import { IdempotencyModel } from '../models/Idempotency.js';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

// ABI load
const ABI_PATH = path.join(process.cwd(), '..', 'shared', 'DAOMarketplaceMarket.json');
let MARKETPLACE_ABI = [];
let MARKETPLACE_ADDRESS = process.env.MARKETPLACE_ADDRESS || '';

if (fs.existsSync(ABI_PATH)) {
    try {
        const data = JSON.parse(fs.readFileSync(ABI_PATH, 'utf8'));
        MARKETPLACE_ABI = data.abi || [];
        if (!MARKETPLACE_ADDRESS && data.address) MARKETPLACE_ADDRESS = data.address;
    } catch (e) {
        console.warn('Failed to load shared ABI:', e);
    }
}

/**
 * Generate tx payload to rent a listing.
 */
export const rentFromListing = async (req: Request, res: Response) => {
    try {
        const { onChainListingId, listingId, nftId, days } = req.body;
        const renterWallet = (req as any).user?.id;
        if (!renterWallet) return res.status(401).json({ status: 'error', error: 'Not authenticated' });

        if (!days || Number(days) <= 0) {
            return res.status(400).json({ status: 'error', error: 'Invalid rental duration (days)' });
        }

        // Resolve listing (chain-first identity)
        let listing = null;
        if (onChainListingId !== undefined && onChainListingId !== null) {
            listing = await ListingModel.findOne({ onChainListingId: Number(onChainListingId) });
        } else if (listingId) {
            listing = await ListingModel.findOne({ id: listingId });
        } else if (nftId) {
            // Resolve via NFT → find its active listing
            const nft = await NFTModel.findOne({
                $or: [{ id: nftId }, { _id: nftId }]
            });
            if (nft && nft.tokenAddress && nft.tokenId) {
                listing = await ListingModel.findOne({
                    tokenAddress: nft.tokenAddress!.toLowerCase(),
                    tokenId: nft.tokenId!.toString(),
                    status: { $in: ['ACTIVE', 'PENDING_CREATE'] }
                });
            }
        }

        if (!listing) return res.status(404).json({ status: 'error', error: 'Listing not found' });
        if (!['ACTIVE', 'PENDING_CREATE'].includes(listing.status)) {
            return res.status(400).json({ status: 'error', error: `Listing is not active (${listing.status})` });
        }

        if (!MARKETPLACE_ADDRESS || MARKETPLACE_ABI.length === 0) {
            return res.status(503).json({ status: 'error', error: 'Contract not configured' });
        }

        let pricePerDayWei;
        try {
            pricePerDayWei = ethers.parseEther(String(listing.pricePerDay));
        } catch (e) {
            pricePerDayWei = BigInt(String(listing.pricePerDay));
        }

        const totalPriceWei = pricePerDayWei * BigInt(Number(days));
        const iface = new ethers.Interface(MARKETPLACE_ABI);
        const data = iface.encodeFunctionData('rent', [Number(listing.onChainListingId), Number(days)]);

        return res.status(200).json({
            status: 'success',
            data: {
                to: MARKETPLACE_ADDRESS,
                data,
                value: totalPriceWei.toString(),
                chainId: Number(process.env.CHAIN_ID || 11155111)
            }
        });
    } catch (err: any) {
        return res.status(500).json({ status: 'error', error: err.message });
    }
};

/**
 * Notify backend that rental transaction submitted
 */
export const notifyRentalTx = async (req: Request, res: Response) => {
    try {
        const idempotencyKey = req.headers['idempotency-key'] as string;
        if (!idempotencyKey) return res.status(400).json({ error: 'Idempotency-Key required' });

        const { onChainListingId, nftId, txHash, value } = req.body;
        const renterWallet = (req as any).user?.id?.toLowerCase();
        if (!renterWallet) return res.status(401).json({ error: 'Not authenticated' });

        // Idempotency
        try {
            await IdempotencyModel.create({ key: idempotencyKey, endpoint: 'rentals/notify', userId: renterWallet, txHash });
        } catch (dupErr: any) {
            if (dupErr.code === 11000) return res.status(200).json({ status: 'success', message: 'Already recorded' });
            throw dupErr;
        }

        // Resolve listing by onChainListingId or by nftId
        let listing = null;
        if (onChainListingId !== undefined && onChainListingId !== null) {
            listing = await ListingModel.findOne({ onChainListingId: Number(onChainListingId) });
        } else if (nftId) {
            const nft = await NFTModel.findOne({
                $or: [{ id: nftId }, { _id: nftId }]
            });
            if (nft && nft.tokenAddress && nft.tokenId) {
                listing = await ListingModel.findOne({
                    tokenAddress: nft.tokenAddress!.toLowerCase(),
                    tokenId: nft.tokenId!.toString(),
                    status: { $in: ['ACTIVE', 'PENDING_CREATE'] }
                });
            }
        }

        const rental = await RentalModel.findOneAndUpdate(
            { txHash },
            {
                $setOnInsert: {
                    onChainListingId: Number(onChainListingId),
                    listingId: listing?._id?.toString() || null,
                    tokenAddress: listing?.tokenAddress?.toLowerCase() || null,
                    tokenId: listing?.tokenId?.toString() || null,
                    renter: renterWallet,
                    owner: listing?.sellerAddress?.toLowerCase() || null,
                    totalPrice: value ? String(value) : (listing?.pricePerDay || '0'),
                    status: 'PENDING',
                    txHash,
                    createdAt: new Date()
                }
            },
            { upsert: true, new: true }
        );

        res.status(200).json({ status: 'success', data: rental });
    } catch (error: any) {
        res.status(500).json({ status: 'error', error: error.message });
    }
};