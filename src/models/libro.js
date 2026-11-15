import mongoose from 'mongoose';

const libroSchema = new mongoose.Schema(
  {
    titulo: { type: String, required: true, trim: true },
    autor: { type: String, required: true, trim: true },
    tipo: { type: String, trim: true, default: 'Novela' },
    isbn: { type: String, trim: true, unique: true, sparse: true },
    editorial: { type: String, trim: true },
    anio: { type: Number, min: 0 },
    genero: { type: String, trim: true },
    precio: { type: Number, min: 0, default: 0 },
    stock: { type: Number, min: 0, default: 0 },
    descripcion: { type: String, trim: true },
    portada: { type: String, trim: true },
    origen: { type: String, enum: ['manual', 'automatico'], default: 'manual' },
    fuente: { type: String, trim: true },
    fuenteId: { type: String, trim: true },
    fuenteUrl: { type: String, trim: true },
    origenDescripcion: { type: String, trim: true },
    lote: { type: String, trim: true, index: true },
  },
  { timestamps: true }
);

libroSchema.index({ fuenteId: 1 }, { unique: true, sparse: true });

export default mongoose.model('Libro', libroSchema);
