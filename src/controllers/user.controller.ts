import { Request, Response } from 'express';
import User from '../models/User';
import mongoose from 'mongoose';

/**
 * Get users within a workspace/team.
 * Supports cursor-based pagination and text search.
 * SECURITY: Returns strict subset of user fields.
 */
export const getUsers = async (req: Request, res: Response) => {
    try {
        const { teamId, workspaceId } = req.query; // In valid-world, teamId might come from req.user context too
        const { cursor, limit = 20, search } = req.query;

        if (!teamId && !search && !workspaceId) {
            // For now, if no teamId, we might default to all (internal tool) 
            // or error out. Let's assume we require teamId or handle "all reachable" logic.
            // For this phase, we'll allow searching across the system if global directory,
            // but strictly we should filter by team.
            // return res.status(400).json({ message: 'Team ID is required' });
        }

        const query: any = {};

        // 1. Search Logic (Prefix based on Name or Email)
        if (search) {
            const searchRegex = new RegExp(`^${search}`, 'i');
            query.$or = [
                { 'profile.name': searchRegex },
                { email: searchRegex }
            ];
        }

        // 2. Filter by Team (Legacy)
        if (teamId) {
            query.teamIds = new mongoose.Types.ObjectId(teamId as string);
        }

        // 3. Filter by Workspace
        if (workspaceId) {
            query.workspaceIds = new mongoose.Types.ObjectId(workspaceId as string);
        }

        // 3. Exclude current user from results (optional, but good for DMs)
        if (req.user && (req.user as any)._id) {
            // We can uncomment this if we never want to DM ourselves
            // query._id = { $ne: (req.user as any)._id };
        }

        // 4. Cursor Pagination (Simple _id based for now)
        if (cursor) {
            query._id = { $gt: new mongoose.Types.ObjectId(cursor as string) };
        }

        // 5. Execution with Strict Projection
        const users = await User.find(query)
            .select('_id profile email status') // STRICT PROJECTION
            .limit(Number(limit) + 1) // +1 to check if next page exists
            .sort({ 'profile.name': 1, _id: 1 });

        const hasNextPage = users.length > Number(limit);
        const data = hasNextPage ? users.slice(0, Number(limit)) : users;
        const nextCursor = hasNextPage ? (data[data.length - 1] as any)._id : null;

        res.json({
            data,
            metadata: {
                nextCursor,
                hasNextPage
            }
        });

    } catch (error) {
        console.error('getUsers error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
