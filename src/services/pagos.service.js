import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const MONEDA = 'COP';
export const DIAS_BASE = 14;
export const DIA_MS = 24 * 60 * 60 * 1000;

function numero(valor, defecto) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : defecto;
}

export function appUrl() {
  return (process.env.APP_URL || 'https://nexolibro-eifu.vercel.app').replace(/\/+$/, '');
}

export function wompiCheckoutConfigurado() {
  return Boolean(process.env.WOMPI_PUBLIC_KEY && process.env.WOMPI_INTEGRITY_SECRET);
}

export function wompiEventosConfigurado() {
  return Boolean(process.env.WOMPI_EVENTS_SECRET);
}

export function wompiConfigurado() {
  return wompiCheckoutConfigurado() && wompiEventosConfigurado();
}

export function modoPagos() {
  const modo = String(process.env.PAGOS_MODO || 'auto').toLowerCase();

  if (modo === 'directo' || modo === 'wompi') {
    return modo;
  }

  return wompiConfigurado() ? 'wompi' : 'directo';
}

export function configuracionPagos() {
  return {
    modo: modoPagos(),
    wompiConfigurado: wompiConfigurado(),
    checkoutConfigurado: wompiCheckoutConfigurado(),
    eventosConfigurados: wompiEventosConfigurado(),
    diasBase: DIAS_BASE,
    tarifaPorcentaje: numero(process.env.RENTAL_FEE_PERCENT, 20),
    tarifaMinima: numero(process.env.RENTAL_FEE_MIN, 1500),
    diasGracia: numero(process.env.DIAS_GRACIA, 3),
    multaDiariaPorcentaje: numero(process.env.MULTA_DIARIA_PORCENTAJE, 1),
    multaMaximaPorcentaje: numero(process.env.MULTA_MAXIMA_PORCENTAJE, 20),
    maxRenovaciones: numero(process.env.MAX_RENOVACIONES, 2),
    pagoTtlMinutos: numero(process.env.PAGO_TTL_MINUTOS, 20),
  };
}

export function diasGracia() {
  return configuracionPagos().diasGracia;
}

export function maxRenovaciones() {
  return configuracionPagos().maxRenovaciones;
}

function redondearPesos(valor) {
  return Math.round(valor / 100) * 100;
}

export function calcularTarifa(precio, dias = DIAS_BASE) {
  const config = configuracionPagos();
  const valor = Math.max(0, numero(precio, 0));
  const cantidadDias = Math.min(30, Math.max(1, numero(dias, DIAS_BASE)));
  const tarifa = valor * (config.tarifaPorcentaje / 100) * (cantidadDias / DIAS_BASE);

  return Math.max(config.tarifaMinima, redondearPesos(tarifa));
}

export function calcularMulta({
  valorLibro,
  fechaVencimiento,
  multaActual = 0,
  ahora = new Date(),
}) {
  const config = configuracionPagos();
  const valor = Math.max(0, numero(valorLibro, 0));

  if (!fechaVencimiento || valor === 0) {
    return { diasAtraso: 0, diasMulta: 0, multa: Math.max(0, numero(multaActual, 0)) };
  }

  const vencimiento = new Date(fechaVencimiento).getTime();
  const transcurrido = ahora.getTime() - vencimiento;
  const diasAtraso = transcurrido > 0 ? Math.ceil(transcurrido / DIA_MS) : 0;
  const diasMulta = Math.max(0, diasAtraso - config.diasGracia);
  const multaCalculada = Math.min(
    valor * (config.multaMaximaPorcentaje / 100),
    valor * (config.multaDiariaPorcentaje / 100) * diasMulta
  );

  return {
    diasAtraso,
    diasMulta,
    multa: Math.max(0, numero(multaActual, 0), redondearPesos(multaCalculada)),
  };
}

export function crearReferencia(tipo = 'ALQ') {
  const limpio = String(tipo).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'ALQ';
  return `NEXO-${limpio}-${Date.now()}-${randomBytes(5).toString('hex')}`;
}

export function firmarIntegridad({ referencia, montoCentavos, moneda = MONEDA, expiracion }) {
  const secreto = process.env.WOMPI_INTEGRITY_SECRET;

  if (!secreto) {
    throw new Error('WOMPI_INTEGRITY_SECRET no está configurado');
  }

  const fecha = expiracion ? new Date(expiracion).toISOString() : '';
  const cadena = `${referencia}${montoCentavos}${moneda}${fecha}${secreto}`;

  return createHash('sha256').update(cadena).digest('hex');
}

export function urlRedireccion(referencia) {
  const base = (process.env.WOMPI_REDIRECT_URL || `${appUrl()}/pago/resultado`).trim();

  if (base.includes(':referencia')) {
    return base.replace(':referencia', encodeURIComponent(referencia));
  }

  return `${base.replace(/\/+$/, '')}/${encodeURIComponent(referencia)}`;
}

export function crearCheckout({
  referencia,
  monto,
  email,
  nombre,
  cedula,
  dias,
}) {
  if (!wompiCheckoutConfigurado()) {
    throw new Error('Wompi no está configurado');
  }

  const config = configuracionPagos();
  const montoCentavos = Math.round(Number(monto) * 100);
  const expiracion = new Date(Date.now() + config.pagoTtlMinutos * 60 * 1000);
  const firma = firmarIntegridad({
    referencia,
    montoCentavos,
    moneda: MONEDA,
    expiracion,
  });
  const base = (process.env.WOMPI_CHECKOUT_URL || 'https://checkout.wompi.co/p/').trim();
  const parametros = [
    ['public-key', process.env.WOMPI_PUBLIC_KEY],
    ['currency', MONEDA],
    ['amount-in-cents', String(montoCentavos)],
    ['reference', referencia],
    ['signature:integrity', firma],
    ['expiration-time', expiracion.toISOString()],
    ['redirect-url', urlRedireccion(referencia)],
  ];

  if (email) {
    parametros.push(['customer-data:email', email]);
  }
  if (nombre) {
    parametros.push(['customer-data:full-name', nombre]);
  }
  if (cedula) {
    parametros.push(['customer-data:legal-id', cedula]);
    parametros.push(['customer-data:legal-id-type', 'CC']);
  }

  const separador = base.includes('?') ? '&' : '?';
  const url = `${base}${separador}${parametros
    .map(([clave, valor]) => `${clave}=${encodeURIComponent(valor)}`)
    .join('&')}`;

  return {
    url,
    referencia,
    montoCentavos,
    expiracion,
    firma,
    dias,
  };
}

function valorRuta(objeto, ruta) {
  return String(ruta)
    .split('.')
    .reduce((actual, parte) => actual?.[parte], objeto);
}

export function verificarFirmaEvento(evento) {
  const secreto = process.env.WOMPI_EVENTS_SECRET;

  if (!secreto) {
    return false;
  }

  const firma = evento?.signature;

  if (!firma?.checksum || !Array.isArray(firma.properties) || !evento?.timestamp) {
    return false;
  }

  const valores = firma.properties
    .map((ruta) => valorRuta(evento.data, ruta) ?? '')
    .join('');
  const cadena = `${valores}${evento.timestamp}${secreto}`;
  const calculado = createHash('sha256').update(cadena).digest('hex').toUpperCase();
  const esperado = String(firma.checksum).toUpperCase();

  if (calculado.length !== esperado.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(calculado), Buffer.from(esperado));
}

export async function enviarCorreo({ para, asunto, html, texto, idempotencia }) {
  const apiKey = process.env.RESEND_API_KEY;
  const desde = process.env.EMAIL_FROM;

  if (!apiKey || !desde) {
    console.log(`[email omitido] ${asunto} -> ${para}`);
    return { enviado: false, motivo: 'sin-configuracion' };
  }

  const respuesta = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(idempotencia ? { 'Idempotency-Key': idempotencia } : {}),
    },
    body: JSON.stringify({
      from: desde,
      to: [para],
      subject: asunto,
      html,
      text: texto,
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!respuesta.ok) {
    throw new Error(`Resend respondió ${respuesta.status}: ${await respuesta.text()}`);
  }

  const datos = await respuesta.json();
  return { enviado: true, id: datos?.id ?? null };
}
