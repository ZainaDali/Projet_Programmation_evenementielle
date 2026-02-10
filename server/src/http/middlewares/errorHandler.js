import { logger } from '../../utils/logger.js';
import { AppError } from '../../utils/errors.js';

/**
 * Middleware de gestion des erreurs globales
 */
export function errorHandler(err, req, res, next) {
  logger.error('Error:', err.message);
  
  // Erreur opérationnelle (attendue)
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
    });
  }
  
  // Erreur de validation Zod
  if (err.name === 'ZodError') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: err.errors,
      },
    });
  }
  
  // Erreur MongoDB duplicate key
  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      error: {
        code: 'DUPLICATE_KEY',
        message: 'Resource already exists',
      },
    });
  }
  
  // Erreur inattendue
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    },
  });
}

/**
 * Middleware pour les routes non trouvées
 */
export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
}
