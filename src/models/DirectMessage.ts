import mongoose, { Schema, Document } from 'mongoose';

export interface IDirectMessage extends Document {
    participants: Array<{
        userId: mongoose.Types.ObjectId;
        lastReadAt: Date;
        unreadCount: number;
    }>;
    lastMessage?: {
        content: string;
        senderId: mongoose.Types.ObjectId;
        sentAt: Date;
    };
    createdAt: Date;
    updatedAt: Date;
}

// Subdocument schema for participants
const ParticipantSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    lastReadAt: { type: Date, default: Date.now },
    unreadCount: { type: Number, default: 0 }
}, { _id: false });

// Subdocument schema for last message
const LastMessageSchema = new Schema({
    content: { type: String, required: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    sentAt: { type: Date, required: true }
}, { _id: false });

const DirectMessageSchema: Schema = new Schema(
    {
        participants: {
            type: [ParticipantSchema],
            required: true,
            validate: {
                validator: function (val: any[]) {
                    return val.length === 2;
                },
                message: 'Direct messages must have exactly 2 participants'
            }
        },
        lastMessage: { type: LastMessageSchema, default: null }
    },
    { timestamps: true }
);

// REMOVED: Unique index on 'participants.userId' which was incorrect.
// It enforced that a user could only be in ONE DM globally.
// We handle DM uniqueness (pair of users) in the service layer using logic.

// Index for querying user's DMs, sorted by most recent activity
DirectMessageSchema.index({ 'participants.userId': 1, updatedAt: -1 });

// Pre-save hook to ensure participants are always sorted
DirectMessageSchema.pre('save', async function () {
    if (this.isModified('participants')) {
        // Sort participants by userId to ensure consistency
        (this as any).participants.sort((a: any, b: any) => {
            return a.userId.toString().localeCompare(b.userId.toString());
        });
    }
});

export default mongoose.model<IDirectMessage>('DirectMessage', DirectMessageSchema);
