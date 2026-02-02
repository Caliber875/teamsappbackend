import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
    email: string;
    emailVerified: boolean;

    // New: Email + Password Auth
    passwordHash?: string; // bcrypt hash
    role: 'super_admin' | 'admin' | 'member'; // single role
    tokenVersion: number; // JWT invalidation mechanism
    disabled: boolean; // account disabled flag
    deletedAt: Date | null; // soft delete

    // DEPRECATED: To be removed after migration
    authProviders?: {
        google?: {
            id: string;
            email: string;
            domain: string;
        };
        password?: {
            hash: string;
            updatedAt: Date;
        };
    };

    profile: {
        name: string;
        avatarUrl?: string;
        timezone: string;
        status: 'online' | 'busy' | 'offline' | 'away';
    };

    // DEPRECATED: Old multi-role system
    roles?: ('admin' | 'member')[];

    workspaceIds: mongoose.Types.ObjectId[];
    security: {
        lastLoginAt?: Date;
        lastIp?: string;
        loginHistory: {
            timestamp: Date;
            ip: string;
            userAgent: string;
        }[];
        failedAttempts: number;
        lockUntil?: Date;
        mustChangePassword?: boolean; // for temp passwords
    };
    createdAt: Date;
    updatedAt: Date;
}

const UserSchema: Schema = new Schema(
    {
        email: { type: String, required: true, unique: true, index: true },
        emailVerified: { type: Boolean, default: false },

        // New: Email + Password Auth
        passwordHash: { type: String }, // nullable during migration
        role: {
            type: String,
            enum: ['super_admin', 'admin', 'member'],
            default: 'member',
            required: true,
            index: true
        },
        tokenVersion: { type: Number, default: 0, required: true },
        disabled: { type: Boolean, default: false, index: true },
        deletedAt: { type: Date, default: null, index: true },

        // DEPRECATED: To be removed after migration
        authProviders: {
            google: {
                id: { type: String, index: true },
                email: String,
                domain: String,
            },
            password: {
                hash: String,
                updatedAt: Date,
            },
        },

        profile: {
            name: { type: String, required: true },
            avatarUrl: String,
            timezone: { type: String, default: 'UTC' },
            status: {
                type: String,
                enum: ['online', 'busy', 'offline', 'away'],
                default: 'offline',
            },
        },

        // DEPRECATED: Old multi-role system
        roles: [{ type: String, enum: ['admin', 'member'] }],

        workspaceIds: [{ type: Schema.Types.ObjectId, ref: 'Workspace', index: true }],
        security: {
            lastLoginAt: Date,
            lastIp: String,
            loginHistory: [
                {
                    timestamp: Date,
                    ip: String,
                    userAgent: String,
                },
            ],
            failedAttempts: { type: Number, default: 0 },
            lockUntil: Date,
            mustChangePassword: { type: Boolean, default: false },
        },
    },
    { timestamps: true }
);

export default mongoose.model<IUser>('User', UserSchema);
