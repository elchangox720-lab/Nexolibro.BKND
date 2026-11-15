import cron from 'node-cron';
import mongoose from 'mongoose';
import EstadoAutomatizacion from '../models/estado-automatizacion.js';
import Libro from '../models/libro.js';
import RegistroMantenimiento from '../models/registro-mantenimiento.js';
import Resena from '../models/resena.js';
import { GENEROS, obtenerLibrosParaGenero } from './libros-externos.service.js';

const ZONA_HORARIA = 'America/Bogota';
const CANTIDAD_DIARIA = 10;
const INTERVALO_GENERACION_MS = 24 * 60 * 60 * 1000;
const CLAVE_ESTADO = 'principal';
const BASE_INTERNA = `http://127.0.0.1:${process.env.PORT || 3000}/api`;

let tareasIniciadas = false;

function fechaBogota(fecha = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(fecha);
}

function slug(texto) {
  return String(texto)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function recortarErrores(errores, maximo = 30) {
  return [...new Set(errores.filter(Boolean))].slice(0, maximo);
}

async function obtenerEstado() {
  let estado = await EstadoAutomatizacion.findOne({ clave: CLAVE_ESTADO });

  if (!estado) {
    try {
      estado = await EstadoAutomatizacion.create({ clave: CLAVE_ESTADO });
    } catch (error) {
      if (error.code !== 11000) {
        throw error;
      }

      estado = await EstadoAutomatizacion.findOne({ clave: CLAVE_ESTADO });
    }
  }

  if (
    estado.generacionEnCurso &&
    estado.inicioGeneracion &&
    Date.now() - estado.inicioGeneracion.getTime() > 2 * 60 * 60 * 1000
  ) {
    estado = await EstadoAutomatizacion.findOneAndUpdate(
      { clave: CLAVE_ESTADO },
      { $set: { generacionEnCurso: false } },
      { returnDocument: 'after' }
    );
  }

  return estado;
}

function generoEnIndice(indice) {
  return GENEROS[((indice % GENEROS.length) + GENEROS.length) % GENEROS.length];
}

async function pedirJsonLocal(ruta, tiempoMaximo = 30000) {
  const respuesta = await fetch(`${BASE_INTERNA}${ruta}`, {
    signal: AbortSignal.timeout(tiempoMaximo),
  });

  if (!respuesta.ok) {
    throw new Error(`HTTP ${respuesta.status}`);
  }

  return respuesta.json();
}

async function guardarRegistro(datos) {
  try {
    return await RegistroMantenimiento.create(datos);
  } catch (error) {
    console.error('No se pudo guardar el registro de mantenimiento:', error.message);
    return null;
  }
}

export async function ejecutarRevision() {
  const inicio = new Date();
  const errores = [];
  const advertencias = [];
  const detalle = {};

  try {
    if (mongoose.connection.readyState !== 1) {
      errores.push('MongoDB no está conectado');
    }

    const totalLibros = await Libro.countDocuments();
    detalle.totalLibros = totalLibros;

    if (totalLibros === 0) {
      errores.push('El catálogo está vacío');
    }

    try {
      const salud = await pedirJsonLocal('/health', 15000);

      if (salud.status !== 'ok' || salud.database !== 'connected') {
        errores.push(`Health check degradado: ${JSON.stringify(salud)}`);
      }
    } catch (error) {
      errores.push(`Health check no responde: ${error.message}`);
    }

    try {
      const libros = await pedirJsonLocal('/libros', 30000);

      if (!Array.isArray(libros)) {
        errores.push('El endpoint de catálogo no devuelve una lista');
      } else {
        detalle.catalogo = libros.length;

        if (libros.length !== totalLibros) {
          advertencias.push(
            `Diferencia entre catálogo y BD: API=${libros.length}, BD=${totalLibros}`
          );
        }

        const muestra = libros[0];

        if (muestra?._id) {
          try {
            const libro = await pedirJsonLocal(`/libros/${muestra._id}`, 15000);
            detalle.libroAbierto = libro?.titulo ?? null;

            if (!libro?.titulo || !libro?.autor) {
              advertencias.push('El detalle de un libro no contiene título y autor');
            }
          } catch (error) {
            errores.push(`No se pudo abrir el detalle de un libro: ${error.message}`);
          }

          try {
            const resenas = await pedirJsonLocal(`/resenas/libro/${muestra._id}`, 15000);

            if (!Array.isArray(resenas?.resenas)) {
              advertencias.push('El endpoint de reseñas no devuelve una lista válida');
            }
          } catch (error) {
            advertencias.push(`No se pudo consultar reseñas: ${error.message}`);
          }
        }
      }
    } catch (error) {
      errores.push(`El catálogo no responde: ${error.message}`);
    }

    const incompletos = await Libro.countDocuments({
      $or: [
        { titulo: { $in: [null, ''] } },
        { autor: { $in: [null, ''] } },
        { portada: { $in: [null, ''] } },
      ],
    });

    if (incompletos > 0) {
      advertencias.push(`${incompletos} libros tienen datos incompletos`);
    }

    const duplicados = await Libro.aggregate([
      {
        $group: {
          _id: { titulo: { $toLower: '$titulo' }, autor: { $toLower: '$autor' } },
          total: { $sum: 1 },
        },
      },
      { $match: { total: { $gt: 1 } } },
      { $limit: 10 },
    ]);

    if (duplicados.length > 0) {
      advertencias.push(`${duplicados.length} posibles títulos duplicados detectados`);
      detalle.duplicados = duplicados.map((item) => item._id);
    }

    try {
      const resenasSinLibro = await Resena.aggregate([
        {
          $lookup: {
            from: 'libros',
            localField: 'libro',
            foreignField: '_id',
            as: 'libroEncontrado',
          },
        },
        { $match: { libroEncontrado: { $size: 0 } } },
        { $limit: 10 },
      ]);

      if (resenasSinLibro.length > 0) {
        advertencias.push(`${resenasSinLibro.length} reseñas apuntan a libros inexistentes`);
      }
    } catch (error) {
      advertencias.push(`No se pudo validar la integridad de reseñas: ${error.message}`);
    }

    const estado = await obtenerEstado();
    const ahora = new Date();

    if (
      estado.ultimaGeneracion &&
      ahora.getTime() - estado.ultimaGeneracion.getTime() > INTERVALO_GENERACION_MS + 2 * 60 * 60 * 1000
    ) {
      advertencias.push('La generación diaria de libros está atrasada');
    }

    if (!estado.ultimaGeneracion) {
      advertencias.push('Todavía no se ha ejecutado una generación automática');
    }

    const estadoFinal = errores.length ? 'error' : advertencias.length ? 'advertencia' : 'ok';
    const fin = new Date();

    await EstadoAutomatizacion.updateOne(
      { clave: CLAVE_ESTADO },
      { $set: { ultimaRevision: fin, ultimoEstado: estadoFinal } }
    );

    await guardarRegistro({
      tipo: 'revision',
      estado: estadoFinal,
      inicio,
      fin,
      duracionMs: fin.getTime() - inicio.getTime(),
      totalLibrosAntes: totalLibros,
      totalLibrosDespues: totalLibros,
      errores: recortarErrores(errores),
      detalle: { ...detalle, advertencias: recortarErrores(advertencias) },
    });

    console.log(
      `Revisión de mantenimiento: ${estadoFinal} (${totalLibros} libros)`
    );
  } catch (error) {
    const fin = new Date();
    errores.push(`Fallo general de revisión: ${error.message}`);

    await guardarRegistro({
      tipo: 'revision',
      estado: 'error',
      inicio,
      fin,
      duracionMs: fin.getTime() - inicio.getTime(),
      errores: recortarErrores(errores),
      detalle: { ...detalle, advertencias: recortarErrores(advertencias) },
    });

    console.error('Error en la revisión de mantenimiento:', error);
  }
}

export async function ejecutarGeneracionDiaria({ forzar = false } = {}) {
  const inicio = new Date();
  let estado;
  let totalAntes = 0;

  try {
    estado = await obtenerEstado();

    const recientes = await Libro.countDocuments({
      origen: 'automatico',
      createdAt: { $gte: new Date(Date.now() - INTERVALO_GENERACION_MS) },
    });

    if (!forzar && recientes >= CANTIDAD_DIARIA) {
      console.log('Generación diaria omitida: ya se agregaron los libros de las últimas 24 horas');
      return { omitido: true, motivo: 'limite-24h', agregados: recientes };
    }

    if (
      !forzar &&
      estado.ultimaGeneracion &&
      Date.now() - estado.ultimaGeneracion.getTime() < INTERVALO_GENERACION_MS
    ) {
      console.log('Generación diaria omitida: última ejecución hace menos de 24 horas');
      return { omitido: true, motivo: 'ultima-ejecucion' };
    }

    if (estado.generacionEnCurso) {
      console.log('Generación diaria omitida: ya hay una ejecución en curso');
      return { omitido: true, motivo: 'en-curso' };
    }

    const bloqueo = await EstadoAutomatizacion.findOneAndUpdate(
      { clave: CLAVE_ESTADO, generacionEnCurso: false },
      {
        $set: {
          generacionEnCurso: true,
          inicioGeneracion: inicio,
          ultimoIntentoGeneracion: inicio,
        },
      },
      { returnDocument: 'after' }
    );

    if (!bloqueo) {
      return { omitido: true, motivo: 'bloqueo' };
    }

    const genero = generoEnIndice(bloqueo.indiceGenero);
    const lote = `${fechaBogota(inicio)}-${slug(genero.nombre)}`;
    const objetivo = forzar ? CANTIDAD_DIARIA : Math.max(CANTIDAD_DIARIA - recientes, 1);
    totalAntes = await Libro.countDocuments();

    console.log(
      `Iniciando generación diaria: ${genero.nombre} (${lote}, ${objetivo} libros)`
    );

    const resultado = await obtenerLibrosParaGenero(genero.nombre, objetivo);
    const agregados = [];
    const errores = [...resultado.errores];

    for (const datos of resultado.libros) {
      try {
        const libro = await Libro.create({ ...datos, lote });
        agregados.push({
          libro: libro._id,
          titulo: libro.titulo,
          autor: libro.autor,
          fuente: libro.fuente,
          fuenteId: libro.fuenteId,
        });
      } catch (error) {
        if (error.code === 11000) {
          errores.push(`Duplicado evitado: ${datos.titulo}`);
        } else {
          errores.push(`No se pudo guardar ${datos.titulo}: ${error.message}`);
        }
      }

      if (agregados.length >= objetivo) {
        break;
      }
    }

    const totalDespues = await Libro.countDocuments();
    const totalHoy = recientes + agregados.length;
    const completo = totalHoy >= CANTIDAD_DIARIA;
    const estadoFinal = completo ? (errores.length ? 'advertencia' : 'ok') : 'error';
    const avanzar = completo;
    const nuevoIndice = avanzar
      ? (bloqueo.indiceGenero + 1) % GENEROS.length
      : bloqueo.indiceGenero % GENEROS.length;
    const nuevoCiclo =
      avanzar && nuevoIndice === 0 ? (bloqueo.ciclo ?? 1) + 1 : bloqueo.ciclo ?? 1;
    const fin = new Date();

    await EstadoAutomatizacion.updateOne(
      { clave: CLAVE_ESTADO },
      {
        $set: {
          indiceGenero: nuevoIndice,
          ciclo: nuevoCiclo,
          ...(completo ? { ultimaGeneracion: fin } : {}),
          generacionEnCurso: false,
          inicioGeneracion: null,
          ultimoEstado: estadoFinal,
        },
        $inc: { totalGenerado: agregados.length },
      }
    );

    await guardarRegistro({
      tipo: 'generacion',
      estado: estadoFinal,
      inicio,
      fin,
      duracionMs: fin.getTime() - inicio.getTime(),
      genero: genero.nombre,
      siguienteGenero: generoEnIndice(nuevoIndice).nombre,
      totalLibrosAntes: totalAntes,
      totalLibrosDespues: totalDespues,
      agregados,
      errores: recortarErrores(errores),
      detalle: {
        lote,
        solicitados: objetivo,
        agregados: agregados.length,
        totalHoy,
        completo,
        advertencias: recortarErrores(resultado.advertencias),
      },
    });

    console.log(
      `Generación diaria ${genero.nombre}: ${agregados.length}/${objetivo} libros (hoy ${totalHoy}/${CANTIDAD_DIARIA}, ${estadoFinal})`
    );

    return {
      agregados: agregados.length,
      genero: genero.nombre,
      estado: estadoFinal,
      totalHoy,
    };
  } catch (error) {
    const fin = new Date();
    const errores = [`Fallo general de generación: ${error.message}`];

    await EstadoAutomatizacion.updateOne(
      { clave: CLAVE_ESTADO },
      {
        $set: {
          generacionEnCurso: false,
          inicioGeneracion: null,
          ultimoIntentoGeneracion: fin,
          ultimoEstado: 'error',
        },
      }
    ).catch(() => {});

    await guardarRegistro({
      tipo: 'generacion',
      estado: 'error',
      inicio,
      fin,
      duracionMs: fin.getTime() - inicio.getTime(),
      genero: estado ? generoEnIndice(estado.indiceGenero).nombre : undefined,
      totalLibrosAntes: totalAntes || undefined,
      totalLibrosDespues: await Libro.countDocuments().catch(() => undefined),
      errores,
    });

    console.error('Error en la generación diaria:', error);
    return { error: error.message };
  }
}

export async function obtenerEstadoMantenimiento() {
  const estado = await obtenerEstado();
  const totalLibros = await Libro.countDocuments();
  const generoActual = generoEnIndice(estado.indiceGenero);
  const siguienteGenero = generoEnIndice(estado.indiceGenero + 1);
  const ultimos = await RegistroMantenimiento.find().sort({ createdAt: -1 }).limit(10).lean();

  return {
    generoActual: generoActual.nombre,
    siguienteGenero: siguienteGenero.nombre,
    ciclo: estado.ciclo,
    indiceGenero: estado.indiceGenero,
    generacionEnCurso: estado.generacionEnCurso,
    ultimaGeneracion: estado.ultimaGeneracion,
    ultimaRevision: estado.ultimaRevision,
    ultimoEstado: estado.ultimoEstado,
    totalGenerado: estado.totalGenerado,
    totalLibros,
    ultimos,
  };
}

export async function listarRegistros(limite = 50) {
  const cantidad = Math.min(Math.max(Number(limite) || 50, 1), 200);
  return RegistroMantenimiento.find().sort({ createdAt: -1 }).limit(cantidad).lean();
}

let temporizadorGeneracion = null;

async function programarProximaGeneracion() {
  const estado = await obtenerEstado();
  const ahora = Date.now();
  const ultima = estado.ultimaGeneracion?.getTime() ?? 0;
  const intento = estado.ultimoIntentoGeneracion?.getTime() ?? 0;
  const proxima = Math.max(ultima + INTERVALO_GENERACION_MS, intento + 60 * 60 * 1000, ahora + 10000);
  const espera = Math.max(10000, proxima - ahora);

  if (temporizadorGeneracion) {
    clearTimeout(temporizadorGeneracion);
  }

  temporizadorGeneracion = setTimeout(async () => {
    await ejecutarGeneracionDiaria().catch((error) =>
      console.error('Error no controlado en generación:', error)
    );
    await programarProximaGeneracion().catch((error) =>
      console.error('No se pudo reprogramar la generación:', error)
    );
  }, espera);
}

export function iniciarAutomatizacion() {
  if (tareasIniciadas) {
    return;
  }

  tareasIniciadas = true;

  cron.schedule(
    '0 * * * *',
    () => {
      ejecutarRevision().catch((error) =>
        console.error('Error no controlado en revisión:', error)
      );
    },
    { timezone: ZONA_HORARIA }
  );

  setTimeout(() => {
    ejecutarRevision().catch((error) =>
      console.error('Error en la revisión inicial:', error)
    );
  }, 15000);

  setTimeout(() => {
    programarProximaGeneracion().catch((error) =>
      console.error('No se pudo iniciar la generación programada:', error)
    );
  }, 20000);

  console.log(
    `Automatización iniciada: revisión cada hora y generación de 10 libros cada 24 horas (${ZONA_HORARIA})`
  );
}
