import AuditLog, { IAuditLog } from '../models/AuditLog';

export class AuditService {
    /**
     * Log an admin action with before/after state
     */
    static async logAction(params: {
        userId: string;
        action: IAuditLog['action'];
        targetUserId?: string;
        beforeState?: Record<string, any>;
        afterState?: Record<string, any>;
        metadata?: Record<string, any>;
        ipAddress: string;
        userAgent: string;
    }): Promise<void> {
        try {
            await AuditLog.create({
                userId: params.userId,
                action: params.action,
                targetUserId: params.targetUserId,
                beforeState: params.beforeState,
                afterState: params.afterState,
                metadata: params.metadata || {},
                ipAddress: params.ipAddress,
                userAgent: params.userAgent,
                timestamp: new Date()
            });
        } catch (error) {
            // Log error but don't fail the request
            console.error('Failed to create audit log:', error);
        }
    }

    /**
     * Get audit logs for a specific user action
     */
    static async getUserLogs(userId: string, limit: number = 100) {
        return AuditLog.find({ userId })
            .sort({ timestamp: -1 })
            .limit(limit)
            .populate('targetUserId', 'email profile.name')
            .lean();
    }

    /**
     * Get audit logs for actions performed on a target user
     */
    static async getTargetUserLogs(targetUserId: string, limit: number = 100) {
        return AuditLog.find({ targetUserId })
            .sort({ timestamp: -1 })
            .limit(limit)
            .populate('userId', 'email profile.name')
            .lean();
    }
}
