import { Router } from 'express';
import {
  eliminarResena,
  guardarResena,
  listarResenasLibro,
} from '../controllers/resena.controller.js';
import { autenticar } from '../middleware/auth.js';

const router = Router();

router.get('/libro/:libroId', listarResenasLibro);
router.put('/:libroId', autenticar, guardarResena);
router.delete('/:libroId', autenticar, eliminarResena);

export default router;
