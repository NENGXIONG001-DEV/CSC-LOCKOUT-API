import { Request, Response, NextFunction } from 'express';
import logger from '../lib/logger';

export function requestLogMiddleware(req: Request, _res: Response, next: NextFunction) {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim()
    ?? req.ip
    ?? req.socket.remoteAddress
    ?? 'unknown';

  let msg = `${req.method} ${req.originalUrl} | IP: ${ip}`;
  if (req.body?.usercode)    msg += ` | usercode=${req.body.usercode}`;
  if (req.body?.unlocked_by) msg += ` | unlocked_by=${req.body.unlocked_by}`;

  logger.info(msg);
  next();
}
