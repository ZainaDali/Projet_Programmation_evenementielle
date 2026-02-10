import { MongoClient } from 'mongodb';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

let client = null;
let db = null;

/**
 * Connexion à MongoDB Atlas
 */
export async function connectDatabase() {
  try {
    client = new MongoClient(env.mongodbUri);
    await client.connect();
    
    db = client.db(env.mongodbDbName);
    
    logger.info(`✅ Connecté à MongoDB Atlas - Base: ${env.mongodbDbName}`);
    
    // Créer les index nécessaires
    await createIndexes();
    
    return db;
  } catch (error) {
    logger.error('❌ Erreur de connexion MongoDB:', error.message);
    throw error;
  }
}

/**
 * Créer les index pour optimiser les requêtes
 */
async function createIndexes() {
  // Index unique sur username
  await db.collection('users').createIndex(
    { username: 1 }, 
    { unique: true }
  );
  
  // Index sur le token pour recherche rapide
  await db.collection('sessions').createIndex(
    { token: 1 }, 
    { unique: true }
  );
  
  // Index TTL pour expiration automatique des sessions
  await db.collection('sessions').createIndex(
    { expiresAt: 1 }, 
    { expireAfterSeconds: 0 }
  );
  
  // Index unique sur le nom des rooms
  await db.collection('rooms').createIndex(
    { name: 1 }, 
    { unique: true }
  );
  
  // Index sur l'ID des rooms
  await db.collection('rooms').createIndex(
    { id: 1 }, 
    { unique: true }
  );
  
  logger.info('📇 Index MongoDB créés');
}

/**
 * Récupérer l'instance de la base de données
 */
export function getDb() {
  if (!db) {
    throw new Error('Database not connected. Call connectDatabase() first.');
  }
  return db;
}

/**
 * Récupérer une collection
 */
export function getCollection(name) {
  return getDb().collection(name);
}

/**
 * Fermer la connexion
 */
export async function closeDatabase() {
  if (client) {
    await client.close();
    logger.info('🔌 Connexion MongoDB fermée');
  }
}
