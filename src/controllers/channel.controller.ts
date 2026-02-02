import { Request, Response } from 'express';
import ChannelService from '../services/channel.service';

export const getChannels = async (req: Request, res: Response) => {
    try {
        const userId = (req.user as any)._id; // Using req.user populated by authMiddleware
        const { workspaceId } = req.query;

        if (!workspaceId) {
            return res.status(400).json({ message: 'Workspace ID is required' });
        }

        const channels = await ChannelService.getChannels(userId, workspaceId as string);
        res.status(200).json(channels);
    } catch (error) {
        console.error('Error fetching channels:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const createChannel = async (req: Request, res: Response) => {
    try {
        const { name, description, type, members, workspaceId } = req.body;
        const creatorId = (req.user as any)._id;

        if (!workspaceId) {
            return res.status(400).json({ message: 'Workspace ID is required' });
        }

        // Ensure creator is a member
        const channelMembers = new Set(members || []);
        channelMembers.add(creatorId);

        const channel = await ChannelService.createChannel({
            name,
            description,
            type,
            workspaceId,
            members: Array.from(channelMembers) as any,
        });

        res.status(201).json(channel);
    } catch (error) {
        console.error('Error creating channel:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const getChannelById = async (req: Request, res: Response) => {
    try {
        const { channelId } = req.params;
        const channel = await ChannelService.getChannelById(channelId as string);

        if (!channel) {
            return res.status(404).json({ message: 'Channel not found' });
        }

        res.status(200).json(channel);
    } catch (error) {
        console.error('Error fetching channel:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
