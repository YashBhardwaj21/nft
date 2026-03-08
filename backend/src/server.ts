import 'dotenv/config'; // Load env vars first — must be the very first import

// ─── Phase 3.2: Validate required env vars before anything else ───────────────
function validateEnvMirrors(): void {
    const required = [
        'MONGODB_URI', 'JWT_SECRET', 'RPC_URL',
        'CHAIN_ID', 'CONTRACT_ADDRESS', 'MARKETPLACE_ADDRESS',
    ];
    const missing = required.filter(k => !process.env[k]);
    if (missing.length) {
        console.error('FATAL: Missing required env vars:', missing.join(', '));
        console.error('Copy backend/.env.example → backend/.env and fill in all values.');
        process.exit(1);
    }
    const addrRegex = /^0x[0-9a-fA-F]{40}$/;
    for (const key of ['CONTRACT_ADDRESS', 'MARKETPLACE_ADDRESS']) {
        if (!addrRegex.test(process.env[key]!)) {
            console.error(`FATAL: ${key} is not a valid Ethereum address: "${process.env[key]}"`);
            process.exit(1);
        }
    }
    console.log('✅ Env validation passed — all required vars present and valid');
}
validateEnvMirrors();
// ─────────────────────────────────────────────────────────────────────────────

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
        abisLoaded: (globalThis as any).ABIS_LOADED,
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
        message: `Route ${req.originalUrl} not found`,
    });
});

// Error handling middleware
app.use(errorHandler);

// ─── Phase 3.3: Start server — HTTP port binds first, workers start after ─────
const startServer = async () => {
    console.log('🚀 Starting NFT Rental Marketplace API...');

    try {
        // 1. Connect to Database (with retry)
        console.log('⏳ Connecting to DB...');
        await connectDBWithRetry();
        console.log('✅ DB Connected');
        (app as any).set('dbConnected', true);

        // 2. Run Crypto Self-Test (non-fatal unless STRICT_CRYPTO_SELFTEST is true)
        console.log('⏳ Running Crypto Self-Test...');
        await CryptoService.selfTest();
        console.log('✅ Crypto Self-Test passed');

        // 3. Bind HTTP server FIRST — API is available immediately
        app.listen(PORT, () => {
            console.log(`✅ Server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
        });

        // 4. Background workers start AFTER — failure here does NOT crash the API
        startWorkers().catch(err => {
            console.warn('⚠️  Background workers failed to start:', err.message);
            console.warn('API running without real-time sync — restart to retry');
        });

    } catch (error: any) {
        console.error('❌ FATAL: Failed to start server:', error.message);
        process.exit(1);
    }
};
// ─────────────────────────────────────────────────────────────────────────────

startServer();

export default app;
