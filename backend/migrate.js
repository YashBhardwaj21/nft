import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://Yash21:yash2103@cluster0.vbrcz6q.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0');
        console.log('Connected to DB for migration');

        const db = mongoose.connection.db;
        const listings = db.collection('listings');
        const nfts = db.collection('nfts');
        const rentals = db.collection('rentals');

        await listings.updateMany({ status: 'active' }, { $set: { status: 'ACTIVE' } });
        await listings.updateMany({ status: 'confirmed' }, { $set: { status: 'ACTIVE' } });
        await listings.updateMany({ status: 'draft' }, { $set: { status: 'LOCAL_DRAFT' } });
        await listings.updateMany({ status: 'pending' }, { $set: { status: 'PENDING_CREATE' } });
        await listings.updateMany({ status: 'rented' }, { $set: { status: 'RENTED' } });
        await listings.updateMany({ status: 'cancelled' }, { $set: { status: 'CANCELLED' } });

        await nfts.updateMany({ status: 'listed' }, { $set: { status: 'listing' } });

        await rentals.updateMany({ status: 'active' }, { $set: { status: 'ACTIVE' } });
        await rentals.updateMany({ status: 'pending' }, { $set: { status: 'PENDING' } });
        await rentals.updateMany({ status: 'completed' }, { $set: { status: 'COMPLETED' } });

        console.log('Migration complete');
    } catch (e) {
        console.error('Migration failed:', e);
    } finally {
        await mongoose.disconnect();
    }
}

run();
