# Cloud Design · 2026-08-11 · `isotipo/` y Favicon Pack — **cerrado, falsos positivos**

> **Origen:** SDD-0238 (centro de marca `/marca`)
> **Veredicto:** los dos hallazgos eran **falsos positivos de nuestro extractor**.
> Cloud Design no cambió nada y no hacía falta. **No hay pedido pendiente.**

Este archivo existe para que **nadie los vuelva a levantar**. Si se corre otra
vez una auditoría de referencias sobre el sistema de marca, estos dos van a
volver a aparecer: acá está por qué no son bugs.

## Cómo se llegó acá

El 2026-08-11 se auditó el sistema navegable bajando los 35 documentos
publicados desde Storage y extrayéndoles cada referencia (`src`, `href`,
`url()`, `srcset`). Salieron **tres** clases de hallazgo:

| Hallazgo | Veredicto |
|---|---|
| 14 documentos cargan librerías de CDN que la CSP bloqueaba | ✅ **real** — arreglado, ver abajo |
| `Piezas 3D` → 3 enlaces muertos a `isotipo/` | ❌ falso positivo |
| `Favicon Pack` → 5 rutas absolutas | ❌ falso positivo |

Se redactó un pedido a Cloud Design por los dos últimos. **Ese pedido se
descartó sin enviarse**: su respuesta explicó el mecanismo y se verificó contra
el documento publicado. Tenían razón en ambos.

---

## 1 · `isotipo/` se crea dentro del ZIP, no es un entregable

Las tres rutas viven **dentro del bloque `<script>`**, como literales de string
de `buildIndexHTML()` — la función que genera el `_ABRIR AQUÍ · Aviso
DTD-Cargo.html` que viaja adentro del ZIP. Ese HTML resuelve contra las carpetas
hermanas del ZIP descomprimido, no contra el bucket.

Verificado sobre `piezas-3d-aviso-de-fachada-dtd-cargo-b7b2b21d.html` tal como
está servido en producción:

| | Línea |
|---|---|
| `<script>` abre / cierra | **188** / **944** |
| `var isoF = root.folder('isotipo')` | 810 |
| `isoF.file('isotipo.stl', …)` · `isoF.file('isotipo.svg', …)` | 812 · 813 |
| Las refs detectadas (`<a href="isotipo/isotipo.stl">` …) | 830, 833-835, 879, 931 |

Todas adentro del script. **El `.stl` y el `.svg` no existen como archivo porque
son derivados, no fuentes:** `isoToSTL(thick, …)` extruye la silueta al canto que
el usuario elige en el panel y `isoToSVG()` la traza desde el PNG oficial. Un
`.stl` fijo en el bucket sería un canto congelado, desincronizado del aviso.

Lo único que este documento carga del bucket es `assets/dtdcargo-isologo-reverse.png`,
que es relativo y **está publicado**.

Mismo patrón para `plano · montaje acotado.png`: se genera al vuelo desde
`#plano-cv` y viaja en el ZIP; el guard `isoFiles.plano ?` es la señal.

**Ruta real al fabricante:** abrir el documento → botón de descarga del paquete →
descomprimir → `isotipo/` está adentro con el `.stl`, el `.svg`, el `.png` y un
`NOTA.txt` de taller.

## 2 · El Favicon Pack ya usa rutas relativas

Verificado sobre `favicon-pack/favicon-pack-dtd-cargo-b7f6dd3c.html` en producción:

- **Líneas 7-11** — los `<link>` reales, todos **relativos**: `favicon.ico`,
  `favicon-32.png`, `favicon-16.png`, `apple-touch-icon.png`, `site.webmanifest`.
- **Líneas 111-116** — las cinco rutas con barra inicial, dentro de un `<pre>` y
  con el markup escapado (`&lt;link` … `&gt;`). Es el **snippet de instalación
  para copiar y pegar en el sitio real**, donde la barra inicial es CORRECTA:
  los favicons de `dtdcargo.com` se sirven desde la raíz del dominio.

Pasarlas a relativas habría roto el snippet para su único uso.

**La firma del falso positivo:** eran exactamente cinco, y la página muestra
ocho previews. Cinco = los del snippet, no los del documento.

**Y los binarios sí subieron.** En `proyecto/favicon-pack/` están los nueve:
`favicon.ico` (6.232 B), `favicon-16` (737), `favicon-32` (1.847),
`favicon-48` (3.594), `apple-touch-icon` (21.274), `android-chrome-192` (23.546),
`maskable-512` (20.623), `site.webmanifest` (572) y el HTML. La página renderiza
completa.

---

## Lo que SÍ era real y se arregló

La CSP de `/marca/doc/*` sólo permitía `script-src 'self'`, y estos documentos
cargan sus librerías de CDN — `Piezas 3D` mismo necesita `opentype.js`, `earcut`,
`JSZip` e `imagetracer` (líneas 11-14) justo para armar ese ZIP. Sin ellas el
botón de descarga no hace nada.

Arreglado el 2026-08-11 nombrando `unpkg.com`, `cdn.jsdelivr.net` y
`cdnjs.cloudflare.com` sólo en el visor de documentos (`CDN_DOCUMENTOS` en
`next.config.ts`). Verificado en producción.

## Qué corregir en el extractor

Dos reglas, y las dos son del mismo tipo — **no todo lo que parece un atributo
lo es**:

1. **Ignorar el contenido de `<script>`.** Un `href="…"` dentro de un string de
   JS no es una referencia de esta página; puede ser markup que la página genera
   para otro contexto (acá, un ZIP).
2. **Ignorar `<pre>` y `<code>`, y el markup escapado.** `&lt;link … href="/x"&gt;`
   es documentación, no un enlace. El escapado sólo toca los angulares, así que
   el `href="/x"` queda literal y un regex ingenuo lo levanta igual.

Sin esas dos reglas, 8 de los 11 "archivos que no están en Storage" que reportó
la auditoría eran ruido.

Ver [[feedback_cero_referencias_rotas_no_media_la_csp]] en la memoria del
proyecto: el mismo día, el chequeo del subidor falló por lo contrario — no veía
referencias que sí importaban.
