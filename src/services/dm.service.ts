import DirectMessage, { IDirectMessage } from '../models/DirectMessage';
import Message from '../models/Message';
import mongoose from 'mongoose';

class DMService {
    /**
     * Create or retrieve existing DM between two users
     * @param user1Id - First user ID
     * @param user2Id - Second user ID
     * @returns DirectMessage document
     */
    async createOrGetDM(user1Id: string, user2Id: string): Promise<IDirectMessage> {
        console.log('🔵 [DM Service] createOrGetDM called:', { user1Id, user2Id });

        // Validate that user1 !== user2
        if (user1Id === user2Id) {
            throw new Error('Cannot create DM with yourself');
        }

        // Sort user IDs to ensure consistency (A-B === B-A)
        const sortedUserIds = [user1Id, user2Id].sort();
        console.log('🔵 [DM Service] Sorted user IDs:', sortedUserIds);

        // Try to find existing DM
        console.log('🔵 [DM Service] Searching for existing DM...');
        let dm = await DirectMessage.findOne({
            'participants.userId': { $all: sortedUserIds }
        }).populate('participants.userId', 'profile.name profile.avatarUrl profile.status'); // Changed 'profile email' to match original populate fields

        if (dm) {
            console.log('✅ [DM Service] Found existing DM:', dm._id);
            return dm;
        }

        console.log('🔵 [DM Service] No existing DM found, creating new one...');
        // Create new DM
        dm = new DirectMessage({
            participants: sortedUserIds.map(uid => ({
                userId: new mongoose.Types.ObjectId(uid),
                lastReadAt: new Date(),
                unreadCount: 0
            }))
        });

        await dm.save();

        // Populate for return
        await dm.populate('participants.userId', 'profile.name profile.avatarUrl profile.status'); // Changed 'profile email' to match original populate fields

        console.log('✅ [DM Service] Created new DM:', dm._id);
        return dm;
    }

    /**
     * Get all DMs for a user
     * @param userId - User ID
     * @returns Array of DirectMessages with populated participants
     */
    async getUserDMs(userId: string): Promise<IDirectMessage[]> {
        const dms = await DirectMessage.find({
            'participants.userId': userId
        })
            .populate('participants.userId', 'profile.name profile.avatarUrl profile.status')
            .populate('lastMessage.senderId', 'profile.name profile.avatarUrl')
            .sort({ updatedAt: -1 }); // Most recent first

        return dms;
    }

    /**
     * Get a specific DM by ID
     * @param dmId - DirectMessage ID
     * @returns DirectMessage document or null
     */
    async getDMById(dmId: string): Promise<IDirectMessage | null> {
        return await DirectMessage.findById(dmId)
            .populate('participants.userId', 'profile.name profile.avatarUrl profile.status');
    }

    /**
     * Update DM's last message (called after sending a message)
     * @param dmId - DirectMessage ID
     * @param messageContent - Message content
     * @param senderId - Sender user ID
     */
    async updateLastMessage(
        dmId: string,
        messageContent: string,
        senderId: string
    ): Promise<void> {
        await DirectMessage.findByIdAndUpdate(dmId, {
            lastMessage: {
                content: messageContent,
                senderId: new mongoose.Types.ObjectId(senderId),
                sentAt: new Date()
            }
        });
    }

    /**
     * Increment unread count for a participant
     * @param dmId - DirectMessage ID
     * @param userId - User ID whose unread count to increment
     */
    async incrementUnreadCount(dmId: string, userId: string): Promise<void> {
        await DirectMessage.updateOne(
            { _id: dmId, 'participants.userId': userId },
            { $inc: { 'participants.$.unreadCount': 1 } }
        );
    }

    /**
     * Mark DM as read for a user
     * @param dmId - DirectMessage ID
     * @param userId - User ID marking as read
     */
    async markAsRead(dmId: string, userId: string): Promise<void> {
        await DirectMessage.updateOne(
            { _id: dmId, 'participants.userId': userId },
            {
                $set: {
                    'participants.$.lastReadAt': new Date(),
                    'participants.$.unreadCount': 0
                }
            }
        );
    }

    /**
     * Verify user is a participant in the DM
     * @param dmId - DirectMessage ID
     * @param userId - User ID to verify
     * @returns boolean indicating if user is participant
     */
    async isParticipant(dmId: string, userId: string): Promise<boolean> {
        const dm = await DirectMessage.findOne({
            _id: dmId,
            'participants.userId': userId
        });
        return !!dm;
    }
}

export default new DMService();
