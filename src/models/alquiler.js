import mongoose from 'mongoose';

const alquilerSchema = new mongoose.Schema(
  {
    usuario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true,
      index: true,
    },
    libro: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Libro',
      required: true,
      index: true,
    },
    titulo: { type: String, required: true },
    autor: { type: String },
    portada: { type: String },
    dias: { type: Number, required: true, min: 1, max: 30 },
    fechaAlquiler: { type: Date, required: true, default: Date.now },
    fechaVencimiento: { type: Date, required: true },
    fechaDevolucion: { type: Date },
    estado: {
      type: String,
      enum: ['activo', 'devuelto'],
      default: 'activo',
      index: true,
    },
    valorLibro: { type: Number, min: 0, default: 0 },
    devueltoPor: { type: String, enum: ['usuario', 'admin'] },
  },
  { timestamps: true }
);

alquilerSchema.index({ usuario: 1, estado: 1 });
alquilerSchema.index({ libro: 1, estado: 1 });
alquilerSchema.index(
  { usuario: 1, libro: 1 },
  { unique: true, partialFilterExpression: { estado: 'activo' } }
);
alquilerSchema.index({ estado: 1, fechaVencimiento: 1 });

export default mongoose.model('Alquiler', alquilerSchema);
