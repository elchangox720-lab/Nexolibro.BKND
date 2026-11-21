import { appUrl, enviarCorreo } from './pagos.service.js';

const ZONA_HORARIA = 'America/Bogota';

function formatearFecha(fecha) {
  if (!fecha) {
    return 'sin fecha';
  }

  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'long',
    timeZone: ZONA_HORARIA,
  }).format(new Date(fecha));
}

function formatearDinero(valor) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(valor) || 0);
}

function plantilla(titulo, contenido) {
  return `
  <div style="font-family: Arial, Helvetica, sans-serif; background:#f6f3ee; padding:24px; color:#231f1a;">
    <div style="max-width:560px; margin:0 auto; background:#ffffff; border-radius:16px; padding:28px; border:1px solid #e8e0d5;">
      <p style="margin:0 0 8px; font-size:12px; letter-spacing:.12em; text-transform:uppercase; color:#8a6d3b;">Nexolibro</p>
      <h1 style="margin:0 0 18px; font-size:24px; line-height:1.25;">${titulo}</h1>
      ${contenido}
      <p style="margin:28px 0 0; font-size:12px; color:#7a7168;">
        Este correo fue enviado automáticamente por Nexolibro.
      </p>
    </div>
  </div>`;
}

function boton(texto, url) {
  return `<p style="margin:24px 0 0;"><a href="${url}" style="display:inline-block; background:#3d6b4f; color:#ffffff; text-decoration:none; padding:12px 18px; border-radius:10px; font-weight:600;">${texto}</a></p>`;
}

async function intentarEnvio(datos) {
  try {
    return await enviarCorreo(datos);
  } catch (error) {
    console.error(`No se pudo enviar el correo "${datos.asunto}":`, error.message);
    return { enviado: false, motivo: 'error' };
  }
}

export async function notificarPagoAprobado({ usuario, alquiler, pago }) {
  if (!usuario?.email) {
    return { enviado: false, motivo: 'sin-email' };
  }

  const tipo = pago?.tipo ?? 'alquiler';
  const titulo =
    tipo === 'renovacion'
      ? 'Renovación confirmada'
      : tipo === 'multa'
        ? 'Multa pagada'
        : 'Pago aprobado';

  const detalle =
    tipo === 'multa'
      ? `<p style="margin:0 0 10px;">Registramos el pago de la multa por <strong>${formatearDinero(pago.monto)}</strong>.</p>`
      : `<p style="margin:0 0 10px;">Recibimos tu pago por <strong>${formatearDinero(pago.monto)}</strong>.</p>
         <p style="margin:0 0 10px;">Libro: <strong>${alquiler?.titulo ?? 'Nexolibro'}</strong></p>
         <p style="margin:0;">Vence el <strong>${formatearFecha(alquiler?.fechaVencimiento)}</strong>.</p>`;

  const html = plantilla(
    titulo,
    `${detalle}${boton('Ver mis alquileres', `${appUrl()}/alquileres`)}`
  );
  const texto = `${titulo}. ${
    tipo === 'multa'
      ? `Multa pagada: ${formatearDinero(pago.monto)}.`
      : `Pago: ${formatearDinero(pago.monto)}. Libro: ${alquiler?.titulo ?? ''}. Vence: ${formatearFecha(alquiler?.fechaVencimiento)}.`
  } ${appUrl()}/alquileres`;

  return intentarEnvio({
    para: usuario.email,
    asunto: `${titulo} - Nexolibro`,
    html,
    texto,
    idempotencia: `pago-aprobado/${pago?.referencia ?? alquiler?._id}`,
  });
}

export async function notificarPagoRechazado({ usuario, pago }) {
  if (!usuario?.email) {
    return { enviado: false, motivo: 'sin-email' };
  }

  const html = plantilla(
    'No pudimos procesar tu pago',
    `<p style="margin:0 0 10px;">El pago por <strong>${formatearDinero(pago?.monto)}</strong> no fue aprobado.</p>
     <p style="margin:0;">Puedes intentarlo de nuevo desde el catálogo o desde tus alquileres.</p>
     ${boton('Volver a intentar', `${appUrl()}/alquileres`)}`
  );

  return intentarEnvio({
    para: usuario.email,
    asunto: 'Pago rechazado - Nexolibro',
    html,
    texto: `El pago por ${formatearDinero(pago?.monto)} no fue aprobado. Intenta de nuevo en ${appUrl()}/alquileres`,
    idempotencia: `pago-rechazado/${pago?.referencia ?? 'sin-referencia'}`,
  });
}

export async function notificarRecordatorio({ usuario, alquiler }) {
  if (!usuario?.email) {
    return { enviado: false, motivo: 'sin-email' };
  }

  const html = plantilla(
    'Tu alquiler está por vencer',
    `<p style="margin:0 0 10px;">El alquiler de <strong>${alquiler.titulo}</strong> vence el <strong>${formatearFecha(alquiler.fechaVencimiento)}</strong>.</p>
     <p style="margin:0;">Puedes devolverlo o renovarlo desde tus alquileres.</p>
     ${boton('Gestionar alquiler', `${appUrl()}/alquileres`)}`
  );

  return intentarEnvio({
    para: usuario.email,
    asunto: `Tu alquiler vence el ${formatearFecha(alquiler.fechaVencimiento)} - Nexolibro`,
    html,
    texto: `El alquiler de ${alquiler.titulo} vence el ${formatearFecha(alquiler.fechaVencimiento)}. Gestiónalo en ${appUrl()}/alquileres`,
    idempotencia: `recordatorio/${alquiler._id}/${new Date(alquiler.fechaVencimiento).toISOString().slice(0, 10)}`,
  });
}

export async function notificarVencido({ usuario, alquiler, multaPendiente }) {
  if (!usuario?.email) {
    return { enviado: false, motivo: 'sin-email' };
  }

  const multa = Number(multaPendiente) || 0;
  const html = plantilla(
    'Tu alquiler venció',
    `<p style="margin:0 0 10px;">El alquiler de <strong>${alquiler.titulo}</strong> venció el <strong>${formatearFecha(alquiler.fechaVencimiento)}</strong>.</p>
     <p style="margin:0;">${
       multa > 0 ? `La multa pendiente es de <strong>${formatearDinero(multa)}</strong>. ` : ''
     }Devuélvelo o renueva el alquiler para regularizar tu préstamo.</p>
     ${boton('Gestionar alquiler', `${appUrl()}/alquileres`)}`
  );

  return intentarEnvio({
    para: usuario.email,
    asunto: 'Tu alquiler venció - Nexolibro',
    html,
    texto: `El alquiler de ${alquiler.titulo} venció el ${formatearFecha(alquiler.fechaVencimiento)}. ${
      multa > 0 ? `Multa pendiente: ${formatearDinero(multa)}.` : ''
    } ${appUrl()}/alquileres`,
    idempotencia: `vencido/${alquiler._id}/${new Date().toISOString().slice(0, 10)}`,
  });
}

export async function notificarAdminRevision({ pago, motivo }) {
  const admin = (process.env.ADMIN_EMAIL || 'elchangox720@gmail.com').trim().toLowerCase();

  if (!admin) {
    return { enviado: false, motivo: 'sin-email' };
  }

  const html = plantilla(
    'Pago que requiere revisión',
    `<p style="margin:0 0 10px;">La referencia <strong>${pago.referencia}</strong> necesita revisión y no se pudo activar el alquiler automáticamente.</p>
     <p style="margin:0;">Motivo: <strong>${motivo}</strong></p>
     <p style="margin:0;">Monto: <strong>${formatearDinero(pago.monto)}</strong></p>`
  );

  return intentarEnvio({
    para: admin,
    asunto: `Revisión manual: ${pago.referencia} - Nexolibro`,
    html,
    texto: `El pago ${pago.referencia} requiere revisión. Motivo: ${motivo}. Monto: ${formatearDinero(pago.monto)}`,
    idempotencia: `revision/${pago.referencia}`,
  });
}
