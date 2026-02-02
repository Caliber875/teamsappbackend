import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { requireSuperAdmin, requireAdmin } from '../middlewares/rbac.middleware';
import { authMiddleware } from '../middlewares/auth.middleware';
import { userCreationRateLimiter } from '../middlewares/rate-limit.middleware';

const router = Router();

// All admin routes require authentication
router.use(authMiddleware);

// User management (super_admin and admin)
router.post('/users', requireSuperAdmin, userCreationRateLimiter, AdminController.createUser);
router.get('/users', requireAdmin, AdminController.listUsers);
router.patch('/users/:userId', requireSuperAdmin, AdminController.updateUser);
router.delete('/users/:userId', requireSuperAdmin, AdminController.deleteUser);

export default router;
