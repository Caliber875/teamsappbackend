import express from 'express';
import { getUploadSignature } from '../controllers/upload.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = express.Router();

router.use(authMiddleware);

router.post('/sign', getUploadSignature);

export default router;
