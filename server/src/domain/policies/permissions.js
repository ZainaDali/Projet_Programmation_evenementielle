import { ROLES } from '../../config/constants.js';
import { Errors } from '../../utils/errors.js';

/**
 * Vérifier si l'utilisateur est admin
 * @param {object} user - Utilisateur
 * @returns {boolean}
 */
export function isAdmin(user) {
  return user?.role === ROLES.ADMIN;
}

/**
 * Vérifier si l'utilisateur est modérateur ou admin
 * @param {object} user - Utilisateur
 * @returns {boolean}
 */
export function isModerator(user) {
  return user?.role === ROLES.ADMIN || user?.role === ROLES.MODERATOR;
}

/**
 * Middleware HTTP pour vérifier le rôle admin
 */
export function requireAdmin(req, res, next) {
  if (!isAdmin(req.user)) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Admin access required',
      },
    });
  }
  next();
}

/**
 * Middleware HTTP pour vérifier le rôle modérateur
 */
export function requireModerator(req, res, next) {
  if (!isModerator(req.user)) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Moderator access required',
      },
    });
  }
  next();
}

/**
 * Vérifier les permissions pour une action
 * @param {object} user - Utilisateur
 * @param {string} action - Action à effectuer
 * @param {object} resource - Ressource concernée
 */
export function checkPermission(user, action, resource = null) {
  // Admin peut tout faire
  if (isAdmin(user)) {
    return true;
  }
  
  switch (action) {
    case 'create:room':
      // Seul admin peut créer des rooms (selon l'énoncé)
      return false;
      
    case 'delete:room':
      // Admin ou créateur
      return resource?.creatorId === user.id;
      
    case 'update:room':
      // Admin ou créateur
      return resource?.creatorId === user.id;
      
    case 'manage:users':
      // Admin ou modérateur
      return isModerator(user);
      
    default:
      return false;
  }
}
