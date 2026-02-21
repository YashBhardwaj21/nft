import { Router } from 'express';
import * as marketplaceController from '../controllers/marketplace.controller.js';
import { protect } from '../middleware/auth.js';

const router: Router = Router();

/**
 * @route   POST /api/marketplace/draft
 * @desc    Create a draft listing for an NFT (Phase 1 of chain-first flow)
 * @access  Private
 */
router.post('/draft', protect, marketplaceController.createListingDraft);

/**
 * @route   POST /api/marketplace/notify
 * @desc    Notify backend of submitted tx Hash for listing (Phase 2 of chain-first flow)
 * @access  Private
 */
router.post('/notify', protect, marketplaceController.notifyListingTx);

/**
 * @route   POST /api/marketplace/cancel/notify
 * @desc    Notify backend of submitted tx Hash for cancelled listing
 * @access  Private
 */
router.post('/cancel/notify', protect, marketplaceController.notifyCancelListing);


/**
 * @route   GET /api/marketplace
 * @desc    Get all marketplace listings
 * @access  Public
 */
router.get('/', marketplaceController.getAllListings);

/**
 * @route   GET /api/marketplace/search
 * @desc    Search and filter marketplace listings
 * @access  Public
 */
router.get('/search', marketplaceController.searchListings);

/**
 * @route   GET /api/marketplace/trending
 * @desc    Get trending NFTs
 * @access  Public
 */
router.get('/trending', marketplaceController.getTrendingNFTs);

/**
 * @route   GET /api/marketplace/stats
 * @desc    Get marketplace statistics
 * @access  Public
 */
router.get('/stats', marketplaceController.getMarketplaceStats);

export default router;
