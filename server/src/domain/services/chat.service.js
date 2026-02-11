import { getCollection } from '../../config/database.js';
import { COLLECTIONS, CHAT_LIMITS } from '../../config/constants.js';
import { generateMessageId } from '../../utils/ids.js';
import { Errors } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

export const chatService = {
  /**
   * Envoie un message dans un salon
   * @param {string} roomId - ID du salon
   * @param {string} content - Contenu du message
   * @param {string} senderId - ID de l'expéditeur
   * @param {string} senderUsername - Nom de l'expéditeur
   * @returns {object} Le message créé
   */
  async sendMessage({ roomId, content }, senderId, senderUsername) {
    // Vérifier que le salon existe et que l'utilisateur en est membre
    const roomsCollection = getCollection(COLLECTIONS.ROOMS);
    const room = await roomsCollection.findOne({ id: roomId });

    if (!room) {
      throw Errors.ROOM_NOT_FOUND;
    }

    // Vérifier les droits d'accès au salon
    const hasAccess = this.userHasRoomAccess(room, senderId);
    if (!hasAccess) {
      throw Errors.FORBIDDEN;
    }

    // Valider la taille du message
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

    // Garder seulement les N derniers messages par salon
    await this.pruneMessages(roomId);

    logger.info(`Message envoyé dans salon ${roomId} par ${senderUsername}`);

    return this.formatMessage(message);
  },

  /**
   * Récupère l'historique des messages d'un salon
   * @param {string} roomId - ID du salon
   * @param {string} userId - ID de l'utilisateur qui demande l'historique
   * @returns {object[]} Liste des messages
   */
  async getHistory(roomId, userId) {
    // Vérifier que le salon existe et que l'utilisateur en est membre
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

  /**
   * Supprime un message (admin ou auteur)
   * @param {string} messageId - ID du message
   * @param {string} userId - ID de l'utilisateur qui supprime
   * @param {string} userRole - Rôle de l'utilisateur
   * @returns {object} Le message mis à jour
   */
  async deleteMessage(messageId, userId, userRole) {
    const messagesCollection = getCollection(COLLECTIONS.MESSAGES);
    const message = await messagesCollection.findOne({ id: messageId });

    if (!message) {
      throw Errors.NOT_FOUND;
    }

    // Seul l'auteur ou un admin/modérateur peut supprimer
    if (message.senderId !== userId && userRole !== 'admin' && userRole !== 'moderator') {
      throw Errors.FORBIDDEN;
    }

    // Suppression logique (soft delete)
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

  /**
   * Vérifie si un utilisateur a accès à un salon
   * @param {object} room - L'objet salon depuis MongoDB
   * @param {string} userId - ID de l'utilisateur
   * @returns {boolean}
   */
  userHasRoomAccess(room, userId) {
    // Le créateur a toujours accès
    if (room.creatorId === userId) return true;

    switch (room.accessType) {
      case 'public':
        return true;
      case 'private':
        // Seul le créateur (déjà géré au-dessus)
        return false;
      case 'selected':
        // Seuls les membres sélectionnés
        return Array.isArray(room.allowedUserIds) && room.allowedUserIds.includes(userId);
      default:
        return false;
    }
  },

  /**
   * Supprime les messages anciens pour ne garder que les N derniers
   * @param {string} roomId - ID du salon
   */
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

  /**
   * Formate un message pour l'envoi au client
   * @param {object} message - Message brut depuis MongoDB
   * @returns {object} Message formaté
   */
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
