import express from 'express';
import { getUsers } from '../controllers/user.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = express.Router();

// Apply auth middleware to all user routes
router.use(authMiddleware);

router.get('/', getUsers);

export default router;
