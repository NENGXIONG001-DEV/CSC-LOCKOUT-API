import 'dotenv/config';
import os from 'os';
import app from './app';
import logger from './lib/logger';

const REQUIRED_ENV = ['DATABASE_URL', 'ADMIN_SECRET'] as const;
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    logger.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const PORT = Number(process.env.PORT) || 9121;

function getLocalIP(): string {
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    if (!iface) continue;
    for (const addr of iface) {
      if (addr.family === 'IPv4' && !addr.internal) {
        return addr.address;
      }
    }
  }
  return 'localhost';
}

app.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP();
  logger.info('CSC Lockout API running on:');
  logger.info(`  Local:   http://localhost:${PORT}`);
  logger.info(`  Network: http://${ip}:${PORT}`);
});
