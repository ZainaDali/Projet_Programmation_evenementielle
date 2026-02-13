import { Router } from 'express';
import { z } from 'zod';
import { pollsService } from '../../domain/services/polls.service.js';
import { authMiddleware } from '../middlewares/auth.http.js';
import { logger } from '../../utils/logger.js';
import { Errors } from '../../utils/errors.js';
import { POLL_ACCESS_TYPES } from '../../config/constants.js';

const router = Router();

// Validation schemas
const createPollSchema = z.object({
    question: z.string().min(3).max(200),
    description: z.string().max(500).optional(),
    options: z.array(z.object({
        id: z.string(),
        text: z.string().min(1).max(100)
    })).min(2).max(6),
    accessType: z.enum(Object.values(POLL_ACCESS_TYPES)).optional(),
    allowedUserIds: z.array(z.string()).optional()
});

const voteSchema = z.object({
    optionId: z.string()
});

const editPollSchema = z.object({
    question: z.string().min(3).max(200).optional(),
    description: z.string().max(500).optional(),
    accessType: z.enum(Object.values(POLL_ACCESS_TYPES)).optional(),
    allowedUserIds: z.array(z.string()).optional()
});

const kickUserSchema = z.object({
    targetUserId: z.string()
});

// GET /api/polls - Get visible polls (state)
router.get('/', authMiddleware, async (req, res, next) => {
    try {
        const state = await pollsService.getPollsState(req.user.userId);
        res.json({ success: true, data: state });
    } catch (error) {
        next(error);
    }
});

// POST /api/polls - Create a new poll
router.post('/', authMiddleware, async (req, res, next) => {
    try {
        if (req.user.role !== 'admin') throw Errors.FORBIDDEN;

        // Simple rate limit check could go here

        const payload = createPollSchema.parse(req.body);
        const poll = await pollsService.createPoll(
            payload,
            req.user.userId,
            req.user.username
        );

        res.status(201).json({ success: true, data: poll });
    } catch (error) {
        next(error);
    }
});

// GET /api/polls/:id - Get a single poll
router.get('/:id', authMiddleware, async (req, res, next) => {
    try {
        const poll = await pollsService.getPollById(req.params.id);
        if (!pollsService.canAccessPoll(poll, req.user.userId)) {
            throw Errors.POLL_ACCESS_DENIED;
        }
        res.json({ success: true, data: pollsService.formatPoll(poll) });
    } catch (error) {
        next(error);
    }
});

// POST /api/polls/:id/vote - Vote on a poll
router.post('/:id/vote', authMiddleware, async (req, res, next) => {
    try {
        const { optionId } = voteSchema.parse(req.body);
        const result = await pollsService.vote(
            { pollId: req.params.id, optionId },
            req.user.userId,
            req.user.username
        );
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

// POST /api/polls/:id/close - Close a poll
router.post('/:id/close', authMiddleware, async (req, res, next) => {
    try {
        const result = await pollsService.closePoll(
            req.params.id,
            req.user.userId,
            req.user.role
        );
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

// PUT /api/polls/:id - Edit a poll
router.put('/:id', authMiddleware, async (req, res, next) => {
    try {
        const updates = editPollSchema.parse(req.body);
        const result = await pollsService.editPoll(
            req.params.id,
            updates,
            req.user.userId,
            req.user.role
        );
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/polls/:id - Delete a poll
router.delete('/:id', authMiddleware, async (req, res, next) => {
    try {
        const result = await pollsService.deletePoll(
            req.params.id,
            req.user.userId,
            req.user.role
        );
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

// POST /api/polls/:id/kick - Kick a user from a poll
router.post('/:id/kick', authMiddleware, async (req, res, next) => {
    try {
        const { targetUserId } = kickUserSchema.parse(req.body);
        const result = await pollsService.kickUser(
            req.params.id,
            targetUserId,
            req.user.userId,
            req.user.role
        );
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

// POST /api/polls/:id/join - Join a poll (for participant tracking)
router.post('/:id/join', authMiddleware, async (req, res, next) => {
    try {
        const result = await pollsService.joinPoll(
            req.params.id,
            req.user.userId,
            req.user.username
        );
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

// POST /api/polls/:id/leave - Leave a poll (for participant tracking)
router.post('/:id/leave', authMiddleware, async (req, res, next) => {
    try {
        const result = await pollsService.leavePoll(
            req.params.id,
            req.user.userId
        );
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

export default router;
