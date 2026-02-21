import mongoose from 'mongoose';
import { config } from 'dotenv';
config();

async function fixDatabase() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGODB_URI as string);
        console.log("Connected.");

        const db = mongoose.connection.db;

        // 1. Drop old broken index
        try {
            console.log("Dropping old broken index 'onChainListingId_1_tokenAddress_1'...");
            await db.collection('listings').dropIndex("onChainListingId_1_tokenAddress_1");
            console.log("Dropped successfully.");
        } catch (e: any) {
            console.log("Index might already be dropped or not exist:", e.message);
        }

        // 2. Clear corrupted old drafts that crashed the chainListener
        console.log("Clearing corrupted drafts with null onChainListingId...");
        const result = await db.collection('listings').deleteMany({ onChainListingId: null });
        console.log(`Deleted ${result.deletedCount} corrupted draft listings.`);

        console.log("Done! You can now restart the backend.");
        process.exit(0);
    } catch (e) {
        console.error("Error fixing DB:", e);
        process.exit(1);
    }
}

fixDatabase();
