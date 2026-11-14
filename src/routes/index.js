import { Router } from 'express';
import mongoose from 'mongoose';

const router = Router();

const dbStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    database: dbStates[mongoose.connection.readyState] ?? 'unknown',
    timestamp: new Date().toISOString(),
  });
});

export default router;
