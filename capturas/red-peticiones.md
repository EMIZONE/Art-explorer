# Registro de peticiones reales (equivale a la pestaña Red de DevTools)

Capturado con el navegador (Edge, protocolo de DevTools) al cargar la página y abrir la primera ficha.
Origen de los datos: `performance.getEntriesByType('resource')`, no es una captura inventada.

Fecha: 24 de noviembre de 2026 · Página: `http://127.0.0.1:8765/` · Consulta inicial: `dune`

| # | Tipo | Método | URL | Duración |
|---|------|--------|-----|----------|
| 1 | fetch | GET | `https://openlibrary.org/search.json?q=dune&page=1&limit=12&fields=key,title,author_name,first_publish_year,cover_i,edition_count` | 576 ms |
| 2–14 | img | GET | `https://covers.openlibrary.org/b/id/{cover_i}-M.jpg` (12 portadas) | 1–650 ms |
| 15 | fetch | GET | `https://openlibrary.org/works/OL893414W.json` (al pulsar «Ver ficha») | 104 ms |
| 16 | img | GET | `https://covers.openlibrary.org/b/id/11481354-L.jpg` (portada grande de la ficha) | 871 ms |

**Lectura del registro**

- Solo **dos peticiones a la API** por interacción: una para la lista y otra para la ficha (más las imágenes del CDN de portadas).
- La segunda visita a la misma página o a la misma ficha **no genera peticiones**: la respuesta está en el `Map` de caché.
- El tamaño en bytes aparece como `0` en el navegador porque el CDN de Open Library no envía `Timing-Allow-Origin`; el tamaño real se puede ver con `curl` (la imagen `-M` pesa ~26 KB).

**Cómo reproducirlo en DevTools**

1. Abre la página y abre DevTools con `F12` → pestaña **Network** (Red).
2. Filtra por `openlibrary` y recarga con `Ctrl+R`.
3. Pulsa **Ver ficha** en una tarjeta para ver la segunda petición.
4. Para la captura de pantalla de la entrega, haz clic derecho sobre la tabla → *Save all as HAR* o simplemente captura la ventana con `Win+Shift+S`.
