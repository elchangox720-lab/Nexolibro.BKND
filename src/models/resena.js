import mongoose from 'mongoose';

const resenaSchema = new mongoose.Schema(
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
    calificacion: { type: Number, required: true, min: 1, max: 5 },
    comentario: { type: String, trim: true, maxlength: 1000 },
  },
  { timestamps: true }
);

resenaSchema.index({ usuario: 1, libro: 1 }, { unique: true });

export default mongoose.model('Resena', resenaSchema);
