import { Request, Response } from 'express';
import { UserStats, ApiResponse } from '../types/index.js';
import { UserModel } from '../models/User.js';
import { NFTModel } from '../models/NFT.js';

/**
 * Get user statistics
 */
export const getUserStats = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Get user's NFTs
        const userNFTs = await NFTModel.find({ owner: id });

        // Calculate total value
        const totalValue = userNFTs.reduce((sum, nft) => sum + (nft.price || 0), 0);

        // Count active listings (NFTs available for rent)
        const activeListings = userNFTs.filter(nft => nft.status === 'available').length;

        // Mock rental count (in real app, query from rentals)
        const totalRentals = 8; // TODO: Implement Rental Model query

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
export const getOwnedNFTs = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const ownedNFTs = await NFTModel.find({ owner: id });

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
/**
 * Get user's rented NFTs
 */
export const getRentedNFTs = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Model A: Query NFT collection directly for renterWallet
        const rentedNFTs = await NFTModel.find({
            renterWallet: id,
            status: 'rented'
        });

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
export const getUserListings = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Get user's NFTs that are listed
        const userListings = await NFTModel.find({
            owner: id,
            status: 'available'
        });

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
export const getUserProfile = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        // Search by internal ID or wallet address or custom ID field
        // Assuming 'id' param maps to our custom 'id' field in schema
        const user = await UserModel.findOne({ id: id });

        // If not found by custom id, try _id just in case
        // const user = await UserModel.findById(id);

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
export const updateUserProfile = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const user = await UserModel.findOneAndUpdate(
            { id: id },
            { $set: req.body },
            { new: true, runValidators: true }
        );

        if (!user) {
            return res.status(404).json({
                status: 'error',
                error: 'User not found'
            });
        }

        res.status(200).json({
            status: 'success',
            data: user,
            message: 'Profile updated successfully'
        });
    } catch (error: any) {
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
};

