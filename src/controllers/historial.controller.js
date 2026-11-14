import Historial from '../models/historial.js';

function manejarError(res, error) {
  console.error(error);
  return res.status(500).json({ message: 'Error interno del servidor' });
}

export async function listarHistorial(req, res) {
  try {
    const items = await Historial.find({ usuario: req.usuarioId })
      .sort({ vistoEn: -1 })
      .limit(100);

    res.json(items);
  } catch (error) {
    manejarError(res, error);
  }
}

export async function registrarVisto(req, res) {
  try {
    const { libroId, titulo, autor, portada } = req.body;

    if (!libroId || !titulo) {
      return res.status(400).json({ message: 'Datos incompletos' });
    }

    const item = await Historial.findOneAndUpdate(
      { usuario: req.usuarioId, libro: libroId },
      { titulo, autor, portada, vistoEn: new Date() },
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );

    res.status(201).json(item);
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'ID de libro inválido' });
    }
    manejarError(res, error);
  }
}

export async function limpiarHistorial(req, res) {
  try {
    await Historial.deleteMany({ usuario: req.usuarioId });
    res.json({ message: 'Historial eliminado' });
  } catch (error) {
    manejarError(res, error);
  }
}

export async function eliminarItem(req, res) {
  try {
    const item = await Historial.findOneAndDelete({
      _id: req.params.id,
      usuario: req.usuarioId,
    });

    if (!item) {
      return res.status(404).json({ message: 'Elemento no encontrado' });
    }

    res.json({ message: 'Elemento eliminado', id: item._id });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'ID inválido' });
    }
    manejarError(res, error);
  }
}
