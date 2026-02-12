import { getCollection } from '../../config/database.js';
import { COLLECTIONS, CHAT_LIMITS } from '../../config/constants.js';
import { generateMessageId } from '../../utils/ids.js';
import { Errors } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import { pollsService } from './polls.service.js';

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

  async sendPollMessage({ pollId, content }, senderId, senderUsername) {
    // Vérifier que le sondage existe
    await pollsService.getPollById(pollId);

    if (!content || content.trim().length === 0) {
      throw Errors.INVALID_PAYLOAD;
    }

    if (content.length > CHAT_LIMITS.MAX_MESSAGE_LENGTH) {
      throw Errors.MESSAGE_TOO_LARGE;
    }

    const messagesCollection = getCollection(COLLECTIONS.MESSAGES);

    const message = {
      id: generateMessageId(),
      pollId,
      content: content.trim(),
      senderId,
      senderUsername,
      deleted: false,
      createdAt: new Date(),
      type: 'poll_chat',
    };

    await messagesCollection.insertOne(message);

    // On pourrait aussi pruner, mais gardons simple pour l'instant
    // await this.prunePollMessages(pollId);

    logger.info(`Message envoyé dans sondage ${pollId} par ${senderUsername}`);

    return this.formatMessage(message);
  },

  async getPollMessages(pollId) {
    // Vérifier l'existence
    await pollsService.getPollById(pollId);

    const messagesCollection = getCollection(COLLECTIONS.MESSAGES);
    const messages = await messagesCollection
      .find({ pollId })
      .sort({ createdAt: 1 })
      .limit(CHAT_LIMITS.HISTORY_SIZE)
      .toArray();

    return messages.map(m => this.formatMessage(m));
  },

  formatMessage(message) {
    return {
      id: message.id,
      roomId: message.roomId,
      pollId: message.pollId, // Ajout du pollId
      content: message.content,
      senderId: message.senderId,
      senderUsername: message.senderUsername,
      deleted: message.deleted || false,
      createdAt: message.createdAt,
      type: message.type || 'room_chat',
    };
  },
};
