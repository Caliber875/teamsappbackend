import { Router } from 'express';
import { createWorkspace, getMyWorkspaces } from '../controllers/workspace.controller';
import { authMiddleware as requireAuth } from '../middlewares/auth.middleware';

const router = Router();

// Apply auth middleware to all routes
router.use(requireAuth);

router.post('/', createWorkspace);
router.get('/', getMyWorkspaces);

export default router;
