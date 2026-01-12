import { Request, Response } from 'express';
import { Listing, NFT, ApiResponse } from '../types/index.js';

// Mock data storage
let listings: Listing[] = [
    {
        id: '1',
        nftId: '1',
        sellerId: 'user1',
        price: '2.5',
        rentalPrice: '0.1',
        currency: 'ETH',
        duration: 7,
        status: 'active',
        views: 150,
        likes: 42,
        createdAt: new Date()
    },
    {
        id: '2',
        nftId: '3',
        sellerId: 'user1',
        price: '3.2',
        rentalPrice: '0.15',
        currency: 'ETH',
        duration: 14,
        status: 'active',
        views: 320,
        likes: 156,
        createdAt: new Date()
    }
];

// Mock NFT data (simplified)
const mockNFTs: NFT[] = [
    {
        id: '1',
        name: 'Cosmic Wanderer #342',
        image: 'https://images.unsplash.com/photo-1634193295627-1cdddf751ebf?w=400',
        owner: 'user1',
        collection: 'Cosmic Collection',
        creator: 'ArtistX',
        price: '2.5',
        rentalPrice: '0.1',
        currency: 'ETH',
        status: 'available',
        likes: 42,
        views: 150
    },
    {
        id: '3',
        name: 'Neon Genesis #89',
        image: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=400',
        owner: 'user1',
        collection: 'Neon Series',
        creator: 'FutureVision',
        price: '3.2',
        rentalPrice: '0.15',
        currency: 'ETH',
        status: 'available',
        likes: 156,
        views: 320
    }
];

/**
 * Get all marketplace listings
 */
export const getAllListings = (req: Request, res: Response) => {
    try {
        const { page = 1, limit = 20, status = 'active' } = req.query;

        const filteredListings = listings.filter(listing =>
            !status || listing.status === status
        );

        // Pagination
        const startIndex = (Number(page) - 1) * Number(limit);
        const endIndex = startIndex + Number(limit);
        const paginatedListings = filteredListings.slice(startIndex, endIndex);

        // Enrich with NFT data
        const enrichedListings = paginatedListings.map(listing => {
            const nft = mockNFTs.find(n => n.id === listing.nftId);
            return {
                ...listing,
                nft
            };
        });

        res.status(200).json({
            status: 'success',
            data: enrichedListings,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: filteredListings.length,
                totalPages: Math.ceil(filteredListings.length / Number(limit))
            }
        });
    } catch (error: any) {
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
};

/**
 * Search marketplace listings
 */
export const searchListings = (req: Request, res: Response) => {
    try {
        const { query, category, minPrice, maxPrice, sortBy = 'trending' } = req.query;

        let results = [...listings];

        // Search by query
        if (query) {
            results = results.filter(listing => {
                const nft = mockNFTs.find(n => n.id === listing.nftId);
                return nft?.name.toLowerCase().includes((query as string).toLowerCase()) ||
                    nft?.collection.toLowerCase().includes((query as string).toLowerCase());
            });
        }

        // Filter by price range
        if (minPrice) {
            results = results.filter(l => parseFloat(l.price) >= parseFloat(minPrice as string));
        }
        if (maxPrice) {
            results = results.filter(l => parseFloat(l.price) <= parseFloat(maxPrice as string));
        }

        // Sort
        if (sortBy === 'price_asc') {
            results.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
        } else if (sortBy === 'price_desc') {
            results.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
        } else if (sortBy === 'trending') {
            results.sort((a, b) => b.views - a.views);
        }

        // Enrich with NFT data
        const enrichedResults = results.map(listing => {
            const nft = mockNFTs.find(n => n.id === listing.nftId);
            return { ...listing, nft };
        });

        res.status(200).json({
            status: 'success',
            data: enrichedResults,
            message: `Found ${results.length} listings`
        });
    } catch (error: any) {
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
};

/**
 * Get trending NFTs
 */
export const getTrendingNFTs = (req: Request, res: Response) => {
    try {
        const { limit = 10 } = req.query;

        // Sort by views and likes
        const trending = [...listings]
            .sort((a, b) => (b.views + b.likes * 2) - (a.views + a.likes * 2))
            .slice(0, Number(limit));

        // Enrich with NFT data
        const enrichedTrending = trending.map(listing => {
            const nft = mockNFTs.find(n => n.id === listing.nftId);
            return { ...listing, nft };
        });

        res.status(200).json({
            status: 'success',
            data: enrichedTrending
        });
    } catch (error: any) {
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
};

/**
 * Get marketplace statistics
 */
export const getMarketplaceStats = (req: Request, res: Response) => {
    try {
        const stats = {
            totalListings: listings.length,
            activeListings: listings.filter(l => l.status === 'active').length,
            totalVolume: listings.reduce((sum, l) => sum + parseFloat(l.price), 0).toFixed(2),
            averagePrice: (listings.reduce((sum, l) => sum + parseFloat(l.price), 0) / listings.length).toFixed(2),
            totalViews: listings.reduce((sum, l) => sum + l.views, 0),
            totalLikes: listings.reduce((sum, l) => sum + l.likes, 0),
            currency: 'ETH'
        };

        res.status(200).json({
            status: 'success',
            data: stats
        });
    } catch (error: any) {
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
};

/**
 * Create a new listing
 */
export const createListing = (req: Request, res: Response) => {
    try {
        const newListing: Listing = {
            id: Date.now().toString(),
            ...req.body,
            status: 'active',
            views: 0,
            likes: 0,
            createdAt: new Date()
        };

        listings.push(newListing);

        res.status(201).json({
            status: 'success',
            data: newListing,
            message: 'Listing created successfully'
        });
    } catch (error: any) {
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
};

/**
 * Delete a listing
 */
export const deleteListing = (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const listingIndex = listings.findIndex(l => l.id === id);

        if (listingIndex === -1) {
            return res.status(404).json({
                status: 'error',
                error: 'Listing not found'
            });
        }

        const deletedListing = listings.splice(listingIndex, 1)[0];

        res.status(200).json({
            status: 'success',
            data: deletedListing,
            message: 'Listing deleted successfully'
        });
    } catch (error: any) {
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
};
