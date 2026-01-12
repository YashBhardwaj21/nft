import { Request, Response } from 'express';
import { User, UserStats, NFT, ApiResponse } from '../types/index.js';

// Mock data storage
let users: User[] = [
    {
        id: 'user1',
        username: 'CryptoCollector',
        email: 'collector@example.com',
        walletAddress: '0x1234...5678',
        profileImage: 'https://api.dicebear.com/7.x/avataaars/svg?seed=user1',
        bio: 'NFT enthusiast and collector',
        createdAt: new Date('2025-01-01')
    },
    {
        id: 'user2',
        username: 'DigitalArtist',
        email: 'artist@example.com',
        walletAddress: '0xabcd...efgh',
        profileImage: 'https://api.dicebear.com/7.x/avataaars/svg?seed=user2',
        bio: 'Creating digital art on the blockchain',
        createdAt: new Date('2025-02-15')
    }
];

// Mock NFT data
const mockUserNFTs: NFT[] = [
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
    },
    {
        id: '2',
        name: 'Digital Dreams #128',
        image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400',
        owner: 'user2',
        collection: 'Dreams Gallery',
        creator: 'CryptoArt',
        price: '1.8',
        rentalPrice: '0.08',
        currency: 'ETH',
        status: 'rented',
        likes: 18,
        views: 89
    }
];

/**
 * Get user statistics
 */
export const getUserStats = (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Get user's NFTs
        const userNFTs = mockUserNFTs.filter(nft => nft.owner === id);

        // Calculate total value
        const totalValue = userNFTs.reduce((sum, nft) => sum + parseFloat(nft.price), 0);

        // Count active listings (NFTs available for rent)
        const activeListings = userNFTs.filter(nft => nft.status === 'available').length;

        // Mock rental count (in real app, query from rentals)
        const totalRentals = 8;

        const stats: UserStats = {
            totalNFTs: userNFTs.length,
            totalValue: totalValue.toFixed(2),
            activeListings,
            totalRentals,
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
 * Get user's owned NFTs
 */
export const getOwnedNFTs = (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const ownedNFTs = mockUserNFTs.filter(nft => nft.owner === id);

        res.status(200).json({
            status: 'success',
            data: ownedNFTs,
            message: `Found ${ownedNFTs.length} owned NFTs`
        });
    } catch (error: any) {
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
};

/**
 * Get user's rented NFTs
 */
export const getRentedNFTs = (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Mock rented NFTs (in real app, join with rentals table)
        const rentedNFTs = [
            {
                id: '4',
                name: 'Borrowed Dreams #256',
                image: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=400',
                rentalPrice: '0.08',
                currency: 'ETH',
                collection: 'Dream Series',
                creator: 'ArtistX',
                owner: 'user2',
                status: 'rented' as const,
                likes: 45,
                price: '2.0',
                timeLeft: '3d 12h',
                rentalEndDate: new Date(Date.now() + 3.5 * 24 * 60 * 60 * 1000)
            },
            {
                id: '5',
                name: 'Neon Future #89',
                image: 'https://images.unsplash.com/photo-1634193295627-1cdddf751ebf?w=400',
                rentalPrice: '0.15',
                currency: 'ETH',
                collection: 'Future Collection',
                creator: 'TechArtist',
                owner: 'user3',
                status: 'rented' as const,
                likes: 78,
                price: '3.5',
                timeLeft: '1d 4h',
                rentalEndDate: new Date(Date.now() + 1.17 * 24 * 60 * 60 * 1000)
            }
        ];

        res.status(200).json({
            status: 'success',
            data: rentedNFTs,
            message: `Found ${rentedNFTs.length} rented NFTs`
        });
    } catch (error: any) {
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
};

/**
 * Get user's active listings
 */
export const getUserListings = (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Get user's NFTs that are listed
        const userListings = mockUserNFTs.filter(
            nft => nft.owner === id && nft.status === 'available'
        );

        res.status(200).json({
            status: 'success',
            data: userListings,
            message: `Found ${userListings.length} active listings`
        });
    } catch (error: any) {
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
};

/**
 * Get user profile
 */
export const getUserProfile = (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const user = users.find(u => u.id === id);

        if (!user) {
            return res.status(404).json({
                status: 'error',
                error: 'User not found'
            });
        }

        res.status(200).json({
            status: 'success',
            data: user
        });
    } catch (error: any) {
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
};

/**
 * Update user profile
 */
export const updateUserProfile = (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userIndex = users.findIndex(u => u.id === id);

        if (userIndex === -1) {
            return res.status(404).json({
                status: 'error',
                error: 'User not found'
            });
        }

        // Update user profile
        users[userIndex] = {
            ...users[userIndex],
            ...req.body,
            id // Preserve ID
        };

        res.status(200).json({
            status: 'success',
            data: users[userIndex],
            message: 'Profile updated successfully'
        });
    } catch (error: any) {
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
};
