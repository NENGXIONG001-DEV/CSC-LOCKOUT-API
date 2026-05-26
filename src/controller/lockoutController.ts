import { Request, Response } from 'express';
import { LockoutService } from '../service/lockoutService';
import { MESSAGES } from '../constants/messages';

export class LockoutController {

  static async status(req: Request, res: Response) {
    const { usercode } = req.query;
    if (!usercode) {
      res.status(400).json({ status: 400, message: MESSAGES.USERCODE_REQUIRED });
      return;
    }
    try {
      const data = await LockoutService.getStatus(usercode as string);
      res.status(200).json({ status: 200, data });
    } catch {
      res.status(500).json({ status: 500, message: MESSAGES.INTERNAL_SERVER_ERROR });
    }
  }

  static async list(_req: Request, res: Response) {
    try {
      const data = await LockoutService.getList();
      res.status(200).json({ status: 200, total: data.length, data });
    } catch {
      res.status(500).json({ status: 500, message: MESSAGES.INTERNAL_SERVER_ERROR });
    }
  }

  static async attempt(req: Request, res: Response) {
    const { usercode } = req.body;
    if (!usercode) {
      res.status(400).json({ status: 400, message: MESSAGES.USERCODE_REQUIRED });
      return;
    }
    try {
      const result = await LockoutService.recordAttempt(usercode);
      res.status(200).json({ status: 200, data: result });
    } catch {
      res.status(500).json({ status: 500, message: MESSAGES.INTERNAL_SERVER_ERROR });
    }
  }

  static async success(req: Request, res: Response) {
    const { usercode } = req.body;
    if (!usercode) {
      res.status(400).json({ status: 400, message: MESSAGES.USERCODE_REQUIRED });
      return;
    }
    try {
      await LockoutService.recordSuccess(usercode);
      res.status(200).json({ status: 200, message: MESSAGES.resetSuccess(usercode) });
    } catch {
      res.status(500).json({ status: 500, message: MESSAGES.INTERNAL_SERVER_ERROR });
    }
  }

  static async unlock(req: Request, res: Response) {
    const { usercode, unlocked_by } = req.body;
    if (!usercode) {
      res.status(400).json({ status: 400, message: MESSAGES.USERCODE_REQUIRED });
      return;
    }
    if (!unlocked_by) {
      res.status(400).json({ status: 400, message: MESSAGES.UNLOCKED_BY_REQUIRED });
      return;
    }
    try {
      const result = await LockoutService.unlock(usercode, unlocked_by);
      if (!result) {
        res.status(404).json({ status: 404, message: MESSAGES.userNotFound(usercode) });
        return;
      }
      res.status(200).json({ status: 200, ...result });
    } catch {
      res.status(500).json({ status: 500, message: MESSAGES.INTERNAL_SERVER_ERROR });
    }
  }
}
