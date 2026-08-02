# Pedido a Cloud Design · cierre del Brand Book v5

> **Fecha:** 2026-08-02 · **Origen:** SDD-0238 (centro de marca `/marca`)
> **Estado:** entrega v5.0 recibida y revisada — faltan 4 cosas
> **Contexto técnico:** [`docs/specs/0238-marca-brand-book-publico/spec.md`](../../specs/0238-marca-brand-book-publico/spec.md)

Este archivo es el **pedido**, no la entrega. Lo que llegue entra por NORTE-SYNC
a `_norte/` como siempre.

## Qué se revisó

`DTD-Cargo-handoff (5).zip` (1.017 MB, proyecto completo). Verificado archivo por
archivo: codificación, referencias externas y cobertura contra las 8 secciones del
catálogo.

| Verificación | Resultado |
|---|---|
| Codificación de los 3 HTML | ✅ UTF-8 sin BOM, sin mojibake |
| `Brand Book DTD v5.0 · OFFLINE.html` | ✅ 26,94 MB, 0 referencias externas |
| `ERP Studio Brand Book.html` | ✅ 8,89 MB, 0 referencias externas |
| `Manual de Producción · DTD-Cargo.html` | ❌ **60 referencias relativas** |
| Logos | ✅ 4 isólogos en SVG + PNG + PDF vectorial |
| Iconografía | ✅ 15 íconos de perfil + ~27 SVG de motivos |
| Fotografía | ✅ 35 fotos editoriales clasificadas |
| Plantillas | ❌ sólo renders de referencia |
| Fondos y portadas | ❌ 1 portada FB + 2 fondos Trello |
| Fuentes | ⚠️ embebidas en los HTML, no como archivos |

---

## El prompt (copiar desde acá)

---

Hola. Recibimos el paquete v5.0 completo y lo revisamos archivo por archivo. Está
muy bien: los SVG de los isólogos, el set de iconografía y el banco de 35 fotos son
exactamente lo que necesitábamos, y la codificación llegó limpia. Quedan **cuatro
cosas** y con eso cerramos.

**Dónde va todo esto**, porque cambia lo que necesitamos: construimos
`dtdcargo.com/marca`, un centro de marca protegido con un código de acceso que le
pasamos a diseño externo, agencias o freelancers. Entran, leen el book, **marcan lo
que necesitan y se lo llevan en un solo .zip**. Se administra desde nuestro ERP —
subimos un archivo y aparece en la web al instante, sin programar. Ya está corriendo.

### 1. El Manual de Producción no se puede abrir ⚠️ (esto es lo que nos bloquea)

De los tres HTML es el único **sin build autocontenido**: tiene 60 referencias a
archivos vecinos, así que adentro de nuestro visor abre sin una sola imagen. Y según
su propio LÉEME es el documento para el diseñador externo y la imprenta — o sea, el
más importante de los tres justo para este canal.

Necesitamos **`Manual de Producción · DTD-Cargo · OFFLINE.html`**, con todo embebido,
igual que hicieron con el Brand Book.

### 2. Saquen el jszip de unpkg

Los dos books inyectan `unpkg.com/jszip@3.10.1` para un botón de descarga propio.
Nuestra política de seguridad no permite scripts de terceros, así que ese botón no
va a hacer nada — y falla en silencio, que es peor que no estar. Es redundante:
la descarga ya la resuelve `/marca`. Lo más limpio es quitarlo; si lo quieren dejar,
hay que embeber la librería en el archivo.

### 3. ¿Cuál de los tres es el maestro?

La sección "Brand Book" del catálogo acepta varios archivos y los tres van a convivir
ahí, descargables. Pero **uno solo se abre a pantalla completa** cuando alguien entra
a leer. Nuestra apuesta es *Brand Book DTD v5.0*. Confírmenlo o corríjanlo.

### 4. Dos secciones siguen vacías

- **Plantillas.** El LÉEME dice que los renders son de referencia y que los editables
  no existen. Necesitamos las piezas editables (Figma / AI / Canva) **+ un PNG o PDF
  de cada una** para que se vea la miniatura. Si no las van a producir, díganlo y
  quitamos la sección en vez de dejarla vacía.
- **Fondos y portadas.** Llegó una portada de Facebook y dos fondos de Trello. Falta
  el set por red **en sus medidas exactas**, con el nombre de la red en el archivo:
  `portada-instagram-1080x1080.png`.

Una consulta aparte sobre **tipografía**: las cinco fuentes vienen embebidas dentro
de los HTML, no como archivos sueltos. Si tenemos licencia para redistribuirlas,
mándenlas en `.woff2` / `.otf` y las ponemos descargables. Si no, dígannoslo y
dejamos sólo la referencia a Google Fonts.

### Y una corrección al índice del v5.0

**§P1 "Brand Hub · portal central" y §13 "Aplicación web" ya existen — están en
producción.** Es `dtdcargo.com/marca`: código de acceso, buscador, selección múltiple
y descargas por sección, más su administración en el ERP. **Documenten lo que está
corriendo, no propongan otro.** Les pasamos el link y el código para que lo vean
funcionando. Si al verlo creen que debería ser distinto, dígannoslo como propuesta
separada y lo evaluamos — pero que el book no describa un hub que no es el que está
en el aire.

### Cómo entregarlo

- **Archivos sueltos por carpeta**, no un ZIP monolítico. El de 1 GB traía el proyecto
  entero; para esto alcanza con lo nuevo.
- **Nombres kebab-case, sin acentos ni espacios:** `isologo-reverse.svg`.
- **Con cada archivo, tres datos** en un .txt o una hoja de cálculo:
  1. **Nombre visible** — "Isólogo Reverse", no `logo_final_v3_OK.png`.
  2. **Detalle en una línea** — "Fondos oscuros · navy, sidebar".
  3. **Sobre qué fondo se ve** — `claro`, `oscuro` o `transparencia`. Este es el que
     más importa: la miniatura se pinta sobre ese fondo, y un logo blanco marcado
     como "claro" se ve como un recuadro vacío. Ya nos pasó.

  Las **dimensiones y el peso no los manden** — se leen solos al subir.
- **Tope 200 MB por archivo.** Formatos que acepta el sistema: PNG, JPG, WEBP, SVG,
  GIF, PSD, PDF, AI/EPS, ZIP, TTF/OTF/WOFF/WOFF2, HTML, TXT, CSV y **MP4**.
  ⚠️ Video **sólo MP4** — `.mov` lo rechaza. Los `.fig` y `.sketch` entran bien.
- **Todo en UTF-8.**

### Reglas que no cambian

1. Sólo colores de la paleta — cero hex inventados.
2. **Tipografía, según la capa:**
   - **Web pública** (dtdcargo.com y `/marca`): Archivo, Archivo Black,
     JetBrains Mono, Noto Sans SC.
   - **ERP Studio**: **Nunito Sans + Sora** desde BD-035. Si el *ERP Studio Brand
     Book* documenta tipografía, es ésta — no la de la web.
3. Cero AI slop: nada de gradientes coloridos, glassmorphism ni emojis decorativos.
   (Glass y glow tonal tienen excepción documentada, BD-030/031.)
4. Todo texto tiene que leerse: contraste AA (4.5:1 normal, 3:1 en texto grande).

### Si algo de esto no se puede

Díganlo en la entrega en vez de resolverlo por su cuenta. Es más fácil ajustar el
sistema que descubrir tres semanas después que un archivo entró mal clasificado.

---

## Notas internas (no van en el prompt)

- El límite de MIME sale de `0334_brand_catalog_public_gate.sql`. Si necesitan `.mov`
  o `.tiff`, hay que ampliar `allowed_mime_types` del bucket con una migración nueva.
- El campo del fondo es `brand_assets.tile` (`auto | light | dark | checker`, migr
  `0335`). `auto` conserva la heurística vieja por nombre de archivo — que es
  exactamente lo que falló y por lo que se le pide el dato a Cloud Design.
- Las secciones son datos, no código (`brand_sections`): si la entrega trae una
  categoría nueva ("Papelería"), se crea sin desplegar.
- **Decisión pendiente del founder:** el Brand Book OFFLINE pesa 26,94 MB y el ERP
  8,89 MB. Sumados a los 13,53 MB del v4.6 que ya están versionados, meterlos en git
  son ~36 MB permanentes por versión (`.git` ya va en 172 MB). La alternativa es
  servirlos desde el bucket `brand-assets` y cambiar `app/marca/asset/[name]/route.ts`
  de `fs.readFile` a Storage — misma URL, mismos headers, misma CSP, mismo iframe —
  y quitar `./private/marca/**` de `outputFileTracingIncludes`.
- Al llegar el v5: borrar `private/marca/brand-book-v4.6.html` y actualizar **las dos
  constantes** de [`lib/marca/brand-book.ts`](../../../lib/marca/brand-book.ts).
- ⚠️ Extraer cualquier ZIP **fuera del árbol del repo** (los ZIP adentro ya causaron
  drift de marca).
