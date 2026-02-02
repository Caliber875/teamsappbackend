import 'dotenv/config';
import http from 'http';
import app from './app';
import SocketService from './services/socket.service';
import { bootstrapSuperAdmin } from './utils/bootstrap-super-admin';
import connectDB from './config/db';

const PORT = process.env.PORT || 3001;

const server = http.createServer(app);

const startServer = async () => {
    try {
        // Connect to database FIRST (before bootstrap)
        console.log('📡 Connecting to MongoDB...');
        await connectDB();
        console.log('✅ MongoDB connected');

        // Bootstrap super admin on startup (idempotent)
        await bootstrapSuperAdmin();

        // Start HTTP Server
        server.listen(PORT, async () => {
            console.log(`🚀 Server running on http://localhost:${PORT}`);

            // Initialize Socket.io
            await SocketService.initialize(server);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

startServer();
