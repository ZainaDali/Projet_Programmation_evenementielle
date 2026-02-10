import { env } from '../config/env.js';

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function formatDate() {
  return new Date().toISOString();
}

export const logger = {
  info: (...args) => {
    console.log(`${colors.blue}[INFO]${colors.reset} ${formatDate()}`, ...args);
  },
  
  success: (...args) => {
    console.log(`${colors.green}[SUCCESS]${colors.reset} ${formatDate()}`, ...args);
  },
  
  warn: (...args) => {
    console.warn(`${colors.yellow}[WARN]${colors.reset} ${formatDate()}`, ...args);
  },
  
  error: (...args) => {
    console.error(`${colors.red}[ERROR]${colors.reset} ${formatDate()}`, ...args);
  },
  
  debug: (...args) => {
    if (env.nodeEnv === 'development') {
      console.log(`${colors.magenta}[DEBUG]${colors.reset} ${formatDate()}`, ...args);
    }
  },
  
  socket: (...args) => {
    console.log(`${colors.cyan}[SOCKET]${colors.reset} ${formatDate()}`, ...args);
  },
};
