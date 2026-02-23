import { Request, Response } from 'express';
import { UserStats } from '../types/index.js';
import { UserModel } from '../models/User.js';
import { NFTModel } from '../models/NFT.js';
import { RentalModel } from '../models/Rental.js';
import { ListingModel } from '../models/Listing.js';

/**
 * Get user statistics
 */
export const getUserStats = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const normalizedId = id.toLowerCase();

        // 1. Get user's NFTs (directly from NFTModel facts)
        const userNFTs = await NFTModel.find({ owner: normalizedId });

        // 2. Count active listings (using sellerAddress)
        const activeListings = await ListingModel.countDocuments({
            sellerAddress: normalizedId,
            status: 'ACTIVE'
        });

        // 3. Active Rentals (as Renter)
        const activeRentalsCount = await RentalModel.countDocuments({
            renter: normalizedId,
            status: 'ACTIVE'
        });

        // 4. Total Earnings (as Owner)
        const ownerRentals = await RentalModel.find({ owner: normalizedId });
        const totalEarnings = ownerRentals.reduce((sum, rental) => {
            return sum + (parseFloat(rental.totalPrice || '0') / 1e18); // assuming totalPrice is in wei
        }, 0);

        // 5. Active Rented Out (as Owner)
        const activeRentedOutCount = await RentalModel.countDocuments({
            owner: normalizedId,
            status: 'ACTIVE'
        });

        const stats: UserStats = {
            totalNFTs: userNFTs.length,
            totalValue: '0.00', // We no longer track 'value' on the NFT model itself
            activeListings,
            totalRentals: activeRentalsCount,
            totalEarnings: totalEarnings.toFixed(4),
            activeRentedOut: activeRentedOutCount,
            currency: 'ETH'
        };

        res.status(200).json({ status: 'success', data: stats });
    } catch (error: any) {
        res.status(500).json({ status: 'error', error: error.message });
    }
};

/**
 * Get user's owned NFTs
 */
export const getOwnedNFTs = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const normalizedId = id.toLowerCase();
        const ownedNFTs = await NFTModel.find({ owner: normalizedId }).lean();

        // Also include drafts that are stuck in MINTING/PREPARED state
        // (these were minted before the confirmMint fix was deployed)
        const { DraftModel } = await import('../models/Draft.js');
        const pendingDrafts = await DraftModel.find({
            creator: normalizedId,
            status: { $in: ['MINTING', 'PREPARED'] }
        }).lean();

        // Convert drafts to NFT-shaped items so the frontend can display them
        const draftAsNFTs = pendingDrafts.map((d: any) => ({
            id: d._id.toString(),
            _id: d._id,
            name: d.name,
            description: d.description || '',
            image: d.image,
            creator: d.creator,
            owner: d.creator,
            collectionName: 'DAO Collection',
            tokenURI: d.tokenURI,
            // Mark these so the frontend can show an appropriate status
            isDraft: true,
            draftStatus: d.status,
        }));

        res.status(200).json({
            status: 'success',
            data: [...ownedNFTs, ...draftAsNFTs],
            message: `Found ${ownedNFTs.length} owned NFTs + ${draftAsNFTs.length} pending mints`
        });
    } catch (error: any) {
        res.status(500).json({ status: 'error', error: error.message });
    }
};

/**
 * Get user's rented NFTs (Items user is renting)
 */
export const getRentedNFTs = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const normalizedId = id.toLowerCase();

        const activeRentals = await RentalModel.find({
            renter: normalizedId,
            status: 'ACTIVE'
        }).lean();

        // Enrich with NFT data using compound keys
        const enrichedNFTs = await Promise.all(activeRentals.map(async (rental) => {
            const nft = await NFTModel.findOne({
                tokenAddress: rental.tokenAddress,
                tokenId: rental.tokenId
            }).lean();

            return {
                ...(nft || {}),
                rentalEndDate: rental.expiresAt,
                timeLeft: rental.expiresAt ? calculateTimeLeft(rental.expiresAt) : 'Expired'
            };
        }));

        res.status(200).json({
            status: 'success',
            data: enrichedNFTs,
            message: `Found ${enrichedNFTs.length} rented NFTs`
        });
    } catch (error: any) {
        res.status(500).json({ status: 'error', error: error.message });
    }
};

/**
 * Get user's active listings
 */
export const getUserListings = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const normalizedId = id.toLowerCase();

        const listings = await ListingModel.find({
            sellerAddress: normalizedId,
            status: { $in: ['ACTIVE', 'LOCAL_DRAFT', 'PENDING_CREATE', 'RENTED'] }
        }).lean();

        const enrichedListings = await Promise.all(listings.map(async (listing) => {
            const nft = await NFTModel.findOne({
                tokenAddress: listing.tokenAddress,
                tokenId: listing.tokenId
            }).lean();

            return { ...listing, nft };
        }));

        res.status(200).json({
            status: 'success',
            data: enrichedListings,
            message: `Found ${enrichedListings.length} active listings`
        });
    } catch (error: any) {
        res.status(500).json({ status: 'error', error: error.message });
    }
};

/**
 * Get User Rental History
 */
export const getRentalHistory = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const normalizedId = id.toLowerCase();

        const history = await RentalModel.find({ renter: normalizedId }).sort({ createdAt: -1 }).lean();

        const richHistory = await Promise.all(history.map(async (rental) => {
            const nft = await NFTModel.findOne({
                tokenAddress: rental.tokenAddress,
                tokenId: rental.tokenId
            }).lean();

            return {
                id: (rental as any)._id,
                nftName: nft?.name || 'Unknown NFT',
                nftImage: nft?.image,
                startDate: rental.startAt,
                endDate: rental.expiresAt,
                price: rental.totalPrice,
                status: rental.status
            };
        }));

        res.status(200).json({ status: 'success', data: richHistory });
    } catch (error: any) {
        res.status(500).json({ status: 'error', error: error.message });
    }
};

/**
 * Get User Earnings History
 */
export const getEarningsHistory = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const normalizedId = id.toLowerCase();

        const earnings = await RentalModel.find({ owner: normalizedId }).sort({ createdAt: -1 }).lean();

        const richEarnings = earnings.map(rental => ({
            id: (rental as any)._id,
            tokenAddress: rental.tokenAddress,
            tokenId: rental.tokenId,
            renter: rental.renter,
            amount: rental.totalPrice,
            date: rental.createdAt,
            status: rental.status
        }));

        res.status(200).json({ status: 'success', data: richEarnings });
    } catch (error: any) {
        res.status(500).json({ status: 'error', error: error.message });
    }
};

/**
 * Get user profile
 */
export const getUserProfile = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const normalizedId = id.toLowerCase();

        // Profiles are indexed by either 'id' or 'walletAddress' (standardized to address)
        const user = await UserModel.findOne({
            $or: [{ id: normalizedId }, { walletAddress: normalizedId }]
        });

        if (!user) return res.status(404).json({ status: 'error', error: 'User not found' });
        res.status(200).json({ status: 'success', data: user });
    } catch (error: any) {
        res.status(500).json({ status: 'error', error: error.message });
    }
};

/**
 * Update user profile
 */
export const updateUserProfile = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const normalizedId = id.toLowerCase();

        const user = await UserModel.findOneAndUpdate(
            { $or: [{ id: normalizedId }, { walletAddress: normalizedId }] },
            { $set: req.body },
            { new: true, runValidators: true }
        );

        if (!user) return res.status(404).json({ status: 'error', error: 'User not found' });
        res.status(200).json({ status: 'success', data: user, message: 'Profile updated successfully' });
    } catch (error: any) {
        res.status(500).json({ status: 'error', error: error.message });
    }
};

// Helper: Calculate time left string
function calculateTimeLeft(endDate: Date): string {
    const now = new Date().getTime();
    const end = new Date(endDate).getTime();
    const diff = end - now;

    if (diff <= 0) return 'Expired';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h left`;
}
