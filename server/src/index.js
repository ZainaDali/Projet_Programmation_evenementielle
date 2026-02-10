import { createServer } from 'http';
import { createApp } from './http/app.js';
import { connectDatabase, closeDatabase } from './config/database.js';
import { initSocketIO } from './realtime/io.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';

async function main() {
  try {
    // Connexion à MongoDB
    await connectDatabase();
    
    // Créer l'application Express
    const app = createApp();
    
    // Créer le serveur HTTP
    const server = createServer(app);
    
    // Initialiser Socket.IO avec authentification
    initSocketIO(server);
    
    // Démarrer le serveur
    server.listen(env.port, () => {
      logger.success(`🚀 Serveur démarré sur http://localhost:${env.port}`);
      logger.info(`📡 Environnement: ${env.nodeEnv}`);
      logger.info(`🔌 Socket.IO prêt pour les connexions`);
    });
    
    // Gestion de l'arrêt propre
    const shutdown = async () => {
      logger.info('🛑 Arrêt du serveur...');
      
      server.close(async () => {
        await closeDatabase();
        logger.info('👋 Serveur arrêté');
        process.exit(0);
      });
    };
    
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
    
  } catch (error) {
    logger.error('❌ Erreur fatale:', error.message);
    process.exit(1);
  }
}

main();
