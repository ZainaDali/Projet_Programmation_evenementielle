import { Router } from 'express';
import { z } from 'zod';
import { chatService } from '../../domain/services/chat.service.js';
import { authMiddleware } from '../middlewares/auth.http.js';
import { Errors } from '../../utils/errors.js';

const router = Router();

const sendMessageSchema = z.object({
    content: z.string().min(1).max(500)
});

router.get('/:pollId', authMiddleware, async (req, res, next) => {
    try {
        const messages = await chatService.getHistory(
            req.params.pollId,
            req.user.userId,
            req.user.role
        );
        res.json({ success: true, data: messages });
    } catch (error) {
        next(error);
    }
});

router.post('/:pollId', authMiddleware, async (req, res, next) => {
    try {
        const { content } = sendMessageSchema.parse(req.body);

        // Rate limit check could go here

        const message = await chatService.sendMessage(
            { pollId: req.params.pollId, content },
            req.user.userId,
            req.user.username,
            req.user.role
        );

        res.status(201).json({ success: true, data: message });
    } catch (error) {
        next(error);
    }
});

router.delete('/message/:messageId', authMiddleware, async (req, res, next) => {
    try {
        const result = await chatService.deleteMessage(
            req.params.messageId,
            req.user.userId,
            req.user.role
        );
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

export default router;
