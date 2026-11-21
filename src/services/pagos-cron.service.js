import cron from 'node-cron';
import Alquiler from '../models/alquiler.js';
import Libro from '../models/libro.js';
import Pago from '../models/pago.js';
import { calcularMulta, DIA_MS } from './pagos.service.js';
import { notificarRecordatorio, notificarVencido } from './notificaciones.service.js';

const ZONA_HORARIA = 'America/Bogota';
let iniciado = false;

async function cancelarAlquilerPendiente(pago) {
  if (pago.tipo !== 'alquiler' || !pago.alquiler) {
    return;
  }

  const alquiler = await Alquiler.findOneAndUpdate(
    { _id: pago.alquiler, estado: 'pendiente_pago' },
    {
      $set: {
        estado: 'cancelado',
        pagoEstado: 'rechazado',
        checkoutUrl: null,
      },
    },
    { returnDocument: 'after' }
  );

  if (alquiler) {
    await Libro.updateOne({ _id: alquiler.libro }, { $inc: { stock: 1 } });
  }
}

export async function expirarPagosPendientes() {
  const pagos = await Pago.find({
    estado: 'pendiente',
    expiracion: { $lt: new Date() },
  })
    .limit(100)
    .lean();

  for (const pago of pagos) {
    const actualizado = await Pago.findOneAndUpdate(
      { _id: pago._id, estado: 'pendiente' },
      {
        $set: {
          estado: 'expirado',
          nota: 'Expirado sin confirmación de pago',
        },
      },
      { returnDocument: 'after' }
    );

    if (actualizado) {
      await cancelarAlquilerPendiente(actualizado);
    }
  }

  if (pagos.length > 0) {
    console.log(`Pagos expirados procesados: ${pagos.length}`);
  }
}

export async function actualizarMultas() {
  const ahora = new Date();
  const alquileres = await Alquiler.find({
    estado: 'activo',
    fechaVencimiento: { $lt: ahora },
  })
    .limit(300)
    .lean();

  for (const alquiler of alquileres) {
    const { multa } = calcularMulta({
      valorLibro: alquiler.valorLibro,
      fechaVencimiento: alquiler.fechaVencimiento,
      multaActual: alquiler.multa,
      ahora,
    });

    if (multa > (Number(alquiler.multa) || 0)) {
      await Alquiler.updateOne({ _id: alquiler._id }, { $max: { multa } });
    }
  }
}

export async function enviarRecordatorios() {
  const ahora = new Date();
  const limite = new Date(ahora.getTime() + 3 * DIA_MS);
  const alquileres = await Alquiler.find({
    estado: 'activo',
    fechaVencimiento: { $gte: ahora, $lte: limite },
    $or: [
      { recordatorioEnviadoEn: { $exists: false } },
      { recordatorioEnviadoEn: null },
    ],
  })
    .populate('usuario', 'nombre email')
    .limit(100);

  for (const alquiler of alquileres) {
    const resultado = await notificarRecordatorio({
      usuario: alquiler.usuario,
      alquiler,
    });

    if (resultado.enviado) {
      await Alquiler.updateOne(
        { _id: alquiler._id, recordatorioEnviadoEn: null },
        { $set: { recordatorioEnviadoEn: new Date() } }
      );
    }
  }
}

export async function enviarAvisosVencidos() {
  const ahora = new Date();
  const haceTresDias = new Date(ahora.getTime() - 3 * DIA_MS);
  const alquileres = await Alquiler.find({
    estado: 'activo',
    fechaVencimiento: { $lt: ahora },
    $or: [
      { ultimoAvisoVencidoEn: { $exists: false } },
      { ultimoAvisoVencidoEn: null },
      { ultimoAvisoVencidoEn: { $lt: haceTresDias } },
    ],
  })
    .populate('usuario', 'nombre email')
    .limit(100);

  for (const alquiler of alquileres) {
    const { multa } = calcularMulta({
      valorLibro: alquiler.valorLibro,
      fechaVencimiento: alquiler.fechaVencimiento,
      multaActual: alquiler.multa,
      ahora,
    });
    const multaPendiente = Math.max(0, multa - (Number(alquiler.multaPagada) || 0));
    const resultado = await notificarVencido({
      usuario: alquiler.usuario,
      alquiler,
      multaPendiente,
    });

    if (resultado.enviado) {
      await Alquiler.updateOne(
        { _id: alquiler._id },
        { $set: { ultimoAvisoVencidoEn: new Date() } }
      );
    }
  }
}

export function iniciarCronPagos() {
  if (iniciado) {
    return;
  }

  iniciado = true;

  cron.schedule(
    '*/5 * * * *',
    () => {
      expirarPagosPendientes().catch((error) =>
        console.error('Error expirando pagos pendientes:', error)
      );
    },
    { timezone: ZONA_HORARIA }
  );

  cron.schedule(
    '15 * * * *',
    () => {
      actualizarMultas().catch((error) =>
        console.error('Error actualizando multas:', error)
      );
    },
    { timezone: ZONA_HORARIA }
  );

  cron.schedule(
    '0 9 * * *',
    () => {
      enviarRecordatorios().catch((error) =>
        console.error('Error enviando recordatorios:', error)
      );
    },
    { timezone: ZONA_HORARIA }
  );

  cron.schedule(
    '0 10 * * *',
    () => {
      enviarAvisosVencidos().catch((error) =>
        console.error('Error enviando avisos de vencimiento:', error)
      );
    },
    { timezone: ZONA_HORARIA }
  );

  setTimeout(() => {
    expirarPagosPendientes().catch(() => {});
  }, 10000);

  console.log('Cron de pagos iniciado: expiración, multas y recordatorios.');
}
