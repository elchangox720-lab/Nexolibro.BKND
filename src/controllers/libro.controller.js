import Alquiler from '../models/alquiler.js';
import Libro from '../models/libro.js';
import { resolverLectura } from '../services/lectura.service.js';
import { calcularTarifa, DIAS_BASE, modoPagos } from '../services/pagos.service.js';

const MENSAJE_SIN_LECTURA =
  'Solo se pueden registrar libros con un PDF legible de dominio público.';

function manejarError(res, error) {
  if (error.name === 'ValidationError') {
    const errores = Object.values(error.errors).map((item) => item.message);
    return res.status(400).json({ message: 'Datos inválidos', errores });
  }

  if (error.name === 'CastError') {
    return res.status(400).json({ message: 'ID inválido' });
  }

  if (error.code === 11000) {
    return res.status(409).json({ message: 'El ISBN ya está registrado' });
  }

  console.error(error);
  return res.status(500).json({ message: 'Error interno del servidor' });
}

function serializarLibro(libro) {
  const base = typeof libro.toObject === 'function' ? libro.toObject() : libro;
  const modo = modoPagos();

  return {
    ...base,
    tarifaAlquiler: modo === 'directo' ? 0 : calcularTarifa(base.precio, DIAS_BASE),
    tarifaDias: DIAS_BASE,
    pagoRequerido: modo !== 'directo',
    modoPagos: modo,
  };
}

export async function listarLibros(req, res) {
  try {
    const libros = await Libro.find().sort({ createdAt: -1 }).lean();
    res.json(libros.map(serializarLibro));
  } catch (error) {
    manejarError(res, error);
  }
}

export async function obtenerLibro(req, res) {
  try {
    const libro = await Libro.findById(req.params.id);
    if (!libro) {
      return res.status(404).json({ message: 'Libro no encontrado' });
    }
    res.json(serializarLibro(libro));
  } catch (error) {
    manejarError(res, error);
  }
}

export async function crearLibro(req, res) {
  try {
    if (!resolverLectura(req.body)) {
      return res.status(400).json({ message: MENSAJE_SIN_LECTURA });
    }

    const libro = await Libro.create(req.body);
    res.status(201).json(serializarLibro(libro));
  } catch (error) {
    manejarError(res, error);
  }
}

export async function actualizarLibro(req, res) {
  try {
    const actual = await Libro.findById(req.params.id).select('titulo autor').lean();

    if (!actual) {
      return res.status(404).json({ message: 'Libro no encontrado' });
    }

    const titulo = req.body.titulo ?? actual.titulo;
    const autor = req.body.autor ?? actual.autor;

    if (!resolverLectura({ titulo, autor })) {
      return res.status(400).json({ message: MENSAJE_SIN_LECTURA });
    }

    const libro = await Libro.findByIdAndUpdate(req.params.id, req.body, {
      returnDocument: 'after',
      runValidators: true,
    });

    if (!libro) {
      return res.status(404).json({ message: 'Libro no encontrado' });
    }

    res.json(serializarLibro(libro));
  } catch (error) {
    manejarError(res, error);
  }
}

export async function eliminarLibro(req, res) {
  try {
    const activos = await Alquiler.countDocuments({
      libro: req.params.id,
      estado: { $in: ['activo', 'pendiente_pago'] },
    });

    if (activos > 0) {
      return res.status(409).json({
        message: 'No se puede eliminar un libro con alquileres activos o pendientes de pago',
      });
    }

    const libro = await Libro.findByIdAndDelete(req.params.id);
    if (!libro) {
      return res.status(404).json({ message: 'Libro no encontrado' });
    }
    res.json({ message: 'Libro eliminado', id: libro._id });
  } catch (error) {
    manejarError(res, error);
  }
}
