import { Request, Response, NextFunction } from 'express';
import { MESSAGES } from '../constants/messages';

export function adminKeyMiddleware(req: Request, res: Response, next: NextFunction) {
  const key = req.headers['x-admin-key'];
  if (!key || key !== process.env.ADMIN_SECRET) {
    res.status(401).json({ status: 401, message: MESSAGES.INVALID_ADMIN_KEY });
    return;
  }
  next();
}
