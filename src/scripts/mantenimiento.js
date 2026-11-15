import 'dotenv/config';
import { connectDB } from '../config/db.js';
import {
  ejecutarGeneracionDiaria,
  ejecutarRevision,
  obtenerEstadoMantenimiento,
} from '../services/mantenimiento.service.js';
import { obtenerLibrosParaGenero } from '../services/libros-externos.service.js';
import mongoose from 'mongoose';

const argumentos = process.argv.slice(2);
const tarea = argumentos.find((item) => !item.startsWith('--')) ?? 'estado';
const forzar = argumentos.includes('--forzar');

async function ejecutar() {
  await connectDB();

  if (tarea === 'revision') {
    await ejecutarRevision();
    console.log(JSON.stringify(await obtenerEstadoMantenimiento(), null, 2));
  } else if (tarea === 'generar') {
    const resultado = await ejecutarGeneracionDiaria({ forzar });
    console.log(JSON.stringify(resultado, null, 2));
  } else if (tarea === 'probar') {
    const genero = argumentos.find((item) => item.startsWith('--genero='))?.split('=')[1];
    const estado = await obtenerEstadoMantenimiento();
    const resultado = await obtenerLibrosParaGenero(genero ?? estado.generoActual, 10);
    console.log(
      JSON.stringify(
        {
          genero: resultado.genero.nombre,
          libros: resultado.libros.map((libro) => ({
            titulo: libro.titulo,
            autor: libro.autor,
            anio: libro.anio,
            portada: libro.portada,
            descripcion: libro.descripcion.slice(0, 160),
            fuente: libro.fuente,
          })),
          errores: resultado.errores,
          advertencias: resultado.advertencias,
        },
        null,
        2
      )
    );
  } else {
    console.log(JSON.stringify(await obtenerEstadoMantenimiento(), null, 2));
  }
}

ejecutar()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
