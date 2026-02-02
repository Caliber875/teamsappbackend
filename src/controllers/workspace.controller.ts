import { Request, Response } from 'express';
import Workspace from '../models/Workspace';
import User from '../models/User';
import { randomBytes } from 'crypto';

/**
 * PROPOSE: Create a new workspace
 */
export const createWorkspace = async (req: Request, res: Response) => {
    try {
        const { name, members = [] } = req.body;
        const userId = (req.user as any)._id;

        if (!name) {
            return res.status(400).json({ message: 'Workspace name is required' });
        }

        const inviteCode = randomBytes(4).toString('hex').toUpperCase();

        const initialMembers = [
            {
                userId: userId,
                role: 'admin',
                joinedAt: new Date()
            },
            ...members.map((memberId: string) => ({
                userId: memberId,
                role: 'member',
                joinedAt: new Date()
            }))
        ];

        const workspace = await Workspace.create({
            name,
            ownerId: userId,
            inviteCode,
            members: initialMembers
        });

        // Sync with User model (Denormalized) - Add workspaceId to owner AND all members
        const allMemberIds = [userId, ...members];
        await User.updateMany(
            { _id: { $in: allMemberIds } },
            { $addToSet: { workspaceIds: workspace._id } }
        );

        res.status(201).json(workspace);
    } catch (error) {
        console.error('Create Workspace Error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * PROPOSE: List my workspaces
 * SOURCE OF TRUTH: Workspace.members
 */
export const getMyWorkspaces = async (req: Request, res: Response) => {
    try {
        const userId = (req.user as any)._id;

        // Query by member userId - Single Source of Truth
        const workspaces = await Workspace.find({
            'members.userId': userId
        }).sort({ createdAt: -1 });

        res.json(workspaces);
    } catch (error) {
        console.error('Get Workspaces Error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
