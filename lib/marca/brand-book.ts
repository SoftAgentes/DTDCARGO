/**
 * El Brand Book standalone vigente (SDD-0238).
 *
 * PUNTO ÚNICO DE ACTUALIZACIÓN. Cuando llega un book nuevo desde el Norte
 * (NORTE-SYNC):
 *   1. reemplazar el HTML en `private/marca/brand-book-vX.Y.html` y BORRAR el
 *      anterior — el vigente es UNO solo (gobernanza de marca v4.2);
 *   2. cambiar las dos constantes de acá.
 *
 * Antes había que tocar además `app/marca/brand-book/page.tsx`, el mapa `ASSETS`
 * de `app/marca/asset/[name]/route.ts` y el hub de `/interno/marca` — cuatro
 * sitios que se desincronizaban entre sí. Ahora los tres leen de acá.
 *
 * ⚠️ Al 01-ago-2026 el vigente es **v4.6**. El **v5 está en Cloud Design y
 * todavía no bajó al repo**: cuando llegue, este archivo y el HTML son lo único
 * que cambia — el catálogo, el gate y las descargas son agnósticos de versión.
 */

export const BRAND_BOOK_VERSION = "v4.6";

/** Nombre del archivo dentro de `private/marca/`. */
export const BRAND_BOOK_FILE = "brand-book-v4.6.html";

/** Ruta autenticada que lo sirve (valida el gate de `/marca`). */
export const BRAND_BOOK_URL = "/marca/asset/brand-book";

/** Nombre con el que se baja. */
export const BRAND_BOOK_DOWNLOAD_NAME = `Brand Book DTD ${BRAND_BOOK_VERSION}.html`;
