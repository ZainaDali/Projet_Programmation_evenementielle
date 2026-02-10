// server/src/realtime/protocol/events.js

export const EVENTS = {
  // Rooms
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',

  // Presence (par salon)
  PRESENCE_USER_JOINED: 'presence:user_joined',
  PRESENCE_USER_LEFT: 'presence:user_left',
  PRESENCE_UPDATE: 'presence:update',
};
