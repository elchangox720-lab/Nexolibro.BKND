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
    cedula: {
      type: String,
      required: true,
      trim: true,
      match: /^\d{6,10}$/,
      index: true,
    },
    dias: { type: Number, required: true, min: 1, max: 30 },
    fechaAlquiler: { type: Date, required: true, default: Date.now },
    fechaVencimiento: { type: Date, required: true },
    fechaDevolucion: { type: Date },
    estado: {
      type: String,
      enum: ['pendiente_pago', 'activo', 'devuelto', 'cancelado'],
      default: 'activo',
      index: true,
    },
    valorLibro: { type: Number, min: 0, default: 0 },
    devueltoPor: { type: String, enum: ['usuario', 'admin'] },

    pagoEstado: {
      type: String,
      enum: ['no_requerido', 'pendiente', 'aprobado', 'rechazado', 'reembolsado'],
      default: 'no_requerido',
      index: true,
    },
    pago: { type: mongoose.Schema.Types.ObjectId, ref: 'Pago' },
    referenciaPago: { type: String, trim: true, index: true },
    checkoutUrl: { type: String },
    pagoExpiraEn: { type: Date },
    tarifa: { type: Number, min: 0, default: 0 },
    montoPagado: { type: Number, min: 0, default: 0 },
    fechaPago: { type: Date },
    renovaciones: { type: Number, min: 0, default: 0 },

    multa: { type: Number, min: 0, default: 0 },
    multaPagada: { type: Number, min: 0, default: 0 },

    recordatorioEnviadoEn: { type: Date },
    ultimoAvisoVencidoEn: { type: Date },
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
alquilerSchema.index({ estado: 1, pagoExpiraEn: 1 });

export default mongoose.model('Alquiler', alquilerSchema);
