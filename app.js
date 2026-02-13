import express from 'express';
import cors from 'cors';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import authRoutes from './routes/auth.routes.js';
import { logger } from '../utils/logger.js';
import { getIO } from '../realtime/io.js';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`);
    next();
  });

  // Middleware pour attacher Socket.IO à req
  app.use((req, res, next) => {
    try {
      req.io = getIO();
    } catch {
      // Socket.IO pas encore initialisé (ne devrait pas arriver en runtime)
      req.io = null;
    }
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

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
