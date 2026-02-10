import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: parseInt(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // MongoDB
  mongodbUri: process.env.MONGODB_URI,
  mongodbDbName: process.env.MONGODB_DB_NAME || 'projet_po',
  
  // Token
  tokenExpiryHours: parseInt(process.env.TOKEN_EXPIRY_HOURS) || 24,
};
