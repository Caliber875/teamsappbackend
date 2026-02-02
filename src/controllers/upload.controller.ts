import { Request, Response } from 'express';
import cloudinary from '../config/cloudinary';

/**
 * Generate a signature for client-side uploads to Cloudinary.
 * SECURITY: Prevents unauthorized uploads. Enforces expiration.
 */
export const getUploadSignature = (req: Request, res: Response) => {
    try {
        const timestamp = Math.round(new Date().getTime() / 1000);
        // Handle case where req.body might be undefined (missing Content-Type or empty body)
        const body = req.body || {};
        const { folder = 'chat-uploads' } = body;

        // Parameters to sign
        const params = {
            timestamp,
            folder,
            // upload_preset: 'ml_default', // Optional if using presets
        };

        // DEBUG: Check if env vars are loaded
        console.log('DEBUG: Cloudinary Config:', {
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY ? '***' + process.env.CLOUDINARY_API_KEY.slice(-4) : 'MISSING',
            api_secret: process.env.CLOUDINARY_API_SECRET ? 'PRESENT' : 'MISSING',
            timestamp
        });

        if (!process.env.CLOUDINARY_API_SECRET) {
            throw new Error('Missing Cloudinary API Secret');
        }

        const signature = cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET || '');

        res.json({
            signature,
            timestamp,
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            folder,
            api_key: process.env.CLOUDINARY_API_KEY
        });
    } catch (error) {
        console.error('Upload signature error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
