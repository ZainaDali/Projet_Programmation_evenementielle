import { pollsService } from '../../domain/services/polls.service.js';
import { roomsService } from '../../domain/services/rooms.service.js';
import { isAdmin, isModerator } from '../../domain/policies/permissions.js';
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
      
      const { roomId, question, options } = payload;
      
      if (!roomId || !question || !options) {
        throw createError('Missing required fields', 400, 'INVALID_PAYLOAD');
      }
      
      const poll = await pollsService.createPoll(
        { roomId, question, options },
        userId,
        username
      );
      
      getIO().to(`room:${roomId}`).emit('poll:created', {
        poll,
        createdBy: username,
      });
      
      logger.info(`Poll created: ${poll.id} in room ${roomId}`);
      
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
      
      const updatedPoll = await pollsService.vote(
        { pollId, optionId },
        userId,
        username
      );
      
      getIO().to(`room:${updatedPoll.roomId}`).emit('poll:results', {
        poll: updatedPoll,
        votedBy: username,
      });
      
      if (typeof callback === 'function') {
        callback({ success: true, data: updatedPoll });
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
      
      getIO().to(`room:${closedPoll.roomId}`).emit('poll:closed', {
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
      const { roomId } = payload;
      
      if (!roomId) {
        throw createError('Missing roomId', 400, 'INVALID_PAYLOAD');
      }
      
      const canAccess = await roomsService.canAccessRoom(roomId, userId);
      if (!canAccess) {
        throw Errors.FORBIDDEN;
      }
      
      const state = await pollsService.getRoomState(roomId, userId);
      
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
  
  socket.on('room:join', async (payload, callback) => {
    try {
      const { roomId } = payload;
      
      if (!roomId) {
        throw createError('Missing roomId', 400, 'INVALID_PAYLOAD');
      }
      
      const canAccess = await roomsService.canAccessRoom(roomId, userId);
      if (!canAccess) {
        throw Errors.FORBIDDEN;
      }
      
      socket.join(`room:${roomId}`);
      
      const state = await pollsService.getRoomState(roomId, userId);
      
      socket.to(`room:${roomId}`).emit('room:userJoined', {
        userId,
        username,
        roomId,
      });
      
      logger.info(`${username} joined room ${roomId}`);
      
      if (typeof callback === 'function') {
        callback({ success: true, data: state });
      }
    } catch (error) {
      logger.error('Error joining room:', error.message);
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
  
  socket.on('room:leave', async (payload, callback) => {
    try {
      const { roomId } = payload;
      
      if (!roomId) {
        throw createError('Missing roomId', 400, 'INVALID_PAYLOAD');
      }
      
      socket.leave(`room:${roomId}`);
      
      socket.to(`room:${roomId}`).emit('room:userLeft', {
        userId,
        username,
        roomId,
      });
      
      logger.info(`${username} left room ${roomId}`);
      
      if (typeof callback === 'function') {
        callback({ success: true });
      }
    } catch (error) {
      logger.error('Error leaving room:', error.message);
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

function createError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}
