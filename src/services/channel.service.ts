import Channel, { IChannel } from '../models/Channel';

class ChannelService {
    async createChannel(data: Partial<IChannel>): Promise<IChannel> {
        // Special logic for Direct Messages
        if (data.type === 'dm') {
            if (!data.members || data.members.length !== 2) {
                throw new Error('Direct messages must have exactly 2 members');
            }
            // Ensure workspaceId is present
            if (!data.workspaceId) {
                throw new Error('Workspace ID is required for DMs');
            }

            // Mongoose creates ObjectIds, but we need to ensure they are sorted for the Unique Index to work
            // Cast to string for stable sort, then we can store them.
            // Actually, assuming the Controller passes ObjectIds or Strings.
            // Let's rely on Mongoose's behavior or pre-sort.
            // For safety, let's sort strings.
            const sortedMembers = (data.members as any[]).map(String).sort();
            data.members = sortedMembers as any;

            // Idempotency: Check if exists first (Optimization)
            const existingDM = await Channel.findOne({
                type: 'dm',
                workspaceId: data.workspaceId,
                members: { $all: sortedMembers } // $all not strictly needed if we match array exactly, but safer
            });

            if (existingDM) {
                return existingDM;
            }
        }

        try {
            const channel = await Channel.create(data);
            return channel;
        } catch (error: any) {
            // Handle Race Condition (Unique Index Violation)
            if (error.code === 11000 && data.type === 'dm') {
                const existing = await Channel.findOne({
                    type: 'dm',
                    workspaceId: data.workspaceId,
                    members: data.members
                });
                if (existing) return existing;
            }
            throw error;
        }
    }

    async getChannels(userId: string, workspaceId: string): Promise<IChannel[]> {
        // Return all public channels in workspace OR channels where the user is a member in that workspace
        return Channel.find({
            workspaceId: workspaceId,
            $or: [
                { type: 'public' },
                { members: userId }
            ]
        }).sort({ createdAt: 1 });
    }

    async getChannelById(channelId: string): Promise<IChannel | null> {
        return Channel.findById(channelId).populate('members', 'profile.name profile.avatarUrl profile.status');
    }
}

export default new ChannelService();
