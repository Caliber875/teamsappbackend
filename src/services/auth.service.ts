import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/User';
import { PasswordUtils } from '../utils/password.utils';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-dev';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export class AuthService {
    static generateToken(user: IUser): string {
        const payload = {
            id: user._id,
            email: user.email,
            role: user.role, // NEW: single role
            tokenVersion: user.tokenVersion, // NEW: for JWT invalidation
            // DEPRECATED: keeping for backward compatibility during migration
            roles: user.roles || [user.role],
        };

        return jwt.sign(payload, JWT_SECRET as string, {
            expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
        });
    }

    static verifyToken(token: string): any {
        try {
            return jwt.verify(token, JWT_SECRET);
        } catch (error) {
            return null;
        }
    }

    // ============================================
    // NEW: Email + Password Authentication
    // ============================================

    /**
     * Hash a password using bcrypt
     */
    static async hashPassword(password: string): Promise<string> {
        return PasswordUtils.hashPassword(password);
    }

    /**
     * Compare password with hash
     */
    static async comparePassword(password: string, hash: string): Promise<boolean> {
        return PasswordUtils.comparePassword(password, hash);
    }

    /**
     * Generate a secure temporary password
     */
    static generateTempPassword(): string {
        return PasswordUtils.generateTempPassword();
    }

    /**
     * Login with email and password
     * Returns user if credentials valid, null if invalid, throws if account locked/disabled
     */
    static async loginWithPassword(email: string, password: string): Promise<IUser | null> {
        const user = await User.findOne({ email: email.toLowerCase() });

        if (!user) {
            return null; // User not found
        }

        // Check if account is deleted
        if (user.deletedAt) {
            throw new Error('Account not found');
        }

        // Check if account is disabled
        if (user.disabled) {
            throw new Error('Account disabled');
        }

        // Check if account is locked
        if (user.security.lockUntil && user.security.lockUntil > new Date()) {
            const remainingMs = user.security.lockUntil.getTime() - Date.now();
            const remainingMins = Math.ceil(remainingMs / 60000);
            throw new Error(`Account locked. Try again in ${remainingMins} minutes.`);
        }

        // Check if password exists
        if (!user.passwordHash) {
            throw new Error('Password not set. Contact administrator.');
        }

        // Verify password
        const isValid = await this.comparePassword(password, user.passwordHash);

        if (!isValid) {
            // Increment failed attempts
            user.security.failedAttempts += 1;

            // Lock account after 5 failures
            if (user.security.failedAttempts >= 5) {
                user.security.lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
            }

            await user.save();
            return null; // Invalid password
        }

        // Reset failed attempts on successful login
        user.security.failedAttempts = 0;
        user.security.lockUntil = undefined;
        await user.save();

        return user;
    }

    // ============================================
    // DEPRECATED: Google OAuth (To be removed)
    // ============================================

    static async findOrCreateGoogleUser(googleProfile: {
        id: string;
        email: string;
        name: string;
        avatarUrl: string;
        domain: string;
    }): Promise<IUser> {
        let user = await User.findOne({ email: googleProfile.email });

        if (user) {
            // Update existing user with Google ID and latest info if not present
            if (!user.authProviders) {
                user.authProviders = {};
            }
            user.authProviders.google = {
                id: googleProfile.id,
                email: googleProfile.email,
                domain: googleProfile.domain,
            };
            user.profile.avatarUrl = googleProfile.avatarUrl;
            await user.save();
        } else {
            // Create new user
            user = await User.create({
                email: googleProfile.email,
                emailVerified: true,
                authProviders: {
                    google: {
                        id: googleProfile.id,
                        email: googleProfile.email,
                        domain: googleProfile.domain,
                    },
                },
                profile: {
                    name: googleProfile.name,
                    avatarUrl: googleProfile.avatarUrl,
                    timezone: 'UTC', // Default
                    status: 'online',
                },
                roles: ['member'], // Default role
            });
        }

        return user;
    }

    static async updateLoginSecurity(userId: string, ip: string, userAgent: string): Promise<void> {
        await User.findByIdAndUpdate(userId, {
            $set: {
                'security.lastLoginAt': new Date(),
                'security.lastIp': ip,
                'security.failedAttempts': 0,
                'security.lockUntil': null,
            },
            $push: {
                'security.loginHistory': {
                    $each: [{ timestamp: new Date(), ip, userAgent }],
                    $slice: -10, // Keep last 10 logins
                },
            },
        });
    }
}
