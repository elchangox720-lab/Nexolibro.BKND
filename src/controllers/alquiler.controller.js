import mongoose from 'mongoose';
import Alquiler from '../models/alquiler.js';
import Libro from '../models/libro.js';
import { resolverLectura } from '../services/lectura.service.js';

const DIAS_POR_DEFECTO = 14;
const DIAS_MAXIMOS = 30;
const MAX_ALQUILERES_ACTIVOS = 5;

function manejarError(res, error) {
  if (error.name === 'ValidationError') {
    const errores = Object.values(error.errors).map((item) => item.message);
    return res.status(400).json({ message: 'Datos inválidos', errores });
  }

  if (error.name === 'CastError') {
    return res.status(400).json({ message: 'ID inválido' });
  }

  if (error.code === 11000) {
    return res.status(409).json({ message: 'Ya tienes un alquiler activo de este libro' });
  }

  console.error(error);
  return res.status(500).json({ message: 'Error interno del servidor' });
}

function serializar(alquiler) {
  const base = typeof alquiler.toObject === 'function' ? alquiler.toObject() : alquiler;
  const activo = base.estado === 'activo';
  const vencido = activo && new Date(base.fechaVencimiento).getTime() < Date.now();
  const diasRestantes = activo
    ? Math.max(
        0,
        Math.ceil((new Date(base.fechaVencimiento).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      )
    : 0;
  const lectura = activo && !vencido ? resolverLectura(base) : null;

  return {
    ...base,
    vencido,
    diasRestantes,
    lecturaDisponible: Boolean(lectura),
    lecturaPaginas: lectura?.paginas ?? null,
    lecturaLicencia: lectura?.licencia ?? null,
    lecturaFuente: lectura?.fuente ?? null,
    lecturaFuenteUrl: lectura?.fuenteUrl ?? null,
  };
}

function normalizarCedula(valor) {
  return String(valor ?? '').replace(/[.\s-]/g, '');
}

function leerDias(valor) {
  if (valor === undefined || valor === null || valor === '') {
    return DIAS_POR_DEFECTO;
  }

  const dias = Number(valor);

  if (!Number.isInteger(dias) || dias < 1 || dias > DIAS_MAXIMOS) {
    return null;
  }

  return dias;
}

async function restaurarStock(libroId) {
  try {
    await Libro.updateOne({ _id: libroId }, { $inc: { stock: 1 } });
  } catch (error) {
    console.error('No se pudo restaurar el stock del libro', libroId, error);
  }
}

async function ejecutarDevolucion(filtro, devueltoPor) {
  const alquiler = await Alquiler.findOneAndUpdate(
    { ...filtro, estado: 'activo' },
    {
      $set: {
        estado: 'devuelto',
        fechaDevolucion: new Date(),
        devueltoPor,
      },
    },
    { returnDocument: 'after' }
  );

  if (!alquiler) {
    return null;
  }

  await Libro.updateOne({ _id: alquiler.libro }, { $inc: { stock: 1 } });
  return alquiler;
}

export async function listarAlquileres(req, res) {
  try {
    const filtro = { usuario: req.usuarioId };
    const { estado } = req.query;

    if (estado && !['activo', 'devuelto'].includes(estado)) {
      return res.status(400).json({ message: 'Estado de alquiler inválido' });
    }

    if (estado) {
      filtro.estado = estado;
    }

    const alquileres = await Alquiler.find(filtro)
      .sort({ estado: 1, fechaVencimiento: 1, createdAt: -1 })
      .lean();

    res.json(alquileres.map(serializar));
  } catch (error) {
    manejarError(res, error);
  }
}

export async function crearAlquiler(req, res) {
  try {
    const { libroId } = req.body ?? {};

    if (!mongoose.isValidObjectId(libroId)) {
      return res.status(400).json({ message: 'ID de libro inválido' });
    }

    const dias = leerDias(req.body?.dias);
    if (dias === null) {
      return res.status(400).json({ message: `Los días deben estar entre 1 y ${DIAS_MAXIMOS}` });
    }

    const cedula = normalizarCedula(req.body?.cedula);
    if (!/^\d{6,10}$/.test(cedula)) {
      return res.status(400).json({
        message: 'Ingresa un número de cédula válido, entre 6 y 10 dígitos',
      });
    }

    const [mismoLibro, activos] = await Promise.all([
      Alquiler.exists({ usuario: req.usuarioId, libro: libroId, estado: 'activo' }),
      Alquiler.countDocuments({ usuario: req.usuarioId, estado: 'activo' }),
    ]);

    if (mismoLibro) {
      return res.status(409).json({ message: 'Ya tienes un alquiler activo de este libro' });
    }

    if (activos >= MAX_ALQUILERES_ACTIVOS) {
      return res.status(409).json({
        message: `Puedes tener como máximo ${MAX_ALQUILERES_ACTIVOS} alquileres activos`,
      });
    }

    const libro = await Libro.findOneAndUpdate(
      { _id: libroId, stock: { $gt: 0 } },
      { $inc: { stock: -1 } },
      { returnDocument: 'after' }
    );

    if (!libro) {
      const existe = await Libro.exists({ _id: libroId });
      return res.status(existe ? 409 : 404).json({
        message: existe ? 'No hay ejemplares disponibles' : 'Libro no encontrado',
      });
    }

    const fechaAlquiler = new Date();
    const fechaVencimiento = new Date(fechaAlquiler.getTime() + dias * 24 * 60 * 60 * 1000);

    try {
      const alquiler = await Alquiler.create({
        usuario: req.usuarioId,
        libro: libro._id,
        titulo: libro.titulo,
        autor: libro.autor,
        portada: libro.portada,
        cedula,
        dias,
        fechaAlquiler,
        fechaVencimiento,
        valorLibro: libro.precio,
      });

      return res.status(201).json(serializar(alquiler));
    } catch (error) {
      await restaurarStock(libro._id);
      return manejarError(res, error);
    }
  } catch (error) {
    return manejarError(res, error);
  }
}

export async function devolverAlquiler(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'ID de alquiler inválido' });
    }

    const alquiler = await ejecutarDevolucion(
      { _id: id, usuario: req.usuarioId },
      'usuario'
    );

    if (!alquiler) {
      const existe = await Alquiler.exists({ _id: id, usuario: req.usuarioId });
      return res.status(existe ? 409 : 404).json({
        message: existe ? 'Este alquiler ya fue devuelto' : 'Alquiler no encontrado',
      });
    }

    res.json(serializar(alquiler));
  } catch (error) {
    manejarError(res, error);
  }
}

export async function leerAlquiler(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'ID de alquiler inválido' });
    }

    const alquiler = await Alquiler.findOne({ _id: id, usuario: req.usuarioId }).lean();

    if (!alquiler) {
      return res.status(404).json({ message: 'Alquiler no encontrado' });
    }

    if (alquiler.estado !== 'activo') {
      return res.status(403).json({
        message: 'Este alquiler ya fue devuelto. El archivo de lectura no está disponible.',
      });
    }

    if (new Date(alquiler.fechaVencimiento).getTime() <= Date.now()) {
      return res.status(403).json({
        message: 'Tu alquiler venció. El archivo de lectura ya no está disponible.',
      });
    }

    const lectura = resolverLectura(alquiler);

    if (!lectura) {
      return res.status(404).json({
        message: 'Archivo de lectura no disponible para este libro.',
      });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${lectura.archivo}"`);
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('Pragma', 'no-cache');

    return res.sendFile(lectura.ruta, (error) => {
      if (!error || res.headersSent) {
        if (error) {
          console.error('No se pudo enviar el archivo de lectura', error);
        }
        return;
      }

      res.removeHeader('Content-Disposition');
      manejarError(res, error);
    });
  } catch (error) {
    manejarError(res, error);
  }
}

export async function listarAlquileresAdmin(req, res) {
  try {
    const filtro = {};
    const { estado, vencidos, usuario, libro } = req.query;

    if (vencidos === 'true' || vencidos === '1') {
      filtro.estado = 'activo';
      filtro.fechaVencimiento = { $lt: new Date() };
    } else if (estado !== undefined) {
      if (!['activo', 'devuelto'].includes(estado)) {
        return res.status(400).json({ message: 'Estado de alquiler inválido' });
      }
      filtro.estado = estado;
    }

    if (usuario !== undefined) {
      if (!mongoose.isValidObjectId(usuario)) {
        return res.status(400).json({ message: 'ID de usuario inválido' });
      }
      filtro.usuario = usuario;
    }

    if (libro !== undefined) {
      if (!mongoose.isValidObjectId(libro)) {
        return res.status(400).json({ message: 'ID de libro inválido' });
      }
      filtro.libro = libro;
    }

    const alquileres = await Alquiler.find(filtro)
      .sort({ estado: 1, fechaVencimiento: 1, createdAt: -1 })
      .populate('usuario', 'nombre email')
      .lean();

    res.json(alquileres.map(serializar));
  } catch (error) {
    manejarError(res, error);
  }
}

export async function devolverAlquilerAdmin(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'ID de alquiler inválido' });
    }

    const alquiler = await ejecutarDevolucion({ _id: id }, 'admin');

    if (!alquiler) {
      const existe = await Alquiler.exists({ _id: id });
      return res.status(existe ? 409 : 404).json({
        message: existe ? 'Este alquiler ya fue devuelto' : 'Alquiler no encontrado',
      });
    }

    await alquiler.populate('usuario', 'nombre email');
    res.json(serializar(alquiler));
  } catch (error) {
    manejarError(res, error);
  }
}
