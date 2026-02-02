import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import User from '../models/User';

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Check both cookie AND Authorization header for token
        // Cookie: for same-origin requests (legacy and socket)
        // Header: for cross-origin requests from Next.js frontend
        let token = req.cookies?.auth_token;

        if (!token) {
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.substring(7); // Remove 'Bearer ' prefix
            }
        }

        if (!token) {
            return res.status(401).json({ status: 'error', message: 'Unauthenticated' });
        }

        const decoded = AuthService.verifyToken(token);
        if (!decoded || !decoded.id) {
            return res.status(401).json({ status: 'error', message: 'Invalid token' });
        }

        // Fetch user from database
        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(401).json({ status: 'error', message: 'User not found' });
        }

        // NEW: Check if user is deleted
        if (user.deletedAt) {
            return res.status(403).json({
                status: 'error',
                message: 'Account not found'
            });
        }

        // NEW: Check if user is disabled
        if (user.disabled) {
            return res.status(403).json({
                status: 'error',
                message: 'Account disabled'
            });
        }

        // NEW: Validate tokenVersion (JWT invalidation mechanism)
        if (decoded.tokenVersion !== undefined && decoded.tokenVersion !== user.tokenVersion) {
            return res.status(401).json({
                status: 'error',
                message: 'Token invalidated. Please login again.'
            });
        }

        // Attach full user object to request
        (req as any).user = user;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
};

// DEPRECATED: Old role middleware (replaced by RBAC middleware)
export const requireRole = (roles: ('admin' | 'member')[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = (req as any).user;

        if (!user) {
            return res.status(401).json({ status: 'error', message: 'Authentication required' });
        }

        const hasRole = user.roles?.some((role: any) => roles.includes(role));
        if (!hasRole) {
            return res.status(403).json({ status: 'error', message: 'Insufficient permissions' });
        }

        next();
    };
};
