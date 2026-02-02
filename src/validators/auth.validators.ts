import { z } from 'zod';

// Email validation
const emailSchema = z.string()
    .email('Invalid email format')
    .max(255, 'Email must not exceed 255 characters')
    .toLowerCase()
    .trim();

// Password validation with complexity requirements
const passwordSchema = z.string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/\d/, 'Password must contain at least one number')
    .regex(/[@$!%*?&]/, 'Password must contain at least one special character (@$!%*?&)');

// Login request validation
export const loginSchema = z.object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required') // Don't validate complexity on login
});

// Change password request validation
export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema
});

// Name validation (for user creation)
const nameSchema = z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must not exceed 100 characters')
    .trim();

// Types
export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
