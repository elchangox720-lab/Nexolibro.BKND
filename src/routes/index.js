import { Router } from 'express';
import mongoose from 'mongoose';
import libroRoutes from './libro.routes.js';

const router = Router();

const dbStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    database: dbStates[mongoose.connection.readyState] ?? 'unknown',
    timestamp: new Date().toISOString(),
  });
});

router.use('/libros', libroRoutes);

export default router;
