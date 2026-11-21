import mongoose from 'mongoose';
import Alquiler from '../models/alquiler.js';
import Libro from '../models/libro.js';
import Pago from '../models/pago.js';
import { resolverLectura } from '../services/lectura.service.js';
import {
  calcularMulta,
  calcularTarifa,
  crearCheckout,
  crearReferencia,
  diasGracia,
  DIA_MS,
  DIAS_BASE,
  maxRenovaciones,
  modoPagos,
  wompiConfigurado,
} from '../services/pagos.service.js';

const DIAS_POR_DEFECTO = 14;
const DIAS_MAXIMOS = 30;
const MAX_ALQUILERES_ACTIVOS = 5;

function manejarError(res, error) {
  if (error.name === 'ValidationError') {
    const errores = Object.values(error.errors).map((item) => item.message);
    return res.status(400).json({ message: 'Datos inválidos', errores });
  }

  if (error.name === 'CastError') {
    return res.status(400).json({ message: 'ID inválido' });
  }

  if (error.code === 11000) {
    return res.status(409).json({ message: 'Ya tienes un alquiler activo de este libro' });
  }

  if (String(error.message).includes('Wompi')) {
    return res.status(503).json({
      message: 'Los pagos no están configurados todavía. Intenta más tarde.',
    });
  }

  console.error(error);
  return res.status(500).json({ message: 'Error interno del servidor' });
}

function serializarPago(pago) {
  if (!pago) {
    return null;
  }

  const base = typeof pago.toObject === 'function' ? pago.toObject() : pago;
  const { payload, ...resto } = base;

  return resto;
}

export function serializarAlquiler(alquiler) {
  const base = typeof alquiler.toObject === 'function' ? alquiler.toObject() : alquiler;
  const estado = base.estado;
  const activo = estado === 'activo';
  const pendiente = estado === 'pendiente_pago';
  const vencimiento = new Date(base.fechaVencimiento);
  const vencido = activo && vencimiento.getTime() < Date.now();
  const diasRestantes = activo
    ? Math.max(0, Math.ceil((vencimiento.getTime() - Date.now()) / DIA_MS))
    : 0;
  const ahoraMulta =
    estado === 'devuelto' && base.fechaDevolucion
      ? new Date(base.fechaDevolucion)
      : estado === 'cancelado'
        ? new Date(base.fechaAlquiler ?? base.createdAt ?? Date.now())
        : new Date();
  const { diasAtraso, multa } = calcularMulta({
    valorLibro: base.valorLibro,
    fechaVencimiento: base.fechaVencimiento,
    multaActual: base.multa,
    ahora: ahoraMulta,
  });
  const multaPagada = Math.max(0, Number(base.multaPagada) || 0);
  const multaPendiente = Math.max(0, multa - multaPagada);
  const lectura =
    activo && !vencido && base.pagoEstado !== 'pendiente' ? resolverLectura(base) : null;
  const checkoutVigente =
    pendiente &&
    base.checkoutUrl &&
    base.pagoExpiraEn &&
    new Date(base.pagoExpiraEn).getTime() > Date.now();

  return {
    ...base,
    pagoEstado: base.pagoEstado ?? 'no_requerido',
    vencido,
    diasRestantes,
    diasAtraso,
    diasGracia: Math.max(0, diasGracia() - diasAtraso),
    multa,
    multaPagada,
    multaPendiente,
    lecturaDisponible: Boolean(lectura),
    lecturaPaginas: lectura?.paginas ?? null,
    lecturaLicencia: lectura?.licencia ?? null,
    lecturaFuente: lectura?.fuente ?? null,
    lecturaFuenteUrl: lectura?.fuenteUrl ?? null,
    puedeRenovar:
      activo &&
      (Number(base.renovaciones) || 0) < maxRenovaciones() &&
      diasAtraso <= diasGracia(),
    puedePagarMulta: multaPendiente > 0 && ['activo', 'devuelto'].includes(estado),
    checkoutUrl: checkoutVigente ? base.checkoutUrl : undefined,
  };
}

function normalizarCedula(valor) {
  return String(valor ?? '').replace(/[.\s-]/g, '');
}

function leerDias(valor) {
  if (valor === undefined || valor === null || valor === '') {
    return DIAS_POR_DEFECTO;
  }

  const dias = Number(valor);

  if (!Number.isInteger(dias) || dias < 1 || dias > DIAS_MAXIMOS) {
    return null;
  }

  return dias;
}

async function restaurarStock(libroId) {
  try {
    await Libro.updateOne({ _id: libroId }, { $inc: { stock: 1 } });
  } catch (error) {
    console.error('No se pudo restaurar el stock del libro', libroId, error);
  }
}

async function cancelarPendiente(alquiler) {
  if (!alquiler || alquiler.estado !== 'pendiente_pago') {
    return null;
  }

  const actualizado = await Alquiler.findOneAndUpdate(
    { _id: alquiler._id, estado: 'pendiente_pago' },
    {
      $set: {
        estado: 'cancelado',
        pagoEstado: 'rechazado',
        checkoutUrl: null,
      },
    },
    { returnDocument: 'after' }
  );

  if (actualizado) {
    await restaurarStock(actualizado.libro);
    if (actualizado.referenciaPago) {
      await Pago.updateOne(
        { referencia: actualizado.referenciaPago, estado: 'pendiente' },
        { $set: { estado: 'expirado', nota: 'Cancelado para crear un nuevo intento' } }
      );
    }
  }

  return actualizado;
}

async function ejecutarDevolucion(filtro, devueltoPor) {
  const alquiler = await Alquiler.findOne({ ...filtro, estado: 'activo' });

  if (!alquiler) {
    return null;
  }

  const { multa } = calcularMulta({
    valorLibro: alquiler.valorLibro,
    fechaVencimiento: alquiler.fechaVencimiento,
    multaActual: alquiler.multa,
  });

  const actualizado = await Alquiler.findOneAndUpdate(
    { _id: alquiler._id, estado: 'activo' },
    {
      $set: {
        estado: 'devuelto',
        fechaDevolucion: new Date(),
        devueltoPor,
      },
      $max: { multa },
    },
    { returnDocument: 'after' }
  );

  if (!actualizado) {
    return null;
  }

  await restaurarStock(actualizado.libro);
  return actualizado;
}

function filtroPendienteVigente(alquiler) {
  return (
    alquiler.estado === 'pendiente_pago' &&
    alquiler.checkoutUrl &&
    alquiler.pagoExpiraEn &&
    new Date(alquiler.pagoExpiraEn).getTime() > Date.now()
  );
}

export async function listarAlquileres(req, res) {
  try {
    const filtro = { usuario: req.usuarioId };
    const { estado } = req.query;
    const estados = ['pendiente_pago', 'activo', 'devuelto', 'cancelado'];

    if (estado && !estados.includes(estado)) {
      return res.status(400).json({ message: 'Estado de alquiler inválido' });
    }

    if (estado) {
      filtro.estado = estado;
    }

    const alquileres = await Alquiler.find(filtro).lean();
    const orden = { pendiente_pago: 0, activo: 1, devuelto: 2, cancelado: 3 };

    alquileres.sort((a, b) => {
      const porEstado = (orden[a.estado] ?? 9) - (orden[b.estado] ?? 9);
      if (porEstado !== 0) {
        return porEstado;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    res.json(alquileres.map(serializarAlquiler));
  } catch (error) {
    manejarError(res, error);
  }
}

export async function crearAlquiler(req, res) {
  try {
    const { libroId } = req.body ?? {};

    if (!mongoose.isValidObjectId(libroId)) {
      return res.status(400).json({ message: 'ID de libro inválido' });
    }

    const dias = leerDias(req.body?.dias);
    if (dias === null) {
      return res.status(400).json({ message: `Los días deben estar entre 1 y ${DIAS_MAXIMOS}` });
    }

    const cedula = normalizarCedula(req.body?.cedula);
    if (!/^\d{6,10}$/.test(cedula)) {
      return res.status(400).json({
        message: 'Ingresa un número de cédula válido, entre 6 y 10 dígitos',
      });
    }

    if (modoPagos() === 'wompi' && !wompiConfigurado()) {
      return res.status(503).json({
        message: 'Los pagos no están configurados todavía. Intenta más tarde.',
      });
    }

    const mismoLibro = await Alquiler.findOne({
      usuario: req.usuarioId,
      libro: libroId,
      estado: { $in: ['activo', 'pendiente_pago'] },
    });

    if (mismoLibro) {
      if (filtroPendienteVigente(mismoLibro)) {
        return res.status(200).json({
          alquiler: serializarAlquiler(mismoLibro),
          pago: null,
          checkoutUrl: mismoLibro.checkoutUrl,
          modo: modoPagos(),
          reutilizado: true,
        });
      }

      if (mismoLibro.estado === 'pendiente_pago') {
        await cancelarPendiente(mismoLibro);
      } else {
        return res.status(409).json({ message: 'Ya tienes un alquiler activo de este libro' });
      }
    }

    const activos = await Alquiler.countDocuments({
      usuario: req.usuarioId,
      estado: { $in: ['activo', 'pendiente_pago'] },
    });

    if (activos >= MAX_ALQUILERES_ACTIVOS) {
      return res.status(409).json({
        message: `Puedes tener como máximo ${MAX_ALQUILERES_ACTIVOS} alquileres activos`,
      });
    }

    const libro = await Libro.findOneAndUpdate(
      { _id: libroId, stock: { $gt: 0 } },
      { $inc: { stock: -1 } },
      { returnDocument: 'after' }
    );

    if (!libro) {
      const existe = await Libro.exists({ _id: libroId });
      return res.status(existe ? 409 : 404).json({
        message: existe ? 'No hay ejemplares disponibles' : 'Libro no encontrado',
      });
    }

    const ahora = new Date();
    const fechaVencimiento = new Date(ahora.getTime() + dias * DIA_MS);
    const tarifa = calcularTarifa(libro.precio, dias);

    if (modoPagos() === 'directo') {
      try {
        const alquiler = await Alquiler.create({
          usuario: req.usuarioId,
          libro: libro._id,
          titulo: libro.titulo,
          autor: libro.autor,
          portada: libro.portada,
          cedula,
          dias,
          fechaAlquiler: ahora,
          fechaVencimiento,
          valorLibro: libro.precio,
          tarifa: 0,
          estado: 'activo',
          pagoEstado: 'no_requerido',
        });

        return res.status(201).json({
          alquiler: serializarAlquiler(alquiler),
          pago: null,
          checkoutUrl: null,
          modo: 'directo',
        });
      } catch (error) {
        await restaurarStock(libro._id);
        return manejarError(res, error);
      }
    }

    const referencia = crearReferencia('ALQ');
    let checkout;

    try {
      checkout = crearCheckout({
        referencia,
        monto: tarifa,
        email: req.usuario?.email,
        nombre: req.usuario?.nombre,
        cedula,
        dias,
      });
    } catch (error) {
      await restaurarStock(libro._id);
      return manejarError(res, error);
    }

    let alquiler;
    let pago;

    try {
      alquiler = await Alquiler.create({
        usuario: req.usuarioId,
        libro: libro._id,
        titulo: libro.titulo,
        autor: libro.autor,
        portada: libro.portada,
        cedula,
        dias,
        fechaAlquiler: ahora,
        fechaVencimiento,
        valorLibro: libro.precio,
        tarifa,
        estado: 'pendiente_pago',
        pagoEstado: 'pendiente',
        referenciaPago: referencia,
        checkoutUrl: checkout.url,
        pagoExpiraEn: checkout.expiracion,
      });

      pago = await Pago.create({
        usuario: req.usuarioId,
        libro: libro._id,
        alquiler: alquiler._id,
        tipo: 'alquiler',
        referencia,
        monto: tarifa,
        moneda: 'COP',
        estado: 'pendiente',
        email: req.usuario?.email,
        nombre: req.usuario?.nombre,
        cedula,
        dias,
        expiracion: checkout.expiracion,
        checkoutUrl: checkout.url,
      });

      alquiler.pago = pago._id;
      await alquiler.save();

      return res.status(201).json({
        alquiler: serializarAlquiler(alquiler),
        pago: serializarPago(pago),
        checkoutUrl: checkout.url,
        modo: 'wompi',
      });
    } catch (error) {
      if (pago?._id) {
        await Pago.deleteOne({ _id: pago._id });
      }
      if (alquiler?._id) {
        await Alquiler.deleteOne({ _id: alquiler._id });
      }
      await restaurarStock(libro._id);
      return manejarError(res, error);
    }
  } catch (error) {
    return manejarError(res, error);
  }
}

export async function renovarAlquiler(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'ID de alquiler inválido' });
    }

    const alquiler = await Alquiler.findOne({ _id: id, usuario: req.usuarioId });

    if (!alquiler) {
      return res.status(404).json({ message: 'Alquiler no encontrado' });
    }

    if (alquiler.estado !== 'activo') {
      return res.status(409).json({ message: 'Solo puedes renovar un alquiler activo' });
    }

    if ((Number(alquiler.renovaciones) || 0) >= maxRenovaciones()) {
      return res.status(409).json({
        message: `Ya usaste las ${maxRenovaciones()} renovaciones disponibles`,
      });
    }

    const { diasAtraso } = calcularMulta({
      valorLibro: alquiler.valorLibro,
      fechaVencimiento: alquiler.fechaVencimiento,
      multaActual: alquiler.multa,
    });

    if (diasAtraso > diasGracia()) {
      return res.status(409).json({
        message: 'El alquiler tiene demasiados días de atraso. Devuélvelo y paga la multa pendiente.',
      });
    }

    const dias = leerDias(req.body?.dias ?? DIAS_BASE);
    if (dias === null) {
      return res.status(400).json({ message: `Los días deben estar entre 1 y ${DIAS_MAXIMOS}` });
    }

    const tarifa = calcularTarifa(alquiler.valorLibro, dias);

    if (modoPagos() === 'directo') {
      const base = Math.max(Date.now(), new Date(alquiler.fechaVencimiento).getTime());
      alquiler.fechaVencimiento = new Date(base + dias * DIA_MS);
      alquiler.renovaciones = (Number(alquiler.renovaciones) || 0) + 1;
      alquiler.recordatorioEnviadoEn = null;
      alquiler.ultimoAvisoVencidoEn = null;
      await alquiler.save();

      return res.json({
        alquiler: serializarAlquiler(alquiler),
        pago: null,
        checkoutUrl: null,
        modo: 'directo',
      });
    }

    if (!wompiConfigurado()) {
      return res.status(503).json({
        message: 'Los pagos no están configurados todavía. Intenta más tarde.',
      });
    }

    const existente = await Pago.findOne({
      alquiler: alquiler._id,
      tipo: 'renovacion',
      estado: 'pendiente',
      expiracion: { $gt: new Date() },
    });

    if (existente) {
      return res.json({
        alquiler: serializarAlquiler(alquiler),
        pago: serializarPago(existente),
        checkoutUrl: existente.checkoutUrl,
        modo: 'wompi',
        reutilizado: true,
      });
    }

    const referencia = crearReferencia('REN');
    const checkout = crearCheckout({
      referencia,
      monto: tarifa,
      email: req.usuario?.email,
      nombre: req.usuario?.nombre,
      cedula: alquiler.cedula,
      dias,
    });

    const pago = await Pago.create({
      usuario: req.usuarioId,
      libro: alquiler.libro,
      alquiler: alquiler._id,
      tipo: 'renovacion',
      referencia,
      monto: tarifa,
      moneda: 'COP',
      estado: 'pendiente',
      email: req.usuario?.email,
      nombre: req.usuario?.nombre,
      cedula: alquiler.cedula,
      dias,
      expiracion: checkout.expiracion,
      checkoutUrl: checkout.url,
    });

    return res.status(201).json({
      alquiler: serializarAlquiler(alquiler),
      pago: serializarPago(pago),
      checkoutUrl: checkout.url,
      modo: 'wompi',
    });
  } catch (error) {
    return manejarError(res, error);
  }
}

export async function pagarMulta(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'ID de alquiler inválido' });
    }

    const alquiler = await Alquiler.findOne({ _id: id, usuario: req.usuarioId });

    if (!alquiler) {
      return res.status(404).json({ message: 'Alquiler no encontrado' });
    }

    if (!['activo', 'devuelto'].includes(alquiler.estado)) {
      return res.status(409).json({ message: 'Este alquiler no tiene multas pendientes' });
    }

    const { multa } = calcularMulta({
      valorLibro: alquiler.valorLibro,
      fechaVencimiento: alquiler.fechaVencimiento,
      multaActual: alquiler.multa,
      ahora:
        alquiler.estado === 'devuelto' && alquiler.fechaDevolucion
          ? new Date(alquiler.fechaDevolucion)
          : new Date(),
    });
    const multaPendiente = Math.max(0, multa - (Number(alquiler.multaPagada) || 0));

    if (multaPendiente <= 0) {
      return res.status(409).json({ message: 'No tienes multas pendientes en este alquiler' });
    }

    if (modoPagos() === 'directo') {
      alquiler.multa = Math.max(Number(alquiler.multa) || 0, multa);
      alquiler.multaPagada = (Number(alquiler.multaPagada) || 0) + multaPendiente;
      await alquiler.save();

      return res.json({
        alquiler: serializarAlquiler(alquiler),
        pago: null,
        checkoutUrl: null,
        modo: 'directo',
      });
    }

    if (!wompiConfigurado()) {
      return res.status(503).json({
        message: 'Los pagos no están configurados todavía. Intenta más tarde.',
      });
    }

    const existente = await Pago.findOne({
      alquiler: alquiler._id,
      tipo: 'multa',
      estado: 'pendiente',
      expiracion: { $gt: new Date() },
    });

    if (existente) {
      return res.json({
        alquiler: serializarAlquiler(alquiler),
        pago: serializarPago(existente),
        checkoutUrl: existente.checkoutUrl,
        modo: 'wompi',
        reutilizado: true,
      });
    }

    const referencia = crearReferencia('MUL');
    const checkout = crearCheckout({
      referencia,
      monto: multaPendiente,
      email: req.usuario?.email,
      nombre: req.usuario?.nombre,
      cedula: alquiler.cedula,
      dias: 1,
    });

    const pago = await Pago.create({
      usuario: req.usuarioId,
      libro: alquiler.libro,
      alquiler: alquiler._id,
      tipo: 'multa',
      referencia,
      monto: multaPendiente,
      moneda: 'COP',
      estado: 'pendiente',
      email: req.usuario?.email,
      nombre: req.usuario?.nombre,
      cedula: alquiler.cedula,
      dias: 1,
      expiracion: checkout.expiracion,
      checkoutUrl: checkout.url,
    });

    return res.status(201).json({
      alquiler: serializarAlquiler(alquiler),
      pago: serializarPago(pago),
      checkoutUrl: checkout.url,
      modo: 'wompi',
    });
  } catch (error) {
    return manejarError(res, error);
  }
}

export async function devolverAlquiler(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'ID de alquiler inválido' });
    }

    const alquiler = await ejecutarDevolucion(
      { _id: id, usuario: req.usuarioId },
      'usuario'
    );

    if (!alquiler) {
      const existente = await Alquiler.findOne({
        _id: id,
        usuario: req.usuarioId,
      }).select('estado');

      if (!existente) {
        return res.status(404).json({ message: 'Alquiler no encontrado' });
      }

      return res.status(409).json({
        message:
          existente.estado === 'pendiente_pago'
            ? 'Completa el pago antes de devolver este alquiler'
            : 'Este alquiler ya fue devuelto',
      });
    }

    res.json(serializarAlquiler(alquiler));
  } catch (error) {
    manejarError(res, error);
  }
}

export async function leerAlquiler(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'ID de alquiler inválido' });
    }

    const alquiler = await Alquiler.findOne({ _id: id, usuario: req.usuarioId }).lean();

    if (!alquiler) {
      return res.status(404).json({ message: 'Alquiler no encontrado' });
    }

    if (alquiler.estado !== 'activo') {
      return res.status(403).json({
        message:
          alquiler.estado === 'pendiente_pago'
            ? 'El pago de este alquiler aún no ha sido confirmado.'
            : 'Este alquiler ya fue devuelto. El archivo de lectura no está disponible.',
      });
    }

    if (alquiler.pagoEstado === 'pendiente') {
      return res.status(403).json({
        message: 'El pago de este alquiler aún no ha sido confirmado.',
      });
    }

    if (new Date(alquiler.fechaVencimiento).getTime() <= Date.now()) {
      return res.status(403).json({
        message: 'Tu alquiler venció. El archivo de lectura ya no está disponible.',
      });
    }

    const lectura = resolverLectura(alquiler);

    if (!lectura) {
      return res.status(404).json({
        message: 'Archivo de lectura no disponible para este libro.',
      });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${lectura.archivo}"`);
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('Pragma', 'no-cache');

    return res.sendFile(lectura.ruta, (error) => {
      if (!error || res.headersSent) {
        if (error) {
          console.error('No se pudo enviar el archivo de lectura', error);
        }
        return;
      }

      res.removeHeader('Content-Disposition');
      manejarError(res, error);
    });
  } catch (error) {
    manejarError(res, error);
  }
}

export async function listarAlquileresAdmin(req, res) {
  try {
    const filtro = {};
    const { estado, vencidos, usuario, libro } = req.query;
    const estados = ['pendiente_pago', 'activo', 'devuelto', 'cancelado'];

    if (vencidos === 'true' || vencidos === '1') {
      filtro.estado = 'activo';
      filtro.fechaVencimiento = { $lt: new Date() };
    } else if (estado !== undefined) {
      if (!estados.includes(estado)) {
        return res.status(400).json({ message: 'Estado de alquiler inválido' });
      }
      filtro.estado = estado;
    }

    if (usuario !== undefined) {
      if (!mongoose.isValidObjectId(usuario)) {
        return res.status(400).json({ message: 'ID de usuario inválido' });
      }
      filtro.usuario = usuario;
    }

    if (libro !== undefined) {
      if (!mongoose.isValidObjectId(libro)) {
        return res.status(400).json({ message: 'ID de libro inválido' });
      }
      filtro.libro = libro;
    }

    const alquileres = await Alquiler.find(filtro)
      .sort({ estado: 1, fechaVencimiento: 1, createdAt: -1 })
      .populate('usuario', 'nombre email')
      .lean();

    res.json(alquileres.map(serializarAlquiler));
  } catch (error) {
    manejarError(res, error);
  }
}

export async function devolverAlquilerAdmin(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'ID de alquiler inválido' });
    }

    const alquiler = await ejecutarDevolucion({ _id: id }, 'admin');

    if (!alquiler) {
      const existente = await Alquiler.findOne({ _id: id }).select('estado');

      if (!existente) {
        return res.status(404).json({ message: 'Alquiler no encontrado' });
      }

      return res.status(409).json({
        message:
          existente.estado === 'pendiente_pago'
            ? 'Este alquiler todavía no tiene el pago confirmado'
            : 'Este alquiler ya fue devuelto',
      });
    }

    await alquiler.populate('usuario', 'nombre email');
    res.json(serializarAlquiler(alquiler));
  } catch (error) {
    manejarError(res, error);
  }
}
