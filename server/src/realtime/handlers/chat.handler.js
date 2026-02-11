import { chatService } from '../../domain/services/chat.service.js';
import { Errors } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import { getIO } from '../io.js';
import { RATE_LIMITS } from '../../config/constants.js';

const chatRateLimits = new Map();

function checkChatRateLimit(userId) {
  const now = Date.now();
  const userTimestamps = chatRateLimits.get(userId) || [];
  const recent = userTimestamps.filter(ts => now - ts < 10000);

  if (recent.length >= RATE_LIMITS.CHAT_MAX_PER_10S) {
    return false;
  }

  recent.push(now);
  chatRateLimits.set(userId, recent);
  return true;
}

export function setupChatHandlers(socket) {
  const { userId, username, role } = socket.user;

  socket.on('chat:send', async (payload, callback) => {
    try {
      if (!payload || typeof payload !== 'object') {
        throw Errors.INVALID_PAYLOAD;
      }

      const { pollId, content } = payload;

      if (!pollId || !content) {
        throw Errors.INVALID_PAYLOAD;
      }

      if (!checkChatRateLimit(userId)) {
        throw Errors.RATE_LIMITED;
      }

      const message = await chatService.sendMessage(
        { pollId, content },
        userId,
        username,
        role
      );

      getIO().to(`poll:${pollId}`).emit('chat:new_message', {
        message,
      });

      logger.info(`chat:send - ${username} dans sondage ${pollId}`);

      if (typeof callback === 'function') {
        callback({ success: true, data: message });
      }
    } catch (error) {
      logger.error('chat:send error:', error.message);
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

  socket.on('chat:history', async (payload, callback) => {
    try {
      if (!payload || !payload.pollId) {
        throw Errors.INVALID_PAYLOAD;
      }

      const { pollId } = payload;

      const messages = await chatService.getHistory(pollId, userId, role);

      logger.info(`chat:history - ${username} demande historique sondage ${pollId}`);

      if (typeof callback === 'function') {
        callback({ success: true, data: messages });
      }
    } catch (error) {
      logger.error('chat:history error:', error.message);
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

  socket.on('chat:delete', async (payload, callback) => {
    try {
      if (!payload || !payload.messageId) {
        throw Errors.INVALID_PAYLOAD;
      }

      const { messageId } = payload;

      const deletedMessage = await chatService.deleteMessage(messageId, userId, role);

      getIO().to(`poll:${deletedMessage.pollId}`).emit('chat:message_deleted', {
        messageId: deletedMessage.id,
        pollId: deletedMessage.pollId,
      });

      logger.info(`chat:delete - message ${messageId} supprimé par ${username}`);

      if (typeof callback === 'function') {
        callback({ success: true, data: deletedMessage });
      }
    } catch (error) {
      logger.error('chat:delete error:', error.message);
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

  socket.on('chat:joinPoll', async (payload, callback) => {
    try {
      if (!payload || !payload.pollId) {
        throw Errors.INVALID_PAYLOAD;
      }

      const { pollId } = payload;

      const messages = await chatService.getHistory(pollId, userId, role);

      socket.join(`poll:${pollId}`);

      logger.info(`chat:joinPoll - ${username} rejoint sondage ${pollId}`);

      if (typeof callback === 'function') {
        callback({ success: true, data: messages });
      }
    } catch (error) {
      logger.error('chat:joinPoll error:', error.message);
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

  socket.on('chat:leavePoll', (payload) => {
    if (payload && payload.pollId) {
      socket.leave(`poll:${payload.pollId}`);
      logger.info(`chat:leavePoll - ${username} quitte sondage ${payload.pollId}`);
    }
  });
}
