import { getCollection } from '../../config/database.js';
import { COLLECTIONS, CHAT_LIMITS } from '../../config/constants.js';
import { generateMessageId } from '../../utils/ids.js';
import { Errors } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

export const chatService = {
  async sendMessage({ pollId, content }, senderId, senderUsername, senderRole) {
    const pollsCollection = getCollection(COLLECTIONS.POLLS);
    const poll = await pollsCollection.findOne({ id: pollId });

    if (!poll) {
      throw Errors.NOT_FOUND;
    }

    const hasAccess = this.userHasPollAccess(poll, senderId, senderRole);
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
      pollId,
      content: content.trim(),
      senderId,
      senderUsername,
      deleted: false,
      createdAt: new Date(),
    };

    await messagesCollection.insertOne(message);

    await this.pruneMessages(pollId);

    logger.info(`Message envoyé dans sondage ${pollId} par ${senderUsername}`);

    return this.formatMessage(message);
  },

  async getHistory(pollId, userId, userRole) {
    const pollsCollection = getCollection(COLLECTIONS.POLLS);
    const poll = await pollsCollection.findOne({ id: pollId });

    if (!poll) {
      throw Errors.NOT_FOUND;
    }

    const hasAccess = this.userHasPollAccess(poll, userId, userRole);
    if (!hasAccess) {
      throw Errors.FORBIDDEN;
    }

    const messagesCollection = getCollection(COLLECTIONS.MESSAGES);
    const messages = await messagesCollection
      .find({ pollId })
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

  userHasPollAccess(poll, userId, userRole) {
    if (userRole === 'admin') return true;

    if (poll.creatorId === userId) return true;

    if (poll.kickedUserIds?.includes(userId)) return false;

    if (!poll.accessType || poll.accessType === 'public') return true;

    if (poll.accessType === 'private') return false;

    if (poll.accessType === 'selected') {
      return Array.isArray(poll.allowedUserIds) && poll.allowedUserIds.includes(userId);
    }

    return true;
  },

  async pruneMessages(pollId) {
    const messagesCollection = getCollection(COLLECTIONS.MESSAGES);
    const count = await messagesCollection.countDocuments({ pollId });

    if (count > CHAT_LIMITS.HISTORY_SIZE) {
      const oldest = await messagesCollection
        .find({ pollId })
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
      pollId: message.pollId,
      content: message.content,
      senderId: message.senderId,
      senderUsername: message.senderUsername,
      deleted: message.deleted || false,
      createdAt: message.createdAt,
    };
  },
};