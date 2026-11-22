import { Router } from 'express';
import mongoose from 'mongoose';
import alquilerRoutes from './alquiler.routes.js';
import authRoutes from './auth.routes.js';
import bibliotecaRoutes from './biblioteca.routes.js';
import historialRoutes from './historial.routes.js';
import libroRoutes from './libro.routes.js';
import mantenimientoRoutes from './mantenimiento.routes.js';
import pagoRoutes from './pago.routes.js';
import resenaRoutes from './resena.routes.js';
import { modoPagos } from '../services/pagos.service.js';

const router = Router();

const dbStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    database: dbStates[mongoose.connection.readyState] ?? 'unknown',
    pagos: modoPagos(),
    email: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
    commit: process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? 'local',
    timestamp: new Date().toISOString(),
  });
});

router.use('/alquileres', alquilerRoutes);
router.use('/auth', authRoutes);
router.use('/biblioteca', bibliotecaRoutes);
router.use('/historial', historialRoutes);
router.use('/libros', libroRoutes);
router.use('/mantenimiento', mantenimientoRoutes);
router.use('/pagos', pagoRoutes);
router.use('/resenas', resenaRoutes);

export default router;
