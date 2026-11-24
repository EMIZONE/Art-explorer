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
    if (cache.has(url)) {
      return cache.get(url);
    }

    const promesa = fetch(url)
      .then(function (respuesta) {
        if (!respuesta.ok) {
          throw new Error('La API respondió ' + respuesta.status);
        }
        return respuesta.json();
      });

    cache.set(url, promesa);
    promesa.catch(function () { cache.delete(url); }); // un fallo no se cachea

    return promesa;
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
      page: String(pagina),
      limit: String(POR_PAGINA),
      fields: CAMPOS,
    });

    const json = await pedirJson(API + '/search.json?' + parametros.toString());
    return {
      total: Number(json.numFound) || 0,
      libros: Array.isArray(json.docs) ? json.docs : [],
    };
  }

  /**
   * Ficha completa de un libro.
   * @param {string} clave  por ejemplo "/works/OL45804W"
   * @returns {Promise<object>}
   */
  function obtenerLibro(clave) {
    return pedirJson(API + clave + '.json');
  }

  /* ---------- 3. Utilidades de DOM ---------- */

  function crear(etiqueta, clase, texto) {
    const nodo = document.createElement(etiqueta);
    if (clase) { nodo.className = clase; }
    if (texto !== undefined) { nodo.textContent = texto; }
    return nodo;
  }

  function vaciar(nodo) {
    while (nodo.firstChild) { nodo.removeChild(nodo.firstChild); }
  }

  function numero(valor) {
    return new Intl.NumberFormat('es-MX').format(valor);
  }

  /* La descripción del detalle puede ser texto o { value: texto } */
  function descripcionDe(libro) {
    if (!libro.description) { return ''; }
    return typeof libro.description === 'string'
      ? libro.description
      : libro.description.value || '';
  }

  /* ---------- 4. Render ---------- */

  const el = {
    buscador: document.getElementById('buscador'),
    sugerencias: document.getElementById('sugerencias'),
    resumen: document.getElementById('resumen'),
    cache: document.getElementById('cache-info'),
    avisos: document.getElementById('estado'),
    celdas: document.getElementById('celdas'),
    paginacion: document.getElementById('paginacion'),
    modal: document.getElementById('modal'),
    modalTitulo: document.getElementById('modal-titulo'),
    modalCuerpo: document.getElementById('modal-cuerpo'),
  };

  function pintarCache() {
    const total = cache.size;
    el.cache.textContent = 'caché: ' + numero(total) + (total === 1 ? ' respuesta' : ' respuestas');
  }

  /** Esqueletos mientras llega la respuesta. */
  function pintarCarga() {
    vaciar(el.celdas);
    for (let i = 0; i < POR_PAGINA; i += 1) {
      const celda = crear('div', 'cell');
      const caja = crear('div', 'esqueleto');
      caja.appendChild(crear('div', 'bloque bloque-portada'));
      caja.appendChild(crear('div', 'bloque bloque-linea'));
      caja.appendChild(crear('div', 'bloque bloque-linea corta'));
      celda.appendChild(caja);
      el.celdas.appendChild(celda);
    }
  }

  /** Tarjeta de un libro: portada, título, autor, año y ediciones. */
  function pintarTarjeta(libro) {
    const celda = crear('div', 'cell');
    const tarjeta = crear('article', 'tarjeta');

    /* Portada */
    const portada = crear('figure', 'portada');
    if (libro.cover_i) {
      const img = crear('img');
      img.src = PORTADAS + '/' + libro.cover_i + '-M.jpg';
      img.alt = 'Portada de ' + (libro.title || 'libro');
      img.loading = 'lazy';
      img.addEventListener('error', function () {
        vaciar(portada);
        portada.appendChild(crear('span', 'sin-portada', 'Sin portada'));
      });
      portada.appendChild(img);
    } else {
      portada.appendChild(crear('span', 'sin-portada', 'Sin portada'));
    }
    tarjeta.appendChild(portada);

    /* Datos */
    const cuerpo = crear('div', 'cuerpo');
    cuerpo.appendChild(crear('h3', 'titulo', libro.title || 'Sin título'));
    cuerpo.appendChild(
      crear('p', 'autor', libro.author_name ? libro.author_name[0] : 'Autor desconocido')
    );

    const etiquetas = crear('div', 'etiquetas');
    if (libro.first_publish_year) {
      etiquetas.appendChild(crear('span', 'etiqueta etiqueta-anio', String(libro.first_publish_year)));
    }
    if (libro.edition_count) {
      etiquetas.appendChild(crear('span', 'etiqueta', numero(libro.edition_count) + ' ediciones'));
    }
    cuerpo.appendChild(etiquetas);

    const boton = crear('button', 'button ver', 'Ver ficha');
    boton.type = 'button';
    boton.appendChild(crear('span', '', '→'));
    /* Se pasa el libro de la lista para tener autor y año a mano:
       la ficha de detalle no repite esos datos. */
    boton.addEventListener('click', function () { abrirFicha(libro); });
    cuerpo.appendChild(boton);

    tarjeta.appendChild(cuerpo);
    celda.appendChild(tarjeta);
    return celda;
  }

  /** Paginación de Bulma con ventana de 5 páginas. */
  function pintarPaginacion(pagina, paginas) {
    vaciar(el.paginacion);
    el.paginacion.hidden = paginas <= 1;
    if (paginas <= 1) { return; }

    const anterior = crear('a', 'pagination-previous', 'Anterior');
    const siguiente = crear('a', 'pagination-next', 'Siguiente');

    if (pagina > 1) {
      anterior.addEventListener('click', function () { irA(pagina - 1); });
    } else {
      anterior.classList.add('is-disabled');
    }
    if (pagina < paginas) {
      siguiente.addEventListener('click', function () { irA(pagina + 1); });
    } else {
      siguiente.classList.add('is-disabled');
    }

    el.paginacion.appendChild(anterior);
    el.paginacion.appendChild(siguiente);

    const lista = crear('ul', 'pagination-list');
    const desde = Math.max(1, pagina - 2);
    const hasta = Math.min(paginas, pagina + 2);

    for (let n = desde; n <= hasta; n += 1) {
      const li = crear('li');
      const enlace = crear('a', 'pagination-link', String(n));
      if (n === pagina) {
        enlace.classList.add('is-current');
        enlace.setAttribute('aria-current', 'page');
      } else {
        enlace.addEventListener('click', function () { irA(n); });
      }
      li.appendChild(enlace);
      lista.appendChild(li);
    }

    el.paginacion.appendChild(lista);
  }

  /** Mensaje de error con `notification` de Bulma y botón de reintento. */
  function pintarError(error) {
    vaciar(el.avisos);
    const caja = crear('div', 'notification is-danger');
    caja.appendChild(crear('p', 'has-text-weight-semibold', 'No se pudo cargar la lista'));
    caja.appendChild(
      crear('p', 'is-size-7 mt-1', 'Revisa tu conexión e inténtalo de nuevo.' +
        (error && error.message ? ' (' + error.message + ')' : ''))
    );

    const boton = crear('button', 'button is-danger is-light is-small mt-4', 'Reintentar');
    boton.type = 'button';
    boton.addEventListener('click', function () { cargar(); });
    caja.appendChild(boton);

    el.avisos.appendChild(caja);
  }

  /** Sin resultados. */
  function pintarVacio(consulta) {
    vaciar(el.avisos);
    const caja = crear('div', 'notification is-warning is-light');
    caja.appendChild(crear('p', 'has-text-weight-semibold', 'Sin resultados'));
    caja.appendChild(
      crear('p', 'is-size-7 mt-1', 'No hay libros para «' + consulta + '». Prueba con otra palabra.')
    );
    el.avisos.appendChild(caja);
  }

  /* ---------- 5. Estado y flujo ---------- */

  const estado = { pagina: 1, consulta: 'dune', total: 0, paginas: 1, cargando: false, error: false };

  function pintarResumen() {
    if (estado.cargando) {
      el.resumen.textContent = 'Consultando Open Library…';
      return;
    }
    if (estado.error) {
      el.resumen.textContent = 'No se pudo cargar la lista · «' + estado.consulta + '»';
      return;
    }
    if (estado.total === 0) {
      el.resumen.textContent = 'Sin resultados · «' + estado.consulta + '»';
      return;
    }
    const desde = (estado.pagina - 1) * POR_PAGINA + 1;
    const hasta = Math.min(estado.pagina * POR_PAGINA, estado.total);
    el.resumen.innerHTML =
      '<strong>' + numero(desde) + '–' + numero(hasta) + '</strong> de ' +
      numero(estado.total) + ' libros · página ' + estado.pagina + ' de ' + numero(estado.paginas) +
      (estado.consulta ? ' · «' + estado.consulta + '»' : '');
  }

  async function cargar() {
    if (estado.cargando) { return; }
    estado.cargando = true;
    estado.error = false;
    UI_limpiarAvisos();
    vaciar(el.paginacion);
    el.paginacion.hidden = true;
    pintarCarga();
    pintarResumen();

    try {
      const resultado = await buscarLibros(estado.consulta, estado.pagina);
      estado.total = resultado.total;
      estado.paginas = Math.max(1, Math.ceil(resultado.total / POR_PAGINA));

      if (resultado.libros.length === 0) {
        vaciar(el.celdas);
        pintarVacio(estado.consulta);
      } else {
        vaciar(el.celdas);
        resultado.libros.forEach(function (libro) {
          el.celdas.appendChild(pintarTarjeta(libro));
        });
        pintarPaginacion(estado.pagina, estado.paginas);
      }
    } catch (error) {
      estado.error = true;
      vaciar(el.celdas);
      pintarError(error);
    } finally {
      estado.cargando = false;
      pintarResumen();
      pintarCache();
    }
  }

  function UI_limpiarAvisos() {
    vaciar(el.avisos);
  }

  function irA(pagina) {
    estado.pagina = pagina;
    cargar();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------- 6. Ficha ---------- */

  function abrirModal() {
    el.modal.classList.add('is-active');
  }

  function cerrarModal() {
    el.modal.classList.remove('is-active');
  }

  /**
   * Pinta la ficha completa.
   * @param {object} libro     respuesta de /works/{id}.json
   * @param {object} resumen   datos que ya tenía la tarjeta (autor, año, ediciones)
   */
  function pintarFicha(libro, resumen) {
    vaciar(el.modalCuerpo);
    el.modalTitulo.textContent = 'Ficha del libro';

    const ficha = crear('div', 'ficha');

    /* Portada grande */
    const columna = crear('div', 'ficha-portada');
    if (libro.covers && libro.covers.length > 0) {
      const img = crear('img');
      img.src = PORTADAS + '/' + libro.covers[0] + '-L.jpg';
      img.alt = 'Portada de ' + (libro.title || 'libro');
      columna.appendChild(img);
    } else {
      columna.appendChild(crear('span', 'sin-portada', 'Sin portada'));
    }
    ficha.appendChild(columna);

    /* Datos */
    const texto = crear('div', 'ficha-texto');
    texto.appendChild(crear('h2', '', libro.title || 'Sin título'));
    texto.appendChild(
      crear('p', 'ficha-autor', resumen.author_name ? resumen.author_name[0] : 'Autor desconocido')
    );

    const datos = crear('dl', 'ficha-datos');
    const anio = libro.first_publish_date || resumen.first_publish_year;
    if (anio) {
      datos.appendChild(crear('dt', '', 'Primera publicación'));
      datos.appendChild(crear('dd', '', String(anio)));
    }
    if (resumen.edition_count) {
      datos.appendChild(crear('dt', '', 'Ediciones'));
      datos.appendChild(crear('dd', '', numero(resumen.edition_count)));
    }
    datos.appendChild(crear('dt', '', 'Identificador'));
    datos.appendChild(crear('dd', '', libro.key || '—'));
    texto.appendChild(datos);

    if (libro.subjects && libro.subjects.length > 0) {
      const temas = crear('div', 'ficha-temas');
      /* La API repite algunos temas: se quitan los duplicados. */
      Array.from(new Set(libro.subjects)).slice(0, 8).forEach(function (tema) {
        temas.appendChild(crear('span', 'etiqueta', tema));
      });
      texto.appendChild(temas);
    }

    const descripcion = descripcionDe(libro);
    if (descripcion) {
      const bloque = crear('div', 'ficha-descripcion');
      bloque.appendChild(crear('p', '', descripcion));
      texto.appendChild(bloque);
    }

    ficha.appendChild(texto);
    el.modalCuerpo.appendChild(ficha);
  }

  async function abrirFicha(resumen) {
    abrirModal();
    vaciar(el.modalCuerpo);
    el.modalTitulo.textContent = 'Cargando ficha…';
    el.modalCuerpo.appendChild(crear('p', 'p-6 is-size-7', 'Pidiendo la ficha a Open Library…'));

    try {
      const libro = await obtenerLibro(resumen.key);
      pintarFicha(libro, resumen);
    } catch (error) {
      vaciar(el.modalCuerpo);
      const caja = crear('div', 'notification is-danger m-5');
      caja.appendChild(crear('p', 'has-text-weight-semibold', 'No se pudo cargar la ficha'));
      caja.appendChild(crear('p', 'is-size-7 mt-1', 'Inténtalo de nuevo en unos segundos.'));
      el.modalCuerpo.appendChild(caja);
    } finally {
      pintarCache();
    }
  }

  /* ---------- 7. Eventos ---------- */

  let temporizador;

  /* Búsqueda con retardo (400 ms) para no pedir en cada tecla. */
  el.buscador.addEventListener('input', function (evento) {
    const consulta = evento.target.value.trim() || 'dune';
    window.clearTimeout(temporizador);
    temporizador = window.setTimeout(function () {
      if (consulta === estado.consulta) { return; }
      estado.consulta = consulta;
      estado.pagina = 1;
      cargar();
    }, 400);
  });

  /* Sugerencias rápidas */
  el.sugerencias.addEventListener('click', function (evento) {
    const boton = evento.target.closest('button[data-q]');
    if (!boton) { return; }
    el.buscador.value = boton.dataset.q;
    estado.consulta = boton.dataset.q;
    estado.pagina = 1;
    cargar();
  });

  /* Cerrar la ficha */
  el.modal.addEventListener('click', function (evento) {
    if (evento.target.closest('[data-cerrar]')) { cerrarModal(); }
  });

  document.addEventListener('keydown', function (evento) {
    if (evento.key === 'Escape') { cerrarModal(); }
  });

  /* ---------- 8. Arranque ---------- */
  cargar();
})();

