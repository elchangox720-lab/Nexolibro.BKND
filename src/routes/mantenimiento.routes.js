import { Router } from 'express';
import {
  ejecutarRevision,
  listarRegistros,
  obtenerEstadoMantenimiento,
} from '../services/mantenimiento.service.js';
import { autenticar, soloAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/estado', autenticar, soloAdmin, async (req, res) => {
  try {
    const estado = await obtenerEstadoMantenimiento();
    res.json(estado);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'No se pudo obtener el estado de mantenimiento' });
  }
});

router.get('/logs', autenticar, soloAdmin, async (req, res) => {
  try {
    const registros = await listarRegistros(req.query.limite);
    res.json(registros);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'No se pudieron obtener los registros' });
  }
});

router.post('/revisar', autenticar, soloAdmin, async (req, res) => {
  try {
    await ejecutarRevision();
    res.json({ message: 'Revisión ejecutada' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'No se pudo ejecutar la revisión' });
  }
});

export default router;
