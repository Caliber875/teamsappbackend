import { z } from 'zod';
import mongoose from 'mongoose';

const emailSchema = z.string()
    .email('Invalid email format')
    .max(255, 'Email must not exceed 255 characters')
    .toLowerCase()
    .trim();

const nameSchema = z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must not exceed 100 characters')
    .trim();

const roleSchema = z.enum(['super_admin', 'admin', 'member']);

const objectIdSchema = z.string().refine(
    (val) => mongoose.Types.ObjectId.isValid(val),
    { message: 'Invalid ObjectId format' }
);

// Create user validation
export const createUserSchema = z.object({
    email: emailSchema,
    name: nameSchema,
    role: roleSchema.default('member'),
    workspaceIds: z.array(objectIdSchema).optional().default([]),
    tempPassword: z.string().min(8).optional() // If not provided, auto-generate
});

// Update user validation
export const updateUserSchema = z.object({
    role: roleSchema.optional(),
    workspaceIds: z.array(objectIdSchema).optional(),
    disabled: z.boolean().optional(),
    resetPassword: z.boolean().optional() // If true, generate new temp password
});

// Types
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
