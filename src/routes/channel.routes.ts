import express from 'express';
import { getChannels, createChannel, getChannelById } from '../controllers/channel.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

import messageRoutes from './message.routes';

const router = express.Router();

router.use(authMiddleware); // Protect all channel routes

router.get('/', getChannels);
router.get('/:channelId', getChannelById);
router.post('/', createChannel);

// Mount Message Routes
router.use('/:channelId/messages', messageRoutes);

export default router;
