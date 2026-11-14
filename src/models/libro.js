import mongoose from 'mongoose';

const libroSchema = new mongoose.Schema(
  {
    titulo: { type: String, required: true, trim: true },
    autor: { type: String, required: true, trim: true },
    isbn: { type: String, trim: true, unique: true, sparse: true },
    editorial: { type: String, trim: true },
    anio: { type: Number, min: 0 },
    genero: { type: String, trim: true },
    precio: { type: Number, min: 0, default: 0 },
    stock: { type: Number, min: 0, default: 0 },
    descripcion: { type: String, trim: true },
    portada: { type: String, trim: true },
  },
  { timestamps: true }
);

export default mongoose.model('Libro', libroSchema);
