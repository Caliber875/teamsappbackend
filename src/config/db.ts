import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async () => {
    try {
        const mongoURI = process.env.MONGO_URI || '';

        if (!mongoURI) {
            console.error('❌ MONGO_URI is not defined in .env file');
            process.exit(1);
        }

        await mongoose.connect(mongoURI);
        console.log('✅ MongoDB Connected Successfully');
    } catch (error) {
        console.error('❌ MongoDB Connection Error:', error);
        process.exit(1);
    }
};

export default connectDB;
