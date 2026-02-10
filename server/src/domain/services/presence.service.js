import { getCollection } from '../../config/database.js';
import { COLLECTIONS, PRESENCE_STATUS } from '../../config/constants.js';
import { logger } from '../../utils/logger.js';

/**
 * Service de gestion de la présence (online/offline)
 */
export const presenceService = {
  /**
   * Mettre un utilisateur en ligne
   * @param {string} userId - ID de l'utilisateur
   * @param {string} socketId - ID du socket
   */
  async setOnline(userId, socketId) {
    const presenceCollection = getCollection(COLLECTIONS.PRESENCE);
    
    await presenceCollection.updateOne(
      { userId },
      {
        $set: {
          status: PRESENCE_STATUS.ONLINE,
          socketId,
          lastSeenAt: new Date(),
          connectedAt: new Date(),
        },
        $setOnInsert: {
          userId,
          currentRoomIds: [],
        },
      },
      { upsert: true }
    );
    
    logger.info(`🟢 ${userId} est en ligne (socket: ${socketId})`);
  },
  
  /**
   * Mettre un utilisateur hors ligne
   * @param {string} userId - ID de l'utilisateur
   */
  async setOffline(userId) {
    const presenceCollection = getCollection(COLLECTIONS.PRESENCE);
    
    await presenceCollection.updateOne(
      { userId },
      {
        $set: {
          status: PRESENCE_STATUS.OFFLINE,
          socketId: null,
          lastSeenAt: new Date(),
          currentRoomIds: [],
        },
      }
    );
    
    logger.info(`🔴 ${userId} est hors ligne`);
  },
  
  /**
   * Mettre à jour lastSeenAt (pour le statut "away")
   * @param {string} userId - ID de l'utilisateur
   */
  async updateLastSeen(userId) {
    const presenceCollection = getCollection(COLLECTIONS.PRESENCE);
    
    await presenceCollection.updateOne(
      { userId },
      { $set: { lastSeenAt: new Date() } }
    );
  },
  
  /**
   * Récupérer le statut de présence d'un utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<object|null>}
   */
  async getPresence(userId) {
    const presenceCollection = getCollection(COLLECTIONS.PRESENCE);
    return await presenceCollection.findOne({ userId });
  },
  
  /**
   * Récupérer les utilisateurs en ligne
   * @returns {Promise<object[]>}
   */
  async getOnlineUsers() {
    const presenceCollection = getCollection(COLLECTIONS.PRESENCE);
    const usersCollection = getCollection(COLLECTIONS.USERS);
    
    // Récupérer les présences en ligne
    const onlinePresences = await presenceCollection
      .find({ status: PRESENCE_STATUS.ONLINE })
      .toArray();
    
    // Enrichir avec les infos utilisateur
    const userIds = onlinePresences.map(p => p.userId);
    const users = await usersCollection
      .find({ id: { $in: userIds } })
      .project({ id: 1, username: 1, role: 1 })
      .toArray();
    
    // Mapper les résultats
    return onlinePresences.map(presence => {
      const user = users.find(u => u.id === presence.userId);
      return {
        userId: presence.userId,
        username: user?.username || 'Unknown',
        role: user?.role,
        status: presence.status,
        lastSeenAt: presence.lastSeenAt,
        connectedAt: presence.connectedAt,
      };
    });
  },
  
  /**
   * Vérifier si un utilisateur est en ligne
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<boolean>}
   */
  async isOnline(userId) {
    const presence = await this.getPresence(userId);
    return presence?.status === PRESENCE_STATUS.ONLINE;
  },
  
  /**
   * Récupérer TOUS les utilisateurs avec leur statut (online + offline)
   * @returns {Promise<object[]>}
   */
  async getAllUsers() {
    const presenceCollection = getCollection(COLLECTIONS.PRESENCE);
    const usersCollection = getCollection(COLLECTIONS.USERS);
    
    // Récupérer tous les utilisateurs
    const users = await usersCollection
      .find({})
      .project({ id: 1, username: 1, role: 1 })
      .toArray();
    
    // Récupérer toutes les présences
    const presences = await presenceCollection.find({}).toArray();
    
    // Mapper les résultats
    return users.map(user => {
      const presence = presences.find(p => p.userId === user.id);
      return {
        userId: user.id,
        username: user.username,
        role: user.role,
        status: presence?.status || PRESENCE_STATUS.OFFLINE,
        lastSeenAt: presence?.lastSeenAt || null,
        connectedAt: presence?.connectedAt || null,
      };
    });
  },
  
  /**
   * Ajouter une room aux rooms actuelles de l'utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @param {string} roomId - ID de la room
   */
  async joinRoom(userId, roomId) {
    const presenceCollection = getCollection(COLLECTIONS.PRESENCE);
    
    await presenceCollection.updateOne(
      { userId },
      { $addToSet: { currentRoomIds: roomId } }
    );
  },
  
  /**
   * Retirer une room des rooms actuelles de l'utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @param {string} roomId - ID de la room
   */
  async leaveRoom(userId, roomId) {
    const presenceCollection = getCollection(COLLECTIONS.PRESENCE);
    
    await presenceCollection.updateOne(
      { userId },
      { $pull: { currentRoomIds: roomId } }
    );
  },
  
  /**
   * Récupérer les rooms actuelles d'un utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<string[]>}
   */
  async getCurrentRooms(userId) {
    const presence = await this.getPresence(userId);
    return presence?.currentRoomIds || [];
  },
};
