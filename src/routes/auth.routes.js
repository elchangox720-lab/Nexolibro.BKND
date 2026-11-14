import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { login, perfil, registrar } from '../controllers/auth.controller.js';
import { autenticar } from '../middleware/auth.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Demasiados intentos. Espera 15 minutos e inténtalo de nuevo.' },
});

router.post('/registro', authLimiter, registrar);
router.post('/login', authLimiter, login);
router.get('/perfil', autenticar, perfil);

export default router;
