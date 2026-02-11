import { getCollection } from '../../config/database.js';
import { COLLECTIONS, CHAT_LIMITS } from '../../config/constants.js';
import { generateMessageId } from '../../utils/ids.js';
import { Errors } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

export const chatService = {
  async sendMessage({ roomId, content }, senderId, senderUsername) {
    const roomsCollection = getCollection(COLLECTIONS.ROOMS);
    const room = await roomsCollection.findOne({ id: roomId });

    if (!room) {
      throw Errors.ROOM_NOT_FOUND;
    }

    const hasAccess = this.userHasRoomAccess(room, senderId);
    if (!hasAccess) {
      throw Errors.FORBIDDEN;
    }

    if (!content || content.trim().length === 0) {
      throw Errors.INVALID_PAYLOAD;
    }

    if (content.length > CHAT_LIMITS.MAX_MESSAGE_LENGTH) {
      throw Errors.MESSAGE_TOO_LARGE;
    }

    const messagesCollection = getCollection(COLLECTIONS.MESSAGES);

    const message = {
      id: generateMessageId(),
      roomId,
      content: content.trim(),
      senderId,
      senderUsername,
      deleted: false,
      createdAt: new Date(),
    };

    await messagesCollection.insertOne(message);
    await this.pruneMessages(roomId);

    logger.info(`Message envoyé dans salon ${roomId} par ${senderUsername}`);

    return this.formatMessage(message);
  },

  async getHistory(roomId, userId) {
    const roomsCollection = getCollection(COLLECTIONS.ROOMS);
    const room = await roomsCollection.findOne({ id: roomId });

    if (!room) {
      throw Errors.ROOM_NOT_FOUND;
    }

    const hasAccess = this.userHasRoomAccess(room, userId);
    if (!hasAccess) {
      throw Errors.FORBIDDEN;
    }

    const messagesCollection = getCollection(COLLECTIONS.MESSAGES);
    const messages = await messagesCollection
      .find({ roomId })
      .sort({ createdAt: 1 })
      .limit(CHAT_LIMITS.HISTORY_SIZE)
      .toArray();

    return messages.map(m => this.formatMessage(m));
  },

  async deleteMessage(messageId, userId, userRole) {
    const messagesCollection = getCollection(COLLECTIONS.MESSAGES);
    const message = await messagesCollection.findOne({ id: messageId });

    if (!message) {
      throw Errors.NOT_FOUND;
    }

    if (message.senderId !== userId && userRole !== 'admin' && userRole !== 'moderator') {
      throw Errors.FORBIDDEN;
    }

    await messagesCollection.updateOne(
      { id: messageId },
      {
        $set: {
          deleted: true,
          content: '[Message supprimé]',
          deletedAt: new Date(),
          deletedBy: userId,
        },
      }
    );

    const updated = await messagesCollection.findOne({ id: messageId });
    logger.info(`Message ${messageId} supprimé par ${userId}`);
    return this.formatMessage(updated);
  },

  userHasRoomAccess(room, userId) {
    if (room.creatorId === userId) return true;

    switch (room.accessType) {
      case 'public':
        return true;
      case 'private':
        return false;
      case 'selected':
        return Array.isArray(room.allowedUserIds) && room.allowedUserIds.includes(userId);
      default:
        return false;
    }
  },

  async pruneMessages(roomId) {
    const messagesCollection = getCollection(COLLECTIONS.MESSAGES);
    const count = await messagesCollection.countDocuments({ roomId });

    if (count > CHAT_LIMITS.HISTORY_SIZE) {
      const oldest = await messagesCollection
        .find({ roomId })
        .sort({ createdAt: 1 })
        .limit(count - CHAT_LIMITS.HISTORY_SIZE)
        .toArray();

      const idsToDelete = oldest.map(m => m.id);
      await messagesCollection.deleteMany({ id: { $in: idsToDelete } });
    }
  },

  formatMessage(message) {
    return {
      id: message.id,
      roomId: message.roomId,
      content: message.content,
      senderId: message.senderId,
      senderUsername: message.senderUsername,
      deleted: message.deleted || false,
      createdAt: message.createdAt,
    };
  },
};