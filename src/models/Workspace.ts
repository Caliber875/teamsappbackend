import mongoose, { Schema, Document } from 'mongoose';

export interface IWorkspace extends Document {
    name: string;
    ownerId: mongoose.Types.ObjectId;
    members: {
        userId: mongoose.Types.ObjectId;
        role: 'admin' | 'member';
        joinedAt: Date;
    }[];
    inviteCode: string; // Simple code for joining
    createdAt: Date;
    updatedAt: Date;
}

const WorkspaceSchema: Schema = new Schema(
    {
        name: { type: String, required: true, trim: true },
        ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        members: [
            {
                userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
                role: { type: String, enum: ['admin', 'member'], default: 'member' },
                joinedAt: { type: Date, default: Date.now }
            }
        ],
        inviteCode: { type: String, unique: true, required: true }
    },
    { timestamps: true }
);

// Index for finding workspaces a user belongs to
WorkspaceSchema.index({ 'members.userId': 1 });

export default mongoose.model<IWorkspace>('Workspace', WorkspaceSchema);
