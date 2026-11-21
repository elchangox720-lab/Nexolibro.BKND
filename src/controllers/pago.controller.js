import mongoose from 'mongoose';
import Alquiler from '../models/alquiler.js';
import Libro from '../models/libro.js';
import Pago from '../models/pago.js';
import { serializarAlquiler } from './alquiler.controller.js';
import {
  configuracionPagos,
  DIA_MS,
  modoPagos,
  verificarFirmaEvento,
} from '../services/pagos.service.js';
import {
  notificarAdminRevision,
  notificarPagoAprobado,
  notificarPagoRechazado,
} from '../services/notificaciones.service.js';

function serializarPago(pago) {
  if (!pago) {
    return null;
  }

  const base = typeof pago.toObject === 'function' ? pago.toObject() : pago;
  const { payload, ...resto } = base;

  return resto;
}

async function cancelarAlquilerPendiente(pago) {
  if (pago.tipo !== 'alquiler' || !pago.alquiler) {
    return null;
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

  return alquiler;
}

async function reservarYActivar(alquiler, pago, ahora, fechaVencimiento) {
  const duplicado = await Alquiler.exists({
    _id: { $ne: alquiler._id },
    usuario: pago.usuario,
    libro: pago.libro,
    estado: 'activo',
  });

  if (duplicado) {
    return { error: 'alquiler-duplicado' };
  }

  const libro = await Libro.findOneAndUpdate(
    { _id: alquiler.libro, stock: { $gt: 0 } },
    { $inc: { stock: -1 } },
    { returnDocument: 'after' }
  );

  if (!libro) {
    return { error: 'sin-stock' };
  }

  const actualizado = await Alquiler.findOneAndUpdate(
    { _id: alquiler._id, estado: 'cancelado' },
    {
      $set: {
        estado: 'activo',
        pagoEstado: 'aprobado',
        pago: pago._id,
        referenciaPago: pago.referencia,
        montoPagado: pago.monto,
        fechaPago: ahora,
        fechaAlquiler: ahora,
        fechaVencimiento,
        checkoutUrl: null,
        pagoExpiraEn: null,
      },
    },
    { returnDocument: 'after' }
  );

  if (!actualizado) {
    await Libro.updateOne({ _id: alquiler.libro }, { $inc: { stock: 1 } });
    return { error: 'alquiler-no-actualizado' };
  }

  return actualizado;
}

async function activarAlquiler(pago) {
  const ahora = new Date();
  const fechaVencimiento = new Date(ahora.getTime() + (pago.dias || 14) * DIA_MS);
  let alquiler = pago.alquiler ? await Alquiler.findById(pago.alquiler) : null;

  if (alquiler && alquiler.estado === 'activo') {
    return alquiler;
  }

  if (alquiler && alquiler.estado === 'devuelto') {
    return { error: 'alquiler-ya-devuelto' };
  }

  if (alquiler && alquiler.estado === 'cancelado') {
    return reservarYActivar(alquiler, pago, ahora, fechaVencimiento);
  }

  if (alquiler && alquiler.estado === 'pendiente_pago') {
    return Alquiler.findOneAndUpdate(
      { _id: alquiler._id, estado: 'pendiente_pago' },
      {
        $set: {
          estado: 'activo',
          pagoEstado: 'aprobado',
          pago: pago._id,
          referenciaPago: pago.referencia,
          montoPagado: pago.monto,
          fechaPago: ahora,
          fechaAlquiler: ahora,
          fechaVencimiento,
          checkoutUrl: null,
          pagoExpiraEn: null,
        },
      },
      { returnDocument: 'after' }
    );
  }

  const duplicado = await Alquiler.exists({
    usuario: pago.usuario,
    libro: pago.libro,
    estado: 'activo',
  });

  if (duplicado) {
    return { error: 'alquiler-duplicado' };
  }

  const libro = await Libro.findOneAndUpdate(
    { _id: pago.libro, stock: { $gt: 0 } },
    { $inc: { stock: -1 } },
    { returnDocument: 'after' }
  );

  if (!libro) {
    return { error: 'sin-stock' };
  }

  try {
    alquiler = await Alquiler.create({
      usuario: pago.usuario,
      libro: pago.libro,
      titulo: libro.titulo,
      autor: libro.autor,
      portada: libro.portada,
      cedula: pago.cedula,
      dias: pago.dias || 14,
      fechaAlquiler: ahora,
      fechaVencimiento,
      valorLibro: libro.precio,
      tarifa: pago.monto,
      estado: 'activo',
      pagoEstado: 'aprobado',
      pago: pago._id,
      referenciaPago: pago.referencia,
      montoPagado: pago.monto,
      fechaPago: ahora,
    });

    await Pago.updateOne({ _id: pago._id }, { $set: { alquiler: alquiler._id } });
    return alquiler;
  } catch (error) {
    await Libro.updateOne({ _id: pago.libro }, { $inc: { stock: 1 } });
    return { error: error.code === 11000 ? 'alquiler-duplicado' : 'no-se-pudo-crear' };
  }
}

async function activarRenovacion(pago) {
  const alquiler = await Alquiler.findById(pago.alquiler);

  if (!alquiler) {
    return { error: 'alquiler-no-encontrado' };
  }

  if (alquiler.estado !== 'activo') {
    return { error: `alquiler-${alquiler.estado}` };
  }

  const base = Math.max(Date.now(), new Date(alquiler.fechaVencimiento).getTime());
  const nuevaFecha = new Date(base + (pago.dias || 14) * DIA_MS);

  return Alquiler.findOneAndUpdate(
    { _id: alquiler._id, estado: 'activo' },
    {
      $set: {
        fechaVencimiento: nuevaFecha,
        recordatorioEnviadoEn: null,
        ultimoAvisoVencidoEn: null,
        fechaPago: new Date(),
      },
      $inc: { renovaciones: 1, montoPagado: pago.monto },
    },
    { returnDocument: 'after' }
  );
}

async function activarMulta(pago) {
  const alquiler = await Alquiler.findById(pago.alquiler);

  if (!alquiler) {
    return { error: 'alquiler-no-encontrado' };
  }

  return Alquiler.findOneAndUpdate(
    { _id: alquiler._id },
    {
      $set: { fechaPago: new Date() },
      $inc: { multaPagada: pago.monto, montoPagado: pago.monto },
    },
    { returnDocument: 'after' }
  );
}

async function activarPago(pago) {
  if (pago.tipo === 'renovacion') {
    return activarRenovacion(pago);
  }

  if (pago.tipo === 'multa') {
    return activarMulta(pago);
  }

  return activarAlquiler(pago);
}

async function notificarActivacion(pago, alquiler) {
  const usuario = {
    email: pago.email,
    nombre: pago.nombre,
  };

  if (!usuario.email) {
    return;
  }

  await notificarPagoAprobado({ usuario, alquiler, pago });
}

export async function procesarTransaccionWompi(transaccion) {
  if (!transaccion?.reference) {
    return { ok: false, motivo: 'transaccion-sin-referencia' };
  }

  const pago = await Pago.findOne({ referencia: transaccion.reference });

  if (!pago) {
    return { ok: false, motivo: 'pago-no-encontrado' };
  }

  const estado = String(transaccion.status || '').toUpperCase();
  const datosBase = {
    wompiId: transaccion.id,
    metodoPago: transaccion.payment_method_type,
    payload: transaccion,
  };

  if (estado === 'PENDING') {
    await Pago.updateOne({ _id: pago._id }, { $set: datosBase });
    return { ok: true, estado: 'pendiente' };
  }

  if (estado === 'APPROVED') {
    const montoEsperado = Math.round(Number(pago.monto) * 100);

    if (
      Number(transaccion.amount_in_cents) !== montoEsperado ||
      String(transaccion.currency || '').toUpperCase() !== String(pago.moneda).toUpperCase()
    ) {
      await Pago.updateOne(
        { _id: pago._id },
        {
          $set: {
            ...datosBase,
            nota: 'Monto o moneda no coinciden con el pago esperado',
          },
        }
      );
      await notificarAdminRevision({
        pago,
        motivo: 'Monto o moneda no coinciden',
      });
      return { ok: false, motivo: 'monto-no-coincide' };
    }

    const aprobado = await Pago.findOneAndUpdate(
      { _id: pago._id, estado: { $ne: 'aprobado' } },
      {
        $set: {
          ...datosBase,
          estado: 'aprobado',
          aprobadoEn: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    if (!aprobado) {
      return { ok: true, estado: 'aprobado', idempotente: true };
    }

    const resultado = await activarPago(aprobado);

    if (!resultado || resultado.error) {
      const motivo = resultado?.error ?? 'alquiler-no-actualizado';
      await Pago.updateOne(
        { _id: aprobado._id },
        { $set: { nota: `Pago aprobado sin activación: ${motivo}` } }
      );
      await notificarAdminRevision({
        pago: aprobado,
        motivo,
      });
      return { ok: false, motivo };
    }

    await notificarActivacion(aprobado, resultado);
    return { ok: true, estado: 'aprobado' };
  }

  if (['DECLINED', 'ERROR', 'VOIDED'].includes(estado)) {
    const rechazado = await Pago.findOneAndUpdate(
      { _id: pago._id, estado: 'pendiente' },
      {
        $set: {
          ...datosBase,
          estado: 'rechazado',
          rechazadoEn: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    if (rechazado) {
      await cancelarAlquilerPendiente(rechazado);
      await notificarPagoRechazado({ usuario: { email: rechazado.email }, pago: rechazado });
    }

    return { ok: true, estado: 'rechazado' };
  }

  await Pago.updateOne({ _id: pago._id }, { $set: datosBase });
  return { ok: true, estado: estado.toLowerCase() };
}

export async function webhookWompi(req, res) {
  try {
    if (!verificarFirmaEvento(req.body)) {
      return res.status(401).json({ message: 'Firma de evento inválida' });
    }

    if (req.body?.event === 'transaction.updated') {
      await procesarTransaccionWompi(req.body.data?.transaction);
    }

    return res.json({ received: true });
  } catch (error) {
    console.error('Error procesando evento de Wompi:', error);
    return res.status(500).json({ message: 'No se pudo procesar el evento' });
  }
}

async function consultarTransaccionWompi(id) {
  const privateKey = process.env.WOMPI_PRIVATE_KEY;

  if (!privateKey || !id) {
    return null;
  }

  try {
    const base = (
      process.env.WOMPI_API_URL ||
      (String(process.env.WOMPI_PUBLIC_KEY).startsWith('pub_test_')
        ? 'https://sandbox.wompi.co/v1'
        : 'https://production.wompi.co/v1')
    ).replace(/\/+$/, '');
    const respuesta = await fetch(`${base}/transactions/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${privateKey}` },
      signal: AbortSignal.timeout(10000),
    });

    if (!respuesta.ok) {
      return null;
    }

    const datos = await respuesta.json();
    return datos?.data ?? null;
  } catch (error) {
    console.error('No se pudo consultar la transacción en Wompi:', error.message);
    return null;
  }
}

export async function estadoPago(req, res) {
  try {
    const { referencia } = req.params;

    if (!referencia) {
      return res.status(400).json({ message: 'Referencia inválida' });
    }

    let pago = await Pago.findOne({
      referencia,
      usuario: req.usuarioId,
    });

    if (!pago) {
      return res.status(404).json({ message: 'Pago no encontrado' });
    }

    if (pago.estado === 'pendiente' && req.query.id) {
      const transaccion = await consultarTransaccionWompi(req.query.id);

      if (transaccion?.reference === pago.referencia) {
        await procesarTransaccionWompi(transaccion);
        pago = await Pago.findOne({ _id: pago._id });
      }
    }

    const alquiler = pago.alquiler
      ? await Alquiler.findById(pago.alquiler)
      : await Alquiler.findOne({ pago: pago._id });
    const checkoutVigente =
      pago.estado === 'pendiente' &&
      pago.expiracion &&
      new Date(pago.expiracion).getTime() > Date.now();

    return res.json({
      pago: serializarPago(pago),
      alquiler: alquiler ? serializarAlquiler(alquiler) : null,
      checkoutUrl: checkoutVigente ? pago.checkoutUrl : null,
      modo: modoPagos(),
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Referencia inválida' });
    }

    console.error(error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

export function configPagos(req, res) {
  const config = configuracionPagos();

  res.json({
    modo: config.modo,
    diasBase: config.diasBase,
    tarifaPorcentaje: config.tarifaPorcentaje,
    tarifaMinima: config.tarifaMinima,
    diasGracia: config.diasGracia,
    multaDiariaPorcentaje: config.multaDiariaPorcentaje,
    multaMaximaPorcentaje: config.multaMaximaPorcentaje,
    maxRenovaciones: config.maxRenovaciones,
  });
}
