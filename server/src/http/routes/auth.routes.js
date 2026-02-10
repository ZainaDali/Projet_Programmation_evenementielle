import { Router } from 'express';
import { z } from 'zod';
import { authService } from '../../domain/services/auth.service.js';
import { authMiddleware } from '../middlewares/auth.http.js';
import { logger } from '../../utils/logger.js';

const router = Router();

// Schéma de validation pour le login
const loginSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers and underscores'),
  password: z.string().optional(),
});

/**
 * POST /auth/login
 * Authentification ou création d'utilisateur
 */
router.post('/login', async (req, res, next) => {
  try {
    // Valider les données d'entrée
    const { username, password } = loginSchema.parse(req.body);
    
    // Appeler le service d'authentification
    const result = await authService.login(username, password);
    
    logger.success(`✅ Login réussi: ${username}`);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/logout
 * Déconnexion - Révoque le token
 */
router.post('/logout', authMiddleware, async (req, res, next) => {
  try {
    const result = await authService.logout(req.token);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /auth/me
 * Récupérer les informations de l'utilisateur connecté
 */
router.get('/me', authMiddleware, async (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      user: req.user,
    },
  });
});

/**
 * GET /auth/validate
 * Valider un token (pour vérification côté client)
 */
router.get('/validate', authMiddleware, async (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      valid: true,
      user: req.user,
    },
  });
});

export default router;
