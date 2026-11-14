import mongoose from 'mongoose';

const bibliotecaSchema = new mongoose.Schema(
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
    },
    favorito: { type: Boolean, default: false },
    estado: {
      type: String,
      enum: ['quiero-leer', 'leyendo', 'leido'],
    },
  },
  { timestamps: true }
);

bibliotecaSchema.index({ usuario: 1, libro: 1 }, { unique: true });

export default mongoose.model('Biblioteca', bibliotecaSchema);
