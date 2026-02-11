/**
 * Classe d'erreur personnalisée pour l'API
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Erreurs prédéfinies
 */
export const Errors = {
  // Authentification
  INVALID_CREDENTIALS: new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS'),
  TOKEN_REQUIRED: new AppError('Authentication token required', 401, 'TOKEN_REQUIRED'),
  TOKEN_INVALID: new AppError('Invalid or expired token', 401, 'TOKEN_INVALID'),
  TOKEN_EXPIRED: new AppError('Token has expired', 401, 'TOKEN_EXPIRED'),
  
  // Validation
  VALIDATION_ERROR: (message) => new AppError(message, 400, 'VALIDATION_ERROR'),
  MISSING_FIELD: (field) => new AppError(`Missing required field: ${field}`, 400, 'MISSING_FIELD'),
  
  // Utilisateur
  USER_NOT_FOUND: new AppError('User not found', 404, 'USER_NOT_FOUND'),
  USERNAME_TAKEN: new AppError('Username already taken', 409, 'USERNAME_TAKEN'),
  
  // Rooms
  ROOM_NOT_FOUND: new AppError('Room not found', 404, 'ROOM_NOT_FOUND'),
  NOT_IN_ROOM: new AppError('You are not in this room', 403, 'NOT_IN_ROOM'),
  ALREADY_IN_ROOM: new AppError('Already in this room', 409, 'ALREADY_IN_ROOM'),
  
  // Polls
  POLL_NOT_FOUND: new AppError('Poll not found', 404, 'POLL_NOT_FOUND'),
  POLL_CLOSED: new AppError('Poll is closed', 409, 'CONFLICT'),
  ALREADY_VOTED: new AppError('You have already voted in this poll', 409, 'CONFLICT'),
  INVALID_OPTION: new AppError('Invalid poll option', 400, 'INVALID_PAYLOAD'),
  INVALID_POLL_OPTIONS: new AppError('Poll must have between 2 and 6 options', 400, 'INVALID_PAYLOAD'),
  
  // Rate limiting
  RATE_LIMITED: new AppError('Too many requests, please slow down', 429, 'RATE_LIMITED'),
  
  // Permissions
  FORBIDDEN: new AppError('Access forbidden', 403, 'FORBIDDEN'),
  NOT_AUTHORIZED: new AppError('Not authorized to perform this action', 403, 'NOT_AUTHORIZED'),
  
  // Général
  NOT_FOUND: new AppError('Resource not found', 404, 'NOT_FOUND'),
  INTERNAL_ERROR: new AppError('Internal server error', 500, 'INTERNAL_ERROR'),
};

/**
 * Créer une erreur personnalisée
 */
export function createError(message, statusCode = 500, code = 'ERROR') {
  return new AppError(message, statusCode, code);
}
