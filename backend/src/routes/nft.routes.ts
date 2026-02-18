import { Router } from 'express';
import * as nftController from '../controllers/nft.controller.js';
import { protect } from '../middleware/auth.js';

const router: Router = Router();

/**
 * @route   GET /api/nfts
 * @desc    Get all NFTs
 * @access  Public
 */
router.get('/', nftController.getAllNFTs);

/**
 * @route   GET /api/nfts/:id
 * @desc    Get NFT by ID
 * @access  Public
 */
router.get('/:id', nftController.getNFTById);

/**
 * @route   POST /api/nfts
 * @desc    Create a new NFT
 * @access  Private
 */
import { upload } from '../middleware/upload.js';

router.post('/prepare', protect, upload.single('image'), nftController.prepareMint);
router.post('/confirm', protect, nftController.confirmMint);
// router.post('/', protect, upload.single('image'), nftController.createNFT); // Legacy

/**
 * @route   PUT /api/nfts/:id
 * @desc    Update NFT
 * @access  Private
 */
router.put('/:id', protect, nftController.updateNFT);

/**
 * @route   DELETE /api/nfts/:id
 * @desc    Delete NFT
 * @access  Private
 */
router.delete('/:id', protect, nftController.deleteNFT);

/**
 * @route   GET /api/nfts/user/:userId
 * @desc    Get NFTs by user ID
 * @access  Public
 */
router.get('/user/:userId', nftController.getNFTsByUser);

export default router;
