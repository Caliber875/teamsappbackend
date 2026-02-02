import { Router } from 'express';
import * as DMController from '../controllers/dm.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// All DM routes require authentication
router.use(authMiddleware);

// Create or get DM with another user
router.post('/', DMController.createOrGetDM);

// Get all DMs for current user
router.get('/', DMController.getUserDMs);

// Get a specific DM by ID
router.get('/:dmId', DMController.getDM);

// Get messages for a specific DM
router.get('/:dmId/messages', DMController.getDMMessages);

// Send a message in a DM
router.post('/:dmId/messages', DMController.sendDMMessage);

// Mark DM as read
router.post('/:dmId/read', DMController.markDMAsRead);

export default router;
