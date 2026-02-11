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
  POLLS: 'polls',
  VOTES: 'votes',
  MESSAGES: 'messages',
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

export const POLL_STATUS = {
  OPEN: 'open',
  CLOSED: 'closed',
};

export const RATE_LIMITS = {
  VOTE_MAX_PER_MINUTE: 10,
  POLL_CREATE_MAX_PER_MINUTE: 3,
  CHAT_MAX_PER_10S: 5,
};

// Limites chat
export const CHAT_LIMITS = {
  MAX_MESSAGE_LENGTH: 500,
  HISTORY_SIZE: 50,
};
