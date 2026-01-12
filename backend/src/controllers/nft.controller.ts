import { Request, Response } from 'express';
import { NFT, ApiResponse } from '../types/index.js';

// Mock data storage (replace with database later)
let nfts: NFT[] = [
    {
        id: '1',
        name: 'Cosmic Wanderer #342',
        description: 'A beautiful cosmic NFT from the Cosmic Collection',
        image: 'https://images.unsplash.com/photo-1634193295627-1cdddf751ebf?w=400',
        owner: 'user1',
        collection: 'Cosmic Collection',
        creator: 'ArtistX',
        price: '2.5',
        rentalPrice: '0.1',
        currency: 'ETH',
        status: 'available',
        likes: 42,
        views: 150,
        createdAt: new Date()
    },
    {
        id: '2',
        name: 'Digital Dreams #128',
        description: 'Dream-inspired digital art',
        image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400',
        owner: 'user2',
        collection: 'Dreams Gallery',
        creator: 'CryptoArt',
        price: '1.8',
        rentalPrice: '0.08',
        currency: 'ETH',
        status: 'rented',
        likes: 18,
        views: 89,
        createdAt: new Date()
    },
    {
        id: '3',
        name: 'Neon Genesis #89',
        description: 'Neon-themed futuristic art',
        image: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=400',
        owner: 'user1',
        collection: 'Neon Series',
        creator: 'FutureVision',
        price: '3.2',
        rentalPrice: '0.15',
        currency: 'ETH',
        status: 'available',
        likes: 156,
        views: 320,
        createdAt: new Date()
    }
];

/**
 * Get all NFTs
 */
export const getAllNFTs = (req: Request, res: Response) => {
    try {
        const { status, collection, minPrice, maxPrice } = req.query;

        let filteredNFTs = [...nfts];

        // Filter by status
        if (status) {
            filteredNFTs = filteredNFTs.filter(nft => nft.status === status);
        }

        // Filter by collection
        if (collection) {
            filteredNFTs = filteredNFTs.filter(nft =>
                nft.collection.toLowerCase().includes((collection as string).toLowerCase())
            );
        }

        // Filter by price range
        if (minPrice) {
            filteredNFTs = filteredNFTs.filter(nft => parseFloat(nft.price) >= parseFloat(minPrice as string));
        }
        if (maxPrice) {
            filteredNFTs = filteredNFTs.filter(nft => parseFloat(nft.price) <= parseFloat(maxPrice as string));
        }

        const response: ApiResponse<NFT[]> = {
            status: 'success',
            data: filteredNFTs,
            message: `Found ${filteredNFTs.length} NFTs`
        };

        res.status(200).json(response);
    } catch (error: any) {
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
};

/**
 * Get NFT by ID
 */
export const getNFTById = (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const nft = nfts.find(n => n.id === id);

        if (!nft) {
            return res.status(404).json({
                status: 'error',
                error: 'NFT not found'
            });
        }

        // Increment views
        nft.views = (nft.views || 0) + 1;

        const response: ApiResponse<NFT> = {
            status: 'success',
            data: nft
        };

        res.status(200).json(response);
    } catch (error: any) {
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
};

/**
 * Create new NFT
 */
export const createNFT = (req: Request, res: Response) => {
    try {
        const newNFT: NFT = {
            id: Date.now().toString(),
            ...req.body,
            likes: 0,
            views: 0,
            status: 'available',
            createdAt: new Date(),
            updatedAt: new Date()
        };

        nfts.push(newNFT);

        const response: ApiResponse<NFT> = {
            status: 'success',
            data: newNFT,
            message: 'NFT created successfully'
        };

        res.status(201).json(response);
    } catch (error: any) {
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
};

/**
 * Update NFT
 */
export const updateNFT = (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const nftIndex = nfts.findIndex(n => n.id === id);

        if (nftIndex === -1) {
            return res.status(404).json({
                status: 'error',
                error: 'NFT not found'
            });
        }

        nfts[nftIndex] = {
            ...nfts[nftIndex],
            ...req.body,
            id, // Preserve ID
            updatedAt: new Date()
        };

        const response: ApiResponse<NFT> = {
            status: 'success',
            data: nfts[nftIndex],
            message: 'NFT updated successfully'
        };

        res.status(200).json(response);
    } catch (error: any) {
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
};

/**
 * Delete NFT
 */
export const deleteNFT = (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const nftIndex = nfts.findIndex(n => n.id === id);

        if (nftIndex === -1) {
            return res.status(404).json({
                status: 'error',
                error: 'NFT not found'
            });
        }

        const deletedNFT = nfts.splice(nftIndex, 1)[0];

        const response: ApiResponse<NFT> = {
            status: 'success',
            data: deletedNFT,
            message: 'NFT deleted successfully'
        };

        res.status(200).json(response);
    } catch (error: any) {
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
};

/**
 * Get NFTs by user
 */
export const getNFTsByUser = (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const userNFTs = nfts.filter(nft => nft.owner === userId);

        const response: ApiResponse<NFT[]> = {
            status: 'success',
            data: userNFTs,
            message: `Found ${userNFTs.length} NFTs for user ${userId}`
        };

        res.status(200).json(response);
    } catch (error: any) {
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
};
