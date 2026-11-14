import { Router } from 'express';
import {
  actualizarLibro,
  crearLibro,
  eliminarLibro,
  listarLibros,
  obtenerLibro,
} from '../controllers/libro.controller.js';
import { autenticar, soloAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/', listarLibros);
router.get('/:id', obtenerLibro);
router.post('/', autenticar, soloAdmin, crearLibro);
router.put('/:id', autenticar, soloAdmin, actualizarLibro);
router.delete('/:id', autenticar, soloAdmin, eliminarLibro);

export default router;
