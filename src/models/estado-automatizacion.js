import mongoose from 'mongoose';

const estadoAutomatizacionSchema = new mongoose.Schema(
  {
    clave: { type: String, required: true, unique: true, default: 'principal' },
    indiceGenero: { type: Number, default: 0, min: 0 },
    ciclo: { type: Number, default: 1, min: 1 },
    ultimaGeneracion: { type: Date },
    ultimoIntentoGeneracion: { type: Date },
    ultimaRevision: { type: Date },
    generacionEnCurso: { type: Boolean, default: false },
    inicioGeneracion: { type: Date },
    ultimoEstado: { type: String, enum: ['ok', 'advertencia', 'error'] },
    totalGenerado: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true, collection: 'estado_automatizacion' }
);

export default mongoose.model('EstadoAutomatizacion', estadoAutomatizacionSchema);
