// server/src/realtime/protocol/schemas.js
import { z } from 'zod';

export const Schemas = {
  roomJoin: z.object({
    roomId: z.string().min(1, 'roomId is required'),
  }),

  roomLeave: z.object({
    roomId: z.string().min(1, 'roomId is required'),
  }),
};
