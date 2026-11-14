import { Router } from 'express';
import mongoose from 'mongoose';
import authRoutes from './auth.routes.js';
import historialRoutes from './historial.routes.js';
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

router.use('/auth', authRoutes);
router.use('/historial', historialRoutes);
router.use('/libros', libroRoutes);

export default router;
