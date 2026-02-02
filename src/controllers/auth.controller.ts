import { Request, Response, CookieOptions } from 'express';
import { AuthService } from '../services/auth.service';
import { loginSchema, changePasswordSchema } from '../validators/auth.validators';

export class AuthController {
    // ============================================
    // NEW: Email + Password Authentication
    // ============================================

    /**
     * Login with email and password
     */
    static async login(req: Request, res: Response) {
        try {
            // Validate input
            const validationResult = loginSchema.safeParse(req.body);
            if (!validationResult.success) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Validation failed',
                    errors: validationResult.error.issues
                });
            }

            const { email, password } = validationResult.data;

            // Attempt login
            const user = await AuthService.loginWithPassword(email, password);

            if (!user) {
                return res.status(401).json({
                    status: 'error',
                    message: 'Invalid credentials'
                });
            }

            // Update security logs
            await AuthService.updateLoginSecurity(
                String(user._id),
                req.ip || 'unknown',
                req.headers['user-agent'] || 'unknown'
            );

            // Generate JWT
            const token = AuthService.generateToken(user);

            // Determine cookie options based on environment
            const isProduction = process.env.NODE_ENV === 'production';
            const cookieOptions: CookieOptions = {
                httpOnly: true,
                secure: isProduction, // true in prod, false in dev
                sameSite: isProduction ? 'none' : 'lax', // 'none' for cross-site prod, 'lax' for dev
                maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
                path: '/'
            };

            // Set HTTP-Only Cookie
            res.cookie('auth_token', token, cookieOptions);

            // Check if user must change password
            const mustChangePassword = user.security.mustChangePassword || false;

            res.status(200).json({
                status: 'success',
                data: {
                    user: {
                        _id: user._id,
                        email: user.email,
                        role: user.role,
                        profile: user.profile,
                        mustChangePassword
                    }
                }
            });
        } catch (error: any) {
            console.error('Login error:', error);

            // Handle specific errors
            if (error.message.includes('Account locked')) {
                return res.status(423).json({
                    status: 'error',
                    message: error.message
                });
            }

            if (error.message.includes('Account disabled') || error.message.includes('Account not found')) {
                return res.status(403).json({
                    status: 'error',
                    message: error.message
                });
            }

            res.status(500).json({
                status: 'error',
                message: 'Internal server error during login'
            });
        }
    }

    /**
     * Change password (requires authentication)
     */
    static async changePassword(req: Request, res: Response) {
        try {
            const user = (req as any).user;

            if (!user) {
                return res.status(401).json({
                    status: 'error',
                    message: 'Unauthenticated'
                });
            }

            // Validate input
            const validationResult = changePasswordSchema.safeParse(req.body);
            if (!validationResult.success) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Validation failed',
                    errors: validationResult.error.issues
                });
            }

            const { currentPassword, newPassword } = validationResult.data;

            // Verify current password
            if (!user.passwordHash) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Password not set'
                });
            }

            const isValid = await AuthService.comparePassword(currentPassword, user.passwordHash);
            if (!isValid) {
                return res.status(401).json({
                    status: 'error',
                    message: 'Current password is incorrect'
                });
            }

            // Hash new password
            const newPasswordHash = await AuthService.hashPassword(newPassword);

            // Update password and increment tokenVersion to invalidate all sessions
            user.passwordHash = newPasswordHash;
            user.tokenVersion += 1;
            user.security.mustChangePassword = false;

            await user.save();

            // Generate new token with new tokenVersion
            const token = AuthService.generateToken(user);

            // Determine cookie options based on environment
            const isProduction = process.env.NODE_ENV === 'production';
            const cookieOptions: CookieOptions = {
                httpOnly: true,
                secure: isProduction,
                sameSite: isProduction ? 'none' : 'lax',
                maxAge: 7 * 24 * 60 * 60 * 1000,
                path: '/'
            };

            // Set new cookie
            res.cookie('auth_token', token, cookieOptions);

            res.status(200).json({
                status: 'success',
                message: 'Password changed successfully'
            });
        } catch (error) {
            console.error('Change password error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Internal server error'
            });
        }
    }

    // ============================================
    // DEPRECATED: Google OAuth (To be removed)
    // ============================================

    /**
     * Handles the final stage after successful Google OAuth authentication.
     * Passport has already found/created the user and attached it to req.user.
     */
    static async googleCallback(req: Request, res: Response) {
        try {
            const user = (req as any).user;
            if (!user) {
                return res.status(401).json({ status: 'error', message: 'Authentication failed' });
            }

            // 1. Domain Restriction Check (Security Req)
            const allowedDomain = process.env.ALLOWED_DOMAIN || 'company.com';
            if (user.authProviders.google.domain !== allowedDomain && allowedDomain !== '*') {
                return res.status(403).json({
                    status: 'error',
                    message: `Authentication restricted to ${allowedDomain} accounts.`
                });
            }

            // 2. Update security logs (IP, UA)
            await AuthService.updateLoginSecurity(
                String(user._id),
                req.ip || 'unknown',
                req.headers['user-agent'] || 'unknown'
            );

            // 3. Generate JWT
            const token = AuthService.generateToken(user);

            // 4. Set HTTP-Only Cookie (Security Req)
            const isProduction = process.env.NODE_ENV === 'production';
            const cookieOptions: CookieOptions = {
                httpOnly: true,
                secure: isProduction,
                sameSite: isProduction ? 'none' : 'lax', // 'none' for cross-site prod, 'lax' for local
                maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
                path: '/'
            };

            res.cookie('auth_token', token, cookieOptions);

            // 5. Redirect to Frontend Home
            res.redirect(process.env.CLIENT_URL || 'http://localhost:3000');
        } catch (error) {
            console.error('Post-Login Error:', error);
            res.status(500).json({ status: 'error', message: 'Internal server error during login' });
        }
    }

    /**
     * Logout
     */
    static async logout(req: Request, res: Response) {
        // Clear cookie with same options (required for some browsers)
        const isProduction = process.env.NODE_ENV === 'production';
        const cookieOptions: CookieOptions = {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax',
            path: '/'
        };

        res.clearCookie('auth_token', cookieOptions);
        res.status(200).json({ status: 'success', message: 'Logged out successfully' });
    }

    static async me(req: Request, res: Response) {
        // Current user will be attached by auth middleware
        res.status(200).json({ status: 'success', data: { user: (req as any).user } });
    }
}
