/**
 * El Brand Book standalone vigente (SDD-0238).
 *
 * PUNTO ÚNICO DE ACTUALIZACIÓN. Cuando llega un book nuevo desde el Norte
 * (NORTE-SYNC) se sube por **Studio › Marketing › HUB de marca** a la sección
 * "Brand Book" y se cambian las dos constantes de acá. No hay que desplegar
 * para publicarlo — el deploy sólo hace falta si cambia el NOMBRE del archivo
 * maestro.
 *
 * EL BOOK YA NO VIVE EN GIT (founder, 2026-08-02). Vivía en
 * `private/marca/brand-book-vX.Y.html`, y cada versión sumaba ~14-27 MB
 * PERMANENTES al repo: git no olvida, así que el peso se acumulaba versión
 * tras versión sobre un `.git` que ya iba en 172 MB. Ahora vive en el bucket
 * privado `brand-assets`, igual que el resto del catálogo, y lo sirve
 * `/marca/asset/brand-book` leyéndolo de Storage.
 *
 * POR QUÉ EL MAESTRO SE NOMBRA POR ARCHIVO Y NO POR ORDEN: el v5 son TRES
 * documentos (Brand Book, ERP Studio Brand Book, Manual de Producción) y los
 * tres conviven descargables en la misma sección. Sólo uno se abre a pantalla
 * completa. Elegirlo por "el primero de la sección" lo dejaría a merced del
 * orden de subida; nombrarlo acá lo hace explícito y revisable en el diff.
 */

export const BRAND_BOOK_VERSION = "v5.0";

/**
 * Nombre del archivo MAESTRO dentro de la sección `brand-book` del bucket.
 *
 * La búsqueda es por SUFIJO de la clave de Storage, no por igualdad: el HUB le
 * antepone un timestamp a lo que sube (`…/brand-book/1754130000000-nombre.html`)
 * para no pisar el archivo anterior. Sin el sufijo, un book subido por la UI
 * sería invisible para el visor aunque estuviera perfectamente cargado.
 */
export const BRAND_BOOK_STORAGE_NAME = "brand-book-dtd-v5.0.html";

/** Ruta autenticada que lo sirve (valida el gate de `/marca`). */
export const BRAND_BOOK_URL = "/marca/asset/brand-book";

/** Nombre con el que se baja. */
export const BRAND_BOOK_DOWNLOAD_NAME = `Brand Book DTD ${BRAND_BOOK_VERSION}.html`;
