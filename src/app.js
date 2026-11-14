import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import routes from './routes/index.js';

const app = express();

const origenesPermitidos = (
  process.env.CORS_ORIGINS ??
  'https://nexolibro-eifu.vercel.app,http://localhost:4200,http://127.0.0.1:4200'
)
  .split(',')
  .map((origen) => origen.trim())
  .filter(Boolean);

const origenesVercel = /^https:\/\/nexolibro(?:-[a-z0-9-]+)*\.vercel\.app$/i;

app.set('trust proxy', 1);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

app.use(
  cors({
    origin(origen, callback) {
      if (!origen || origenesPermitidos.includes(origen) || origenesVercel.test(origen)) {
        return callback(null, true);
      }
      return callback(new Error('Origen no permitido'));
    },
  })
);

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 600,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { message: 'Demasiadas solicitudes. Intenta de nuevo en unos minutos.' },
  }),
  routes
);

app.use((req, res) => {
  res.status(404).json({ message: 'Ruta no encontrada' });
});

app.use((error, req, res, next) => {
  if (error?.message === 'Origen no permitido') {
    return res.status(403).json({ message: 'Origen no permitido' });
  }

  if (error?.type === 'entity.too.large') {
    return res.status(413).json({ message: 'La solicitud es demasiado grande' });
  }

  console.error(error);
  return res.status(500).json({ message: 'Error interno del servidor' });
});

export default app;
