import { Router } from 'express';
import passport from 'passport';
import { AuthController } from '../controllers/auth.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { loginRateLimiter } from '../middlewares/rate-limit.middleware';

const router = Router();

// ============================================
// NEW: Email + Password Authentication
// ============================================
router.post('/login', loginRateLimiter, AuthController.login);
router.post('/change-password', authMiddleware, AuthController.changePassword);

// ============================================
// DEPRECATED: Google OAuth (To be removed)
// ============================================

// OAuth Routes
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get(
    '/callback/google',
    passport.authenticate('google', { session: false }),
    AuthController.googleCallback
);

// Session Routes
router.get('/me', authMiddleware, AuthController.me);
router.post('/logout', authMiddleware, AuthController.logout);

export default router;
