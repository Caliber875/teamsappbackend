import { Request, Response } from 'express';
import User from '../models/User';
import Workspace from '../models/Workspace';
import { AuthService } from '../services/auth.service';
import { AuditService } from '../services/audit.service';
import { createUserSchema, updateUserSchema } from '../validators/admin.validators';

export class AdminController {
    /**
     * Create a new user (admin/super_admin only)
     */
    static async createUser(req: Request, res: Response) {
        try {
            const currentUser = (req as any).user;

            // Validate input
            const validationResult = createUserSchema.safeParse(req.body);
            if (!validationResult.success) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Validation failed',
                    errors: validationResult.error.issues
                });
            }

            const { email, name, role, workspaceIds, tempPassword } = validationResult.data;

            // Check if user already exists
            const existingUser = await User.findOne({ email: email.toLowerCase() });
            if (existingUser) {
                return res.status(409).json({
                    status: 'error',
                    message: 'User with this email already exists'
                });
            }

            // Generate or use provided temp password
            const password = tempPassword || AuthService.generateTempPassword();

            // Hash password
            const passwordHash = await AuthService.hashPassword(password);

            // Create user
            const newUser = await User.create({
                email: email.toLowerCase(),
                passwordHash,
                role,
                tokenVersion: 0,
                disabled: false,
                deletedAt: null,
                emailVerified: false,
                profile: {
                    name,
                    timezone: 'UTC',
                    status: 'offline'
                },
                workspaceIds: workspaceIds || [],
                security: {
                    failedAttempts: 0,
                    loginHistory: [],
                    mustChangePassword: true // Force password change on first login
                }
            });

            // SYNC: Add user to workspace members if workspaces assigned
            if (workspaceIds && workspaceIds.length > 0) {
                await Workspace.updateMany(
                    { _id: { $in: workspaceIds } },
                    {
                        $addToSet: {
                            members: {
                                userId: newUser._id,
                                role: 'member',
                                joinedAt: new Date()
                            }
                        }
                    }
                );
            }

            // Audit log
            await AuditService.logAction({
                userId: String(currentUser._id),
                action: 'user_created',
                targetUserId: String(newUser._id),
                afterState: {
                    email: newUser.email,
                    role: newUser.role,
                    workspaceIds: newUser.workspaceIds
                },
                ipAddress: req.ip || 'unknown',
                userAgent: req.headers['user-agent'] || 'unknown'
            });

            res.status(201).json({
                status: 'success',
                data: {
                    user: {
                        _id: newUser._id,
                        email: newUser.email,
                        role: newUser.role,
                        profile: newUser.profile,
                        workspaceIds: newUser.workspaceIds
                    },
                    tempPassword: password // Return temp password to admin
                }
            });
        } catch (error) {
            console.error('Create user error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Internal server error'
            });
        }
    }

    /**
     * Update user (role, workspaces, disable/enable)
     */
    static async updateUser(req: Request, res: Response) {
        try {
            const currentUser = (req as any).user;
            const { userId } = req.params;

            // Validate input
            const validationResult = updateUserSchema.safeParse(req.body);
            if (!validationResult.success) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Validation failed',
                    errors: validationResult.error.issues
                });
            }

            const updates = validationResult.data;

            // Find target user
            const targetUser = await User.findById(userId);
            if (!targetUser || targetUser.deletedAt) {
                return res.status(404).json({
                    status: 'error',
                    message: 'User not found'
                });
            }

            // Capture before state
            const beforeState: any = {};
            if (updates.role !== undefined) beforeState.role = targetUser.role;
            if (updates.disabled !== undefined) beforeState.disabled = targetUser.disabled;
            if (updates.workspaceIds !== undefined) beforeState.workspaceIds = targetUser.workspaceIds;

            // Super admin safety lock: prevent deleting/demoting last super_admin
            if (targetUser.role === 'super_admin' && updates.role && updates.role !== 'super_admin') {
                const superAdminCount = await User.countDocuments({
                    role: 'super_admin',
                    disabled: false,
                    deletedAt: null
                });

                if (superAdminCount === 1) {
                    return res.status(400).json({
                        status: 'error',
                        message: 'Cannot demote the last super_admin'
                    });
                }
            }

            // Apply updates
            if (updates.role) {
                targetUser.role = updates.role;
                targetUser.tokenVersion += 1; // Invalidate sessions on role change
            }

            if (updates.workspaceIds !== undefined) {
                const oldWorkspaceIds = targetUser.workspaceIds.map(id => String(id));
                const newWorkspaceIds = updates.workspaceIds.map(id => String(id));

                targetUser.workspaceIds = updates.workspaceIds.map(id => id as any);

                // SYNC: Find workspaces to add and remove
                const workspacesToAdd = newWorkspaceIds.filter(id => !oldWorkspaceIds.includes(id));
                const workspacesToRemove = oldWorkspaceIds.filter(id => !newWorkspaceIds.includes(id));

                // Add user to new workspaces
                if (workspacesToAdd.length > 0) {
                    await Workspace.updateMany(
                        { _id: { $in: workspacesToAdd } },
                        {
                            $addToSet: {
                                members: {
                                    userId: targetUser._id,
                                    role: 'member',
                                    joinedAt: new Date()
                                }
                            }
                        }
                    );
                }

                // Remove user from removed workspaces
                if (workspacesToRemove.length > 0) {
                    await Workspace.updateMany(
                        { _id: { $in: workspacesToRemove } },
                        {
                            $pull: {
                                members: { userId: targetUser._id }
                            }
                        }
                    );
                }
            }

            if (updates.disabled !== undefined) {
                targetUser.disabled = updates.disabled;
                if (updates.disabled) {
                    targetUser.tokenVersion += 1; // Invalidate sessions when disabling
                }
            }

            if (updates.resetPassword) {
                const newTempPassword = AuthService.generateTempPassword();
                targetUser.passwordHash = await AuthService.hashPassword(newTempPassword);
                targetUser.security.mustChangePassword = true;
                targetUser.tokenVersion += 1;

                await targetUser.save();

                // Audit log for password reset
                await AuditService.logAction({
                    userId: String(currentUser._id),
                    action: 'password_reset',
                    targetUserId: String(targetUser._id),
                    ipAddress: req.ip || 'unknown',
                    userAgent: req.headers['user-agent'] || 'unknown'
                });

                return res.status(200).json({
                    status: 'success',
                    message: 'Password reset successfully',
                    data: {
                        tempPassword: newTempPassword
                    }
                });
            }

            await targetUser.save();

            // Capture after state
            const afterState: any = {};
            if (updates.role !== undefined) afterState.role = targetUser.role;
            if (updates.disabled !== undefined) afterState.disabled = targetUser.disabled;
            if (updates.workspaceIds !== undefined) afterState.workspaceIds = targetUser.workspaceIds;

            // Audit log
            const action = updates.role ? 'role_changed' :
                updates.disabled !== undefined ?
                    (updates.disabled ? 'user_disabled' : 'user_enabled') :
                    'user_updated';

            await AuditService.logAction({
                userId: String(currentUser._id),
                action,
                targetUserId: String(targetUser._id),
                beforeState,
                afterState,
                ipAddress: req.ip || 'unknown',
                userAgent: req.headers['user-agent'] || 'unknown'
            });

            res.status(200).json({
                status: 'success',
                data: {
                    user: {
                        _id: targetUser._id,
                        email: targetUser.email,
                        role: targetUser.role,
                        disabled: targetUser.disabled,
                        workspaceIds: targetUser.workspaceIds
                    }
                }
            });
        } catch (error) {
            console.error('Update user error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Internal server error'
            });
        }
    }

    /**
     * Delete user (soft delete)
     */
    static async deleteUser(req: Request, res: Response) {
        try {
            const currentUser = (req as any).user;
            const { userId } = req.params;

            // Find target user
            const targetUser = await User.findById(userId);
            if (!targetUser || targetUser.deletedAt) {
                return res.status(404).json({
                    status: 'error',
                    message: 'User not found'
                });
            }

            // Super admin safety lock
            if (targetUser.role === 'super_admin') {
                const superAdminCount = await User.countDocuments({
                    role: 'super_admin',
                    disabled: false,
                    deletedAt: null
                });

                if (superAdminCount === 1) {
                    return res.status(400).json({
                        status: 'error',
                        message: 'Cannot delete the last super_admin'
                    });
                }
            }

            // Soft delete
            targetUser.deletedAt = new Date();
            targetUser.disabled = true;
            targetUser.tokenVersion += 1; // Invalidate all sessions
            await targetUser.save();

            // SYNC: Remove user from all workspaces
            await Workspace.updateMany(
                { 'members.userId': targetUser._id },
                {
                    $pull: {
                        members: { userId: targetUser._id }
                    }
                }
            );

            // Audit log
            await AuditService.logAction({
                userId: String(currentUser._id),
                action: 'user_deleted',
                targetUserId: String(targetUser._id),
                beforeState: {
                    email: targetUser.email,
                    role: targetUser.role
                },
                ipAddress: req.ip || 'unknown',
                userAgent: req.headers['user-agent'] || 'unknown'
            });

            res.status(200).json({
                status: 'success',
                message: 'User deleted successfully'
            });
        } catch (error) {
            console.error('Delete user error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Internal server error'
            });
        }
    }

    /**
     * List all users (with filtering)
     */
    static async listUsers(req: Request, res: Response) {
        try {
            const { role, disabled, page = '1', limit = '50' } = req.query;

            const query: any = { deletedAt: null };
            if (role) query.role = role;
            if (disabled !== undefined) query.disabled = disabled === 'true';

            const pageNum = parseInt(page as string, 10);
            const limitNum = parseInt(limit as string, 10);
            const skip = (pageNum - 1) * limitNum;

            const [users, total] = await Promise.all([
                User.find(query)
                    .select('_id email role disabled profile workspaceIds createdAt')
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limitNum)
                    .lean(),
                User.countDocuments(query)
            ]);

            res.status(200).json({
                status: 'success',
                data: {
                    users,
                    pagination: {
                        page: pageNum,
                        limit: limitNum,
                        total,
                        pages: Math.ceil(total / limitNum)
                    }
                }
            });
        } catch (error) {
            console.error('List users error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Internal server error'
            });
        }
    }
}
