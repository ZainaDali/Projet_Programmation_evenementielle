import { Server } from 'socket.io';
import { authSocketMiddleware } from './middlewares/auth.socket.js';
import { presenceService } from '../domain/services/presence.service.js';
import { setupPollHandlers } from './handlers/polls.handler.js';
import { setupChatHandlers } from './handlers/chat.handler.js';
import { logger } from '../utils/logger.js';

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

    setupPollHandlers(socket);
    setupChatHandlers(socket);

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

    // ========== OPÉRATIONS ASYNC APRÈS l'enregistrement des handlers ==========
    // 4.1 METTRE EN LIGNE
    await presenceService.setOnline(userId, socket.id);
    
    // Joindre une room personnelle pour les messages privés
    socket.join(`user:${userId}`);
    
    // Notifier les autres utilisateurs qu'il est en ligne
    socket.broadcast.emit('user:online', {
      userId,
      username,
      timestamp: new Date().toISOString(),
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
 * Envoyer un événement à tous les utilisateurs dans une room de poll
 * @param {string} pollId - ID du poll
 * @param {string} event - Nom de l'événement
 * @param {any} data - Données à envoyer
 */
export function emitToPollRoom(pollId, event, data) {
  getIO().to(`poll:${pollId}`).emit(event, data);
}

/**
 * Envoyer un événement à tous les utilisateurs dans une room de chat (même que poll)
 * @param {string} pollId - ID du poll (le chat est lié au poll)
 * @param {string} event - Nom de l'événement
 * @param {any} data - Données à envoyer
 */
export function emitToChatRoom(pollId, event, data) {
  // Le chat utilise la même room que le poll
  emitToPollRoom(pollId, event, data);
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
  io.emit(event, data);
}
