import app from './app.js';
import { connectDB } from './config/db.js';
import { iniciarAutomatizacion } from './services/mantenimiento.service.js';
import { iniciarCronPagos } from './services/pagos-cron.service.js';

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    if (!process.env.JWT_SECRET) {
      console.warn('ADVERTENCIA: JWT_SECRET no está definida; registro e inicio de sesión fallarán.');
    }

    if (
      !process.env.WOMPI_PUBLIC_KEY ||
      !process.env.WOMPI_INTEGRITY_SECRET ||
      !process.env.WOMPI_EVENTS_SECRET
    ) {
      const modo = (process.env.PAGOS_MODO || 'auto').toLowerCase();
      console.warn(
        modo === 'wompi'
          ? 'ADVERTENCIA: PAGOS_MODO=wompi pero faltan llaves de Wompi; los cobros fallarán.'
          : 'ADVERTENCIA: Wompi no está completamente configurado; los alquileres usarán el modo directo sin cobro.'
      );
    }

    await connectDB();

    app.listen(PORT, () => {
      console.log(`Servidor Nexolibro corriendo en http://localhost:${PORT}`);
      iniciarAutomatizacion();
      iniciarCronPagos();
    });
  } catch (error) {
    console.error('No se pudo iniciar el servidor:', error.message);
    process.exit(1);
  }
}

start();
