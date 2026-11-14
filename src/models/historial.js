import mongoose from 'mongoose';

const historialSchema = new mongoose.Schema(
  {
    usuario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true,
      index: true,
    },
    libro: { type: mongoose.Schema.Types.ObjectId, ref: 'Libro', required: true },
    titulo: { type: String, required: true },
    autor: { type: String },
    portada: { type: String },
    vistoEn: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

historialSchema.index({ usuario: 1, libro: 1 }, { unique: true });

export default mongoose.model('Historial', historialSchema);
