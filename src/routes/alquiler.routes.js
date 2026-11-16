import { Router } from 'express';
import {
  crearAlquiler,
  devolverAlquiler,
  devolverAlquilerAdmin,
  listarAlquileres,
  listarAlquileresAdmin,
} from '../controllers/alquiler.controller.js';
import { autenticar, soloAdmin } from '../middleware/auth.js';

const router = Router();

router.use(autenticar);

router.get('/admin', soloAdmin, listarAlquileresAdmin);
router.post('/admin/:id/devolver', soloAdmin, devolverAlquilerAdmin);

router.get('/', listarAlquileres);
router.post('/', crearAlquiler);
router.post('/:id/devolver', devolverAlquiler);

export default router;
