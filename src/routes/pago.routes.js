import { Router } from 'express';
import { configPagos, estadoPago, webhookWompi } from '../controllers/pago.controller.js';
import { autenticar } from '../middleware/auth.js';

const router = Router();

router.post('/wompi/eventos', webhookWompi);
router.get('/config', configPagos);
router.get('/:referencia', autenticar, estadoPago);

export default router;
