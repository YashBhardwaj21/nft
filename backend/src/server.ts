import 'dotenv/config'; // Load env vars before other imports

import express, { Application, Request, Response } from 'express';
import cors from 'cors';

import connectDBWithRetry from './config/db.js';
import { CryptoService } from './security/cryptoService.js';
import { startWorkers } from './workers/index.js';
import nftRoutes from './routes/nft.routes.js';
import marketplaceRoutes from './routes/marketplace.routes.js';
import rentalRoutes from './routes/rental.routes.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import demoRoutes from './routes/demo.routes.js';
import adminRoutes from './routes/admin.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app: Application = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check route
app.get('/health', (_req: Request, res: Response) => {
    const dbConnected = (app as any).get('dbConnected') || false;
    res.status(200).json({
        status: 'success',
        message: 'NFT Rental Marketplace API is running',
        timestamp: new Date().toISOString(),
        dbConnected,
        cryptoOk: (globalThis as any).CRYPTO_SELFTEST_OK,
        abisLoaded: (globalThis as any).ABIS_LOADED
    });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/nfts', nftRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/rentals', rentalRoutes);
app.use('/api/users', userRoutes);
app.use('/api/demo', demoRoutes);
app.use('/admin', adminRoutes);

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
    console.log('🚀 Starting NFT Rental Marketplace API...');

    try {
        // 1. Connect to Database (with retry)
        console.log('⏳ Connecting to DB...');
        await connectDBWithRetry();
        console.log('✅ DB Connected step done');
        (app as any).set('dbConnected', true);

        // 2. Run Crypto Self-Test (non-fatal unless STRICT_CRYPTO_SELFTEST is true)
        console.log('⏳ Running Crypto Self-Test...');
        await CryptoService.selfTest();
        console.log('✅ Crypto Self-Test done');

        // 3. Start Background Workers (Chain Listener & Projector)
        console.log('⏳ Starting Background Workers...');
        await startWorkers();
        console.log('✅ Background Workers started');

        // 4. Listen
        app.listen(PORT, () => {
            console.log(`✅ Server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
        });
    } catch (error: any) {
        console.error('❌ FATAL: Failed to start server:', error.message);
        process.exit(1);
    }
};

startServer();

export default app;
