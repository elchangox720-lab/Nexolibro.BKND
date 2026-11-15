import mongoose from 'mongoose';

const libroAgregadoSchema = new mongoose.Schema(
  {
    libro: { type: mongoose.Schema.Types.ObjectId, ref: 'Libro' },
    titulo: { type: String, required: true },
    autor: { type: String },
    fuente: { type: String },
    fuenteId: { type: String },
  },
  { _id: false }
);

const registroMantenimientoSchema = new mongoose.Schema(
  {
    tipo: { type: String, enum: ['revision', 'generacion'], required: true, index: true },
    estado: { type: String, enum: ['ok', 'advertencia', 'error'], required: true, index: true },
    inicio: { type: Date, required: true },
    fin: { type: Date, required: true },
    duracionMs: { type: Number, required: true, min: 0 },
    genero: { type: String },
    siguienteGenero: { type: String },
    totalLibrosAntes: { type: Number },
    totalLibrosDespues: { type: Number },
    agregados: { type: [libroAgregadoSchema], default: [] },
    errores: { type: [String], default: [] },
    detalle: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true, collection: 'registros_mantenimiento' }
);

registroMantenimientoSchema.index({ createdAt: -1 });

export default mongoose.model('RegistroMantenimiento', registroMantenimientoSchema);
