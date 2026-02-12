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

      // Le créateur rejoint automatiquement la room du poll
      socket.join(`poll:${poll.id}`);

      // Faire rejoindre automatiquement tous les utilisateurs autorisés à la room
      const io = getIO();
      const allSockets = Array.from(io.sockets.sockets.values());
      
      // Pour les polls sélectionnés/privés, faire rejoindre les utilisateurs autorisés
      if (poll.accessType === 'selected' || poll.accessType === 'private') {
        const userIdsToJoin = poll.accessType === 'selected' 
          ? poll.allowedUserIds 
          : [userId]; // Privé: juste le créateur
        
        for (const uid of userIdsToJoin) {
          // Trouver tous les sockets de cet utilisateur
          const userSockets = allSockets.filter(s => s.user?.userId === uid);
          for (const userSocket of userSockets) {
            userSocket.join(`poll:${poll.id}`);
            logger.info(`User ${uid} auto-joined poll room ${poll.id}`);
          }
        }
      }

      // Broadcast selon le type d'accès - TOUJOURS via la room maintenant
      if (poll.accessType === 'public' || !poll.accessType) {
        // Public: notifier tout le monde (broadcast global pour que les nouveaux utilisateurs le voient)
        io.emit('poll:created', { poll, createdBy: username });
      } else {
        // Sélectionné/Privé: notifier uniquement les utilisateurs dans la room
        io.to(`poll:${poll.id}`).emit('poll:created', { poll, createdBy: username });
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

      // Envoyer les résultats uniquement aux utilisateurs dans la room du poll
      getIO().to(`poll:${pollId}`).emit('poll:results', { poll: updatedPoll, votedBy: username, action });

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
      // Envoyer uniquement aux utilisateurs dans la room du poll
      getIO().to(`poll:${pollId}`).emit('poll:closed', { poll: closedPoll, closedBy: username });

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

      // Envoyer uniquement aux utilisateurs dans la room du poll
      getIO().to(`poll:${pollId}`).emit('poll:updated', { poll: updatedPoll, updatedBy: username });

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

      // Notifier tous les utilisateurs dans la room, puis supprimer la room
      getIO().to(`poll:${pollId}`).emit('poll:deleted', { pollId: result.pollId, question: result.question, deletedBy: username });
      
      // Déconnecter tous les sockets de la room (optionnel, mais propre)
      const room = getIO().sockets.adapter.rooms.get(`poll:${pollId}`);
      if (room) {
        room.forEach(socketId => {
          getIO().sockets.sockets.get(socketId)?.leave(`poll:${pollId}`);
        });
      }

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

      // Retirer l'utilisateur expulsé de la room
      const targetSocket = Array.from(getIO().sockets.sockets.values())
        .find(s => s.user?.userId === targetUserId);
      if (targetSocket) {
        targetSocket.leave(`poll:${pollId}`);
      }

      // Notifier les utilisateurs dans la room de la mise à jour
      getIO().to(`poll:${pollId}`).emit('poll:updated', { poll: updatedPoll, updatedBy: username });

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

      // Vérifier que l'utilisateur a accès au poll
      const poll = await pollsService.getPollById(pollId);
      if (!pollsService.canAccessPoll(poll, userId)) {
        throw Errors.POLL_ACCESS_DENIED;
      }

      // Rejoindre la room Socket.IO du poll
      socket.join(`poll:${pollId}`);
      
      const updatedPoll = await pollsService.joinPoll(pollId, userId, username);

      // Notifier uniquement les utilisateurs dans la room du poll
      getIO().to(`poll:${pollId}`).emit('poll:participantJoined', { pollId, userId, username, participants: updatedPoll.participants });

      logger.info(`User ${username} joined poll room ${pollId}`);
      if (typeof callback === 'function') callback({ success: true, data: updatedPoll });
    } catch (error) {
      logger.error('Error joining poll:', error.message);
      if (typeof callback === 'function') callback({ success: false, error: { code: error.code || 'INTERNAL_ERROR', message: error.message } });
    }
  });

  // ========== LEAVE (participant tracking) ==========
  socket.on('poll:leave', async (payload, callback) => {
    try {
      const { pollId } = payload;
      if (!pollId) throw createError('Missing pollId', 400, 'INVALID_PAYLOAD');

      // Quitter la room Socket.IO du poll
      socket.leave(`poll:${pollId}`);
      
      const updatedPoll = await pollsService.leavePoll(pollId, userId);

      // Notifier uniquement les utilisateurs restants dans la room
      getIO().to(`poll:${pollId}`).emit('poll:participantLeft', { pollId, userId, username, participants: updatedPoll.participants });

      logger.info(`User ${username} left poll room ${pollId}`);
      if (typeof callback === 'function') callback({ success: true });
    } catch (error) {
      logger.error('Error leaving poll:', error.message);
      if (typeof callback === 'function') callback({ success: false, error: { code: error.code || 'INTERNAL_ERROR', message: error.message } });
    }
  });

  // ========== GET STATE ==========
  socket.on('poll:getState', async (payload, callback) => {
    logger.info(`📊 poll:getState received from ${username} (socket: ${socket.id}), callback type: ${typeof callback}`);
    try {
      const state = await pollsService.getPollsState(userId);
      
      // Rejoindre automatiquement les rooms de tous les polls visibles
      // (optionnel, mais permet de recevoir les mises à jour même sans poll:join explicite)
      for (const poll of state.polls) {
        try {
          socket.join(`poll:${poll.id}`);
        } catch (err) {
          logger.warn(`Failed to join poll room ${poll.id}:`, err.message);
        }
      }
      
      logger.info(`📊 poll:getState success: ${state.polls.length} polls found, joined ${state.polls.length} rooms`);
      if (typeof callback === 'function') callback({ success: true, data: state });
    } catch (error) {
      logger.error('Error getting poll state:', error.message);
      if (typeof callback === 'function') callback({ success: false, error: { code: error.code || 'INTERNAL_ERROR', message: error.message } });
    }
  });
}
