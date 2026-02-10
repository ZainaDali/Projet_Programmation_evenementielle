import { Server } from 'socket.io';
import { authSocketMiddleware } from './middlewares/auth.socket.js';
import { presenceService } from '../domain/services/presence.service.js';
import { logger } from '../utils/logger.js';
import { EVENTS } from './protocol/events.js';
import { Schemas } from './protocol/schemas.js';

let io = null;

/**
 * Initialise Socket.IO avec le serveur HTTP
 * @param {http.Server} httpServer - Le serveur HTTP
 * @returns {Server} - Instance Socket.IO
 */
export function initSocketIO(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: '*', // En prod, mettre l'URL du client
      methods: ['GET', 'POST'],
    },
  });
  
  // ========== MIDDLEWARE D'AUTHENTIFICATION ==========
  // Vérifie le token AVANT d'accepter la connexion
  io.use(authSocketMiddleware);
  
  // ========== GESTION DES CONNEXIONS ==========
  io.on('connection', async (socket) => {
    const { userId, username, role } = socket.user;
    
    logger.socket(`🔌 Connecté: ${username} (${userId}) - Socket: ${socket.id}`);
    
    // ========== 4.1 METTRE EN LIGNE ==========
    await presenceService.setOnline(userId, socket.id);
    
    // Joindre une room personnelle pour les messages privés
    socket.join(`user:${userId}`);
    
    // Notifier les autres utilisateurs qu'il est en ligne
    socket.broadcast.emit('user:online', {
      userId,
      username,
      timestamp: new Date().toISOString(),
    });
    
    // ========== ÉVÉNEMENTS DE BASE ==========
    
    // Ping/Pong pour vérifier la connexion
    socket.on('ping', (callback) => {
      if (typeof callback === 'function') {
        callback({ pong: true, timestamp: Date.now() });
      }
    });
    
    // Récupérer la liste des utilisateurs en ligne
    socket.on('presence:getOnlineUsers', async (callback) => {
      try {
        const onlineUsers = await presenceService.getOnlineUsers();
        if (typeof callback === 'function') {
          callback({ success: true, data: onlineUsers });
        }
      } catch (error) {
        logger.error('Error getting online users:', error.message);
        if (typeof callback === 'function') {
          callback({ success: false, error: error.message });
        }
      }
    });
    
    // Récupérer TOUS les utilisateurs (online + offline)
    socket.on('presence:getAllUsers', async () => {
      logger.info('📋 Requête getAllUsers reçue');
      
      try {
        const allUsers = await presenceService.getAllUsers();
        logger.info(`📋 ${allUsers.length} utilisateurs trouvés`);
        
        // Envoyer via événement
        socket.emit('presence:allUsersResponse', { success: true, data: allUsers });
        logger.info('📋 Réponse envoyée via event!');
      } catch (error) {
        logger.error('Error getting all users:', error.message);
        socket.emit('presence:allUsersResponse', { success: false, error: error.message });
      }
    });

    // ========== SALONS (ROOMS) ==========

    socket.on(EVENTS.ROOM_JOIN, async (payload, callback) => {
  try {
    // 1 Validation du payload
    const { roomId } = Schemas.roomJoin.parse(payload);

    // 2 Mise à jour de la présence (métier)
    await presenceService.joinRoom(userId, roomId);

    // 3 Rejoindre la room Socket.IO
    socket.join(roomId);

    logger.info(`👥 ${username} a rejoint la room ${roomId}`);

    // 4 Notifier les autres utilisateurs du salon
    socket.to(roomId).emit(EVENTS.PRESENCE_USER_JOINED, {
      userId,
      username,
      roomId,
      timestamp: new Date().toISOString(),
    });

    // 5 Récupérer la liste des utilisateurs du salon
    const roomUsers = await presenceService.getOnlineUsers();

    //  Filtrer uniquement ceux qui sont dans cette room
    const usersInRoom = roomUsers.filter(user =>
      user.userId !== userId // on enlève soi-même
    );

    // 6 Envoyer l’état au nouvel arrivant
    socket.emit(EVENTS.PRESENCE_UPDATE, {
      roomId,
      users: usersInRoom,
    });

    // 7 Callback succès (optionnel)
    if (typeof callback === 'function') {
      callback({ success: true });
    }
  } catch (error) {
    logger.error('❌ Erreur room:join', error.message);

    // Erreur de validation ou autre
    if (typeof callback === 'function') {
      callback({
        success: false,
        error: 'INVALID_PAYLOAD',
      });
    }
  }
});



socket.on(EVENTS.ROOM_LEAVE, async (payload, callback) => {
  try {
    // 1 Validation du payload
    const { roomId } = Schemas.roomLeave.parse(payload);

    // 2 Mise à jour de la présence (métier)
    await presenceService.leaveRoom(userId, roomId);

    // 3 Quitter la room Socket.IO
    socket.leave(roomId);

    logger.info(`👋 ${username} a quitté la room ${roomId}`);

    // 4 Notifier les autres utilisateurs du salon
    socket.to(roomId).emit(EVENTS.PRESENCE_USER_LEFT, {
      userId,
      username,
      roomId,
      timestamp: new Date().toISOString(),
    });

    // 5 Callback succès (optionnel)
    if (typeof callback === 'function') {
      callback({ success: true });
    }
  } catch (error) {
    logger.error('❌ Erreur room:leave', error.message);

    if (typeof callback === 'function') {
      callback({
        success: false,
        error: 'INVALID_PAYLOAD',
      });
    }
  }
});




    
    // ========== 4.2 DÉCONNEXION ==========
    socket.on('disconnect', async (reason) => {
      logger.socket(`🔌 Déconnecté: ${username} - Raison: ${reason}`);
      
      // Mettre hors ligne dans MongoDB
      await presenceService.setOffline(userId);
      
      // Notifier les autres utilisateurs
      socket.broadcast.emit('user:offline', {
        userId,
        username,
        reason,
        timestamp: new Date().toISOString(),
      });
    });
    
    // Erreur sur le socket
    socket.on('error', (error) => {
      logger.error(`Socket error (${username}):`, error.message);
    });
  });
  
  logger.success('🔌 Socket.IO initialisé');
  
  return io;
}

/**
 * Récupérer l'instance Socket.IO
 * @returns {Server}
 */
export function getIO() {
  if (!io) {
    throw new Error('Socket.IO not initialized. Call initSocketIO() first.');
  }
  return io;
}

/**
 * Envoyer un événement à un utilisateur spécifique
 * @param {string} userId - ID de l'utilisateur
 * @param {string} event - Nom de l'événement
 * @param {any} data - Données à envoyer
 */
export function emitToUser(userId, event, data) {
  getIO().to(`user:${userId}`).emit(event, data);
}

/**
 * Envoyer un événement à tous les utilisateurs connectés
 * @param {string} event - Nom de l'événement
 * @param {any} data - Données à envoyer
 */
export function broadcast(event, data) {
  if (!io) {
    logger.error('❌ broadcast: Socket.IO non initialisé!');
    return;
  }
  logger.info(`📢 Broadcasting ${event} à tous les clients...`);
  io.emit(event, data);
  logger.info(`📢 Broadcast ${event} terminé`);
}
