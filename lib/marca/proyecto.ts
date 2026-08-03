/**
 * El sistema de marca navegable (SDD-0238).
 *
 * El Brand Book es el índice de 35 documentos que se enlazan entre sí con
 * rutas RELATIVAS. Para que esos enlaces funcionen, el proyecto se sube a
 * Storage conservando su estructura de carpetas bajo un prefijo común y se
 * sirve desde `/marca/doc/<ruta>` — ver `app/marca/doc/[...ruta]/route.ts`.
 *
 * El prefijo se declara acá y no en la ruta porque lo comparten el servidor y
 * el script de subida (`scripts/upload-brand-proyecto.ts`): si los dos no
 * escriben y leen la misma clave, la subida "funciona" y el visor da 404 en
 * todo, que es el fallo más difícil de diagnosticar de los dos lados.
 */

/** Carpeta dentro de `{tenant_id}/` donde vive el proyecto navegable. */
export const PROYECTO_PREFIJO = "proyecto";

/**
 * Convierte una ruta relativa del proyecto en su clave de Storage.
 *
 * POR QUÉ NO SE USA LA RUTA TAL CUAL: Supabase Storage rechaza con «Invalid
 * key» todo lo que no sea ASCII, y los nombres de Cloud Design están llenos —
 * el separador `·` (U+00B7) aparece en casi todos
 * (`Manual de Producción · DTD-Cargo.html`) y los acentos también. En la
 * primera corrida subieron los 140 binarios y fallaron los 45 documentos.
 *
 * ⚠️ `encodeURIComponent` NO RESUELVE ESTO. Storage **decodifica la clave antes
 * de validarla**: mandando `Manual%20%C2%B7%20x.html` el error vuelve a decir
 * `Invalid key: Manual · x.html`. Medido, no supuesto. Lo único que acepta es
 * ASCII de verdad (los espacios sí pasan).
 *
 * Por eso se translitera: se descomponen los acentos y se descarta la marca
 * diacrítica (`ó` → `o`), y todo lo demás fuera de ASCII cae a `-`. Como dos
 * nombres distintos pueden transliterar igual, se le pega un hash corto de la
 * ruta COMPLETA — que además distingue `logo/icono.png` de `fotos/icono.png`.
 *
 * No hace falta que sea reversible: los dos lados —el script de subida y la
 * ruta que sirve— la calculan desde la misma ruta relativa. Sí hace falta que
 * sea DETERMINISTA, y que la calcule un solo sitio: si cada lado tuviera su
 * copia, la subida diría "listo" y el visor daría 404 en todo.
 */
export function claveProyecto(relativa: string): string {
  const partes = relativa.split("/").filter(Boolean);
  const huella = hash32(partes.join("/"));
  return partes
    .map((seg, i) => {
      const ext = i === partes.length - 1 ? extensionDe(seg) : "";
      const base = ext ? seg.slice(0, -ext.length) : seg;
      const limpio = asciiSeguro(base) || "x";
      return i === partes.length - 1 ? `${limpio}-${huella}${ext}` : limpio;
    })
    .join("/");
}

function extensionDe(nombre: string): string {
  const i = nombre.lastIndexOf(".");
  return i > 0 ? nombre.slice(i).toLowerCase() : "";
}

function asciiSeguro(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // se va la tilde, queda la letra
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

/**
 * FNV-1a de 32 bits. Se usa este y no `node:crypto` para que el módulo siga
 * siendo importable desde cualquier runtime sin arrastrar un builtin de Node.
 * No es criptográfico y no necesita serlo: sólo distingue rutas entre ~200
 * archivos, donde la probabilidad de choque es despreciable — y el script de
 * subida además la comprueba y aborta si alguna vez ocurre.
 */
function hash32(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** Documento que abre el visor. */
export const PROYECTO_INDICE = "Brand Book DTD v5.0.html";

/** URL del visor navegable, ya codificada. */
export const PROYECTO_URL = `/marca/doc/${encodeURIComponent(PROYECTO_INDICE)}`;

/**
 * QUÉ NO SE PUBLICA — decisión del founder, 2026-08-02.
 *
 * `/marca` es el enlace que se le pasa a diseño externo y a la imprenta, así
 * que se publica el sistema de MARCA y se deja fuera el de PRODUCTO: el ERP por
 * dentro, la app del operario, los formularios de inspección y los documentos
 * comerciales. Sus enlaces dentro del book no quedan muertos — caen en la
 * página de aviso de `/marca/doc`.
 *
 * La lista es EXPLÍCITA y no un patrón de nombres a propósito: el primer
 * intento clasificaba por subcadenas y `"0"` matcheó `Brand Book DTD v5.0.html`,
 * dejando el documento principal fuera de la publicación. Una lista se revisa
 * de un vistazo; un patrón hay que ejecutarlo para saber qué hace.
 *
 * Al llegar una versión nueva desde el Norte, esto es lo único que hay que
 * revisar: si Cloud Design agrega una pieza de producto y no se anota acá, se
 * publica sola.
 */
export const PROYECTO_CARPETAS_EXCLUIDAS = new Set([
  "_web-maquetas", // maquetas del sitio público: producto, no marca
  "erp-mockups-v5", // las 11 pantallas de estado del ERP
]);

export const PROYECTO_ARCHIVOS_EXCLUIDOS = new Set([
  "DTD Studio · ERP.html",
  "DTD Apps · Launcher.html",
  "Operario · App.html",
  "Operario CN.html",
  "Cotizador de Fletes · DTD-Cargo.html",
  "Calculadora CBM · DTD-Cargo.html",
  "Etiqueta Bodega ZPL · DTD-Cargo.html",
  "Comprobante WhatsApp · DTD-Cargo.html",
  "Cotización · DTD-Cargo.html",
  "Packing List + Factura · DTD-Cargo.html",
  "Reportes de Inspección · DTD.html",
  "Inspección de Fábrica · DTD.html",
  "Inspección de Producto · DTD.html",
  "Inspección de Producto · Baterías · DTD.html",
  "Plantilla · Inspección de Fábrica.html",
  "Plantilla · Inspección de Producto.html",
]);

/** ¿Este documento se publica en `/marca`? Se juzga por su ruta relativa. */
export function sePublica(relativa: string): boolean {
  const partes = relativa.split("/");
  if (partes.some((p) => PROYECTO_CARPETAS_EXCLUIDAS.has(p))) return false;
  return !PROYECTO_ARCHIVOS_EXCLUIDOS.has(partes[partes.length - 1]);
}

/**
 * MIME por extensión.
 *
 * Se resuelve por extensión y NO por el `mime` guardado en el catálogo porque
 * estos archivos no son filas de `brand_assets`: son los assets internos del
 * proyecto (imágenes que sólo existen para que una página se vea completa), y
 * darles una fila a cada uno inflaría el catálogo con 150 entradas que nadie
 * quiere ver listadas.
 *
 * El default es `application/octet-stream` a propósito: un tipo desconocido se
 * baja en vez de que el navegador adivine y termine ejecutando algo.
 */
const TIPOS: Record<string, string> = {
  html: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  ico: "image/x-icon",
  avif: "image/avif",
  pdf: "application/pdf",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  mp4: "video/mp4",
  webm: "video/webm",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  txt: "text/plain; charset=utf-8",
  md: "text/plain; charset=utf-8",
};

export function tipoDeContenido(nombre: string): string {
  const ext = nombre.split(".").pop()?.toLowerCase() ?? "";
  return TIPOS[ext] ?? "application/octet-stream";
}

/**
 * El MIME SIN parámetros, para subir a Storage.
 *
 * Supabase rechaza el `contentType` con `charset`: `text/html; charset=utf-8`
 * devuelve «mime type … is not supported» y el archivo NO se sube. En la
 * primera corrida pasaron los 140 binarios y fallaron los 45 documentos —
 * justo los que hacen falta para que el sistema se navegue.
 *
 * Al servir sí se usa `tipoDeContenido()` con el charset: el tipo lo calcula la
 * ruta por extensión, no lo lee de Storage, así que declarar UTF-8 en la
 * respuesta no depende de lo que Storage haya aceptado guardar. Sin él, los
 * acentos de los documentos salen mojibake.
 */
export function tipoBase(nombre: string): string {
  return tipoDeContenido(nombre).split(";")[0].trim();
}
