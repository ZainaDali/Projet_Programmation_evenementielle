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
  
  // Erreur de validation Zod (v3: err.errors, v4: err.issues)
  if (err.name === 'ZodError') {
    const issues = err.issues || err.errors || [];
    const first = issues[0];
    const message = first
      ? (typeof first.message === 'string' ? first.message : (first.message?.message || 'Champ invalide'))
      : 'Données invalides';
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message,
        details: issues,
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
