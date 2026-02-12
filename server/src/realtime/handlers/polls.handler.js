import { pollsService } from '../../domain/services/polls.service.js';
import { isAdmin } from '../../domain/policies/permissions.js';
import { Errors } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import { getIO, emitToUser } from '../io.js';

const voteRateLimits = new Map();
const pollCreateRateLimits = new Map();

function checkVoteRateLimit(userId) {
  const now = Date.now();
  const userLimits = voteRateLimits.get(userId) || [];
  const recentVotes = userLimits.filter(timestamp => now - timestamp < 60000);
  if (recentVotes.length >= 10) return false;
  recentVotes.push(now);
  voteRateLimits.set(userId, recentVotes);
  return true;
}

function checkPollCreateRateLimit(userId) {
  const now = Date.now();
  const userLimits = pollCreateRateLimits.get(userId) || [];
  const recentCreations = userLimits.filter(timestamp => now - timestamp < 60000);
  if (recentCreations.length >= 3) return false;
  recentCreations.push(now);
  pollCreateRateLimits.set(userId, recentCreations);
  return true;
}

function createError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

export function setupPollHandlers(socket) {
  const { userId, username, role } = socket.user;

  // ========== CREATE ==========
  socket.on('poll:create', async (payload, callback) => {
    try {
      if (!isAdmin(socket.user)) throw Errors.FORBIDDEN;
      if (!checkPollCreateRateLimit(userId)) throw Errors.RATE_LIMITED;

      const { question, description, options, accessType, allowedUserIds } = payload;
      if (!question || !options) throw createError('Missing required fields', 400, 'INVALID_PAYLOAD');

      const poll = await pollsService.createPoll(
        { question, description, options, accessType, allowedUserIds },
        userId, username
      );

      // Broadcast selon le type d'accès
      if (poll.accessType === 'public' || !poll.accessType) {
        getIO().emit('poll:created', { poll, createdBy: username });
      } else if (poll.accessType === 'selected') {
        // Envoyer au créateur + utilisateurs autorisés
        emitToUser(userId, 'poll:created', { poll, createdBy: username });
        for (const uid of poll.allowedUserIds) {
          if (uid !== userId) emitToUser(uid, 'poll:created', { poll, createdBy: username });
        }
      } else {
        // Privé: juste le créateur
        emitToUser(userId, 'poll:created', { poll, createdBy: username });
      }

      logger.info(`Poll created: ${poll.id} (${poll.accessType})`);
      if (typeof callback === 'function') callback({ success: true, data: poll });
    } catch (error) {
      logger.error('Error creating poll:', error.message);
      if (typeof callback === 'function') callback({ success: false, error: { code: error.code || 'INTERNAL_ERROR', message: error.message } });
    }
  });

  // ========== VOTE ==========
  socket.on('poll:vote', async (payload, callback) => {
    try {
      if (!checkVoteRateLimit(userId)) throw Errors.RATE_LIMITED;

      const { pollId, optionId } = payload;
      if (!pollId || optionId === undefined || optionId === null) throw createError('Missing required fields', 400, 'INVALID_PAYLOAD');

      const result = await pollsService.vote({ pollId, optionId }, userId, username);
      const { action, poll: updatedPoll } = result;

      getIO().emit('poll:results', { poll: updatedPoll, votedBy: username, action });

      if (typeof callback === 'function') {
        const userVote = action === 'unvoted' ? null : optionId;
        callback({ success: true, data: { ...updatedPoll, userVote, action } });
      }
    } catch (error) {
      logger.error('Error voting:', error.message);
      if (typeof callback === 'function') callback({ success: false, error: { code: error.code || 'INTERNAL_ERROR', message: error.message } });
    }
  });

  // ========== CLOSE ==========
  socket.on('poll:close', async (payload, callback) => {
    try {
      const { pollId } = payload;
      if (!pollId) throw createError('Missing pollId', 400, 'INVALID_PAYLOAD');

      const closedPoll = await pollsService.closePoll(pollId, userId, role);
      getIO().emit('poll:closed', { poll: closedPoll, closedBy: username });

      logger.info(`Poll ${pollId} closed by ${username}`);
      if (typeof callback === 'function') callback({ success: true, data: closedPoll });
    } catch (error) {
      logger.error('Error closing poll:', error.message);
      if (typeof callback === 'function') callback({ success: false, error: { code: error.code || 'INTERNAL_ERROR', message: error.message } });
    }
  });

  // ========== EDIT ==========
  socket.on('poll:edit', async (payload, callback) => {
    try {
      const { pollId, updates } = payload;
      if (!pollId || !updates) throw createError('Missing required fields', 400, 'INVALID_PAYLOAD');

      const updatedPoll = await pollsService.editPoll(pollId, updates, userId, role);

      getIO().emit('poll:updated', { poll: updatedPoll, updatedBy: username });

      logger.info(`Poll ${pollId} updated by ${username}`);
      if (typeof callback === 'function') callback({ success: true, data: updatedPoll });
    } catch (error) {
      logger.error('Error editing poll:', error.message);
      if (typeof callback === 'function') callback({ success: false, error: { code: error.code || 'INTERNAL_ERROR', message: error.message } });
    }
  });

  // ========== DELETE ==========
  socket.on('poll:delete', async (payload, callback) => {
    try {
      const { pollId } = payload;
      if (!pollId) throw createError('Missing pollId', 400, 'INVALID_PAYLOAD');

      const result = await pollsService.deletePoll(pollId, userId, role);

      getIO().emit('poll:deleted', { pollId: result.pollId, question: result.question, deletedBy: username });

      logger.info(`Poll ${result.pollId} deleted by ${username}`);
      if (typeof callback === 'function') callback({ success: true, data: result });
    } catch (error) {
      logger.error('Error deleting poll:', error.message);
      if (typeof callback === 'function') callback({ success: false, error: { code: error.code || 'INTERNAL_ERROR', message: error.message } });
    }
  });

  // ========== KICK USER ==========
  socket.on('poll:kickUser', async (payload, callback) => {
    try {
      const { pollId, targetUserId } = payload;
      if (!pollId || !targetUserId) throw createError('Missing required fields', 400, 'INVALID_PAYLOAD');

      const updatedPoll = await pollsService.kickUser(pollId, targetUserId, userId, role);

      // Notifier tout le monde de la mise à jour du sondage
      getIO().emit('poll:updated', { poll: updatedPoll, updatedBy: username });

      // Notifier l'utilisateur expulsé
      emitToUser(targetUserId, 'poll:kicked', { pollId, kickedBy: username, question: updatedPoll.question });

      logger.info(`User ${targetUserId} kicked from poll ${pollId} by ${username}`);
      if (typeof callback === 'function') callback({ success: true, data: updatedPoll });
    } catch (error) {
      logger.error('Error kicking user:', error.message);
      if (typeof callback === 'function') callback({ success: false, error: { code: error.code || 'INTERNAL_ERROR', message: error.message } });
    }
  });

  // ========== JOIN (participant tracking) ==========
  socket.on('poll:join', async (payload, callback) => {
    try {
      const { pollId } = payload;
      if (!pollId) throw createError('Missing pollId', 400, 'INVALID_PAYLOAD');

      const updatedPoll = await pollsService.joinPoll(pollId, userId, username);

      getIO().emit('poll:participantJoined', { pollId, userId, username, participants: updatedPoll.participants });

      if (typeof callback === 'function') callback({ success: true, data: updatedPoll });
    } catch (error) {
      if (typeof callback === 'function') callback({ success: false, error: { code: error.code || 'INTERNAL_ERROR', message: error.message } });
    }
  });

  // ========== LEAVE (participant tracking) ==========
  socket.on('poll:leave', async (payload, callback) => {
    try {
      const { pollId } = payload;
      if (!pollId) throw createError('Missing pollId', 400, 'INVALID_PAYLOAD');

      const updatedPoll = await pollsService.leavePoll(pollId, userId);

      getIO().emit('poll:participantLeft', { pollId, userId, username, participants: updatedPoll.participants });

      if (typeof callback === 'function') callback({ success: true });
    } catch (error) {
      if (typeof callback === 'function') callback({ success: false, error: { code: error.code || 'INTERNAL_ERROR', message: error.message } });
    }
  });

  // ========== GET STATE ==========
  socket.on('poll:getState', async (payload, callback) => {
    logger.info(`📊 poll:getState received from ${username} (socket: ${socket.id}), callback type: ${typeof callback}`);
    try {
      const state = await pollsService.getPollsState(userId);
      logger.info(`📊 poll:getState success: ${state.polls.length} polls found`);
      if (typeof callback === 'function') callback({ success: true, data: state });
    } catch (error) {
      logger.error('Error getting poll state:', error.message);
      if (typeof callback === 'function') callback({ success: false, error: { code: error.code || 'INTERNAL_ERROR', message: error.message } });
    }
  });
}
