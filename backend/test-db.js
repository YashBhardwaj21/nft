import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const uri = process.env.MONGODB_URI;
console.log('Testing mongoose connection to:', uri.replace(/:([^:@]+)@/, ':***@'));

mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 })
    .then(() => {
        console.log('Success connecting to MongoDB');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Failed to connect:', err.message);
        process.exit(1);
    });
