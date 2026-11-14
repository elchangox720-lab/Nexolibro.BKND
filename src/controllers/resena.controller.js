import mongoose from 'mongoose';
import Libro from '../models/libro.js';
import Resena from '../models/resena.js';

function manejarError(res, error) {
  if (error.name === 'ValidationError') {
    const errores = Object.values(error.errors).map((item) => item.message);
    return res.status(400).json({ message: 'Datos inválidos', errores });
  }

  console.error(error);
  return res.status(500).json({ message: 'Error interno del servidor' });
}

export async function listarResenasLibro(req, res) {
  try {
    const { libroId } = req.params;

    if (!mongoose.isValidObjectId(libroId)) {
      return res.status(400).json({ message: 'ID de libro inválido' });
    }

    const [resenas, resumen] = await Promise.all([
      Resena.find({ libro: libroId })
        .populate('usuario', 'nombre')
        .sort({ createdAt: -1 })
        .lean(),
      Resena.aggregate([
        { $match: { libro: new mongoose.Types.ObjectId(libroId) } },
        { $group: { _id: null, promedio: { $avg: '$calificacion' }, total: { $sum: 1 } } },
      ]),
    ]);

    res.json({
      resenas,
      promedio: resumen[0]?.promedio ?? 0,
      total: resumen[0]?.total ?? 0,
    });
  } catch (error) {
    manejarError(res, error);
  }
}

export async function guardarResena(req, res) {
  try {
    const { libroId } = req.params;

    if (!mongoose.isValidObjectId(libroId)) {
      return res.status(400).json({ message: 'ID de libro inválido' });
    }

    const calificacion = Number(req.body?.calificacion);
    const comentario = String(req.body?.comentario ?? '').trim();

    if (!Number.isInteger(calificacion) || calificacion < 1 || calificacion > 5) {
      return res.status(400).json({ message: 'La calificación debe ser un entero entre 1 y 5' });
    }

    if (comentario.length > 1000) {
      return res.status(400).json({ message: 'La reseña no puede superar 1000 caracteres' });
    }

    const libro = await Libro.exists({ _id: libroId });
    if (!libro) {
      return res.status(404).json({ message: 'Libro no encontrado' });
    }

    const resena = await Resena.findOneAndUpdate(
      { usuario: req.usuarioId, libro: libroId },
      { $set: { calificacion, comentario } },
      {
        returnDocument: 'after',
        upsert: true,
        setDefaultsOnInsert: true,
        runValidators: true,
      }
    ).populate('usuario', 'nombre');

    res.status(201).json(resena);
  } catch (error) {
    manejarError(res, error);
  }
}

export async function eliminarResena(req, res) {
  try {
    const { libroId } = req.params;

    if (!mongoose.isValidObjectId(libroId)) {
      return res.status(400).json({ message: 'ID de libro inválido' });
    }

    const resena = await Resena.findOneAndDelete({
      usuario: req.usuarioId,
      libro: libroId,
    });

    if (!resena) {
      return res.status(404).json({ message: 'No tienes una reseña de este libro' });
    }

    res.json({ message: 'Reseña eliminada', id: resena._id });
  } catch (error) {
    manejarError(res, error);
  }
}
