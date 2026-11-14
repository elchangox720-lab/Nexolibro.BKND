import mongoose from 'mongoose';
import Biblioteca from '../models/biblioteca.js';
import Libro from '../models/libro.js';

const ESTADOS = ['quiero-leer', 'leyendo', 'leido'];

function manejarError(res, error) {
  if (error.name === 'ValidationError') {
    const errores = Object.values(error.errors).map((item) => item.message);
    return res.status(400).json({ message: 'Datos inválidos', errores });
  }

  console.error(error);
  return res.status(500).json({ message: 'Error interno del servidor' });
}

export async function listarBiblioteca(req, res) {
  try {
    const items = await Biblioteca.find({ usuario: req.usuarioId })
      .sort({ updatedAt: -1 })
      .lean();

    res.json(items);
  } catch (error) {
    manejarError(res, error);
  }
}

export async function actualizarBiblioteca(req, res) {
  try {
    const { libroId } = req.params;

    if (!mongoose.isValidObjectId(libroId)) {
      return res.status(400).json({ message: 'ID de libro inválido' });
    }

    const { favorito, estado } = req.body ?? {};

    if (favorito === undefined && estado === undefined) {
      return res.status(400).json({ message: 'No hay cambios para aplicar' });
    }

    const set = {};
    const unset = {};

    if (favorito !== undefined) {
      if (typeof favorito !== 'boolean') {
        return res.status(400).json({ message: 'El favorito debe ser booleano' });
      }
      set.favorito = favorito;
    }

    if (estado !== undefined) {
      if (estado === null || estado === '') {
        unset.estado = 1;
      } else if (!ESTADOS.includes(estado)) {
        return res.status(400).json({ message: 'Estado de lectura inválido' });
      } else {
        set.estado = estado;
      }
    }

    const libro = await Libro.exists({ _id: libroId });
    if (!libro) {
      return res.status(404).json({ message: 'Libro no encontrado' });
    }

    const operacion = {};
    if (Object.keys(set).length) {
      operacion.$set = set;
    }
    if (Object.keys(unset).length) {
      operacion.$unset = unset;
    }

    const item = await Biblioteca.findOneAndUpdate(
      { usuario: req.usuarioId, libro: libroId },
      operacion,
      {
        returnDocument: 'after',
        upsert: true,
        setDefaultsOnInsert: true,
        runValidators: true,
      }
    );

    res.json(item);
  } catch (error) {
    manejarError(res, error);
  }
}

export async function eliminarDeBiblioteca(req, res) {
  try {
    const { libroId } = req.params;

    if (!mongoose.isValidObjectId(libroId)) {
      return res.status(400).json({ message: 'ID de libro inválido' });
    }

    const item = await Biblioteca.findOneAndDelete({
      usuario: req.usuarioId,
      libro: libroId,
    });

    if (!item) {
      return res.status(404).json({ message: 'El libro no está en tu biblioteca' });
    }

    res.json({ message: 'Libro quitado de tu biblioteca', id: item._id });
  } catch (error) {
    manejarError(res, error);
  }
}
