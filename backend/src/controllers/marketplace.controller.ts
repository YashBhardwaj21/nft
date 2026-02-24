import { Request, Response } from 'express';
import { ListingModel } from '../models/Listing.js';
import { NFTModel } from '../models/NFT.js';
import { RentalModel } from '../models/Rental.js';
import { UserModel } from '../models/User.js';
import crypto from 'crypto';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

// Load marketplace ABI for tx generation
const ABI_PATH = path.join(process.cwd(), '..', 'shared', 'DAOMarketplaceMarket.json');
let CANCEL_ABI: any[] = [];
let CANCEL_MARKETPLACE_ADDRESS = process.env.MARKETPLACE_ADDRESS || '';

if (fs.existsSync(ABI_PATH)) {
    try {
        const data = JSON.parse(fs.readFileSync(ABI_PATH, 'utf8'));
        CANCEL_ABI = data.abi || [];
        if (!CANCEL_MARKETPLACE_ADDRESS && data.address) CANCEL_MARKETPLACE_ADDRESS = data.address;
    } catch (e) {
        console.warn('marketplace.controller: Failed to load shared ABI:', e);
    }
}

// Pagination helper
function safePaginate(query: any) {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    return { page, limit, skip: (page - 1) * limit };
}

/**
 * Get all marketplace listings
 */
export const getAllListings = async (req: Request, res: Response) => {
    try {
        const { page, limit, skip } = safePaginate(req.query);
        const filter: any = { status: { $in: ['ACTIVE', 'PENDING_CREATE'] } };

        const total = await ListingModel.countDocuments(filter);
        const pipeline: any[] = [
            { $match: filter },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
                $lookup: {
                    from: 'nfts',
                    let: { addr: '$tokenAddress', tid: '$tokenId' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: [{ $toLower: '$tokenAddress' }, { $toLower: '$$addr' }] },
                                        { $eq: [{ $toString: '$tokenId' }, { $toString: '$$tid' }] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: 'nft'
                }
            },
            { $unwind: { path: '$nft', preserveNullAndEmptyArrays: true } },
            {
                $addFields: {
                    id: { $ifNull: ['$id', { $toString: '$_id' }] },
                    'nft.isListed': true,
                    'nft.isRented': {
                        $and: [
                            { $ne: ['$nft.expiresAt', null] },
                            { $gt: ['$nft.expiresAt', new Date()] }
                        ]
                    }
                }
            }
        ];

        const listings = await ListingModel.aggregate(pipeline);

        res.status(200).json({
            status: 'success',
            data: listings,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
        });
    } catch (error: any) {
        res.status(500).json({ status: 'error', error: error.message });
    }
};

/**
 * Create a Listing Draft (Chain-First)
 */
export const createListingDraft = async (req: Request, res: Response) => {
    try {
        const { nftId, tokenAddress, tokenId, price, duration } = req.body;
        const userId = ((req as any).user?.id || '').toLowerCase();

        if (!userId) return res.status(401).json({ error: 'Sign in required' });

        let nft: any = null;

        // Resolve via tokenAddress+tokenId if provided, otherwise lookup by nftId
        if (tokenAddress && tokenId) {
            nft = await NFTModel.findOne({
                tokenAddress: tokenAddress.toLowerCase(),
                tokenId: tokenId.toString()
            });
        } else if (nftId) {
            // First try compound id, then try as Mongo _id
            nft = await NFTModel.findOne({ id: nftId });
            if (!nft) {
                try {
                    nft = await NFTModel.findById(nftId);
                } catch (castErr) {
                    // nftId is not a valid ObjectId — that's fine, we already tried the compound id
                }
            }
        }

        if (!nft) {
            console.error(`[createListingDraft] NFT not found for nftId=${nftId}, tokenAddress=${tokenAddress}, tokenId=${tokenId}`);
            return res.status(404).json({ error: 'NFT not indexed yet. Please wait for sync.' });
        }
        if (nft.owner !== userId) {
            console.error(`[createListingDraft] Ownership mismatch: nft.owner=${nft.owner} userId=${userId}`);
            return res.status(403).json({ error: 'Not authorized. You do not own this NFT.' });
        }

        // 2. Prevent duplicate active listings
        const existingListing = await ListingModel.findOne({
            tokenAddress: nft.tokenAddress,
            tokenId: nft.tokenId,
            status: { $in: ['LOCAL_DRAFT', 'PENDING_CREATE', 'ACTIVE'] }
        });

        if (existingListing) {
            return res.status(400).json({ error: 'Listing already exists for this NFT' });
        }

        const draftId = `listing_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

        const newListing = await ListingModel.create({
            id: draftId,
            tokenAddress: nft.tokenAddress,
            tokenId: nft.tokenId,
            sellerAddress: userId, // OWNERSHIP SNAPSHOT
            pricePerDay: price.toString(),
            duration: Number(duration),
            status: 'LOCAL_DRAFT',
            metadataHash: nft.metadataHash
        });

        res.status(201).json({ status: 'success', data: newListing });
    } catch (error: any) {
        console.error('[createListingDraft] Error:', error.message, error.stack);
        res.status(500).json({ status: 'error', error: error.message });
    }
};

/**
 * Notify backend that listing transaction submitted
 */
export const notifyListingTx = async (req: Request, res: Response) => {
    try {
        const { draftId, txHash } = req.body;
        const userId = ((req as any).user?.id || '').toLowerCase();

        const listing = await ListingModel.findOne({ id: draftId });
        if (!listing) return res.status(404).json({ error: 'Draft not found' });
        if (listing.sellerAddress !== userId) return res.status(403).json({ error: 'Not authorized' });

        listing.status = 'ACTIVE';
        listing.txHash = txHash;
        await listing.save();

        res.status(200).json({ status: 'success', data: listing });
    } catch (error: any) {
        res.status(500).json({ status: 'error', error: error.message });
    }
};

/**
 * Cancel Transaction Notify
 */
export const notifyCancelTx = async (req: Request, res: Response) => {
    try {
        const { onChainListingId, txHash } = req.body;
        await ListingModel.updateOne(
            { onChainListingId: Number(onChainListingId) },
            { $set: { status: 'PENDING_CANCEL', txHash } }
        );
        res.status(200).json({ status: 'success', message: 'Cancellation pending' });
    } catch (error: any) {
        res.status(500).json({ status: 'error', error: error.message });
    }
};

// ... other handlers (getTrending, stats)
/**
 * Delete a local draft listing
 */
export const deleteDraftListing = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = ((req as any).user?.id || '').toLowerCase();
        const result = await ListingModel.deleteOne({ id, sellerAddress: userId, status: 'LOCAL_DRAFT' });
        if (result.deletedCount === 0) return res.status(404).json({ error: 'Draft not found or already submitted' });
        res.status(200).json({ status: 'success', message: 'Draft deleted' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Generate Tx for Cancellation
 */
export const generateCancelTx = async (req: Request, res: Response) => {
    try {
        const { onChainListingId } = req.body;

        if (!CANCEL_MARKETPLACE_ADDRESS || CANCEL_ABI.length === 0) {
            return res.status(503).json({ status: 'error', error: 'Marketplace contract not configured' });
        }

        const iface = new ethers.Interface(CANCEL_ABI);
        const data = iface.encodeFunctionData('cancelListing', [Number(onChainListingId)]);

        res.status(200).json({
            status: 'success',
            data: {
                to: CANCEL_MARKETPLACE_ADDRESS,
                data,
                value: '0'
            }
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Search/Filter Listings
 */
export const searchListings = async (req: Request, res: Response) => {
    try {
        const { page, limit, skip } = safePaginate(req.query);
        const { query, sort } = req.query;

        const filter: any = { status: { $in: ['ACTIVE', 'PENDING_CREATE'] } };

        // Parse sort option
        let sortStage: Record<string, 1 | -1> = { createdAt: -1 };
        if (sort === 'price_low') sortStage = { pricePerDay: 1 };
        else if (sort === 'price_high') sortStage = { pricePerDay: -1 };
        else if (sort === 'newest') sortStage = { createdAt: -1 };
        else if (sort === 'oldest') sortStage = { createdAt: 1 };

        // Build pipeline — lookup NFT first so we can filter by NFT name
        const pipeline: any[] = [
            { $match: filter },
            {
                $lookup: {
                    from: 'nfts',
                    let: { addr: '$tokenAddress', tid: '$tokenId' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: [{ $toLower: '$tokenAddress' }, { $toLower: '$$addr' }] },
                                        { $eq: [{ $toString: '$tokenId' }, { $toString: '$$tid' }] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: 'nft'
                }
            },
            { $unwind: { path: '$nft', preserveNullAndEmptyArrays: true } },
        ];

        // Text search on NFT name (if query provided)
        if (query && typeof query === 'string' && query.trim()) {
            const safeQuery = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            pipeline.push({
                $match: { 'nft.name': { $regex: safeQuery, $options: 'i' } }
            });
        }

        // Add computed fields
        pipeline.push({
            $addFields: {
                id: { $ifNull: ['$id', { $toString: '$_id' }] },
                'nft.isListed': true,
                'nft.isRented': {
                    $and: [
                        { $ne: ['$nft.expiresAt', null] },
                        { $gt: ['$nft.expiresAt', new Date()] }
                    ]
                }
            }
        });

        // Get total count before pagination (using $facet)
        const result = await ListingModel.aggregate([
            ...pipeline,
            {
                $facet: {
                    metadata: [{ $count: 'total' }],
                    data: [
                        { $sort: sortStage },
                        { $skip: skip },
                        { $limit: limit }
                    ]
                }
            }
        ]);

        const total = result[0]?.metadata[0]?.total || 0;
        const listings = result[0]?.data || [];

        res.status(200).json({
            status: 'success',
            data: listings,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
        });
    } catch (error: any) {
        res.status(500).json({ status: 'error', error: error.message });
    }
};

/**
 * Get Trending NFTs — returns listing-shaped objects with nested .nft sub-doc
 */
export const getTrendingNFTs = async (req: Request, res: Response) => {
    try {
        const pipeline: any[] = [
            { $match: { status: { $in: ['ACTIVE', 'PENDING_CREATE'] } } },
            {
                $lookup: {
                    from: 'nfts',
                    let: { addr: '$tokenAddress', tid: '$tokenId' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: [{ $toLower: '$tokenAddress' }, { $toLower: '$$addr' }] },
                                        { $eq: [{ $toString: '$tokenId' }, { $toString: '$$tid' }] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: 'nft'
                }
            },
            { $unwind: { path: '$nft', preserveNullAndEmptyArrays: true } },
            {
                $addFields: {
                    id: { $ifNull: ['$id', { $toString: '$_id' }] },
                    // Sort by NFT views (trending metric), falling back to listing views
                    _sortViews: { $ifNull: ['$nft.views', '$views'] },
                    'nft.isListed': true
                }
            },
            { $sort: { _sortViews: -1, createdAt: -1 } },
            { $limit: 10 },
            { $project: { _sortViews: 0 } }
        ];

        const trending = await ListingModel.aggregate(pipeline);
        res.status(200).json({ status: 'success', data: trending });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get Marketplace Stats — includes volumeTraded and activeUsers
 */
export const getMarketplaceStats = async (req: Request, res: Response) => {
    try {
        const [totalNFTs, totalListings, totalRentals] = await Promise.all([
            NFTModel.countDocuments(),
            ListingModel.countDocuments({ status: 'ACTIVE' }),
            RentalModel.countDocuments()
        ]);

        // Volume traded — sum of all rental totalPrice values (stored as wei strings)
        const volumeAgg = await RentalModel.aggregate([
            {
                $group: {
                    _id: null,
                    totalWei: {
                        $sum: { $toDouble: { $ifNull: ['$totalPrice', '0'] } }
                    }
                }
            }
        ]);
        const volumeTradedWei = volumeAgg[0]?.totalWei || 0;
        // Convert from wei to ETH (approximate — good enough for stats display)
        const volumeTraded = (volumeTradedWei / 1e18).toFixed(4);

        // Active users — distinct wallet addresses that have ever rented or listed
        const [distinctRenters, distinctOwners] = await Promise.all([
            RentalModel.distinct('renter'),
            ListingModel.distinct('sellerAddress')
        ]);
        const uniqueAddresses = new Set([...distinctRenters, ...distinctOwners]);
        const activeUsers = uniqueAddresses.size;

        res.status(200).json({
            status: 'success',
            data: { totalNFTs, totalListings, totalRentals, volumeTraded, activeUsers }
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};