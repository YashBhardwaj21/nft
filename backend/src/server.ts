import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import nftRoutes from './routes/nft.routes.js';
import marketplaceRoutes from './routes/marketplace.routes.js';
import rentalRoutes from './routes/rental.routes.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import demoRoutes from './routes/demo.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

// Load environment variables
dotenv.config();

// Connect to Database
import connectDB from './config/db.js';
import { CryptoService } from './security/cryptoService.js';
import { chainListener } from './services/chainListener.js';
import { quickCheck } from './crypto/quickCheck.js';

// CryptoService.selfTest() is called inside startServer() below.

connectDB();

const app: Application = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check route
app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
        status: 'success',
        message: 'NFT Rental Marketplace API is running',
        timestamp: new Date().toISOString()
    });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/nfts', nftRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/rentals', rentalRoutes);
app.use('/api/users', userRoutes);
app.use('/api/demo', demoRoutes);

// 404 handler
app.use('*', (req: Request, res: Response) => {
    res.status(404).json({
        status: 'error',
        message: `Route ${req.originalUrl} not found`
    });
});

// Error handling middleware
app.use(errorHandler);

// Start server
const startServer = async () => {
    try {
        // Start Chain Listener
        chainListener.start();

        // Run Crypto Self-Test
        try {
            await CryptoService.selfTest();
            console.log(`Crypto Self-Test: PASSED ✅`);
            quickCheck(); // Non-blocking
        } catch (error) {
            console.error(`Crypto Self-Test: FAILED ❌`, error);
            process.exit(1);
        }

        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`🔗 Health check: http://localhost:${PORT}/health`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();

export default app;
