import express from 'express';
import cors from 'cors';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import authRoutes from './routes/auth.routes.js';
import { authMiddleware } from './middlewares/auth.http.js';
import { roomsService } from '../domain/services/rooms.service.js';
import { logger } from '../utils/logger.js';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`);
    next();
  });

  app.get('/health', (req, res) => {
    res.json({
      success: true,
      data: {
        status: 'ok',
        timestamp: new Date().toISOString(),
      },
    });
  });

  app.use('/auth', authRoutes);

  // ── GET /rooms — liste des salons accessibles par l'utilisateur ──
  app.get('/rooms', authMiddleware, async (req, res, next) => {
    try {
      const rooms = await roomsService.getVisibleRooms(req.user.id);
      res.json({ success: true, data: rooms });
    } catch (error) {
      next(error);
    }
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
