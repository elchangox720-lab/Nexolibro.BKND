const USER_AGENT = 'NexolibroBot/1.0 (+https://nexolibro-eifu.vercel.app)';
const WIKI_API = 'https://es.wikipedia.org/w/api.php';
const WIKI_EN_API = 'https://en.wikipedia.org/w/api.php';

export const GENEROS = [
  {
    nombre: 'Fantasía',
    tipo: 'Novela',
    google: 'subject:"fantasy"',
    openLibrary: 'subject:fantasy language:spa',
    wiki: 'novela fantasía',
  },
  {
    nombre: 'Romance',
    tipo: 'Novela',
    google: 'subject:"romance"',
    openLibrary: 'subject:romance language:spa',
    wiki: 'novela romántica',
  },
  {
    nombre: 'Terror',
    tipo: 'Novela',
    google: 'subject:"horror"',
    openLibrary: 'subject:horror language:spa',
    wiki: 'novela de terror',
  },
  {
    nombre: 'Ciencia ficción',
    tipo: 'Novela',
    google: 'subject:"science fiction"',
    openLibrary: 'subject:science_fiction language:spa',
    wiki: 'novela ciencia ficción',
  },
  {
    nombre: 'Misterio',
    tipo: 'Novela',
    google: 'subject:"mystery"',
    openLibrary: 'subject:mystery language:spa',
    wiki: 'novela de misterio',
  },
  {
    nombre: 'Aventura',
    tipo: 'Novela',
    google: 'subject:"adventure"',
    openLibrary: 'subject:adventure language:spa',
    wiki: 'novela de aventuras',
  },
  {
    nombre: 'Acción',
    tipo: 'Novela',
    google: 'subject:"action"',
    openLibrary: 'subject:action language:spa',
    wiki: 'novela de acción',
  },
  {
    nombre: 'Drama',
    tipo: 'Novela',
    google: 'subject:"drama"',
    openLibrary: 'subject:drama language:spa',
    wiki: 'novela dramática',
  },
  {
    nombre: 'Suspenso',
    tipo: 'Novela',
    google: 'subject:"suspense"',
    openLibrary: 'subject:suspense language:spa',
    wiki: 'novela de suspenso',
  },
  {
    nombre: 'Historia',
    tipo: 'Novela',
    google: 'subject:"historical fiction"',
    openLibrary: 'subject:historical_fiction language:spa',
    wiki: 'novela histórica',
  },
  {
    nombre: 'Filosofía',
    tipo: 'Novela',
    google: 'subject:"philosophy"',
    openLibrary: 'subject:philosophy language:spa',
    wiki: 'libro de filosofía',
  },
  {
    nombre: 'Comedia',
    tipo: 'Novela',
    google: 'subject:"humor"',
    openLibrary: 'subject:humor language:spa',
    wiki: 'novela de comedia',
  },
  {
    nombre: 'Manga',
    tipo: 'Manga',
    google: 'subject:"manga"',
    openLibrary: 'subject:manga language:spa',
    wiki: 'manga',
    anilist: { country: 'JP' },
  },
  {
    nombre: 'Manhwa',
    tipo: 'Manhwa',
    google: 'subject:"manhwa"',
    openLibrary: 'subject:manhwa',
    wiki: 'manhwa',
    anilist: { country: 'KR' },
  },
  {
    nombre: 'Clásico',
    tipo: 'Novela',
    google: 'subject:"classics"',
    openLibrary: 'subject:classics language:spa',
    wiki: 'novela clásica',
  },
  {
    nombre: 'Deportes',
    tipo: 'Novela',
    google: 'subject:"sports"',
    openLibrary: 'subject:sports language:spa',
    wiki: 'libro de deportes',
  },
  {
    nombre: 'Realismo mágico',
    tipo: 'Novela',
    google: 'subject:"magic realism"',
    openLibrary: 'subject:magic_realism language:spa',
    wiki: 'novela realismo mágico',
  },
  {
    nombre: 'Distopía',
    tipo: 'Novela',
    google: 'subject:"dystopia"',
    openLibrary: 'subject:dystopia language:spa',
    wiki: 'novela distópica',
  },
  {
    nombre: 'Fábula',
    tipo: 'Novela',
    google: 'subject:"fables"',
    openLibrary: 'subject:fables language:spa',
    wiki: 'fábula libro',
  },
  {
    nombre: 'Sátira',
    tipo: 'Novela',
    google: 'subject:"satire"',
    openLibrary: 'subject:satire language:spa',
    wiki: 'novela satírica',
  },
];

const PALABRAS_ESPANOL =
  /\b(el|la|los|las|un|una|unos|unas|de|del|que|en|con|por|para|sus|como|más|pero|esta|este|esto|libro|novela|historia|vida|mundo|año|años|personajes|obra|autor|autora|escritor|escritora|publicada|publicado|tras|entre|sobre|desde|hasta|cuando|donde)\b/gi;

function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúüñ\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function claveLibro(titulo, autor) {
  return `${normalizar(titulo)}|${normalizar(autor)}`;
}

function anioDesde(valor) {
  const coincidencia = String(valor ?? '').match(/(\d{4})/);
  const anio = coincidencia ? Number(coincidencia[1]) : null;
  return anio && anio > 0 && anio <= new Date().getFullYear() + 1 ? anio : null;
}

function esEspanol(texto) {
  const palabras = String(texto ?? '').match(PALABRAS_ESPANOL) ?? [];
  return palabras.length >= 4;
}

function limpiarHtml(texto) {
  return String(texto ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/&hellip;/gi, '…')
    .replace(/&rsquo;/gi, "'")
    .replace(/&ldquo;/gi, '"')
    .replace(/&rdquo;/gi, '"')
    .replace(/\*\*/g, '')
    .replace(/\[[0-9]+\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function recortarDescripcion(texto, maximo = 850) {
  const limpio = limpiarHtml(texto);

  if (limpio.length <= maximo) {
    return limpio;
  }

  const corte = limpio.slice(0, maximo);
  const ultimoPunto = Math.max(
    corte.lastIndexOf('. '),
    corte.lastIndexOf('! '),
    corte.lastIndexOf('? ')
  );

  if (ultimoPunto > maximo * 0.45) {
    return `${corte.slice(0, ultimoPunto + 1)}…`;
  }

  const ultimoEspacio = corte.lastIndexOf(' ');
  return `${corte.slice(0, ultimoEspacio > 0 ? ultimoEspacio : maximo)}…`;
}

async function pedirJson(url, opciones = {}, tiempoMaximo = 20000) {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), tiempoMaximo);

  try {
    const respuesta = await fetch(url, {
      ...opciones,
      signal: controlador.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
        ...(opciones.headers ?? {}),
      },
    });

    if (!respuesta.ok) {
      throw new Error(`HTTP ${respuesta.status}`);
    }

    return await respuesta.json();
  } finally {
    clearTimeout(temporizador);
  }
}

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function buscarGoogleBooks(genero, errores) {
  const candidatos = [];
  const llave = process.env.GOOGLE_BOOKS_API_KEY
    ? `&key=${encodeURIComponent(process.env.GOOGLE_BOOKS_API_KEY)}`
    : '';

  for (const inicio of [0, 40]) {
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(
      genero.google
    )}&langRestrict=es&printType=books&maxResults=40&startIndex=${inicio}${llave}`;

    try {
      const datos = await pedirJson(url);
      const items = datos.items ?? [];

      for (const item of items) {
        const info = item.volumeInfo ?? {};
        const titulo = String(info.title ?? '').trim();
        const autor = (info.authors ?? []).map((nombre) => String(nombre).trim()).filter(Boolean).join(', ');
        const anio = anioDesde(info.publishedDate);
        const portada = (info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail ?? '')
          .replace(/^http:\/\//i, 'https://')
          .replace(/&edge=curl/gi, '');

        if (!titulo || !autor || !anio) {
          continue;
        }

        candidatos.push({
          titulo,
          autor,
          anio,
          portada,
          isbn: (info.industryIdentifiers ?? []).find((itemIsbn) => itemIsbn.type === 'ISBN_13')?.identifier,
          fuente: 'Google Books',
          fuenteId: `google:${item.id}`,
          fuenteUrl: `https://books.google.com/books?id=${item.id}`,
          descripcionFuente: recortarDescripcion(info.description ?? ''),
          temas: (info.categories ?? []).slice(0, 4),
        });
      }

      if (items.length < 40) {
        break;
      }
    } catch (error) {
      errores.push(`Google Books (${genero.nombre}): ${error.message}`);
      break;
    }

    await esperar(500);
  }

  return candidatos;
}

async function buscarOpenLibrary(genero, errores) {
  const candidatos = [];

  for (const pagina of [1, 2]) {
    const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(
      genero.openLibrary
    )}&limit=50&page=${pagina}&fields=key,title,author_name,first_publish_year,cover_i,isbn,subject`;

    try {
      const datos = await pedirJson(url);
      const docs = datos.docs ?? [];

      for (const doc of docs) {
        const titulo = String(doc.title ?? '').trim();
        const autor = (doc.author_name ?? []).map((nombre) => String(nombre).trim()).filter(Boolean).join(', ');
        const anio = anioDesde(doc.first_publish_year);
        const isbn = (doc.isbn ?? []).find((valor) => String(valor).replace(/-/g, '').length === 13);

        if (!titulo || !autor || !anio) {
          continue;
        }

        candidatos.push({
          titulo,
          autor,
          anio,
          portada: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : '',
          isbn: isbn ? String(isbn).replace(/-/g, '') : undefined,
          fuente: 'Open Library',
          fuenteId: `openlibrary:${doc.key}`,
          fuenteUrl: `https://openlibrary.org${doc.key}`,
          descripcionFuente: '',
          temas: (doc.subject ?? []).slice(0, 4),
        });
      }

      if (docs.length < 50) {
        break;
      }
    } catch (error) {
      errores.push(`Open Library (${genero.nombre}): ${error.message}`);
      break;
    }

    await esperar(600);
  }

  return candidatos;
}

const ANILIST_QUERY = `
  query ($pagina: Int!, $pais: CountryCode!) {
    Page(page: $pagina, perPage: 50) {
      media(type: MANGA, countryOfOrigin: $pais, sort: POPULARITY_DESC, isAdult: false) {
        id
        title { romaji english native }
        description
        startDate { year }
        coverImage { extraLarge large }
        genres
        staff(perPage: 3) {
          edges { role node { name { full } } }
        }
      }
    }
  }
`;

async function buscarAniList(genero, errores) {
  const candidatos = [];

  for (const pagina of [1, 2]) {
    try {
      const datos = await pedirJson('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: ANILIST_QUERY,
          variables: { pagina, pais: genero.anilist.country },
        }),
      });

      const media = datos.data?.Page?.media ?? [];

      for (const item of media) {
        const titulo = String(item.title?.romaji ?? item.title?.english ?? item.title?.native ?? '').trim();
        const autores = (item.staff?.edges ?? [])
          .map((edge) => ({
            rol: String(edge.role ?? ''),
            nombre: String(edge.node?.name?.full ?? '').trim(),
          }))
          .filter((edge) => edge.nombre);
        const autor =
          autores.find((edge) => /story/i.test(edge.rol))?.nombre ?? autores[0]?.nombre ?? '';
        const anio = anioDesde(item.startDate?.year);

        if (!titulo || !autor || !anio) {
          continue;
        }

        candidatos.push({
          titulo,
          tituloAlternativo: String(item.title?.english ?? item.title?.native ?? '').trim(),
          autor,
          anio,
          portada: item.coverImage?.extraLarge ?? item.coverImage?.large ?? '',
          isbn: undefined,
          fuente: 'AniList',
          fuenteId: `anilist:${item.id}`,
          fuenteUrl: `https://anilist.co/manga/${item.id}`,
          descripcionFuente: recortarDescripcion(item.description ?? ''),
          temas: (item.genres ?? []).slice(0, 4),
        });
      }

      if (media.length < 50) {
        break;
      }
    } catch (error) {
      errores.push(`AniList (${genero.nombre}): ${error.message}`);
      break;
    }

    await esperar(700);
  }

  return candidatos;
}

const PALABRAS_VACIAS = new Set([
  'the', 'and', 'of', 'a', 'an', 'to', 'in', 'on', 'for', 'with', 'by', 'from', 'at',
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al', 'y', 'o',
  'en', 'con', 'por', 'para', 'que', 'se', 'su', 'sus', 'lo',
]);

function tokensSignificativos(texto) {
  return [
    ...new Set(
      normalizar(texto)
        .split(' ')
        .filter((token) => token.length > 2 && !PALABRAS_VACIAS.has(token))
    ),
  ];
}

function coincideTitulo(titulo, tituloPagina) {
  const tituloNormal = normalizar(titulo);
  const paginaNormal = normalizar(tituloPagina.replace(/\(.*?\)/g, ''));

  if (!tituloNormal || !paginaNormal) {
    return false;
  }

  if (paginaNormal === tituloNormal || paginaNormal.includes(tituloNormal)) {
    return true;
  }

  const tokensTitulo = tokensSignificativos(titulo);
  const tokensPagina = new Set(tokensSignificativos(tituloPagina.replace(/\(.*?\)/g, '')));

  if (tokensTitulo.length === 0) {
    return false;
  }

  if (tokensTitulo.length === 1) {
    return paginaNormal === tituloNormal;
  }

  const coincidencias = tokensTitulo.filter((token) => tokensPagina.has(token)).length;
  return coincidencias >= Math.min(2, tokensTitulo.length);
}

async function tituloEspanolOpenLibrary(candidato) {
  try {
    const clave = candidato.fuenteId.replace(/^openlibrary:/, '');
    const datos = await pedirJson(`https://openlibrary.org${clave}/editions.json?limit=50`);
    const entradas = (datos.entries ?? []).filter((entrada) => entrada.title);
    const espanol = entradas.find((entrada) =>
      (entrada.languages ?? []).some((idioma) => /\/languages\/(spa|es)$/.test(idioma.key ?? ''))
    );

    if (espanol) {
      return String(espanol.title).trim();
    }

    const ingles = entradas.find((entrada) =>
      (entrada.languages ?? []).some((idioma) => /\/languages\/eng$/.test(idioma.key ?? ''))
    );

    return String(ingles?.title ?? '').trim();
  } catch {
    return '';
  }
}

async function buscarWikipedia(
  titulo,
  autor,
  genero,
  tituloAlternativo = '',
  api = WIKI_API,
  idioma = 'es'
) {
  const tituloBusqueda = tituloAlternativo || titulo;
  const terminoGenero =
    idioma === 'en'
      ? genero.tipo.toLowerCase() === 'novela'
        ? 'novel'
        : genero.tipo.toLowerCase()
      : genero.wiki;
  const parametros = new URLSearchParams({
    action: 'query',
    format: 'json',
    prop: 'extracts|pageimages',
    exintro: '1',
    explaintext: '1',
    piprop: 'thumbnail',
    pithumbsize: '640',
    generator: 'search',
    gsrsearch: `${tituloBusqueda} ${autor} ${terminoGenero}`.trim(),
    gsrlimit: '6',
  });

  try {
    const datos = await pedirJson(`${api}?${parametros}`);
    const paginas = Object.values(datos.query?.pages ?? {});

    for (const pagina of paginas) {
      const extracto = recortarDescripcion(pagina.extract ?? '', 900);

      if (extracto.length < 250 || /desambiguaci[oó]n/i.test(pagina.title ?? '')) {
        continue;
      }

      const extractoNormal = normalizar(extracto);
      const paginaNormal = normalizar(String(pagina.title ?? '').replace(/\(.*?\)/g, ''));
      const apellido = normalizar(autor).split(' ').filter(Boolean).pop() ?? '';
      const mencionaAutor = apellido.length > 2 && extractoNormal.includes(apellido);
      const esSerie = /\b(serie|saga|universo)\s+de\b/.test(extractoNormal.slice(0, 170));
      const esPersonaje = /^[^.]{0,100}\b(es|fue)\s+(un|una)\s+personaje\b/.test(
        extractoNormal
      );
      const esBiografia =
        /^[^.]{0,140}\b(es|fue)\s+un[ao]?\s+(filosofo|escritor|poeta|politico|emperador|cientifico|historiador|dramaturgo|novelista)\b/.test(
          extractoNormal
        );
      const esAdaptacion =
        /^[^.]{0,160}\b(es|fue)\s+un[ao]?\s+(pelicula|serie|miniserie|adaptacion|videojuego)\b/.test(
          extractoNormal
        ) || /\badaptacion (filmica|cinematografica|televisiva)\b/.test(extractoNormal.slice(0, 220));

      if (
        !mencionaAutor ||
        paginaNormal === normalizar(autor) ||
        esSerie ||
        esPersonaje ||
        esBiografia ||
        esAdaptacion
      ) {
        continue;
      }

      const posicionTitulo = Math.min(
        ...[titulo, tituloAlternativo]
          .filter(Boolean)
          .filter((valor) => tokensSignificativos(valor).length > 1)
          .map((valor) => extractoNormal.indexOf(normalizar(valor)))
          .filter((posicion) => posicion >= 0)
      );
      const tituloEnExtracto = Number.isFinite(posicionTitulo) && posicionTitulo < 220;
      const tituloCoincide =
        coincideTitulo(titulo, String(pagina.title ?? '')) ||
        (tituloAlternativo && coincideTitulo(tituloAlternativo, String(pagina.title ?? '')));

      if (!tituloEnExtracto && !tituloCoincide) {
        continue;
      }

      return {
        descripcion: extracto,
        portada: pagina.thumbnail?.source ?? '',
        fuenteUrl: `${idioma}.wikipedia.org/wiki/${encodeURIComponent(
          String(pagina.title).replace(/\s/g, '_')
        )}`,
      };
    }
  } catch {
    return null;
  }

  if (tituloAlternativo && normalizar(tituloAlternativo) !== normalizar(titulo)) {
    return buscarWikipedia(titulo, autor, genero, '', api, idioma);
  }

  return null;
}

async function descripcionOpenLibrary(candidato) {
  try {
    const clave = candidato.fuenteId.replace(/^openlibrary:/, '');
    const datos = await pedirJson(`https://openlibrary.org${clave}.json`);
    const descripcion = typeof datos.description === 'object'
      ? datos.description?.value
      : datos.description;

    return recortarDescripcion(descripcion ?? '');
  } catch {
    return '';
  }
}

async function traducirGoogle(texto) {
  try {
    const parametros = new URLSearchParams({
      client: 'gtx',
      sl: 'auto',
      tl: 'es',
      dt: 't',
      q: String(texto ?? '').slice(0, 1800),
    });
    const datos = await pedirJson(
      `https://translate.googleapis.com/translate_a/single?${parametros}`,
      {},
      20000
    );
    const traduccion = Array.isArray(datos?.[0])
      ? datos[0].map((parte) => (Array.isArray(parte) ? parte[0] : '')).join('')
      : '';
    return recortarDescripcion(traduccion, 900);
  } catch {
    return '';
  }
}

function idiomaProbable(texto) {
  if (/[ąćęłńóśźż]/i.test(texto)) {
    return 'pl';
  }

  if (/[ãõç]/i.test(texto)) {
    return 'pt';
  }

  return 'en';
}

async function traducirMyMemory(texto) {
  try {
    const limpio = limpiarHtml(texto).slice(0, 1800);
    const idioma = idiomaProbable(limpio);
    const partes = [];

    for (let inicio = 0; inicio < limpio.length; inicio += 450) {
      const parte = limpio.slice(inicio, inicio + 450);
      const parametros = new URLSearchParams({
        q: parte,
        langpair: `${idioma}|es`,
      });
      const datos = await pedirJson(
        `https://api.mymemory.translated.net/get?${parametros}`,
        {},
        20000
      );
      const traduccion = datos?.responseData?.translatedText;

      if (!traduccion || /MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(traduccion)) {
        return '';
      }

      partes.push(traduccion);
      await esperar(120);
    }

    return recortarDescripcion(partes.join(' '), 900);
  } catch {
    return '';
  }
}

async function traducirEspanol(texto) {
  const google = await traducirGoogle(texto);

  if (google) {
    return google;
  }

  return traducirMyMemory(texto);
}

function descripcionGenerica(candidato, genero) {
  const temas = candidato.temas?.length
    ? ` La obra se relaciona con temas como ${candidato.temas.join(', ')}.`
    : '';

  return `${candidato.titulo} es una obra de ${genero.nombre.toLowerCase()} escrita por ${candidato.autor} y publicada en ${candidato.anio}.${temas} Forma parte del catálogo de Nexolibro y está disponible para conocer más sobre su historia y su autor.`;
}

export async function completarDescripcion(candidato, genero, advertencias) {
  const tituloEspanol =
    candidato.fuente === 'Open Library' ? await tituloEspanolOpenLibrary(candidato) : '';
  const wiki = await buscarWikipedia(
    candidato.titulo,
    candidato.autor,
    genero,
    tituloEspanol || candidato.tituloAlternativo
  );

  if (wiki) {
    return {
      descripcion: wiki.descripcion,
      portada: candidato.portada || wiki.portada,
      fuenteUrl: candidato.fuenteUrl || wiki.fuenteUrl,
      origenDescripcion: 'Wikipedia en español',
    };
  }

  if (candidato.fuente === 'Open Library') {
    const descripcion = await descripcionOpenLibrary(candidato);

    if (descripcion.length >= 150) {
      const traducida = esEspanol(descripcion) ? descripcion : await traducirEspanol(descripcion);

      if (!traducida) {
        advertencias.push(`Descripción no traducida: ${candidato.titulo}`);
      }

      return {
        descripcion: traducida || descripcion,
        portada: candidato.portada,
        fuenteUrl: candidato.fuenteUrl,
        origenDescripcion: traducida ? 'Open Library (traducida)' : 'Open Library',
      };
    }
  }

  if (candidato.descripcionFuente?.length >= 150) {
    const original = candidato.descripcionFuente;
    const traducida = esEspanol(original) ? original : await traducirEspanol(original);

    if (!traducida) {
      advertencias.push(`Descripción no traducida: ${candidato.titulo}`);
    }

    return {
      descripcion: traducida || original,
      portada: candidato.portada,
      fuenteUrl: candidato.fuenteUrl,
      origenDescripcion: traducida ? `${candidato.fuente} (traducida)` : candidato.fuente,
    };
  }

  const wikiIngles = await buscarWikipedia(
    candidato.titulo,
    candidato.autor,
    genero,
    '',
    WIKI_EN_API,
    'en'
  );

  if (wikiIngles) {
    const traduccion = await traducirEspanol(wikiIngles.descripcion);

    if (traduccion) {
      return {
        descripcion: traduccion,
        portada: candidato.portada || wikiIngles.portada,
        fuenteUrl: candidato.fuenteUrl || wikiIngles.fuenteUrl,
        origenDescripcion: 'Wikipedia en inglés (traducida)',
      };
    }
  }

  advertencias.push(`Descripción genérica usada: ${candidato.titulo}`);

  return {
    descripcion: recortarDescripcion(descripcionGenerica(candidato, genero)),
    portada: candidato.portada,
    fuenteUrl: candidato.fuenteUrl,
    origenDescripcion: 'Ficha bibliográfica',
  };
}

export async function obtenerLibrosParaGenero(nombreGenero, cantidad = 10) {
  const genero = GENEROS.find((item) => item.nombre === nombreGenero);

  if (!genero) {
    throw new Error(`Género no configurado: ${nombreGenero}`);
  }

  const { default: Libro } = await import('../models/libro.js');
  const existentes = await Libro.find().select('titulo autor isbn fuenteId').lean();
  const clavesExistentes = new Set(
    existentes.map((libro) => claveLibro(libro.titulo, libro.autor))
  );
  const isbnExistentes = new Set(
    existentes.map((libro) => String(libro.isbn ?? '').replace(/-/g, '')).filter(Boolean)
  );
  const fuentesExistentes = new Set(
    existentes.map((libro) => String(libro.fuenteId ?? '')).filter(Boolean)
  );

  const errores = [];
  const advertencias = [];
  const crudos = [];

  if (genero.anilist) {
    crudos.push(...(await buscarAniList(genero, errores)));
  }

  crudos.push(...(await buscarGoogleBooks(genero, errores)));
  crudos.push(...(await buscarOpenLibrary(genero, errores)));

  const clavesUsadas = new Set();
  const libros = [];
  let intentosDescripcion = 0;

  for (const candidato of crudos) {
    if (libros.length >= cantidad || intentosDescripcion >= 70) {
      break;
    }

    if (!candidato.titulo || !candidato.autor || !candidato.anio) {
      continue;
    }

    const clave = claveLibro(candidato.titulo, candidato.autor);
    const isbn = String(candidato.isbn ?? '').replace(/-/g, '');

    if (
      clavesExistentes.has(clave) ||
      clavesUsadas.has(clave) ||
      fuentesExistentes.has(candidato.fuenteId) ||
      (isbn && isbnExistentes.has(isbn))
    ) {
      continue;
    }

    intentosDescripcion += 1;
    const completado = await completarDescripcion(candidato, genero, advertencias);

    if (!completado.portada) {
      advertencias.push(`Sin portada verificable: ${candidato.titulo}`);
      continue;
    }

    if (completado.descripcion.length < 180) {
      advertencias.push(`Descripción demasiado corta: ${candidato.titulo}`);
      continue;
    }

    clavesUsadas.add(clave);

    if (isbn) {
      isbnExistentes.add(isbn);
    }

    libros.push({
      titulo: candidato.titulo,
      autor: candidato.autor,
      tipo: genero.tipo,
      genero: genero.nombre,
      anio: candidato.anio,
      descripcion: completado.descripcion,
      portada: completado.portada,
      isbn: isbn || undefined,
      precio: 49900,
      stock: 10,
      origen: 'automatico',
      fuente: candidato.fuente,
      fuenteId: candidato.fuenteId,
      fuenteUrl: completado.fuenteUrl,
      origenDescripcion: completado.origenDescripcion,
    });

    await esperar(150);
  }

  if (libros.length < cantidad) {
    errores.push(
      `Solo se encontraron ${libros.length} de ${cantidad} libros válidos para ${genero.nombre}`
    );
  }

  return { genero, libros, errores, advertencias };
}
