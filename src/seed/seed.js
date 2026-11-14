import 'dotenv/config';
import mongoose from 'mongoose';
import Libro from '../models/libro.js';

import accion from './data/accion.js';
import accion2 from './data/accion-2.js';
import base from './data/base.js';
import cienciaFiccion from './data/ciencia-ficcion.js';
import cienciaFiccion2 from './data/ciencia-ficcion-2.js';
import clasicos from './data/clasicos.js';
import clasicos2 from './data/clasicos-2.js';
import comics from './data/comics.js';
import comics2 from './data/comics-2.js';
import fantasia from './data/fantasia.js';
import fantasia2 from './data/fantasia-2.js';
import manga from './data/manga.js';
import manga2 from './data/manga-2.js';
import manhwa from './data/manhwa.js';
import manhwa2 from './data/manhwa-2.js';
import misterio from './data/misterio.js';
import misterio2 from './data/misterio-2.js';
import novelas from './data/novelas.js';
import novelas2 from './data/novelas-2.js';
import romance from './data/romance.js';
import romance2 from './data/romance-2.js';
import terror from './data/terror.js';
import terror2 from './data/terror-2.js';

const todos = [
  ...base,
  ...novelas,
  ...novelas2,
  ...fantasia,
  ...fantasia2,
  ...romance,
  ...romance2,
  ...terror,
  ...terror2,
  ...misterio,
  ...misterio2,
  ...cienciaFiccion,
  ...cienciaFiccion2,
  ...accion,
  ...accion2,
  ...clasicos,
  ...clasicos2,
  ...manga,
  ...manga2,
  ...manhwa,
  ...manhwa2,
  ...comics,
  ...comics2,
];

function normalizar(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

async function resolverPortada(titulo, autor) {
  const urls = [
    `https://openlibrary.org/search.json?title=${encodeURIComponent(titulo)}&author=${encodeURIComponent(autor)}&limit=3&fields=cover_i`,
    `https://openlibrary.org/search.json?title=${encodeURIComponent(titulo)}&limit=3&fields=cover_i`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (!res.ok) {
        continue;
      }
      const data = await res.json();
      const doc = data.docs?.find((item) => item.cover_i);
      if (doc) {
        return `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
      }
    } catch {
      // ignora y prueba la siguiente estrategia
    }
  }

  const texto = encodeURIComponent(titulo.slice(0, 42));
  return `https://placehold.co/600x900/14141b/e8cf7a?text=${texto}`;
}

function precioPara(indice) {
  return Math.round((39900 + ((indice * 3700) % 90000)) / 100) * 100;
}

await mongoose.connect(process.env.MONGODB_URI, {
  dbName: process.env.MONGODB_DB || 'nexolibro',
});

const backfill = await Libro.updateMany({ tipo: { $exists: false } }, { $set: { tipo: 'Novela' } });
if (backfill.modifiedCount) {
  console.log('tipo asignado a libros existentes:', backfill.modifiedCount);
}

const existentes = await Libro.find({}, { titulo: 1, descripcion: 1 }).lean();
const existentesPorTitulo = new Map(
  existentes.map((libro) => [normalizar(libro.titulo), libro]),
);
const existentesSet = new Set(existentesPorTitulo.keys());

let creados = 0;
let omitidos = 0;
let conPortada = 0;
let conRespaldo = 0;

for (let i = 0; i < todos.length; i++) {
  const item = todos[i];
  const clave = normalizar(item.titulo);

  if (existentesSet.has(clave)) {
    const actual = existentesPorTitulo.get(clave);
    const palabras = (actual?.descripcion ?? '').trim().split(/\s+/).filter(Boolean).length;

    if (palabras < 80 && item.descripcion) {
      await Libro.updateOne({ _id: actual._id }, { $set: { descripcion: item.descripcion } });
      console.log(`Descripcion ampliada: ${item.titulo}`);
    }

    omitidos++;
    continue;
  }

  const portada = await resolverPortada(item.titulo, item.autor);
  const esRespaldo = portada.includes('placehold.co');

  if (esRespaldo) {
    conRespaldo++;
  } else {
    conPortada++;
  }

  await Libro.create({
    ...item,
    portada,
    precio: precioPara(i),
    stock: 3 + (i % 9),
  });

  existentesSet.add(clave);
  creados++;
  console.log(`${i + 1}/${todos.length} ${item.titulo} -> ${esRespaldo ? 'respaldo' : 'portada real'}`);

  await new Promise((resolve) => setTimeout(resolve, 120));
}

console.log('-----------------------------------------');
console.log('creados:', creados);
console.log('omitidos (ya existian):', omitidos);
console.log('portadas reales:', conPortada);
console.log('portadas de respaldo:', conRespaldo);
console.log('total en base:', await Libro.countDocuments());

await mongoose.disconnect();
