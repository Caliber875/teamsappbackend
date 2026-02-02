import { Router } from 'express';
import { sendMessage, getMessages, editMessage, deleteMessage, toggleReaction } from '../controllers/message.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router({ mergeParams: true }); // Mounted at /api/channels/:channelId/messages

router.use(authMiddleware);

router.post('/', sendMessage);
router.get('/', getMessages);

// NEW: Advanced features - Note: These might need to be mounted at root /api/messages for easier ID access
// BUT since we are inside /channels/:channelId/messages router, we might have issues if we assume :messageId is root.
// Let's typically put ID-based operations on a separate route or handle them carefully.
// Ideally: /api/messages/:messageId
// Current mount seems to be: /api/channels/:channelId/messages (based on app.ts usually)

// However, edit/delete usually just needs ID.
// Let's add them here assuming the client calls /api/channels/:channelId/messages/:messageId
router.put('/:messageId', editMessage);
router.delete('/:messageId', deleteMessage);
router.post('/:messageId/reactions', toggleReaction);

export default router;
