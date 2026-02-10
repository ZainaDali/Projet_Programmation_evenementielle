// Rôles utilisateur
export const ROLES = {
  USER: 'user',
  ADMIN: 'admin',
  MODERATOR: 'moderator',
};

// Collections MongoDB
export const COLLECTIONS = {
  USERS: 'users',
  SESSIONS: 'sessions',
  PRESENCE: 'presence',
  ROOMS: 'rooms',
};

// Statuts de session
export const SESSION_STATUS = {
  ACTIVE: 'active',
  EXPIRED: 'expired',
  REVOKED: 'revoked',
};

// Statuts de présence (en ligne / hors ligne)
export const PRESENCE_STATUS = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  AWAY: 'away',
};

// Types d'accès aux rooms
export const ACCESS_TYPES = {
  PUBLIC: 'public',     // Tout le monde peut accéder
  PRIVATE: 'private',   // Personne ne peut accéder (sauf créateur)
  SELECTED: 'selected', // Uniquement les utilisateurs sélectionnés
};
