import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIRECTORIO_PDF = fileURLToPath(new URL('../storage/pdf/', import.meta.url));

const CATALOGO_LECTURAS = [
  {
    titulo: 'Frankenstein',
    autor: 'Mary Shelley',
    archivo: 'frankenstein-1869.pdf',
    paginas: 190,
    licencia: 'Dominio público',
    fuente: 'Wikimedia Commons / Internet Archive',
    fuenteUrl:
      'https://commons.wikimedia.org/wiki/File:Frankenstein,_Or,_The_Modern_Prometheus_(IA_frankensteinorm00shelgoog).pdf',
  },
  {
    titulo: 'Drácula',
    autor: 'Bram Stoker',
    archivo: 'dracula-1897.pdf',
    paginas: 370,
    licencia: 'Dominio público',
    fuente: 'Wikimedia Commons / Internet Archive',
    fuenteUrl:
      'https://commons.wikimedia.org/wiki/File:Dracula_(IA_draculabr00stokuoft).pdf',
  },
];

function normalizar(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function rutaSegura(archivo) {
  const nombre = path.basename(archivo);
  const ruta = path.resolve(DIRECTORIO_PDF, nombre);

  if (!ruta.startsWith(path.resolve(DIRECTORIO_PDF) + path.sep)) {
    return null;
  }

  return ruta;
}

export function resolverLectura({ titulo, autor } = {}) {
  const tituloBuscado = normalizar(titulo);
  const autorBuscado = normalizar(autor);

  if (!tituloBuscado || !autorBuscado) {
    return null;
  }

  const lectura = CATALOGO_LECTURAS.find(
    (item) => normalizar(item.titulo) === tituloBuscado && normalizar(item.autor) === autorBuscado
  );

  if (!lectura) {
    return null;
  }

  const ruta = rutaSegura(lectura.archivo);

  if (!ruta || !existsSync(ruta)) {
    return null;
  }

  return { ...lectura, ruta };
}
