import mongoose from 'mongoose';

const pagoSchema = new mongoose.Schema(
  {
    usuario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true,
      index: true,
    },
    libro: { type: mongoose.Schema.Types.ObjectId, ref: 'Libro', index: true },
    alquiler: { type: mongoose.Schema.Types.ObjectId, ref: 'Alquiler', index: true },
    tipo: {
      type: String,
      enum: ['alquiler', 'renovacion', 'multa'],
      default: 'alquiler',
      index: true,
    },
    referencia: { type: String, required: true, unique: true, trim: true },
    monto: { type: Number, required: true, min: 1 },
    moneda: { type: String, default: 'COP', uppercase: true },
    estado: {
      type: String,
      enum: ['pendiente', 'aprobado', 'rechazado', 'expirado', 'reembolsado'],
      default: 'pendiente',
      index: true,
    },
    wompiId: { type: String, trim: true, index: true },
    metodoPago: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    nombre: { type: String, trim: true },
    cedula: { type: String, trim: true },
    dias: { type: Number, min: 1, max: 30 },
    expiracion: { type: Date, index: true },
    checkoutUrl: { type: String },
    aprobadoEn: { type: Date },
    rechazadoEn: { type: Date },
    nota: { type: String, trim: true },
    payload: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

pagoSchema.index({ usuario: 1, estado: 1 });
pagoSchema.index({ alquiler: 1, tipo: 1, estado: 1 });

export default mongoose.model('Pago', pagoSchema);
