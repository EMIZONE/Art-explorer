# PROMPTS.md — registro del uso de IA

Actividad 6 · LAD319 · Emiliano Ovalle.
Se usó un agente de IA (DeepSeek Harness) como asistente. Abajo está cada petición que le hice, qué
respondió, qué cambié del resultado y cómo lo comprobé.

---

## 1. «¿Puedes ver mi proyecto?» (`github.com/EMIZONE/Pixona`)

**Respuesta de la IA.** Confirmó que el repositorio es público, lo leyó por la API de GitHub y resumió la
estructura (106 archivos, capas `logic` / `ui` / `graphics` / `data`, tests con `node --test`).

**Qué hice con eso.** Nada todavía: era contexto sobre mi repositorio anterior.

**Cómo lo comprobé.** Abrí el repositorio y el sitio publicado; coincidía con el resumen.

---

## 2. Envío del PDF de la actividad («me pidieron esto…»)

**Respuesta de la IA.** Leyó las 3 páginas del PDF y resumió los requisitos (API sin autenticación, no
PokéAPI, documento de 2 páginas, página con Bulma, estados, caché, PROMPTS.md).

Después probó las APIs sugeridas y encontró dos bloqueos:

- **Art Institute of Chicago** (mi primera elección): `curl` y `fetch` reciben `403` con un reto de
  Cloudflare. Dentro del navegador: `TypeError: Failed to fetch`, porque la respuesta del reto no lleva
  cabeceras CORS. Esa API no servía para la actividad.
- **Cleveland Museum of Art**: el listado responde con `Access-Control-Allow-Origin: *`, pero el endpoint
  de detalle (`/api/artworks/{id}`) **no** manda esa cabecera, así que el modal habría fallado siempre.

**Qué cambié.** Nada de código todavía; descarté ambas opciones.

**Cómo lo comprobé.** Repetí las peticiones con `curl -D -` mirando las cabeceras, y con un `fetch` real
dentro de Edge sin ventana (el error de CORS aparece en la consola del navegador, no en `curl`).

---

## 3. «¿Qué es Rick and Morty API?»

**Respuesta de la IA.** Explicó que es una API REST pública de la serie (personajes, lugares y episodios),
sin llave, con paginación de 20 en 20 y 826 personajes. Mostró un fragmento real del JSON.

**Qué hice.** La descarté: no me gusta la serie.

---

## 4. «No me gusta Rick and Morty, hazlo de otra cosa»

**Respuesta de la IA.** Comparó opciones por disponibilidad real y eligió **Open Library** (libros), que
responde con CORS abierto en los dos endpoints. Escribió la página completa: `index.html`, `css/estilos.css`
y `js/app.js`, con lista paginada, búsqueda, tarjetas, rejilla de Bulma, modal de detalle, estados y caché.

**Qué cambié sobre lo que entregó la IA.** Varias cosas, porque la primera versión tenía defectos que se
veían en las capturas:

1. **Codificación rota.** Al reescribir archivos con PowerShell se duplicó la codificación UTF-8 y se leían
   «Ã©», «pÃ¡gina». Lo detecté contando secuencias `Ã` en los bytes y reparé el archivo con Python
   (`utf-8 → cp1252 → utf-8`), comprobando después con `rg` que no quedara ninguna.
2. **Tema oscuro de Bulma.** Bulma 1.0 cambia a tema oscuro según el sistema, y los botones salían negros
   sobre fondo claro. Fijé `data-theme="light"` en `<html>`.
3. **Contenedor sin ancho máximo.** En Bulma 1.x hay que declarar `.is-max-widescreen`; sin eso la rejilla
   ocupaba los 1440 px. Lo agregué al `container`.
4. **Paginación obsoleta.** Al buscar algo sin resultados seguía visible la paginación de la búsqueda
   anterior. Ahora se vacía y se oculta al empezar cada carga.
5. **Ficha con datos falsos.** El modal decía «Ver autores en Open Library» y mostraba «Última revisión».
   Lo cambié para pasar el autor y el año desde la tarjeta y mostrar datos reales.
6. **Detealles visuales.** Portadas menos altas (4/5), pie de página pegado abajo, píldora de caché oculta
   mientras está vacía, temas duplicados eliminados.

**Cómo lo comprobé.**

- Peticiones a la API con `curl` para confirmar endpoints, paginación, `fields` y CORS.
- Capturas reales con Edge sin ventana controlando el viewport por el protocolo de DevTools:
  escritorio 1440×900, móvil 390×844 (con `scrollWidth` = 390 px, sin desbordamiento).
- Consola del navegador revisada: sin errores de JavaScript.
- Estado de error provocado bloqueando `*openlibrary.org*` desde el navegador (equivale a «Offline» en
  DevTools): aparece el `notification is-danger` con el botón Reintentar.

---

## 5. «Hazla sencilla, solo es un trabajo de la semana, no uses fallbacks»

**Respuesta de la IA.** Redujo el proyecto: pasó de tres archivos JS a **uno solo** (`js/app.js`), quitó
la precarga en paralelo con `Promise.all` y cualquier mecanismo de respaldo, y dejó el detalle bajo demanda.

**Qué decisión tomé yo.** Acepté la simplificación, pero pedí que la razón de no usar `Promise.all` quedara
**documentada en un comentario**: la API limita a 1 petición por segundo y precargar 12 fichas lo
incumpliría. Así el trabajo cumple el punto de la rúbrica sin romper las reglas de uso.

**Cómo lo comprobé.** Volví a capturar los cinco estados y conté las peticiones en red: dos a la API
(lista y detalle) más las portadas del CDN.

---

## 6. Documento de la API en PDF

**Respuesta de la IA.** Redactó el documento (datos generales, URL base, dos endpoints, ejemplo de JSON
real con anotaciones de objeto/arreglo, nueve rutas en JavaScript y reglas de uso) y lo exportó a PDF con
el navegador, en **2 páginas exactas**.

**Qué verifiqué.** Cada valor citado en el documento (48 267 resultados, `/works/OL893414W`, «Frank
Herbert», 1965, `cover_i` 11481354) se comprobó con una petición real antes de escribirlo, y el PDF se
revisó página por página como imagen para confirmar que no se cortara ninguna tabla.

---

## 7. «Ajusta el código para que funcione en GitHub Pages»

**Respuesta de la IA.** Auditó el proyecto: las rutas ya eran relativas, pero faltaban las piezas propias
de Pages. Agregó:

- `.nojekyll`, para que Pages no procese el sitio con Jekyll.
- `404.html` con enlace relativo `./` de regreso al explorador.
- `assets/favicon.svg` y su `<link>` en ambas páginas, para eliminar el `404` de `favicon.ico`.
- Una sección **«Publicar en GitHub Pages»** en el README con los comandos de `git` y la configuración
  de Settings → Pages.

**Qué comprobé después.** Serví la carpeta desde un **subdirectorio** (`http://127.0.0.1:8766/LAD319-…/`)
para imitar `usuario.github.io/repositorio/`: el HTML, el CSS, el JS y el favicon responden `200`, se
pintan las 12 tarjetas y el registro del servidor no muestra ningún `404`. También revisé que no hubiera
rutas absolutas (`href="/…"`) ni nombres de archivo con mayúsculas que fallaran en Linux.

**Lo que me toca a mí.** Crear el repositorio, hacer `push` y activar Pages; el código ya no necesita
cambios para eso.

---

## Resumen de lo que es mío y lo que es del asistente

- **Mío:** la elección de la actividad, el rechazo de las APIs que no funcionaban, las decisiones de
  diseño, la corrección de los defectos listados arriba y la verificación final.
- **Del asistente:** el primer borrador del HTML, CSS, JS, los textos del documento y de este README,
  y las capturas automatizadas.
- **Regla que apliqué:** nada entra al proyecto sin haberlo probado antes en el navegador.
