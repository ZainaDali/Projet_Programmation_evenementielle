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

      const { roomId, content } = payload;

      if (!roomId || !content) {
        throw Errors.INVALID_PAYLOAD;
      }

      if (!checkChatRateLimit(userId)) {
        throw Errors.RATE_LIMITED;
      }

      const message = await chatService.sendMessage(
        { roomId, content },
        userId,
        username
      );

      getIO().to(`room:${roomId}`).emit('chat:new_message', { message });

      logger.info(`chat:send - ${username} dans salon ${roomId}`);

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
      if (!payload || !payload.roomId) {
        throw Errors.INVALID_PAYLOAD;
      }

      const { roomId } = payload;
      const messages = await chatService.getHistory(roomId, userId);

      logger.info(`chat:history - ${username} demande historique salon ${roomId}`);

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

      getIO().to(`room:${deletedMessage.roomId}`).emit('chat:message_deleted', {
        messageId: deletedMessage.id,
        roomId: deletedMessage.roomId,
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

  socket.on('chat:joinRoom', async (payload, callback) => {
    try {
      if (!payload || !payload.roomId) {
        throw Errors.INVALID_PAYLOAD;
      }

      const { roomId } = payload;
      const messages = await chatService.getHistory(roomId, userId);

      socket.join(`room:${roomId}`);

      logger.info(`chat:joinRoom - ${username} rejoint salon ${roomId}`);

      if (typeof callback === 'function') {
        callback({ success: true, data: messages });
      }
    } catch (error) {
      logger.error('chat:joinRoom error:', error.message);
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

  socket.on('chat:leaveRoom', (payload) => {
    if (payload && payload.roomId) {
      socket.leave(`room:${payload.roomId}`);
      logger.info(`chat:leaveRoom - ${username} quitte salon ${payload.roomId}`);
    }
  });
}