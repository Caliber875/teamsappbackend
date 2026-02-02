import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
    userId: mongoose.Types.ObjectId; // admin who performed action
    action: 'user_created' | 'user_updated' | 'user_deleted' | 'password_reset' | 'role_changed' | 'user_disabled' | 'user_enabled' | 'profile_updated';
    targetUserId?: mongoose.Types.ObjectId;
    metadata: Record<string, any>;
    beforeState?: Record<string, any>; // snapshot before change
    afterState?: Record<string, any>; // snapshot after change
    ipAddress: string;
    userAgent: string;
    timestamp: Date;
}

const AuditLogSchema: Schema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action: {
        type: String,
        enum: ['user_created', 'user_updated', 'user_deleted', 'password_reset', 'role_changed', 'user_disabled', 'user_enabled', 'profile_updated'],
        required: true,
        index: true
    },
    targetUserId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    beforeState: { type: Schema.Types.Mixed },
    afterState: { type: Schema.Types.Mixed },
    ipAddress: { type: String, required: true },
    userAgent: { type: String, required: true },
    timestamp: { type: Date, default: Date.now, index: true }
});

// Compound index for efficient querying
AuditLogSchema.index({ userId: 1, timestamp: -1 });
AuditLogSchema.index({ targetUserId: 1, timestamp: -1 });

export default mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
