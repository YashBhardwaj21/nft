import { Router } from 'express';
import * as marketplaceController from '../controllers/marketplace.controller.js';

const router = Router();

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

/**
 * @route   POST /api/marketplace/listings
 * @desc    Create a new marketplace listing
 * @access  Public (will be protected later)
 */
router.post('/listings', marketplaceController.createListing);

/**
 * @route   DELETE /api/marketplace/listings/:id
 * @desc    Delete a marketplace listing
 * @access  Public (will be protected later)
 */
router.delete('/listings/:id', marketplaceController.deleteListing);

export default router;
