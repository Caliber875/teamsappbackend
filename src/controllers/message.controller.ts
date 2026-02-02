import { Request, Response } from 'express';
import Message from '../models/Message';
import Channel from '../models/Channel';
import Workspace from '../models/Workspace';
import mongoose from 'mongoose';
import SocketService from '../services/socket.service';

/**
 * SEND MESSAGE
 * Invariants:
 * 1. User must be in Workspace.members
 * 2. User must be in Channel.members
 * 3. Channel must belong to Workspace
 * 4. Message must have workspaceId
 */
export const sendMessage = async (req: Request, res: Response) => {
    try {
        const { channelId } = req.params;
        const { content, type = 'text', attachments, taskData } = req.body;
        const userId = (req.user as any)._id;

        // DEBUG: Log what we receive
        console.log('='.repeat(50));
        console.log('📨 Received sendMessage request:');
        console.log('Raw attachments type:', typeof attachments);
        console.log('Raw attachments value:', JSON.stringify(attachments, null, 2));
        console.log('='.repeat(50));

        // 1. Fetch Channel to get workspaceId
        const channel = await Channel.findById(channelId);
        if (!channel) {
            return res.status(404).json({ message: 'Channel not found' });
        }

        const workspaceId = channel.workspaceId;

        // 2. Validate Workspace Membership (Source of Truth)
        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) {
            return res.status(404).json({ message: 'Workspace not found' });
        }

        const isWorkspaceMember = workspace.members.some(m => m.userId.toString() === userId.toString());
        if (!isWorkspaceMember) {
            return res.status(403).json({ message: 'Not a member of this workspace' });
        }

        // 3. Validate Channel Membership
        // For DMs, this is critical. For Public channels, maybe not if we allow open join, but let's be strict for now.
        const isChannelMember = channel.members.some(m => m.toString() === userId.toString());
        if (!isChannelMember) {
            return res.status(403).json({ message: 'Not a member of this channel' });
        }

        // 4. Parse attachments if stringified (defensive programming)
        let parsedAttachments: any = attachments;

        if (attachments) {
            // If it's a string, try to parse it
            if (typeof attachments === 'string') {
                console.log('⚠️  Attachments is a string, attempting to parse...');
                try {
                    parsedAttachments = JSON.parse(attachments);
                    console.log('✅ Successfully parsed attachments:', parsedAttachments);
                } catch (e) {
                    console.error('❌ Failed to parse attachments:', e);
                    parsedAttachments = [];
                }
            }

            // Ensure it's an array
            if (!Array.isArray(parsedAttachments)) {
                console.log('⚠️  Parsed attachments is not an array, wrapping...');
                parsedAttachments = [parsedAttachments];
            }
        } else {
            parsedAttachments = undefined;
        }

        console.log('📎 Final attachments to save:', JSON.stringify(parsedAttachments, null, 2));

        // 5. Create Message
        const message = await Message.create({
            workspaceId,
            channelId,
            senderId: userId,
            content,
            type,
            attachments: parsedAttachments,
            ...(type === 'task' && taskData && { taskData }),
            ...(req.body.replyTo && { replyTo: req.body.replyTo }) // Handle Reply
        });

        // 6. Populate Sender details and task assignees for frontend
        await message.populate('senderId', 'profile email');
        if (type === 'task') {
            await message.populate('taskData.assignees', 'profile.name profile.avatarUrl');
        }
        if (req.body.replyTo) {
            await message.populate({
                path: 'replyTo',
                select: 'content senderId',
                populate: {
                    path: 'senderId',
                    select: 'profile.name'
                }
            });
        }

        // 7. Emit Realtime Event
        if (SocketService.io) {
            SocketService.io.to(`channel:${channelId}`).emit('message:new', message);
        }

        res.status(201).json(message);
    } catch (error) {
        console.error('Send Message Error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * EDIT MESSAGE
 */
export const editMessage = async (req: Request, res: Response) => {
    try {
        const { messageId } = req.params;
        const { content } = req.body;
        const userId = (req.user as any)._id;

        const message = await Message.findById(messageId);
        if (!message) return res.status(404).json({ message: 'Message not found' });

        if (message.senderId.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'Not authorized to edit this message' });
        }

        if (message.isDeleted) {
            return res.status(400).json({ message: 'Cannot edit a deleted message' });
        }

        message.content = content;
        message.editedAt = new Date();
        await message.save();

        // Populate for consistency
        await message.populate('senderId', 'profile email');
        await message.populate({
            path: 'replyTo',
            select: 'content senderId',
            populate: {
                path: 'senderId',
                select: 'profile.name'
            }
        }); // Just in case it's a reply

        if (SocketService.io) {
            const room = message.channelId ? `channel:${message.channelId}` : `dm:${message.directMessageId}`;
            SocketService.io.to(room).emit('message:updated', message);
        }

        res.json(message);
    } catch (error) {
        console.error('Edit Message Error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * DELETE MESSAGE (Soft Delete)
 */
export const deleteMessage = async (req: Request, res: Response) => {
    try {
        const { messageId } = req.params;
        const userId = (req.user as any)._id;

        const message = await Message.findById(messageId);
        if (!message) return res.status(404).json({ message: 'Message not found' });

        if (message.senderId.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'Not authorized to delete this message' });
        }

        message.isDeleted = true;
        message.content = ''; // Clear content for protection
        message.attachments = [];
        await message.save();

        if (SocketService.io) {
            const room = message.channelId ? `channel:${message.channelId}` : `dm:${message.directMessageId}`;
            SocketService.io.to(room).emit('message:updated', message);
        }

        res.json({ success: true, message });
    } catch (error) {
        console.error('Delete Message Error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * TOGGLE REACTION
 */
export const toggleReaction = async (req: Request, res: Response) => {
    try {
        const { messageId } = req.params;
        const { emoji } = req.body; // e.g., "👍"
        const userId = (req.user as any)._id;

        const message = await Message.findById(messageId);
        if (!message) return res.status(404).json({ message: 'Message not found' });

        const existingReactionIndex = message.reactions.findIndex(
            r => r.userId.toString() === userId.toString() && r.emoji === emoji
        );

        if (existingReactionIndex > -1) {
            // Remove reaction
            message.reactions.splice(existingReactionIndex, 1);
        } else {
            // Add reaction
            message.reactions.push({
                emoji,
                userId,
                createdAt: new Date()
            });
        }

        await message.save();

        if (SocketService.io) {
            const room = message.channelId ? `channel:${message.channelId}` : `dm:${message.directMessageId}`;
            SocketService.io.to(room).emit('message:updated', message);
        }

        res.json(message);
    } catch (error) {
        console.error('Toggle Reaction Error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * GET MESSAGES
 * Pagination: Cursor-based (beforeId)
 */
export const getMessages = async (req: Request, res: Response) => {
    try {
        const { channelId } = req.params;
        const { cursor, limit = '30', type, taskStatus } = req.query;
        const userId = (req.user as any)._id;

        // Security: Check channel/workspace access
        const channel = await Channel.findById(channelId);
        if (!channel) {
            return res.status(404).json({ message: 'Channel not found' });
        }

        // Validate Workspace Membership
        const workspace = await Workspace.findById(channel.workspaceId);
        if (!workspace || !workspace.members.some(m => m.userId.toString() === userId.toString())) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Validate Channel Membership
        if (!channel.members.some(m => m.toString() === userId.toString())) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const limitNum = Math.min(parseInt(limit as string) || 30, 50); // Hard limit 50

        const query: any = {
            channelId,
            workspaceId: channel.workspaceId // Strict Scoping
        };

        // Filter by Type
        if (type) {
            query.type = type;
        }

        // Filter by Task Status (if type is task)
        if (taskStatus && type === 'task') {
            const statuses = (taskStatus as string).split(',');
            query['taskData.status'] = { $in: statuses };
        }

        if (cursor) {
            // Find messages created BEFORE the cursor message
            // or simply use _id < cursor if using ObjectIds which are time-ordered
            query._id = { $lt: cursor };
        }

        const messages = await Message.find(query)
            .sort({ createdAt: -1 }) // Newest first
            .limit(limitNum)
            .populate('senderId', 'profile email')
            .populate('taskData.assignees', 'profile.name profile.avatarUrl')
            .populate({
                path: 'replyTo',
                select: 'content senderId',
                populate: {
                    path: 'senderId',
                    select: 'profile.name'
                }
            }) // Populate parent message for replies
            .populate('reactions.userId', 'profile.name'); // Populate reactors

        res.json(messages.reverse()); // Return properly time-ordered (Oldest -> Newest) for UI
    } catch (error) {
        console.error('Get Messages Error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
