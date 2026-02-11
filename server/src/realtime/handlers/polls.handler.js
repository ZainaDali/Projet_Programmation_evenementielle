import { pollsService } from '../../domain/services/polls.service.js';
import { isAdmin } from '../../domain/policies/permissions.js';
import { Errors } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import { getIO } from '../io.js';

const voteRateLimits = new Map();
const pollCreateRateLimits = new Map();

function checkVoteRateLimit(userId) {
  const now = Date.now();
  const userLimits = voteRateLimits.get(userId) || [];
  const recentVotes = userLimits.filter(timestamp => now - timestamp < 60000);

  if (recentVotes.length >= 10) {
    return false;
  }

  recentVotes.push(now);
  voteRateLimits.set(userId, recentVotes);
  return true;
}

function checkPollCreateRateLimit(userId) {
  const now = Date.now();
  const userLimits = pollCreateRateLimits.get(userId) || [];
  const recentCreations = userLimits.filter(timestamp => now - timestamp < 60000);

  if (recentCreations.length >= 3) {
    return false;
  }

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

  socket.on('poll:create', async (payload, callback) => {
    try {
      if (!isAdmin(socket.user)) {
        throw Errors.FORBIDDEN;
      }

      if (!checkPollCreateRateLimit(userId)) {
        throw Errors.RATE_LIMITED;
      }

      const { question, options } = payload;

      if (!question || !options) {
        throw createError('Missing required fields', 400, 'INVALID_PAYLOAD');
      }

      const poll = await pollsService.createPoll(
        { question, options },
        userId,
        username
      );

      getIO().emit('poll:created', {
        poll,
        createdBy: username,
      });

      logger.info(`Poll created: ${poll.id}`);

      if (typeof callback === 'function') {
        callback({ success: true, data: poll });
      }
    } catch (error) {
      logger.error('Error creating poll:', error.message);
      if (typeof callback === 'function') {
        callback({
          success: false,
          error: {
            code: error.code || 'INTERNAL_ERROR',
            message: error.message,
          },
        });
      }
    }
  });

  socket.on('poll:vote', async (payload, callback) => {
    try {
      if (!checkVoteRateLimit(userId)) {
        throw Errors.RATE_LIMITED;
      }

      const { pollId, optionId } = payload;

      if (!pollId || optionId === undefined || optionId === null) {
        throw createError('Missing required fields', 400, 'INVALID_PAYLOAD');
      }

      const result = await pollsService.vote(
        { pollId, optionId },
        userId,
        username
      );

      const { action, poll: updatedPoll } = result;

      getIO().emit('poll:results', {
        poll: updatedPoll,
        votedBy: username,
        action,
      });

      if (typeof callback === 'function') {
        const userVote = action === 'unvoted' ? null : optionId;
        callback({ success: true, data: { ...updatedPoll, userVote, action } });
      }
    } catch (error) {
      logger.error('Error voting:', error.message);
      if (typeof callback === 'function') {
        callback({
          success: false,
          error: {
            code: error.code || 'INTERNAL_ERROR',
            message: error.message,
          },
        });
      }
    }
  });

  socket.on('poll:close', async (payload, callback) => {
    try {
      const { pollId } = payload;

      if (!pollId) {
        throw createError('Missing pollId', 400, 'INVALID_PAYLOAD');
      }

      const closedPoll = await pollsService.closePoll(pollId, userId, role);

      getIO().emit('poll:closed', {
        poll: closedPoll,
        closedBy: username,
      });

      logger.info(`Poll ${pollId} closed by ${username}`);

      if (typeof callback === 'function') {
        callback({ success: true, data: closedPoll });
      }
    } catch (error) {
      logger.error('Error closing poll:', error.message);
      if (typeof callback === 'function') {
        callback({
          success: false,
          error: {
            code: error.code || 'INTERNAL_ERROR',
            message: error.message,
          },
        });
      }
    }
  });

  socket.on('poll:getState', async (payload, callback) => {
    try {
      const state = await pollsService.getPollsState(userId);

      if (typeof callback === 'function') {
        callback({ success: true, data: state });
      }
    } catch (error) {
      logger.error('Error getting poll state:', error.message);
      if (typeof callback === 'function') {
        callback({
          success: false,
          error: {
            code: error.code || 'INTERNAL_ERROR',
            message: error.message,
          },
        });
      }
    }
  });
}
