import { nanoid } from 'nanoid';

/**
 * Génère un ID utilisateur
 */
export function generateUserId() {
  return `user_${nanoid(12)}`;
}

/**
 * Génère un token de session
 */
export function generateToken() {
  return nanoid(32);
}

/**
 * Génère un ID de room
 */
export function generateRoomId() {
  return `room_${nanoid(8)}`;
}

// TODO: À implémenter par les développeurs
// export function generateMessageId() { return `msg_${nanoid(16)}`; }
// export function generatePollId() { return `poll_${nanoid(10)}`; }
