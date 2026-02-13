import express from 'express';
import cors from 'cors';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import authRoutes from './routes/auth.routes.js';
import pollsRoutes from './routes/polls.routes.js';
import chatRoutes from './routes/chat.routes.js';
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
  app.use('/api/polls', pollsRoutes);
  app.use('/api/chat', chatRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
