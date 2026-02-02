import { Router } from 'express';
import { ProfileController } from '../controllers/profile.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Get current user profile
router.get('/', ProfileController.getProfile);

// Update name only
router.patch('/name', ProfileController.updateName);

export default router;
