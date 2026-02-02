import { Request, Response } from 'express';
import DMService from '../services/dm.service';
import Message from '../models/Message';
import Workspace from '../models/Workspace';
import mongoose from 'mongoose';
import SocketService from '../services/socket.service';

/**
 * CREATE OR GET DM
 * Creates a new DM or returns existing one between current user and another user
 */
export const createOrGetDM = async (req: Request, res: Response) => {
    console.log('🔵 [DM API] createOrGetDM called');
    try {
        const { otherUserId, workspaceId } = req.body;
        const currentUserId = (req.user as any)._id.toString();

        console.log('🔵 [DM API] Request data:', {
            currentUserId,
            otherUserId,
            workspaceId
        });

        // Validate required fields
        if (!otherUserId) {
            console.error('❌ [DM API] Missing otherUserId');
            return res.status(400).json({ message: 'otherUserId is required' });
        }

        if (!workspaceId) {
            console.error('❌ [DM API] Missing workspaceId');
            return res.status(400).json({ message: 'workspaceId is required' });
        }

        console.log('🔵 [DM API] Fetching workspace:', workspaceId);
        // Verify both users are in the workspace
        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) {
            console.error('❌ [DM API] Workspace not found:', workspaceId);
            return res.status(404).json({ message: 'Workspace not found' });
        }

        console.log('✅ [DM API] Workspace found:', workspace.name);

        const isCurrentUserMember = workspace.members.some(
            m => m.userId.toString() === currentUserId
        );
        const isOtherUserMember = workspace.members.some(
            m => m.userId.toString() === otherUserId
        );

        console.log('🔵 [DM API] Membership check:', {
            isCurrentUserMember,
            isOtherUserMember
        });

        if (!isCurrentUserMember || !isOtherUserMember) {
            console.error('❌ [DM API] Users not in workspace');
            return res.status(403).json({
                message: 'Both users must be members of the workspace'
            });
        }

        console.log('🔵 [DM API] Calling DMService.createOrGetDM');
        // Create or get DM
        const dm = await DMService.createOrGetDM(currentUserId, otherUserId);

        console.log('✅ [DM API] DM created/retrieved:', dm._id);

        res.status(200).json({ dm });
    } catch (error: any) {
        console.error('❌ [DM API] Error in createOrGetDM:', error);
        res.status(500).json({ message: error.message || 'Internal server error' });
    }
};

/**
 * GET USER'S DMS
 * Returns all Direct Messages for the current user
 */
export const getUserDMs = async (req: Request, res: Response) => {
    try {
        const userId = (req.user as any)._id.toString();

        const dms = await DMService.getUserDMs(userId);

        // Format response with other participant info
        const formattedDMs = dms.map(dm => {
            const otherParticipant = dm.participants.find(
                p => p.userId._id.toString() !== userId
            );

            return {
                _id: dm._id,
                otherUser: otherParticipant?.userId,
                lastMessage: dm.lastMessage,
                unreadCount: dm.participants.find(p => p.userId._id.toString() === userId)?.unreadCount || 0,
                lastReadAt: dm.participants.find(p => p.userId._id.toString() === userId)?.lastReadAt,
                updatedAt: dm.updatedAt
            };
        });

        res.status(200).json({ dms: formattedDMs });
    } catch (error: any) {
        console.error('Get user DMs error:', error);
        res.status(500).json({ message: error.message || 'Internal server error' });
    }
};

/**
 * GET SINGLE DM
 * Returns a single Direct Message by ID with participant verification
 */
export const getDM = async (req: Request, res: Response) => {
    console.log('🔵 [DM API] getDM called');
    try {
        const { dmId } = req.params;
        const dmIdString: string = dmId as string; // Explicitly type as string
        const userId = (req.user as any)._id.toString();

        console.log('🔵 [DM API] Fetching DM:', { dmId: dmIdString, userId });

        // Fetch DM
        const dm = await DMService.getDMById(dmIdString);

        if (!dm) {
            console.error('❌ [DM API] DM not found:', dmIdString);
            return res.status(404).json({ message: 'Direct message not found' });
        }

        // Verify user is a participant
        const isParticipant = await DMService.isParticipant(dmIdString, userId);
        if (!isParticipant) {
            console.error('❌ [DM API] User not a participant:', { userId, dmId });
            return res.status(403).json({ message: 'Access denied' });
        }

        console.log('✅ [DM API] DM fetched successfully');

        // Format response with other participant info
        const otherParticipant = dm.participants.find(
            p => p.userId._id.toString() !== userId
        );

        const formattedDM = {
            _id: dm._id,
            participants: dm.participants,
            otherUser: otherParticipant?.userId,
            lastMessage: dm.lastMessage,
            unreadCount: dm.participants.find(p => p.userId._id.toString() === userId)?.unreadCount || 0,
            lastReadAt: dm.participants.find(p => p.userId._id.toString() === userId)?.lastReadAt,
            createdAt: dm.createdAt,
            updatedAt: dm.updatedAt
        };

        res.status(200).json({ dm: formattedDM });
    } catch (error: any) {
        console.error('❌ [DM API] Error in getDM:', error);
        res.status(500).json({ message: error.message || 'Internal server error' });
    }
};

/**
 * GET DM MESSAGES
 * Returns messages for a specific DM with pagination
 */
export const getDMMessages = async (req: Request, res: Response) => {
    try {
        const dmId = req.params.dmId as string;
        const cursor = req.query.cursor as string | undefined;
        const limit = req.query.limit as string || '30';
        const userId = (req.user as any)._id.toString();

        // Verify user is a participant
        const isParticipant = await DMService.isParticipant(dmId, userId);
        if (!isParticipant) {
            return res.status(403).json({ message: 'Access denied: not a participant' });
        }

        // Build query
        const query: any = { directMessageId: dmId };
        if (cursor) {
            query.createdAt = { $lt: new Date(cursor) };
        }

        // Fetch messages
        const messages = await Message.find(query)
            .populate('senderId', 'profile.name profile.avatarUrl')
            .populate({
                path: 'replyTo',
                select: 'content senderId',
                populate: {
                    path: 'senderId',
                    select: 'profile.name'
                }
            })
            .sort({ createdAt: -1 })
            .limit(parseInt(limit as string));

        const nextCursor = messages.length > 0
            ? messages[messages.length - 1].createdAt.toISOString()
            : null;

        res.status(200).json({
            messages: messages.reverse(), // Return in ascending order (oldest first)
            nextCursor
        });
    } catch (error: any) {
        console.error('Get DM messages error:', error);
        res.status(500).json({ message: error.message || 'Internal server error' });
    }
};

/**
 * SEND DM MESSAGE
 * Sends a message in a DM
 */
export const sendDMMessage = async (req: Request, res: Response) => {
    try {
        const dmId = req.params.dmId as string;
        const { content, type = 'text', attachments, replyTo } = req.body; // Added replyTo
        const userId = (req.user as any)._id;

        // Verify user is a participant
        const isParticipant = await DMService.isParticipant(dmId, userId.toString());
        if (!isParticipant) {
            return res.status(403).json({ message: 'Access denied: not a participant' });
        }

        // Get DM to find workspace (DMs need workspaceId for consistency)
        // For DMs we'll use the first workspace both users share
        // For simplicity, we can store workspaceId with DM or infer from context
        // Let's get workspace from request body for now
        const { workspaceId } = req.body;
        if (!workspaceId) {
            return res.status(400).json({ message: 'workspaceId is required' });
        }

        // Parse attachments if stringified
        let parsedAttachments: any = attachments;
        if (attachments && typeof attachments === 'string') {
            try {
                parsedAttachments = JSON.parse(attachments);
            } catch (e) {
                console.warn('Failed to parse attachments:', e);
            }
        }

        // Ensure attachments is an array
        if (parsedAttachments && !Array.isArray(parsedAttachments)) {
            parsedAttachments = [parsedAttachments];
        }

        // Create message
        const message = await Message.create({
            directMessageId: new mongoose.Types.ObjectId(dmId),
            workspaceId: new mongoose.Types.ObjectId(workspaceId),
            senderId: userId,
            content,
            type,
            attachments: parsedAttachments,
            ...(replyTo && { replyTo }) // Added replyTo to creation
        });

        // Populate sender info
        await message.populate('senderId', 'profile.name profile.avatarUrl');

        // Populate replyTo if exists
        if (replyTo) {
            await message.populate({
                path: 'replyTo',
                select: 'content senderId',
                populate: {
                    path: 'senderId',
                    select: 'profile.name'
                }
            });
        }

        // Update DM's last message
        await DMService.updateLastMessage(dmId, content || '[Attachment]', userId.toString());

        // Get other participant ID
        const dm = await DMService.getDMById(dmId);
        const otherParticipant = dm?.participants.find(
            p => p.userId._id.toString() !== userId.toString()
        );

        if (otherParticipant) {
            // Increment unread count for other user
            await DMService.incrementUnreadCount(dmId, otherParticipant.userId._id.toString());

            // Emit Socket.IO event to other user
            console.log('🔵 [DM Controller] Emitting dm:new_message event:', {
                targetUserId: otherParticipant.userId._id.toString(),
                room: `user:${otherParticipant.userId._id}`,
                dmId,
                messageId: message._id
            });

            if (SocketService.io) {
                SocketService.io.to(`user:${otherParticipant.userId._id}`).emit('dm:new_message', {
                    dmId,
                    message
                });
                console.log('✅ [DM Controller] Event emitted successfully');
            } else {
                console.error('❌ [DM Controller] SocketService.io is null!');
            }
        } else {
            console.error('❌ [DM Controller] Could not find other participant');
        }

        res.status(201).json({ message });
    } catch (error: any) {
        console.error('Send DM message error:', error);
        res.status(500).json({ message: error.message || 'Internal server error' });
    }
};

/**
 * MARK DM AS READ
 * Marks all messages in DM as read for current user
 */
export const markDMAsRead = async (req: Request, res: Response) => {
    try {
        const dmId = req.params.dmId as string;
        const userId = (req.user as any)._id.toString();

        // Verify user is a participant
        const isParticipant = await DMService.isParticipant(dmId, userId);
        if (!isParticipant) {
            return res.status(403).json({ message: 'Access denied: not a participant' });
        }

        // Mark as read
        await DMService.markAsRead(dmId, userId);

        res.status(200).json({ success: true });
    } catch (error: any) {
        console.error('Mark DM as read error:', error);
        res.status(500).json({ message: error.message || 'Internal server error' });
    }
};
