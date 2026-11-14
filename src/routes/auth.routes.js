import { Router } from 'express';
import { login, perfil, registrar } from '../controllers/auth.controller.js';
import { autenticar } from '../middleware/auth.js';

const router = Router();

router.post('/registro', registrar);
router.post('/login', login);
router.get('/perfil', autenticar, perfil);

export default router;
