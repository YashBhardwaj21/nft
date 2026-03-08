import { getDynamicProvider } from '../utils/provider.js';
import { chainListener } from '../services/chainListener.js';
import { createProjector } from '../services/projector.js';
import { scanExpiredRentals } from './expiryScanner.js';

const projector = createProjector();

export async function startWorkers() {
    console.log('👷 Starting background workers...');

    try {
        const provider = getDynamicProvider();

        // Start Chain Listener
        // It handles its own internal degraded mode if ABIs are missing
        await chainListener.start(provider);

        // Start Projector
        await projector.start(provider);

        // Start Expiry Scanner — runs every 5 minutes to mark expired rentals
        setInterval(scanExpiredRentals, 5 * 60 * 1000);
        console.log('[ExpiryScanner] Started — scanning every 5 minutes');

        console.log('✅ Background workers initialized');
    } catch (err: any) {
        console.error('❌ Failed to start background workers:', err.message);
        console.warn('⚠️  Application running without background sync/projection.');
    }
}
