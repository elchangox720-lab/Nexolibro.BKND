import EstadoAutomatizacion from '../models/estado-automatizacion.js';
import Libro from '../models/libro.js';
import RegistroMantenimiento from '../models/registro-mantenimiento.js';
import { claveLectura, listarCatalogoLecturas } from './lectura.service.js';

const CLAVE_ESTADO = 'principal';
const CANTIDAD_DIARIA = 10;
const INTERVALO_GENERACION_MS = 24 * 60 * 60 * 1000;
const ZONA_HORARIA = 'America/Bogota';

function fechaBogota(fecha = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(fecha);
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

async function guardarRegistro(datos) {
  try {
    return await RegistroMantenimiento.create(datos);
  } catch (error) {
    console.error('No se pudo guardar el registro de mantenimiento:', error.message);
    return null;
  }
}

async function obtenerPendientes() {
  const existentes = await Libro.find().select('titulo autor').lean();
  const claves = new Set(existentes.map((libro) => claveLectura(libro)));

  return listarCatalogoLecturas().filter(
    (lectura) => lectura.disponible && !claves.has(claveLectura(lectura))
  );
}

export async function obtenerResumenCatalogo() {
  const catalogo = listarCatalogoLecturas();
  const pendientes = await obtenerPendientes();

  return {
    totalCatalogo: catalogo.length,
    lecturasDisponibles: catalogo.filter((lectura) => lectura.disponible).length,
    pendientes: pendientes.length,
  };
}

export async function ejecutarGeneracionCatalogo({
  forzar = false,
  cantidad,
  lote: loteSolicitado,
} = {}) {
  const inicio = new Date();
  let estado;
  let totalAntes = 0;

  try {
    estado = await obtenerEstado();

    const recientes = await Libro.countDocuments({
      origen: 'automatico',
      createdAt: { $gte: new Date(Date.now() - INTERVALO_GENERACION_MS) },
    });

    if (!forzar && !cantidad && recientes >= CANTIDAD_DIARIA) {
      console.log('Generación omitida: ya se agregaron los libros de las últimas 24 horas');
      return { omitido: true, motivo: 'limite-24h', agregados: recientes };
    }

    if (
      !forzar &&
      !cantidad &&
      estado.ultimaGeneracion &&
      Date.now() - estado.ultimaGeneracion.getTime() < INTERVALO_GENERACION_MS
    ) {
      console.log('Generación omitida: última ejecución hace menos de 24 horas');
      return { omitido: true, motivo: 'ultima-ejecucion' };
    }

    if (estado.generacionEnCurso) {
      console.log('Generación omitida: ya hay una ejecución en curso');
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

    const catalogo = listarCatalogoLecturas();
    const pendientes = await obtenerPendientes();
    const lote = loteSolicitado || `${fechaBogota(inicio)}-catalogo-validado`;
    const objetivo = Math.min(
      Number(cantidad) > 0 ? Number(cantidad) : forzar ? CANTIDAD_DIARIA : Math.max(CANTIDAD_DIARIA - recientes, 1),
      pendientes.length
    );
    totalAntes = await Libro.countDocuments();

    if (objetivo === 0) {
      const fin = new Date();

      await EstadoAutomatizacion.updateOne(
        { clave: CLAVE_ESTADO },
        {
          $set: {
            generacionEnCurso: false,
            inicioGeneracion: null,
            ultimaGeneracion: fin,
            ultimoEstado: 'ok',
          },
        }
      );

      console.log(
        `Generación sin pendientes: ${catalogo.filter((lectura) => lectura.disponible).length}/${catalogo.length} lecturas disponibles en catálogo`
      );

      return {
        omitido: true,
        motivo: 'sin-pendientes',
        catalogo: catalogo.length,
        disponibles: catalogo.filter((lectura) => lectura.disponible).length,
        pendientes: 0,
      };
    }

    console.log(`Iniciando generación validada: ${lote} (${objetivo} libros)`);

    const agregados = [];
    const errores = [];

    for (const lectura of pendientes.slice(0, objetivo)) {
      try {
        const libro = await Libro.create({
          titulo: lectura.titulo,
          autor: lectura.autor,
          tipo: lectura.tipo || 'Novela',
          genero: lectura.genero,
          anio: lectura.anio,
          descripcion: lectura.descripcion,
          portada: lectura.portada,
          precio: 49900,
          stock: 10,
          origen: 'automatico',
          fuente: lectura.fuente,
          fuenteId: lectura.fuenteId,
          fuenteUrl: lectura.fuenteUrl,
          origenDescripcion: 'Catálogo validado de dominio público',
          lote,
        });

        agregados.push({
          libro: libro._id,
          titulo: libro.titulo,
          autor: libro.autor,
          fuente: libro.fuente,
          fuenteId: libro.fuenteId,
        });
      } catch (error) {
        if (error.code === 11000) {
          errores.push(`Duplicado evitado: ${lectura.titulo}`);
        } else {
          errores.push(`No se pudo guardar ${lectura.titulo}: ${error.message}`);
        }
      }
    }

    const totalDespues = await Libro.countDocuments();
    const totalHoy = recientes + agregados.length;
    const estadoFinal = errores.length ? 'advertencia' : 'ok';
    const fin = new Date();

    await EstadoAutomatizacion.updateOne(
      { clave: CLAVE_ESTADO },
      {
        $set: {
          ...(agregados.length ? { ultimaGeneracion: fin } : {}),
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
      genero: 'Catálogo validado',
      siguienteGenero: 'Catálogo validado',
      totalLibrosAntes: totalAntes,
      totalLibrosDespues: totalDespues,
      agregados,
      errores: recortarErrores(errores),
      detalle: {
        lote,
        solicitados: objetivo,
        agregados: agregados.length,
        totalHoy,
        catalogo: catalogo.length,
        disponibles: catalogo.filter((lectura) => lectura.disponible).length,
        pendientesAntes: pendientes.length,
        pendientesDespues: Math.max(pendientes.length - agregados.length, 0),
      },
    });

    console.log(
      `Generación validada: ${agregados.length}/${objetivo} libros (hoy ${totalHoy}/${CANTIDAD_DIARIA}, ${estadoFinal})`
    );

    return {
      agregados: agregados.length,
      estado: estadoFinal,
      totalHoy,
      lote,
      catalogo: catalogo.length,
      disponibles: catalogo.filter((lectura) => lectura.disponible).length,
      pendientes: Math.max(pendientes.length - agregados.length, 0),
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
      genero: 'Catálogo validado',
      totalLibrosAntes: totalAntes || undefined,
      totalLibrosDespues: await Libro.countDocuments().catch(() => undefined),
      errores,
    });

    console.error('Error en la generación validada:', error);
    return { error: error.message };
  }
}
