import { getCollection } from '../../config/database.js';
import { COLLECTIONS, ROLES, SESSION_STATUS } from '../../config/constants.js';
import { env } from '../../config/env.js';
import { generateUserId, generateToken } from '../../utils/ids.js';
import { Errors } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

/**
 * Service d'authentification
 */
export const authService = {
  /**
   * Inscription d'un nouvel utilisateur
   * @param {string} username - Nom d'utilisateur
   * @param {string} password - Mot de passe
   * @returns {Promise<{message: string}>}
   */
  async register(username, password) {
    const usersCollection = getCollection(COLLECTIONS.USERS);
    
    // Vérifier si l'utilisateur existe déjà
    const existingUser = await usersCollection.findOne({ username });
    if (existingUser) {
      throw Errors.USERNAME_TAKEN;
    }
    
    // Vérifier si c'est le premier utilisateur (sera admin)
    const userCount = await usersCollection.countDocuments();
    const role = userCount === 0 ? ROLES.ADMIN : ROLES.USER;
    
    // Créer le nouvel utilisateur
    const user = {
      id: generateUserId(),
      username,
      password,
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    await usersCollection.insertOne(user);
    
    if (role === ROLES.ADMIN) {
      logger.success(`👑 Premier utilisateur (ADMIN) créé: ${username}`);
    } else {
      logger.success(`👤 Nouvel utilisateur enregistré: ${username}`);
    }
    
    return {
      message: 'User registered successfully',
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    };
  },

  /**
   * Connexion utilisateur
   * @param {string} username - Nom d'utilisateur
   * @param {string} password - Mot de passe
   * @returns {Promise<{token: string, user: object}>}
   */
  async login(username, password) {
    const usersCollection = getCollection(COLLECTIONS.USERS);
    const sessionsCollection = getCollection(COLLECTIONS.SESSIONS);
    
    // Rechercher l'utilisateur
    const user = await usersCollection.findOne({ username });
    
    if (!user) {
      throw Errors.INVALID_CREDENTIALS;
    }
    
    // Vérifier le mot de passe
    if (user.password !== password) {
      throw Errors.INVALID_CREDENTIALS;
    }
    
    logger.info(`🔑 Connexion utilisateur: ${username}`);
    
    // Générer un token
    const token = generateToken();
    const expiresAt = new Date(Date.now() + env.tokenExpiryHours * 60 * 60 * 1000);
    
    // Créer la session
    const session = {
      token,
      userId: user.id,
      status: SESSION_STATUS.ACTIVE,
      createdAt: new Date(),
      expiresAt,
    };
    
    await sessionsCollection.insertOne(session);
    logger.info(`🎫 Session créée pour: ${username}`);
    
    // Retourner le token et les infos utilisateur
    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    };
  },
  
  /**
   * Valider un token et récupérer l'utilisateur
   * @param {string} token - Token de session
   * @returns {Promise<object>} - Utilisateur
   */
  async validateToken(token) {
    if (!token) {
      throw Errors.TOKEN_REQUIRED;
    }
    
    const sessionsCollection = getCollection(COLLECTIONS.SESSIONS);
    const usersCollection = getCollection(COLLECTIONS.USERS);
    
    // Rechercher la session
    const session = await sessionsCollection.findOne({
      token,
      status: SESSION_STATUS.ACTIVE,
    });
    
    if (!session) {
      throw Errors.TOKEN_INVALID;
    }
    
    // Vérifier l'expiration
    if (session.expiresAt < new Date()) {
      // Marquer comme expirée
      await sessionsCollection.updateOne(
        { token },
        { $set: { status: SESSION_STATUS.EXPIRED } }
      );
      throw Errors.TOKEN_EXPIRED;
    }
    
    // Récupérer l'utilisateur
    const user = await usersCollection.findOne({ id: session.userId });
    
    if (!user) {
      throw Errors.USER_NOT_FOUND;
    }
    
    return {
      id: user.id,
      username: user.username,
      role: user.role,
    };
  },
  
  /**
   * Déconnexion - Révoquer le token
   * @param {string} token - Token à révoquer
   */
  async logout(token) {
    const sessionsCollection = getCollection(COLLECTIONS.SESSIONS);
    
    const result = await sessionsCollection.updateOne(
      { token },
      { $set: { status: SESSION_STATUS.REVOKED } }
    );
    
    if (result.modifiedCount === 0) {
      throw Errors.TOKEN_INVALID;
    }
    
    logger.info(`🚪 Session révoquée`);
    return { message: 'Logged out successfully' };
  },
  
  /**
   * Récupérer un utilisateur par ID
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<object>}
   */
  async getUserById(userId) {
    const usersCollection = getCollection(COLLECTIONS.USERS);
    const user = await usersCollection.findOne({ id: userId });
    
    if (!user) {
      throw Errors.USER_NOT_FOUND;
    }
    
    return {
      id: user.id,
      username: user.username,
      role: user.role,
    };
  },
};
