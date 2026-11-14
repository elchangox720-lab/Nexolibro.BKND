import { Router } from 'express';
import {
  actualizarBiblioteca,
  eliminarDeBiblioteca,
  listarBiblioteca,
} from '../controllers/biblioteca.controller.js';
import { autenticar } from '../middleware/auth.js';

const router = Router();

router.use(autenticar);

router.get('/', listarBiblioteca);
router.put('/:libroId', actualizarBiblioteca);
router.delete('/:libroId', eliminarDeBiblioteca);

export default router;
