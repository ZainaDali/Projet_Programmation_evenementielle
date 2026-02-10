import { getCollection } from '../../config/database.js';
import { COLLECTIONS, ACCESS_TYPES } from '../../config/constants.js';
import { generateRoomId } from '../../utils/ids.js';
import { Errors, createError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

/**
 * Service de gestion des rooms (salons de sondage avec chat)
 * 
 * Types d'accès:
 * - public: tout le monde peut accéder
 * - private: personne ne peut accéder (sauf créateur)
 * - selected: uniquement les utilisateurs sélectionnés
 */
export const roomsService = {
  /**
   * Créer une nouvelle room
   */
  async createRoom({ name, description = '', accessType = 'public', allowedUserIds = [] }, creatorId, creatorUsername) {
    const roomsCollection = getCollection(COLLECTIONS.ROOMS);
    
    // Vérifier si le nom existe déjà
    const existing = await roomsCollection.findOne({ name });
    if (existing) {
      throw createError('Room name already exists', 409, 'ROOM_NAME_EXISTS');
    }
    
    // Valider le type d'accès
    if (!Object.values(ACCESS_TYPES).includes(accessType)) {
      throw createError('Invalid access type', 400, 'INVALID_ACCESS_TYPE');
    }
    
    const room = {
      id: generateRoomId(),
      name,
      description,
      accessType,
      allowedUserIds: accessType === 'selected' ? [...new Set([...allowedUserIds, creatorId])] : [],
      creatorId,
      creatorUsername,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    await roomsCollection.insertOne(room);
    logger.success(`🏠 Room créée: ${name} (${room.id}) par ${creatorUsername} - Accès: ${accessType}`);
    
    return {
      id: room.id,
      name: room.name,
      description: room.description,
      accessType: room.accessType,
      allowedUserIds: room.allowedUserIds,
      creatorId: room.creatorId,
      creatorUsername: room.creatorUsername,
      createdAt: room.createdAt,
    };
  },
  
  /**
   * Récupérer les rooms visibles par un utilisateur
   */
  async getVisibleRooms(userId) {
    const roomsCollection = getCollection(COLLECTIONS.ROOMS);
    
    // Inclure les rooms:
    // 1. Publiques (accessType = 'public' ou null/undefined pour rétrocompatibilité)
    // 2. Sélectionnées où l'utilisateur est dans la liste
    // 3. Créées par l'utilisateur
    const rooms = await roomsCollection.find({
      $or: [
        { accessType: ACCESS_TYPES.PUBLIC },
        { accessType: { $exists: false } }, // Anciennes rooms sans accessType
        { accessType: null }, // Rooms avec accessType null
        { accessType: ACCESS_TYPES.SELECTED, allowedUserIds: userId },
        { creatorId: userId },
      ],
    }).sort({ createdAt: -1 }).toArray();
    
    logger.info(`📋 ${rooms.length} rooms trouvées pour ${userId}`);
    
    // Mapper les rooms
    const result = rooms.map(room => ({
      id: room.id,
      name: room.name,
      description: room.description,
      accessType: room.accessType,
      creatorId: room.creatorId,
      creatorUsername: room.creatorUsername,
      // TODO: Ajouter pollsCount quand les sondages seront implémentés
      pollsCount: 0,
      createdAt: room.createdAt,
    }));
    
    return result;
  },
  
  /**
   * Récupérer une room par ID
   */
  async getRoomById(roomId) {
    const roomsCollection = getCollection(COLLECTIONS.ROOMS);
    const room = await roomsCollection.findOne({ id: roomId });
    
    if (!room) {
      throw Errors.ROOM_NOT_FOUND;
    }
    
    return room;
  },
  
  // TODO: Implémenter getRoomWithPolls quand les sondages seront développés
  // async getRoomWithPolls(roomId) { ... }
  
  /**
   * Vérifier si un utilisateur a accès à une room
   */
  async canAccessRoom(roomId, userId) {
    const room = await this.getRoomById(roomId);
    
    if (room.creatorId === userId) return true;
    
    // Si accessType n'est pas défini, on considère la room comme publique (rétrocompatibilité)
    if (!room.accessType || room.accessType === ACCESS_TYPES.PUBLIC) {
      return true;
    }
    
    switch (room.accessType) {
      case ACCESS_TYPES.PRIVATE: return false;
      case ACCESS_TYPES.SELECTED: 
        return Array.isArray(room.allowedUserIds) && room.allowedUserIds.includes(userId);
      default: return true; // Par défaut, accessible (rétrocompatibilité)
    }
  },

  /**
   * Ajouter des utilisateurs à une room
   */
  async addUsersToRoom(roomId, userIds, requesterId) {
    const room = await this.getRoomById(roomId);
    if (room.creatorId !== requesterId) throw Errors.NOT_AUTHORIZED;
    
    const roomsCollection = getCollection(COLLECTIONS.ROOMS);
    await roomsCollection.updateOne(
      { id: roomId },
      { $addToSet: { allowedUserIds: { $each: userIds } }, $set: { updatedAt: new Date() } }
    );
    logger.info(`👥 ${userIds.length} utilisateurs ajoutés à la room ${roomId}`);
  },

  /**
   * Supprimer une room
   */
  async deleteRoom(roomId, requesterId, requesterRole) {
    const room = await this.getRoomById(roomId);
    if (room.creatorId !== requesterId && requesterRole !== 'admin') throw Errors.NOT_AUTHORIZED;
    
    const roomsCollection = getCollection(COLLECTIONS.ROOMS);
    await roomsCollection.deleteOne({ id: roomId });
    
    // TODO: Supprimer les messages associés quand le chat sera implémenté
    // const messagesCollection = getCollection(COLLECTIONS.MESSAGES);
    // await messagesCollection.deleteMany({ roomId });
    
    // TODO: Supprimer les sondages associés quand les polls seront implémentés
    // const pollsCollection = getCollection(COLLECTIONS.POLLS);
    // await pollsCollection.deleteMany({ roomId });
    
    logger.info(`🗑️ Room ${roomId} supprimée`);
  },

  /**
   * Mettre à jour une room
   */
  async updateRoom(roomId, updates, requesterId, requesterRole) {
    const room = await this.getRoomById(roomId);
    if (room.creatorId !== requesterId && requesterRole !== 'admin') throw Errors.NOT_AUTHORIZED;
    
    const roomsCollection = getCollection(COLLECTIONS.ROOMS);
    const allowedUpdates = {};
    if (updates.name) allowedUpdates.name = updates.name;
    if (updates.description !== undefined) allowedUpdates.description = updates.description;
    if (updates.accessType && Object.values(ACCESS_TYPES).includes(updates.accessType)) {
      allowedUpdates.accessType = updates.accessType;
    }
    if (updates.allowedUserIds) allowedUpdates.allowedUserIds = updates.allowedUserIds;
    
    await roomsCollection.updateOne(
      { id: roomId },
      { $set: { ...allowedUpdates, updatedAt: new Date() } }
    );
    
    return await this.getRoomById(roomId);
  },
};
