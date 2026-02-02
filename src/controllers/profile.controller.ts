import { Request, Response } from 'express';
import User from '../models/User';
import { AuditService } from '../services/audit.service';
import { updateNameSchema } from '../validators/profile.validators';

export class ProfileController {
    /**
     * Get current user's profile
     */
    static async getProfile(req: Request, res: Response) {
        try {
            const userId = (req as any).user._id;

            const user = await User.findById(userId)
                .select('email role profile workspaceIds createdAt security')
                .lean();

            if (!user) {
                return res.status(404).json({
                    status: 'error',
                    message: 'User not found'
                });
            }

            res.status(200).json({
                status: 'success',
                data: { user }
            });
        } catch (error) {
            console.error('Get profile error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Internal server error'
            });
        }
    }

    /**
     * Update user's display name
     */
    static async updateName(req: Request, res: Response) {
        try {
            const userId = (req as any).user._id;

            // Validate input
            const validationResult = updateNameSchema.safeParse(req.body);
            if (!validationResult.success) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Validation failed',
                    errors: validationResult.error.issues
                });
            }

            const { name } = validationResult.data;

            // Update user
            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({
                    status: 'error',
                    message: 'User not found'
                });
            }

            const oldName = user.profile.name;
            user.profile.name = name;
            await user.save();

            // Audit log
            await AuditService.logAction({
                userId: String(userId),
                action: 'profile_updated',
                beforeState: { name: oldName },
                afterState: { name },
                ipAddress: req.ip || 'unknown',
                userAgent: req.headers['user-agent'] || 'unknown'
            });

            res.status(200).json({
                status: 'success',
                message: 'Name updated successfully',
                data: {
                    user: {
                        id: user._id,
                        email: user.email,
                        role: user.role,
                        profile: user.profile
                    }
                }
            });
        } catch (error) {
            console.error('Update name error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Internal server error'
            });
        }
    }
}
