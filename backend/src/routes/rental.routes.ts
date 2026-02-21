import { Router } from 'express';
import * as rentalController from '../controllers/rental.controller.js';

import { protect } from '../middleware/auth.js';

const router: Router = Router();

// ... existing routes ...

/**
 * @route   POST /api/rentals/rent
 * @desc    Rent an NFT (from Listing)
 * @access  Private
 */
router.post('/rent', protect, rentalController.rentFromListing as any);

/**
 * @route   POST /api/rentals/notify
 * @desc    Notify backend of submitted tx Hash for rental
 * @access  Private
 */
router.post('/notify', protect, rentalController.notifyRentalTx as any);

export default router;
