import { Request, Response, NextFunction } from 'express';

type UserRole = 'super_admin' | 'admin' | 'member';

/**
 * Middleware factory to require specific role(s)
 */
export function requireRole(...allowedRoles: UserRole[]) {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = (req as any).user;

        if (!user) {
            return res.status(401).json({
                status: 'error',
                message: 'Unauthenticated'
            });
        }

        if (!allowedRoles.includes(user.role)) {
            return res.status(403).json({
                status: 'error',
                message: `Forbidden: Requires one of the following roles: ${allowedRoles.join(', ')}`
            });
        }

        next();
    };
}

/**
 * Shorthand for super admin only
 */
export const requireSuperAdmin = requireRole('super_admin');

/**
 * Shorthand for admin or super admin
 */
export const requireAdmin = requireRole('super_admin', 'admin');
