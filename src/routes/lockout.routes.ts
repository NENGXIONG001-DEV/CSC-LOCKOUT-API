import { Router } from 'express';
import { LockoutController } from '../controller/lockoutController';
import { adminKeyMiddleware } from '../middleware/adminKey.middleware';

const router = Router();

router.get('/status',   adminKeyMiddleware, LockoutController.status);
router.get('/list',     adminKeyMiddleware, LockoutController.list);
router.post('/attempt', adminKeyMiddleware, LockoutController.attempt);
router.post('/success', adminKeyMiddleware, LockoutController.success);
router.post('/unlock',  adminKeyMiddleware, LockoutController.unlock);

export default router;
