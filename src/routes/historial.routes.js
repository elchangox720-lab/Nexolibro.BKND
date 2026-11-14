import { Router } from 'express';
import {
  eliminarItem,
  limpiarHistorial,
  listarHistorial,
  registrarVisto,
} from '../controllers/historial.controller.js';
import { autenticar } from '../middleware/auth.js';

const router = Router();

router.use(autenticar);

router.get('/', listarHistorial);
router.post('/', registrarVisto);
router.delete('/', limpiarHistorial);
router.delete('/:id', eliminarItem);

export default router;
