import { Router } from 'express';
import { z } from 'zod';
import { roomsService } from '../../domain/services/rooms.service.js';
import { authMiddleware } from '../middlewares/auth.http.js';
import { requireAdmin } from '../../domain/policies/permissions.js';
import { logger } from '../../utils/logger.js';
import { broadcast } from '../../realtime/io.js';
import { presenceService } from '../../domain/services/presence.service.js';

const router = Router();

// Schéma de validation pour créer une room
const createRoomSchema = z.object({
  name: z.string()
    .min(3, 'Room name must be at least 3 characters')
    .max(50, 'Room name must be at most 50 characters'),
  description: z.string().max(200).optional().default(''),
  accessType: z.enum(['public', 'private', 'selected']).optional().default('public'),
  allowedUserIds: z.array(z.string()).optional().default([]),
});

// Schéma de validation pour mettre à jour une room
const updateRoomSchema = z.object({
  name: z.string().min(3).max(50).optional(),
  description: z.string().max(200).optional(),
  accessType: z.enum(['public', 'private', 'selected']).optional(),
  allowedUserIds: z.array(z.string()).optional(),
});

/**
 * GET /rooms/users
 * Récupérer tous les utilisateurs pour la sélection
 */
router.get('/users', authMiddleware, async (req, res, next) => {
  try {
    const users = await presenceService.getAllUsers();
    res.json({
      success: true,
      data: users.map(u => ({ id: u.userId, username: u.username, status: u.status })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /rooms
 * Créer une nouvelle room (Admin uniquement)
 */
router.post('/', authMiddleware, requireAdmin, async (req, res, next) => {
  try {
    const data = createRoomSchema.parse(req.body);
    const room = await roomsService.createRoom(data, req.user.id, req.user.username);
    
    logger.success(`✅ Room créée: ${room.name}`);
    
    // Notifier tous les clients en temps réel
    try {
      broadcast('room:created', {
        room,
        createdBy: req.user.username,
        timestamp: new Date().toISOString(),
      });
      logger.info('📢 Broadcast room:created envoyé');
    } catch (broadcastError) {
      logger.error('Erreur broadcast:', broadcastError.message);
    }
    
    res.status(201).json({
      success: true,
      data: room,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /rooms
 * Lister les rooms visibles par l'utilisateur
 */
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const rooms = await roomsService.getVisibleRooms(req.user.id);
    
    res.status(200).json({
      success: true,
      data: rooms,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /rooms/:roomId
 * Récupérer une room par ID
 */
router.get('/:roomId', authMiddleware, async (req, res, next) => {
  try {
    const { roomId } = req.params;
    
    // Vérifier l'accès
    const canAccess = await roomsService.canAccessRoom(roomId, req.user.id);
    if (!canAccess) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have access to this room',
        },
      });
    }
    
    const room = await roomsService.getRoomById(roomId);
    
    res.status(200).json({
      success: true,
      data: room,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /rooms/:roomId
 * Mettre à jour une room
 */
router.put('/:roomId', authMiddleware, async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const updates = updateRoomSchema.parse(req.body);
    
    const room = await roomsService.updateRoom(
      roomId, 
      updates, 
      req.user.id, 
      req.user.role
    );
    
    // Broadcast la mise à jour en temps réel
    try {
      broadcast('room:updated', {
        room,
        updatedBy: req.user.username,
        timestamp: new Date().toISOString(),
      });
      logger.info('📢 Broadcast room:updated envoyé');
    } catch (broadcastError) {
      logger.error('Erreur broadcast:', broadcastError.message);
    }
    
    res.status(200).json({
      success: true,
      data: room,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /rooms/:roomId
 * Supprimer une room
 */
router.delete('/:roomId', authMiddleware, async (req, res, next) => {
  try {
    const { roomId } = req.params;
    
    // Récupérer les infos de la room avant suppression pour le broadcast
    const room = await roomsService.getRoomById(roomId);
    
    await roomsService.deleteRoom(roomId, req.user.id, req.user.role);
    
    // Broadcast la suppression en temps réel
    try {
      broadcast('room:deleted', {
        roomId,
        roomName: room.name,
        deletedBy: req.user.username,
        timestamp: new Date().toISOString(),
      });
      logger.info('📢 Broadcast room:deleted envoyé');
    } catch (broadcastError) {
      logger.error('Erreur broadcast:', broadcastError.message);
    }
    
    res.status(200).json({
      success: true,
      data: { message: 'Room deleted successfully' },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /rooms/:roomId/users
 * Ajouter un utilisateur à une room privée
 */
router.post('/:roomId/users', authMiddleware, async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELD',
          message: 'userId is required',
        },
      });
    }
    
    await roomsService.addUserToRoom(roomId, userId, req.user.id);
    
    res.status(200).json({
      success: true,
      data: { message: 'User added to room' },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /rooms/:roomId/users/:userId
 * Retirer un utilisateur d'une room privée
 */
router.delete('/:roomId/users/:userId', authMiddleware, async (req, res, next) => {
  try {
    const { roomId, userId } = req.params;
    
    await roomsService.removeUserFromRoom(roomId, userId, req.user.id);
    
    res.status(200).json({
      success: true,
      data: { message: 'User removed from room' },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
