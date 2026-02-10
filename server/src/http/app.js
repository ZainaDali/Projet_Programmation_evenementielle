import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import authRoutes from './routes/auth.routes.js';
import roomsRoutes from './routes/rooms.routes.js';
// TODO: Importer les routes polls quand elles seront implémentées
// import pollsRoutes from './routes/polls.routes.js';
import { logger } from '../utils/logger.js';

// Pour ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Créer et configurer l'application Express
 */
export function createApp() {
  const app = express();
  
  // Middlewares globaux
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Servir les fichiers statiques du client
  const clientPath = path.join(__dirname, '../../../client');
  app.use(express.static(clientPath));
  logger.info(`📁 Fichiers statiques servis depuis: ${clientPath}`);
  
  // Logging des requêtes
  app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`);
    next();
  });
  
  // Route de santé
  app.get('/health', (req, res) => {
    res.json({
      success: true,
      data: {
        status: 'ok',
        timestamp: new Date().toISOString(),
      },
    });
  });
  
  // Routes API
  app.use('/auth', authRoutes);
  app.use('/rooms', roomsRoutes);
  // TODO: Ajouter les routes polls quand elles seront implémentées
  // app.use('/polls', pollsRoutes);
  
  // Gestion des erreurs
  app.use(notFoundHandler);
  app.use(errorHandler);
  
  return app;
}
