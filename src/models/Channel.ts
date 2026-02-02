import mongoose, { Schema, Document } from 'mongoose';

export interface IChannel extends Document {
    name: string;
    description?: string;
    type: 'public' | 'private' | 'dm';
    workspaceId: mongoose.Types.ObjectId;
    members: mongoose.Types.ObjectId[]; // User IDs
    createdAt: Date;
    updatedAt: Date;
}

const ChannelSchema: Schema = new Schema(
    {
        name: { type: String, required: true },
        description: { type: String },
        workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
        type: {
            type: String,
            enum: ['public', 'private', 'dm'],
            default: 'public',
        },
        members: [{ type: Schema.Types.ObjectId, ref: 'User', index: true }],
    },
    { timestamps: true }
);

// Enforce unique DM per user pair
// The logic depends on 'members' being sorted when inserting for DMs
ChannelSchema.index(
    { members: 1 },
    {
        unique: true,
        partialFilterExpression: { type: 'dm' }
    }
);

export default mongoose.model<IChannel>('Channel', ChannelSchema);
