import bcrypt from 'bcrypt';
import crypto from 'crypto';

const SALT_ROUNDS = 12;

// Password complexity requirements
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;

export class PasswordUtils {
    /**
     * Hash a password using bcrypt with salt rounds >= 12
     */
    static async hashPassword(password: string): Promise<string> {
        return bcrypt.hash(password, SALT_ROUNDS);
    }

    /**
     * Compare a plain password with a bcrypt hash
     */
    static async comparePassword(password: string, hash: string): Promise<boolean> {
        return bcrypt.compare(password, hash);
    }

    /**
     * Generate a cryptographically secure temporary password
     * Format: Aa1!xxxx (ensures complexity requirements)
     */
    static generateTempPassword(): string {
        const randomBytes = crypto.randomBytes(8).toString('hex');
        // Ensure it meets complexity: uppercase, lowercase, number, special char
        return `Temp${randomBytes}!`;
    }

    /**
     * Validate password meets complexity requirements
     */
    static validatePasswordComplexity(password: string): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (password.length < PASSWORD_MIN_LENGTH) {
            errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters long`);
        }

        if (!/[a-z]/.test(password)) {
            errors.push('Password must contain at least one lowercase letter');
        }

        if (!/[A-Z]/.test(password)) {
            errors.push('Password must contain at least one uppercase letter');
        }

        if (!/\d/.test(password)) {
            errors.push('Password must contain at least one number');
        }

        if (!/[@$!%*?&]/.test(password)) {
            errors.push('Password must contain at least one special character (@$!%*?&)');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
}
