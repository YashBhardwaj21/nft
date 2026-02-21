// backend/src/controllers/marketplace.controller.ts
import { Request, Response } from 'express';
import { ListingModel } from '../models/Listing.js';
import { NFTModel } from '../models/NFT.js';
import crypto from 'crypto';
import { ApiResponse } from '../types/index.js';

/**
 * Get all marketplace listings (confirmed by default)
 * Enrich each listing with NFT data using tokenAddress + tokenId lookup.
 */
export const getAllListings = async (req: Request, res: Response) => {
    try {
        const { page = 1, limit = 20, status = 'confirmed' } = req.query as any;

        const filter: any = {};
        if (status) filter.status = status;

        const total = await ListingModel.countDocuments(filter);

        const listings = await ListingModel.find(filter)
            .sort({ createdAt: -1 })
            .skip((Number(page) - 1) * Number(limit))
            .limit(Number(limit));

        // Enrich with NFT data (lookup by tokenAddress + tokenId; fall back to legacy nftId if present)
        const enrichedListings = await Promise.all(listings.map(async (listing) => {
            let nft = null;
            if (listing.tokenAddress && listing.tokenId) {
                nft = await NFTModel.findOne({
                    tokenAddress: listing.tokenAddress.toLowerCase(),
                    tokenId: listing.tokenId.toString()
                });
            }
            // legacy fallback: some listings might still have nftId
            if (!nft && listing.nftId) {
                nft = await NFTModel.findOne({ id: listing.nftId });
            }

            return {
                ...listing.toObject(),
                nft
            };
        }));

        const response: ApiResponse = {
            status: 'success',
            data: enrichedListings,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: total,
                totalPages: Math.ceil(total / Number(limit))
            }
        };

        res.status(200).json(response);
    } catch (error: any) {
        console.error("getAllListings error:", error);
        res.status(500).json({ status: 'error', error: error.message });
    }
};

/**
 * Search marketplace listings using tokenAddress+tokenId -> nft lookup
 * Supports query, minPrice, maxPrice and sort.
 */
export const searchListings = async (req: Request, res: Response) => {
    try {
        const { query, category, minPrice, maxPrice, sortBy = 'trending' } = req.query as any;

        // Start with confirmed listings by default
        const pipeline: any[] = [
            { $match: { status: 'confirmed' } },
            // Convert price string to number for numeric comparisons and scoring
            {
                $addFields: {
                    priceNum: { $toDouble: { $ifNull: ['$price', '0'] } }
                }
            },
            // Lookup NFT by tokenAddress + tokenId
            {
                $lookup: {
                    from: 'nfts',
                    let: { tokenAddress: '$tokenAddress', tokenId: '$tokenId' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: [{ $toLower: '$tokenAddress' }, { $toLower: '$$tokenAddress' }] },
                                        { $eq: ['$tokenId', '$$tokenId'] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: 'nft'
                }
            },
            { $unwind: { path: '$nft', preserveNullAndEmptyArrays: false } }
        ];

        // Text search across nft.name / nft.collectionName if provided
        if (query) {
            const regex = new RegExp(String(query), 'i');
            pipeline.push({
                $match: {
                    $or: [
                        { 'nft.name': regex },
                        { 'nft.collectionName': regex },
                        { 'nft.description': regex }
                    ]
                }
            });
        }

        // Price range filtering (uses numeric priceNum)
        if (minPrice !== undefined || maxPrice !== undefined) {
            const priceMatch: any = {};
            if (minPrice !== undefined) priceMatch.$gte = Number(minPrice);
            if (maxPrice !== undefined) priceMatch.$lte = Number(maxPrice);
            pipeline.push({ $match: { priceNum: priceMatch } });
        }

        // Sorting
        let sortStage: any = {};
        if (sortBy === 'price_asc') sortStage.priceNum = 1;
        else if (sortBy === 'price_desc') sortStage.priceNum = -1;
        else if (sortBy === 'trending') sortStage.views = -1;
        else sortStage.createdAt = -1;

        pipeline.push({ $sort: sortStage });

        const results = await ListingModel.aggregate(pipeline).allowDiskUse(true);

        res.status(200).json({
            status: 'success',
            data: results,
            message: `Found ${results.length} listings`
        });
    } catch (error: any) {
        console.error("searchListings error:", error);
        res.status(500).json({ status: 'error', error: error.message });
    }
};

/**
 * Get trending NFTs (uses tokenAddress+tokenId join)
 */
export const getTrendingNFTs = async (req: Request, res: Response) => {
    try {
        const { limit = 10 } = req.query as any;

        const pipeline = [
            { $match: { status: 'confirmed' } },
            {
                $addFields: {
                    score: { $add: [{ $ifNull: ['$views', 0] }, { $multiply: [{ $ifNull: ['$likes', 0] }, 2] }] },
                    priceNum: { $toDouble: { $ifNull: ['$price', '0'] } }
                }
            },
            { $sort: { score: -1 } },
            { $limit: Number(limit) },
            {
                $lookup: {
                    from: 'nfts',
                    let: { tokenAddress: '$tokenAddress', tokenId: '$tokenId' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: [{ $toLower: '$tokenAddress' }, { $toLower: '$$tokenAddress' }] },
                                        { $eq: ['$tokenId', '$$tokenId'] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: 'nft'
                }
            },
            { $unwind: { path: '$nft', preserveNullAndEmptyArrays: false } }
        ];

        const trending = await ListingModel.aggregate(pipeline).allowDiskUse(true);

        res.status(200).json({ status: 'success', data: trending });
    } catch (error: any) {
        console.error("getTrendingNFTs error:", error);
        res.status(500).json({ status: 'error', error: error.message });
    }
};

export const getMarketplaceStats = async (req: Request, res: Response) => {
    try {
        const stats = await ListingModel.aggregate([
            {
                $group: {
                    _id: null,
                    totalListings: { $sum: 1 },
                    activeListings: {
                        $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] }
                    },
                    totalViews: { $sum: { $ifNull: ['$views', 0] } },
                    totalLikes: { $sum: { $ifNull: ['$likes', 0] } }
                }
            }
        ]);

        const result = stats[0] || { totalListings: 0, activeListings: 0, totalViews: 0, totalLikes: 0 };

        res.status(200).json({ status: 'success', data: { ...result, currency: 'ETH' } });
    } catch (error: any) {
        console.error("getMarketplaceStats error:", error);
        res.status(500).json({ status: 'error', error: error.message });
    }
};

/**
 * Create a Listing Draft
 * Accepts either:
 *  - nftId (legacy) OR
 *  - tokenAddress + tokenId
 *
 * Stores canonical tokenAddress + tokenId on the Listing doc.
 * Creates a metadata JSON and pins as a file buffer (uploadFileBuffer).
 */
export const createListingDraft = async (req: Request, res: Response) => {
    try {
        const { nftId, tokenAddress: tokenAddressIn, tokenId: tokenIdIn, price, duration } = req.body;
        const userId = (req as any).user.id;

        if ((!nftId && (!tokenAddressIn || tokenIdIn === undefined)) || price === undefined || duration === undefined) {
            return res.status(400).json({ status: 'error', error: 'Missing required fields. Provide nftId or tokenAddress+tokenId, price and duration.' });
        }

        // Resolve NFT by either nftId or tokenAddress+tokenId
        let nft = null;
        if (nftId) {
            nft = await NFTModel.findOne({ id: nftId });
        }
        if (!nft && tokenAddressIn && tokenIdIn !== undefined) {
            nft = await NFTModel.findOne({ tokenAddress: tokenAddressIn.toLowerCase(), tokenId: tokenIdIn.toString() });
        }
        if (!nft) {
            return res.status(404).json({ status: 'error', error: 'NFT not found' });
        }

        if (nft.owner.toLowerCase() !== userId.toLowerCase()) {
            return res.status(403).json({ status: 'error', error: 'Not authorized. You do not own this NFT.' });
        }

        if (nft.status === 'rented' || nft.isEscrowed) {
            return res.status(400).json({ status: 'error', error: 'NFT is currently rented or in escrow.' });
        }

        // Create metadata for listing
        const metadata = {
            nftId: nft.id || null,
            tokenAddress: nft.tokenAddress,
            tokenId: nft.tokenId,
            sellerId: userId.toLowerCase(),
            price: price.toString(),
            duration: Number(duration),
            timestamp: Date.now()
        };
        const metadataString = JSON.stringify(metadata);

        // deterministic sha256
        const metadataHash = crypto.createHash('sha256').update(metadataString).digest('hex');

        // Upload as file buffer to IPFS (Pinata service)
        const { uploadFileBuffer } = await import('../services/ipfs.service.js');
        const metadataUrl = await uploadFileBuffer(Buffer.from(metadataString, 'utf-8'), `listing-${nft.id || `${nft.tokenAddress}-${nft.tokenId}`}-${Date.now()}.json`, 'application/json');

        const draftId = `draft_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

        const newListing = await ListingModel.create({
            id: draftId,
            // canonical fields for protocol
            tokenAddress: nft.tokenAddress,
            tokenId: nft.tokenId,
            seller: userId.toLowerCase(),
            pricePerDay: price.toString(),
            // legacy field retained for compatibility
            nftId: nft.id || null,
            sellerId: userId.toLowerCase(),
            price: price.toString(),
            rentalPrice: price.toString(),
            currency: 'ETH',
            duration: Number(duration),
            minDuration: 1,
            maxDuration: Number(duration),
            metadataHash: `0x${metadataHash}`,
            tokenURI: metadataUrl,
            type: 'rent',
            status: 'draft',
            createdAt: new Date()
        });

        res.status(201).json({
            status: 'success',
            data: { draftId: newListing.id, metadataHash: newListing.metadataHash, tokenURI: newListing.tokenURI },
            message: 'Listing draft created successfully'
        });
    } catch (error: any) {
        console.error("createListingDraft error:", error);
        res.status(500).json({ status: 'error', error: error.message });
    }
};

/**
 * Notify backend that the listing transaction has been submitted (frontend should call immediately after sending tx)
 * This marks the draft as pending and records txHash. ChainListener will confirm and set onChainListingId.
 */
export const notifyListingTx = async (req: Request, res: Response) => {
    try {
        const idempotencyKey = req.headers['idempotency-key'] as string | undefined;
        if (!idempotencyKey) {
            return res.status(400).json({ status: 'error', error: 'Idempotency-Key header is required' });
        }

        const { draftId, txHash } = req.body;
        const userId = (req as any).user.id;

        if (!draftId || !txHash) {
            return res.status(400).json({ status: 'error', error: 'draftId and txHash are required' });
        }

        const listing = await ListingModel.findOne({ id: draftId });
        if (!listing) {
            // Idempotent behavior: if we already have a listing with this txHash, return it
            const existingListingByTx = await ListingModel.findOne({ txHash });
            if (existingListingByTx) {
                return res.status(200).json({ status: 'success', data: existingListingByTx, message: 'Transaction already recorded.' });
            }
            return res.status(404).json({ status: 'error', error: 'Draft not found' });
        }

        if (listing.sellerId.toLowerCase() !== userId.toLowerCase()) {
            return res.status(403).json({ status: 'error', error: 'Not authorized.' });
        }

        if (listing.status !== 'draft') {
            // If previously marked pending with same txHash, respond ok
            if (listing.txHash === txHash) {
                return res.status(200).json({ status: 'success', data: listing, message: 'Transaction already recorded.' });
            }
            return res.status(400).json({ status: 'error', error: `Draft is already in status: ${listing.status}` });
        }

        // Record tx and mark pending (listener will confirm).
        listing.status = 'pending';
        listing.txHash = txHash;
        listing.updatedAt = new Date();
        await listing.save();

        res.status(200).json({
            status: 'success',
            data: listing,
            message: 'Transaction recorded. Waiting for block confirmations.'
        });
    } catch (error: any) {
        console.error("notifyListingTx error:", error);
        res.status(500).json({ status: 'error', error: error.message });
    }
};

/**
 * Notify cancel (frontend can call after submitting on-chain cancel tx)
 * ChainListener will mark cancelled when event is processed.
 */
export const notifyCancelListing = async (req: Request, res: Response) => {
    try {
        const { onChainListingId, txHash } = req.body;
        const userId = (req as any).user.id;

        if (!onChainListingId || !txHash) {
            return res.status(400).json({ status: 'error', error: 'onChainListingId and txHash are required' });
        }

        const listing = await ListingModel.findOne({ onChainListingId: Number(onChainListingId) });
        if (!listing) {
            return res.status(404).json({ status: 'error', error: 'Listing not found' });
        }

        if (listing.sellerId.toLowerCase() !== userId.toLowerCase()) {
            return res.status(403).json({ status: 'error', error: 'Not authorized.' });
        }

        // We do not perform chain cancellation here — frontend must submit TX.
        // Record txHash to aid reconciliation; listener will finalize.
        listing.pendingCancelTx = txHash;
        listing.status = 'pending_cancel';
        listing.updatedAt = new Date();
        await listing.save();

        res.status(200).json({ status: 'success', message: 'Cancellation tx recorded. Waiting for confirmations.' });
    } catch (error: any) {
        console.error("notifyCancelListing error:", error);
        res.status(500).json({ status: 'error', error: error.message });
    }
};