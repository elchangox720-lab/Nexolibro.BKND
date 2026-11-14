import Libro from '../models/libro.js';

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

export async function listarLibros(req, res) {
  try {
    const libros = await Libro.find().sort({ createdAt: -1 });
    res.json(libros);
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
    res.json(libro);
  } catch (error) {
    manejarError(res, error);
  }
}

export async function crearLibro(req, res) {
  try {
    const libro = await Libro.create(req.body);
    res.status(201).json(libro);
  } catch (error) {
    manejarError(res, error);
  }
}

export async function actualizarLibro(req, res) {
  try {
    const libro = await Libro.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!libro) {
      return res.status(404).json({ message: 'Libro no encontrado' });
    }
    res.json(libro);
  } catch (error) {
    manejarError(res, error);
  }
}

export async function eliminarLibro(req, res) {
  try {
    const libro = await Libro.findByIdAndDelete(req.params.id);
    if (!libro) {
      return res.status(404).json({ message: 'Libro no encontrado' });
    }
    res.json({ message: 'Libro eliminado', id: libro._id });
  } catch (error) {
    manejarError(res, error);
  }
}
