import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import passport from 'passport';
import setupPassport from './config/passport';
import connectDB from './config/db';

import authRoutes from './routes/auth.routes';
import channelRoutes from './routes/channel.routes';
import userRoutes from './routes/user.routes';
import uploadRoutes from './routes/upload.routes';
import workspaceRoutes from './routes/workspace.routes';
import adminRoutes from './routes/admin.routes';
import profileRoutes from './routes/profile.routes';
import dmRoutes from './routes/dm.routes';
import messageRoutes from './routes/message.routes';

dotenv.config();

const app = express();

// Trust Proxy (Required for Vercel/Heroku to detect HTTPS)
app.set('trust proxy', 1);

// Initialize Passport
setupPassport();
app.use(passport.initialize());

// Middleware
app.use(helmet());
app.use(cookieParser());
const allowedOrigins = [
    process.env.CLIENT_URL,
    'http://localhost:3000',
    'https://orbit-teams.vercel.app'
].filter(Boolean) as string[];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
app.use(express.json());

// Database Connection Middleware
// Ensures DB is connected before handling any request (Crucial for Serverless context)
app.use(async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (error) {
        console.error('Database connection failed:', error);
        res.status(500).json({ message: 'Service Unavailable: Database error' });
    }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/users', userRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/dms', dmRoutes);
app.use('/api/messages', messageRoutes); // Global message routes (edit/delete/react)

// Health Check Route
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root Route
app.get('/', (req, res) => {
    res.send('API is running...');
});

export default app;
