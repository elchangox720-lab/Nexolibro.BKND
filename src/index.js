import app from './app.js';
import { connectDB } from './config/db.js';
import { iniciarAutomatizacion } from './services/mantenimiento.service.js';

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    if (!process.env.JWT_SECRET) {
      console.warn('ADVERTENCIA: JWT_SECRET no está definida; registro e inicio de sesión fallarán.');
    }

    await connectDB();

    app.listen(PORT, () => {
      console.log(`Servidor Nexolibro corriendo en http://localhost:${PORT}`);
      iniciarAutomatizacion();
    });
  } catch (error) {
    console.error('No se pudo iniciar el servidor:', error.message);
    process.exit(1);
  }
}

start();
