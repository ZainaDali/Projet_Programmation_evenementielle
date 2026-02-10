import { authService } from '../../domain/services/auth.service.js';
import { logger } from '../../utils/logger.js';

/**
 * Middleware d'authentification Socket.IO
 * Vérifie le token envoyé lors du handshake
 * 
 * Côté client : io.connect(url, { auth: { token: 'xxx' } })
 */
export async function authSocketMiddleware(socket, next) {
  try {
    // 1. Récupérer le token du handshake
    const token = socket.handshake.auth?.token;
    
    if (!token) {
      logger.warn(`🚫 Socket ${socket.id} - Token manquant`);
      return next(new Error('TOKEN_REQUIRED'));
    }
    
    // 2. Valider le token et récupérer l'utilisateur
    const user = await authService.validateToken(token);
    
    // 3. Attacher l'utilisateur au socket
    socket.user = {
      userId: user.id,
      username: user.username,
      role: user.role,
    };
    
    // 4. Stocker le token pour logout éventuel
    socket.token = token;
    
    logger.socket(`✅ Socket ${socket.id} authentifié: ${user.username}`);
    
    next();
  } catch (error) {
    logger.error(`🚫 Socket ${socket.id} - Auth échouée: ${error.message}`);
    
    // Renvoyer une erreur propre au client
    next(new Error(error.code || 'AUTH_FAILED'));
  }
}
