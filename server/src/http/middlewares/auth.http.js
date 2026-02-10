import { authService } from '../../domain/services/auth.service.js';
import { Errors } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

/**
 * Middleware d'authentification HTTP
 * Extrait le token du header Authorization et valide la session
 */
export async function authMiddleware(req, res, next) {
  try {
    // Récupérer le token du header Authorization
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_REQUIRED',
          message: 'Authentication token required',
        },
      });
    }
    
    // Format: "Bearer <token>"
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_AUTH_FORMAT',
          message: 'Authorization header must be: Bearer <token>',
        },
      });
    }
    
    const token = parts[1];
    
    // Valider le token et récupérer l'utilisateur
    const user = await authService.validateToken(token);
    
    // Attacher l'utilisateur à la requête
    req.user = user;
    req.token = token;
    
    next();
  } catch (error) {
    logger.error('Auth middleware error:', error.message);
    
    const statusCode = error.statusCode || 401;
    return res.status(statusCode).json({
      success: false,
      error: {
        code: error.code || 'AUTH_ERROR',
        message: error.message,
      },
    });
  }
}

/**
 * Middleware optionnel - n'échoue pas si pas de token
 */
export async function optionalAuthMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader) {
      const parts = authHeader.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        const token = parts[1];
        const user = await authService.validateToken(token);
        req.user = user;
        req.token = token;
      }
    }
    
    next();
  } catch (error) {
    // Ignorer les erreurs d'auth pour le middleware optionnel
    next();
  }
}
