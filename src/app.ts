import express from 'express';
import cors from 'cors';
import lockoutRoutes from './routes/lockout.routes';
import { requestLogMiddleware } from './middleware/requestLog.middleware';

const app = express();

app.set('trust proxy', true);
app.use(cors());
app.use(express.json());
app.use(requestLogMiddleware);

app.use('/lockout', lockoutRoutes);

export default app;
