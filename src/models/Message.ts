import mongoose, { Schema, Document } from 'mongoose';

export interface IMessage extends Document {
    workspaceId: mongoose.Types.ObjectId;
    channelId?: mongoose.Types.ObjectId;       // Optional for DMs
    directMessageId?: mongoose.Types.ObjectId; // NEW: For DM messages
    senderId: mongoose.Types.ObjectId;
    content: string;
    type: 'text' | 'image' | 'file' | 'task';
    attachments?: {
        name: string;
        url: string;
        type: string;
        size: number;
    }[];
    taskData?: {
        title: string;
        description?: string;
        assignees: mongoose.Types.ObjectId[];
        dueDate?: Date;
        priority: 'low' | 'medium' | 'high';
        status: 'todo' | 'in-progress' | 'done';
    };
    // NEW FIELDS
    isDeleted: boolean;
    editedAt?: Date;
    replyTo?: mongoose.Types.ObjectId;
    reactions: {
        emoji: string;
        userId: mongoose.Types.ObjectId;
        createdAt: Date;
    }[];
    createdAt: Date;
    updatedAt: Date;
}

// Define attachment subdocument schema explicitly
const AttachmentSchema = new Schema({
    name: { type: String, required: true },
    url: { type: String, required: true },
    type: { type: String, required: true },
    size: { type: Number, required: true }
}, { _id: false }); // Disable _id for subdocuments

const MessageSchema = new Schema({
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    channelId: { type: Schema.Types.ObjectId, ref: 'Channel' },  // Now optional
    directMessageId: { type: Schema.Types.ObjectId, ref: 'DirectMessage' }, // NEW: For DMs
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, default: '' },
    type: { type: String, enum: ['text', 'image', 'file', 'task'], default: 'text' },
    attachments: [AttachmentSchema], // Use the explicit schema

    // NEW FIELDS FOR ADVANCED FEATURES
    isDeleted: { type: Boolean, default: false },
    editedAt: { type: Date },
    replyTo: { type: Schema.Types.ObjectId, ref: 'Message' },
    reactions: [{
        emoji: { type: String, required: true },
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        createdAt: { type: Date, default: Date.now }
    }],

    taskData: {
        title: { type: String },
        description: { type: String },
        assignees: [{ type: Schema.Types.ObjectId, ref: 'User' }],
        dueDate: { type: Date },
        priority: {
            type: String,
            enum: ['low', 'medium', 'high'],
            default: 'medium'
        },
        status: {
            type: String,
            enum: ['todo', 'in-progress', 'done'],
            default: 'todo'
        }
    }
},
    { timestamps: true }
);

// XOR Validation: Message must belong to either channel OR DM (not both, not neither)
MessageSchema.pre('validate', async function () {
    const hasChannel = !!this.channelId;
    const hasDM = !!this.directMessageId;

    // XOR: Must have exactly one (not both, not neither)
    if (hasChannel === hasDM) {
        throw new Error('Message must belong to either a channel or a direct message, not both or neither');
    }

    // Task validation
    if (this.type === 'task') {
        const taskData = this.taskData as any;
        if (!taskData?.title) {
            throw new Error('Task messages must have a title');
        }
        if (!taskData?.assignees || taskData.assignees.length === 0) {
            throw new Error('Task messages must have at least one assignee');
        }
    }
});

// Existing: Pagination Index for channels
MessageSchema.index({ channelId: 1, createdAt: -1 });

// NEW: Pagination Index for DMs
MessageSchema.index({ directMessageId: 1, createdAt: -1 });

export default mongoose.model<IMessage>('Message', MessageSchema);
