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
  password: z.string().min(1, 'Password is required'),
});

// Schéma de validation pour le register
const registerSchema = z.object({
  username: z.string()
    .trim()
    .min(3, 'Le nom d\'utilisateur doit faire au moins 3 caractères')
    .max(20, 'Le nom d\'utilisateur doit faire au plus 20 caractères')
    .regex(/^[a-zA-Z0-9_]+$/, 'Lettres, chiffres et tirets bas uniquement (ex: john_doe)'),
  password: z.string()
    .min(6, 'Le mot de passe doit faire au moins 6 caractères'),
});

/**
 * POST /auth/register
 * Inscription d'un nouvel utilisateur
 */
router.post('/register', async (req, res, next) => {
  try {
    const { username, password } = registerSchema.parse(req.body);
    
    const result = await authService.register(username, password);
    
    logger.success(`✅ Utilisateur créé: ${username}`);
    
    // Notifier tous les clients qu'un nouvel utilisateur s'est inscrit
    if (req.io) {
      req.io.emit('user:registered', {
        userId: result.user.id,
        username: result.user.username,
        timestamp: new Date().toISOString(),
      });
    }
    
    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/login
 * Authentification utilisateur
 */
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = loginSchema.parse(req.body);
    
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
    
    // Forcer la déconnexion du socket de l'utilisateur
    if (req.io && req.user) {
      const userRoom = `user:${req.user.id}`;
      // Envoyer un événement pour forcer le client à se déconnecter
      req.io.to(userRoom).emit('auth:forceLogout', {
        reason: 'Session révoquée',
        timestamp: new Date().toISOString(),
      });
      // Déconnecter tous les sockets de cet utilisateur
      req.io.in(userRoom).disconnectSockets(true);
    }
    
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
