/* ============================================================
   app.js — Biblioteca Abierta (LAD319 · Actividad 6)
   ------------------------------------------------------------
   Explorador de libros sobre la API pública de Open Library.
   Patrón de la Pokédex: lista → detalle → tarjetas → rejilla.

   Endpoints usados (documentados en https://openlibrary.org/developers/api):
     1) GET /search.json?q=…&page=…&limit=…   → lista paginada
     2) GET /works/{ID}.json                  → ficha del libro

   Reglas de uso: Open Library permite 1 petición/segundo sin
   identificarse (3/s con User-Agent y correo), pide cachear las
   respuestas y no usarla como backend masivo. Por eso aquí NO se
   precargan las fichas en paralelo con Promise.all: la lista ya
   trae los datos de la tarjeta y el detalle se pide solo cuando el
   usuario abre una ficha (una petición por clic).
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 1. Configuración ---------- */
  const API = 'https://openlibrary.org';
  const PORTADAS = 'https://covers.openlibrary.org/b/id';
  const POR_PAGINA = 12;

  /* Campos que se piden al buscador: solo lo que pinta la tarjeta. */
  const CAMPOS = 'key,title,author_name,first_publish_year,cover_i,edition_count';

  /* ---------- 2. Caché y peticiones ---------- */

  /* Map: URL → promesa de la respuesta. Guardar la promesa (no el
     resultado) evita duplicar peticiones simultáneas a la misma URL. */
  const cache = new Map();

  /**
   * Pide una URL en JSON y la cachea.
   * @param {string} url
   * @returns {Promise<object>}
   */
  function pedirJson(url) {
    if (!cache.has(url)) {
      const promesa = fetch(url).then(function (respuesta) {
        if (!respuesta.ok) { throw new Error('La API respondió ' + respuesta.status); }
        return respuesta.json();
      });
      cache.set(url, promesa);
      promesa.catch(function () { cache.delete(url); }); // un fallo no se cachea
    }
    return cache.get(url);
  }

  /**
   * Lista paginada de libros.
   * @param {string} consulta
   * @param {number} pagina  empieza en 1
   * @returns {Promise<{total:number, libros:Array}>}
   */
  async function buscarLibros(consulta, pagina) {
    const parametros = new URLSearchParams({
      q: consulta,
      page: pagina,
      limit: POR_PAGINA,
      fields: CAMPOS,
    });
    const json = await pedirJson(API + '/search.json?' + parametros);
    return {
      total: Number(json.numFound) || 0,
      libros: Array.isArray(json.docs) ? json.docs : [],
    };
  }

  /**
   * Ficha completa de una obra.
   * @param {string} clave  por ejemplo "/works/OL45804W"
   * @returns {Promise<object>}
   */
  function obtenerLibro(clave) {
    return pedirJson(API + clave + '.json');
  }

  /* ---------- 3. Utilidades de DOM ---------- */

  const formato = new Intl.NumberFormat('es-MX');
  const numero = formato.format.bind(formato); // 48267 → «48,267»

  /* Mapa de escapes: se reutiliza en cada llamada en vez de recrearlo. */
  const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  /* Escapa texto de la API antes de meterlo en innerHTML: un título con
     < o " no rompe el marcado ni permite inyectar HTML. */
  function esc(texto) {
    return String(texto ?? '').replace(/[&<>"']/g, (caracter) => ESCAPES[caracter]);
  }

  /** Crea un nodo con clase y texto opcionales (siempre textContent). */
  function crear(etiqueta, clase, texto) {
    const nodo = document.createElement(etiqueta);
    if (clase) { nodo.className = clase; }
    if (texto !== undefined) { nodo.textContent = texto; }
    return nodo;
  }

  /** La descripción del detalle puede ser texto o { value: texto }. */
  function descripcionDe(libro) {
    const descripcion = libro.description;
    return typeof descripcion === 'string' ? descripcion : (descripcion && descripcion.value) || '';
  }

  /** HTML de la portada del CDN, o el aviso si el libro no tiene cover_i. */
  function portadaHTML(id, tamano, titulo) {
    if (!id) { return '<span class="sin-portada">Sin portada</span>'; }
    return '<img src="' + PORTADAS + '/' + encodeURIComponent(id) + '-' + tamano + '.jpg"' +
      ' alt="Portada de ' + esc(titulo || 'libro') + '" loading="lazy" decoding="async">';
  }

  /* ---------- 4. Nodos fijos ---------- */

  const $ = (id) => document.getElementById(id);
  const el = {
    buscador: $('buscador'),
    sugerencias: $('sugerencias'),
    resumen: $('resumen'),
    cache: $('cache-info'),
    avisos: $('estado'),
    celdas: $('celdas'),
    paginacion: $('paginacion'),
    modal: $('modal'),
    modalTitulo: $('modal-titulo'),
    modalCuerpo: $('modal-cuerpo'),
  };

  function pintarCache() {
    el.cache.textContent = 'caché: ' + numero(cache.size) + (cache.size === 1 ? ' respuesta' : ' respuestas');
  }

  /* ---------- 5. Render ---------- */

  /** Esqueletos de carga: HTML fijo, repetido una vez por tarjeta. */
  const ESQUELETO = '<div class="cell"><div class="esqueleto">' +
    '<div class="bloque bloque-portada"></div><div class="bloque bloque-linea"></div>' +
    '<div class="bloque bloque-linea corta"></div></div></div>';

  function pintarCarga() {
    el.celdas.innerHTML = ESQUELETO.repeat(POR_PAGINA);
  }

  /** Tarjeta de un libro: portada, título, autor, año y ediciones. */
  function pintarTarjeta(libro) {
    const titulo = libro.title || 'Sin título';
    const autor = libro.author_name ? libro.author_name[0] : 'Autor desconocido';
    const etiquetas =
      (libro.first_publish_year ? '<span class="etiqueta etiqueta-anio">' + esc(libro.first_publish_year) + '</span>' : '') +
      (libro.edition_count ? '<span class="etiqueta">' + numero(libro.edition_count) + ' ediciones</span>' : '');

    const celda = crear('div', 'cell');
    celda.innerHTML =
      '<article class="tarjeta">' +
        '<figure class="portada">' + portadaHTML(libro.cover_i, 'M', titulo) + '</figure>' +
        '<div class="cuerpo">' +
          '<h3 class="titulo">' + esc(titulo) + '</h3>' +
          '<p class="autor">' + esc(autor) + '</p>' +
          '<div class="etiquetas">' + etiquetas + '</div>' +
          '<button type="button" class="button ver">Ver ficha <span>→</span></button>' +
        '</div>' +
      '</article>';

    /* Se pasa el libro de la lista para tener autor y año a mano:
       la ficha de detalle no repite esos datos. */
    celda.querySelector('.ver').addEventListener('click', function () { abrirFicha(libro); });
    return celda;
  }

  /** Paginación de Bulma con ventana de 5 páginas; los saltos van en `data-ir`. */
  function pintarPaginacion(pagina, paginas) {
    el.paginacion.hidden = paginas <= 1;
    if (paginas <= 1) { el.paginacion.replaceChildren(); return; }

    const desde = Math.max(1, pagina - 2);
    const hasta = Math.min(paginas, pagina + 2);
    const numeros = [];
    for (let n = desde; n <= hasta; n += 1) {
      numeros.push(n === pagina
        ? '<li><a class="pagination-link is-current" aria-current="page">' + n + '</a></li>'
        : '<li><a class="pagination-link" data-ir="' + n + '">' + n + '</a></li>');
    }

    el.paginacion.innerHTML =
      '<a class="pagination-previous' + (pagina === 1 ? ' is-disabled' : '') + '"' +
        (pagina > 1 ? ' data-ir="' + (pagina - 1) + '"' : '') + '>Anterior</a>' +
      '<a class="pagination-next' + (pagina === paginas ? ' is-disabled' : '') + '"' +
        (pagina < paginas ? ' data-ir="' + (pagina + 1) + '"' : '') + '>Siguiente</a>' +
      '<ul class="pagination-list">' + numeros.join('') + '</ul>';
  }

  /** Aviso tipo `notification` de Bulma, con acción opcional. */
  function aviso(clases, titulo, detalle, accion) {
    const caja = crear('div', 'notification ' + clases);
    caja.append(
      crear('p', 'has-text-weight-semibold', titulo),
      crear('p', 'is-size-7 mt-1', detalle)
    );
    if (accion) {
      const boton = crear('button', 'button is-danger is-light is-small mt-4', accion.texto);
      boton.type = 'button';
      boton.addEventListener('click', accion.alHacer);
      caja.append(boton);
    }
    el.avisos.replaceChildren(caja);
  }

  /** Error de red, con botón de reintento. */
  function pintarError(error) {
    aviso('is-danger', 'No se pudo cargar la lista',
      'Revisa tu conexión e inténtalo de nuevo.' +
        (error && error.message ? ' (' + error.message + ')' : ''),
      { texto: 'Reintentar', alHacer: cargar });
  }

  /** Búsqueda sin coincidencias. */
  function pintarVacio(consulta) {
    aviso('is-warning is-light', 'Sin resultados',
      'No hay libros para «' + consulta + '». Prueba con otra palabra.');
  }

  /* ---------- 6. Estado y flujo ---------- */

  const estado = { consulta: 'dune', pagina: 1, total: 0, paginas: 1, turno: 0, cargando: false, error: false };

  /** Barra de estado: carga, error, sin resultados o rango de la página. */
  function pintarResumen() {
    if (estado.cargando) { el.resumen.textContent = 'Consultando Open Library…'; return; }
    if (estado.error) { el.resumen.textContent = 'No se pudo cargar la lista · «' + estado.consulta + '»'; return; }
    if (estado.total === 0) { el.resumen.textContent = 'Sin resultados · «' + estado.consulta + '»'; return; }

    const desde = (estado.pagina - 1) * POR_PAGINA + 1;
    const hasta = Math.min(estado.pagina * POR_PAGINA, estado.total);
    el.resumen.replaceChildren(
      crear('strong', '', numero(desde) + '–' + numero(hasta)),
      ' de ' + numero(estado.total) + ' libros · página ' + estado.pagina +
        ' de ' + numero(estado.paginas) + ' · «' + estado.consulta + '»'
    );
  }

  /* Pide la página actual y la pinta. Cada llamada incrementa `turno`:
     si una respuesta vieja llega tarde, se descarta y no pisa la nueva. */
  async function cargar() {
    const turno = ++estado.turno;
    estado.cargando = true;
    estado.error = false;
    el.avisos.replaceChildren();
    el.paginacion.hidden = true;
    el.paginacion.replaceChildren();
    pintarCarga();
    pintarResumen();

    try {
      const resultado = await buscarLibros(estado.consulta, estado.pagina);
      if (turno !== estado.turno) { return; }
      estado.total = resultado.total;
      estado.paginas = Math.max(1, Math.ceil(resultado.total / POR_PAGINA));
      el.celdas.replaceChildren();

      if (resultado.libros.length === 0) {
        pintarVacio(estado.consulta);
      } else {
        el.celdas.append(...resultado.libros.map(pintarTarjeta));
        pintarPaginacion(estado.pagina, estado.paginas);
      }
    } catch (error) {
      if (turno !== estado.turno) { return; }
      estado.error = true;
      el.celdas.replaceChildren();
      pintarError(error);
    } finally {
      if (turno === estado.turno) {
        estado.cargando = false;
        pintarResumen();
        pintarCache();
      }
    }
  }

  function irA(pagina) {
    estado.pagina = pagina;
    cargar();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------- 7. Ficha ---------- */

  function abrirModal() { el.modal.classList.add('is-active'); }
  function cerrarModal() { el.modal.classList.remove('is-active'); }

  /**
   * Pinta la ficha completa.
   * @param {object} libro    respuesta de /works/{id}.json
   * @param {object} resumen  datos que ya tenía la tarjeta (autor, año, ediciones)
   */
  function pintarFicha(libro, resumen) {
    el.modalTitulo.textContent = 'Ficha del libro';
    const titulo = libro.title || 'Sin título';
    const autor = resumen.author_name ? resumen.author_name[0] : 'Autor desconocido';
    const anio = libro.first_publish_date || resumen.first_publish_year;

    const datos =
      (anio ? '<dt>Primera publicación</dt><dd>' + esc(anio) + '</dd>' : '') +
      (resumen.edition_count ? '<dt>Ediciones</dt><dd>' + numero(resumen.edition_count) + '</dd>' : '') +
      '<dt>Identificador</dt><dd>' + esc(libro.key || '—') + '</dd>';

    let temas = '';
    if (libro.subjects && libro.subjects.length > 0) {
      /* La API repite algunos temas: se quitan los duplicados. */
      temas = '<div class="ficha-temas">' +
        Array.from(new Set(libro.subjects)).slice(0, 8).map(function (tema) {
          return '<span class="etiqueta">' + esc(tema) + '</span>';
        }).join('') +
      '</div>';
    }

    const descripcion = descripcionDe(libro);
    const bloque = descripcion
      ? '<div class="ficha-descripcion"><p>' + esc(descripcion) + '</p></div>'
      : '';

    el.modalCuerpo.innerHTML =
      '<div class="ficha">' +
        '<div class="ficha-portada">' + portadaHTML(libro.covers && libro.covers[0], 'L', titulo) + '</div>' +
        '<div class="ficha-texto">' +
          '<h2>' + esc(titulo) + '</h2>' +
          '<p class="ficha-autor">' + esc(autor) + '</p>' +
          '<dl class="ficha-datos">' + datos + '</dl>' + temas + bloque +
        '</div>' +
      '</div>';
  }

  async function abrirFicha(resumen) {
    abrirModal();
    el.modalTitulo.textContent = 'Cargando ficha…';
    el.modalCuerpo.innerHTML = '<p class="p-6 is-size-7">Pidiendo la ficha a Open Library…</p>';

    try {
      pintarFicha(await obtenerLibro(resumen.key), resumen);
    } catch (error) {
      el.modalCuerpo.innerHTML =
        '<div class="notification is-danger m-5">' +
          '<p class="has-text-weight-semibold">No se pudo cargar la ficha</p>' +
          '<p class="is-size-7 mt-1">Inténtalo de nuevo en unos segundos.</p>' +
        '</div>';
    } finally {
      pintarCache();
    }
  }

  /* ---------- 8. Eventos ---------- */

  /* Una imagen rota se cambia por «Sin portada» en tarjetas y ficha.
     `error` no burbujea, por eso se escucha en fase de captura. */
  document.addEventListener('error', function (evento) {
    const img = evento.target;
    if (img instanceof HTMLImageElement && img.parentElement.matches('.portada, .ficha-portada')) {
      img.parentElement.replaceChildren(crear('span', 'sin-portada', 'Sin portada'));
    }
  }, true);

  let temporizador;

  /** Lanza una búsqueda nueva desde la página 1. */
  function buscar(consulta) {
    estado.consulta = consulta.trim() || 'dune';
    estado.pagina = 1;
    cargar();
  }

  /* Retardo de 400 ms para no pedir a la API en cada tecla. */
  el.buscador.addEventListener('input', function (evento) {
    window.clearTimeout(temporizador);
    temporizador = window.setTimeout(function () {
      const consulta = evento.target.value.trim() || 'dune';
      if (consulta !== estado.consulta) { buscar(consulta); }
    }, 400);
  });

  /* Sugerencias rápidas. */
  el.sugerencias.addEventListener('click', function (evento) {
    const boton = evento.target.closest('button[data-q]');
    if (!boton) { return; }
    el.buscador.value = boton.dataset.q;
    buscar(boton.dataset.q);
  });

  /* Un solo listener resuelve Anterior, Siguiente y los números. */
  el.paginacion.addEventListener('click', function (evento) {
    const enlace = evento.target.closest('[data-ir]');
    if (enlace) { irA(Number(enlace.dataset.ir)); }
  });

  /* Cerrar la ficha con la X o con el fondo oscuro. */
  el.modal.addEventListener('click', function (evento) {
    if (evento.target.closest('[data-cerrar]')) { cerrarModal(); }
  });

  document.addEventListener('keydown', function (evento) {
    if (evento.key === 'Escape') { cerrarModal(); }
  });

  /* ---------- 9. Arranque ---------- */
  cargar();
})();
