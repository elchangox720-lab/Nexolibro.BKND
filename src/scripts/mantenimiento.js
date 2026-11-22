import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import {
  ejecutarGeneracionDiaria,
  ejecutarRevision,
  obtenerEstadoMantenimiento,
} from '../services/mantenimiento.service.js';

const argumentos = process.argv.slice(2);
const tarea = argumentos.find((item) => !item.startsWith('--')) ?? 'estado';
const forzar = argumentos.includes('--forzar');
const cantidad = Number(
  argumentos.find((item) => item.startsWith('--cantidad='))?.split('=')[1] ?? 0
);
const lote = argumentos.find((item) => item.startsWith('--lote='))?.split('=')[1];

async function ejecutar() {
  await connectDB();

  if (tarea === 'revision') {
    await ejecutarRevision();
    console.log(JSON.stringify(await obtenerEstadoMantenimiento(), null, 2));
  } else if (tarea === 'generar') {
    const resultado = await ejecutarGeneracionDiaria({
      forzar,
      ...(cantidad > 0 ? { cantidad } : {}),
      ...(lote ? { lote } : {}),
    });
    console.log(JSON.stringify(resultado, null, 2));
  } else if (tarea === 'sembrar') {
    const resultado = await ejecutarGeneracionDiaria({
      forzar: true,
      cantidad: cantidad > 0 ? cantidad : 50,
      lote: lote || 'carga-inicial-catalogo-validado',
    });
    console.log(JSON.stringify(resultado, null, 2));
  } else if (tarea === 'catalogo') {
    const estado = await obtenerEstadoMantenimiento();
    console.log(
      JSON.stringify(
        {
          totalLibros: estado.totalLibros,
          totalCatalogo: estado.totalCatalogo,
          lecturasDisponibles: estado.lecturasDisponibles,
          pendientes: estado.pendientes,
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
