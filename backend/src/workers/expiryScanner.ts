import { RentalModel } from '../models/Rental.js';
import { ListingModel } from '../models/Listing.js';

/**
 * ExpiryScanner — Phase 6.2
 *
 * Runs on a timer and marks any rental whose on-chain `userExpires` timestamp
 * has passed as EXPIRED, then re-opens the corresponding listing so it can be
 * rented again. Without this, MongoDB would permanently show old rentals as
 * ACTIVE even after the on-chain timer has elapsed.
 */
export async function scanExpiredRentals(): Promise<void> {
    const now = new Date();

    const expired = await RentalModel.find({
        status: 'ACTIVE',
        expiresAt: { $lt: now },
    });

    for (const rental of expired) {
        await RentalModel.findByIdAndUpdate(rental._id, { status: 'EXPIRED' });
        await ListingModel.findOneAndUpdate(
            { tokenId: rental.tokenId, tokenAddress: rental.tokenAddress },
            { status: 'ACTIVE' }
        );
        console.log(`[ExpiryScanner] Rental expired — tokenId: ${rental.tokenId}`);
    }

    if (expired.length > 0) {
        console.log(`[ExpiryScanner] Marked ${expired.length} rental(s) as EXPIRED`);
    }
}
