import { Router } from 'express';
import {
  actualizarLibro,
  crearLibro,
  eliminarLibro,
  listarLibros,
  obtenerLibro,
} from '../controllers/libro.controller.js';

const router = Router();

router.get('/', listarLibros);
router.get('/:id', obtenerLibro);
router.post('/', crearLibro);
router.put('/:id', actualizarLibro);
router.delete('/:id', eliminarLibro);

export default router;
