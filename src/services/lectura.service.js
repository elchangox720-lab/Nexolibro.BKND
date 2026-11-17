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
  {
    titulo: 'Don Quijote de la Mancha',
    autor: 'Miguel de Cervantes',
    archivo: 'don-quijote-1876.pdf',
    paginas: 906,
    licencia: 'Dominio público',
    fuente: 'Internet Archive',
    fuenteUrl: 'https://archive.org/details/donquijote00cervuoft',
  },
  {
    titulo: 'La Ilíada',
    autor: 'Homero',
    archivo: 'iliada-1908.pdf',
    paginas: 458,
    licencia: 'Dominio público',
    fuente: 'Internet Archive',
    fuenteUrl: 'https://archive.org/details/lailadaversindi00estagoog',
  },
  {
    titulo: 'La Odisea',
    autor: 'Homero',
    archivo: 'odisea-1921.pdf',
    paginas: 462,
    licencia: 'Dominio público',
    fuente: 'Internet Archive',
    fuenteUrl: 'https://archive.org/details/laodisea00homeuoft',
  },
  {
    titulo: 'La divina comedia',
    autor: 'Dante Alighieri',
    archivo: 'divina-comedia-1871.pdf',
    paginas: 600,
    licencia: 'Dominio público',
    fuente: 'Internet Archive',
    fuenteUrl: 'https://archive.org/details/ladivinacomedia00aliggoog',
  },
  {
    titulo: 'Orgullo y prejuicio',
    autor: 'Jane Austen',
    archivo: 'orgullo-y-prejuicio-1924.pdf',
    paginas: 520,
    licencia: 'Dominio público',
    fuente: 'Internet Archive (tomos I y II)',
    fuenteUrl: 'https://archive.org/details/oypv1',
  },
  {
    titulo: 'La letra escarlata',
    autor: 'Nathaniel Hawthorne',
    archivo: 'letra-escarlata-1894.pdf',
    paginas: 364,
    licencia: 'Dominio público',
    fuente: 'Internet Archive',
    fuenteUrl: 'https://archive.org/details/laletraescarlata00hawt',
  },
  {
    titulo: 'Hamlet',
    autor: 'William Shakespeare',
    archivo: 'hamlet-1856.pdf',
    paginas: 62,
    licencia: 'Dominio público',
    fuente: 'Internet Archive',
    fuenteUrl: 'https://archive.org/details/hamletdramaencin00alon',
  },
  {
    titulo: 'Oliver Twist',
    autor: 'Charles Dickens',
    archivo: 'oliver-twist-1883.pdf',
    paginas: 589,
    licencia: 'Dominio público',
    fuente: 'Internet Archive',
    fuenteUrl: 'https://archive.org/details/el_hijo_de_la_parroquia_1883',
  },
  {
    titulo: 'La isla del tesoro',
    autor: 'Robert Louis Stevenson',
    archivo: 'isla-del-tesoro-1901.pdf',
    paginas: 249,
    licencia: 'Dominio público',
    fuente: 'Project Gutenberg',
    fuenteUrl: 'https://www.gutenberg.org/ebooks/45438',
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
