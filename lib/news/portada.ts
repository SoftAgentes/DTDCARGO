/**
 * SDD-0611 §11.5 · Regla de la foto de portada de una noticia.
 *
 * Puro y sin dependencias: lo usan el render público, el filtro de la
 * publicación automática y las pruebas. Su gemela en la base son los CHECK de
 * `news_posts` y el cuerpo de `news_insertar_post` (migración 0547): misma
 * lista de rutas, mismo patrón de la marca anterior.
 *
 * La regla (decidida por Sam el 2026-11-15), en orden:
 *   1. foto de la fuente, solo con licencia que permita reutilizarla y comprobada;
 *   2. foto de un banco libre, o propia de la marca vigente;
 *   3. sin foto. Ante cualquier duda, sin foto.
 *   4. nunca la marca anterior («DoorTuDoor», «Door to Door»).
 *
 * «Sin permiso comprobado» no retiene la noticia: la portada se descarta y la
 * noticia sigue con el respaldo propio o sin foto.
 */

/** Origen de la foto, en el orden de la regla (§11.5). */
export const ORIGENES_DE_PORTADA = ["fuente", "banco", "propia"] as const;
export type OrigenDePortada = (typeof ORIGENES_DE_PORTADA)[number];

/**
 * Marca anterior en un nombre de archivo o URL: «doortudoor», «door-to-door»,
 * «door to door», «door2door», con separadores o su codificación (`%20`). La
 * misma expresión vive en los CHECK de la 0547.
 */
export const MARCA_ANTERIOR_RE = /door.{0,6}t[uo].{0,6}door|door.{0,6}2.{0,6}door/i;

/**
 * Lista CERRADA de fotos propias revisadas a la vista (§11.5, 2026-11-15): sin la
 * marca anterior en rótulos, gorras, camisas ni códigos QR. Una foto nueva entra
 * aquí, en el CHECK `news_posts_portada_con_permiso` de la 0547 y en la prueba
 * gemela, o no entra. El nombre del archivo no prueba nada: `dtd-cargo-recepcion-contenedor.webp`
 * y `puerto-venezuela-aduana-entrega-final-…jpg` no la nombran y la llevan puesta.
 * Excluidas (marca anterior visible): esas dos, `precinto-doortudoor-…`,
 * `carga-contenedor-precinto-doortudoor-…`; dudosas, no usadas:
 * `dtd-cargo-descarga-bodega.webp` y `dtd-cargo-atencion-mapa.webp`.
 */
export const FOTOS_PROPIAS_REVISADAS: readonly string[] = [
  "/fotos/dtd-cargo-carga-consolidada.webp",
  "/fotos/dtd-cargo-camion-entrega.webp",
  "/fotos/dtd-cargo-operacion-puerto.webp",
  "/fotos/dtd-cargo-equipo-contenedor.webp",
  "/fotos/bodega-yiwu-china-recepcion-consolidacion-dtd-cargo.jpg",
];

/**
 * Storage público de un proyecto de Supabase: el patrón `*.supabase.co` de
 * `next.config` en `images.remotePatterns` (cualquier proyecto, no solo el propio;
 * lo que se sube ahí lo revisa una persona antes de registrar la licencia).
 */
const HOST_PERMITIDO_RE = /^[a-z0-9-]+\.supabase\.co$/;
const RUTA_STORAGE_RE = /^\/storage\/v1\/object\/public\/[A-Za-z0-9._%/-]+\.(?:webp|jpe?g|png|avif)$/i;

const LICENCIA_MAX = 120;
const CREDITO_MAX = 200;
const ALT_MAX = 200;
const URL_MAX = 2048;

function sinVacios(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

/** ¿El texto (crudo o decodificado) nombra la marca anterior? Texto no decodificable = sí (falla cerrado). */
export function nombraMarcaAnterior(texto: string): boolean {
  const nfkc = texto.normalize("NFKC");
  if (MARCA_ANTERIOR_RE.test(nfkc)) return true;
  try {
    return MARCA_ANTERIOR_RE.test(decodeURIComponent(nfkc).normalize("NFKC"));
  } catch {
    return true;
  }
}

/** Ruta propia versionada: solo una foto de la lista cerrada de fotos revisadas. */
export function esRutaPropiaVersionada(url: string): boolean {
  return FOTOS_PROPIAS_REVISADAS.includes(url);
}

/** Host permitido: solo el Storage público de Supabase, por https y sin puerto ni credenciales. */
export function esHostPermitido(url: string): boolean {
  if (url.length > URL_MAX || /\s/.test(url)) return false;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  return (
    u.protocol === "https:" &&
    u.port === "" &&
    u.username === "" &&
    u.password === "" &&
    u.search === "" &&
    u.hash === "" &&
    HOST_PERMITIDO_RE.test(u.hostname) &&
    RUTA_STORAGE_RE.test(u.pathname) &&
    !u.pathname.includes("..") &&
    !nombraMarcaAnterior(url)
  );
}

/** La URL de una portada solo puede ser ruta propia versionada o un host permitido. */
export function esUrlDePortadaPermitida(url: unknown): url is string {
  if (typeof url !== "string") return false;
  return url.startsWith("/") ? esRutaPropiaVersionada(url) : esHostPermitido(url);
}

/** Enlace de origen: https, sin credenciales ni espacios. */
export function esEnlaceDeOrigen(url: unknown): url is string {
  if (typeof url !== "string" || url.length > URL_MAX || /\s/.test(url)) return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.username === "" && u.password === "" && u.hostname.includes(".");
  } catch {
    return false;
  }
}

/** Lo que un borrador declara de su portada. Todo opcional: falta de algo = sin permiso. */
export interface PortadaDeclarada {
  url?: string | null;
  alt?: string | null;
  origen?: string | null;
  credito?: string | null;
  licencia?: string | null;
  enlaceOrigen?: string | null;
  /** Fecha ISO en que alguien comprobó la licencia en la fuente. */
  licenciaVerificadaEn?: string | null;
}

export interface PortadaAceptada {
  url: string;
  alt: string | null;
  origen: OrigenDePortada;
  credito: string | null;
  licencia: string;
  enlaceOrigen: string | null;
  licenciaVerificadaEn: string;
}

export type MotivoDeDescarte =
  | "portada:url"
  | "portada:marca_anterior"
  | "portada:sin_licencia"
  | "portada:licencia_sin_comprobar"
  | "portada:origen"
  | "portada:sin_enlace_de_origen"
  | "portada:campo_invalido";

export type DecisionDePortada =
  | { usa: true; portada: PortadaAceptada }
  | { usa: false; declarada: boolean; motivos: MotivoDeDescarte[] };

/**
 * ¿Se puede usar esta portada? Sin foto declarada no hay nada que decidir
 * (`declarada: false`). Con foto declarada, solo se usa si TODO está en orden;
 * si no, se devuelven los motivos y la noticia sigue sin esa foto.
 */
export function evaluarPortada(p: PortadaDeclarada | null | undefined): DecisionDePortada {
  const url = sinVacios(p?.url);
  if (url === "") return { usa: false, declarada: false, motivos: [] };

  const motivos: MotivoDeDescarte[] = [];
  if (nombraMarcaAnterior(url)) motivos.push("portada:marca_anterior");
  else if (!esUrlDePortadaPermitida(url)) motivos.push("portada:url");
  // La marca anterior tampoco entra por el enlace, el crédito ni el texto alternativo.
  if ([p?.enlaceOrigen, p?.credito, p?.alt].some((t) => nombraMarcaAnterior(sinVacios(t)))) {
    if (!motivos.includes("portada:marca_anterior")) motivos.push("portada:marca_anterior");
  }

  const licencia = sinVacios(p?.licencia);
  const verificada = sinVacios(p?.licenciaVerificadaEn);
  if (licencia === "") motivos.push("portada:sin_licencia");
  else if (verificada === "" || Number.isNaN(Date.parse(verificada)) || Date.parse(verificada) > Date.now()) {
    // Sin fecha, ilegible o futura: la licencia no está comprobada todavía.
    motivos.push("portada:licencia_sin_comprobar");
  }

  const origen = sinVacios(p?.origen);
  if (!(ORIGENES_DE_PORTADA as readonly string[]).includes(origen)) motivos.push("portada:origen");
  const enlace = sinVacios(p?.enlaceOrigen);
  if ((origen === "fuente" || origen === "banco") && !esEnlaceDeOrigen(enlace)) {
    motivos.push("portada:sin_enlace_de_origen");
  }

  const credito = sinVacios(p?.credito);
  const alt = sinVacios(p?.alt);
  if (
    licencia.length > LICENCIA_MAX ||
    credito.length > CREDITO_MAX ||
    alt.length > ALT_MAX ||
    (enlace !== "" && !esEnlaceDeOrigen(enlace))
  ) {
    motivos.push("portada:campo_invalido");
  }

  if (motivos.length > 0) return { usa: false, declarada: true, motivos };
  return {
    usa: true,
    portada: {
      url,
      alt: alt === "" ? null : alt,
      origen: origen as OrigenDePortada,
      credito: credito === "" ? null : credito,
      licencia,
      enlaceOrigen: enlace === "" ? null : enlace,
      licenciaVerificadaEn: verificada,
    },
  };
}

/** Los campos de `news_posts` que el sitio público lee de la portada. */
export interface PortadaDeRegistro {
  cover_image_url?: string | null;
  cover_alt?: string | null;
  cover_origin?: string | null;
  cover_credit?: string | null;
  cover_license?: string | null;
  cover_source_url?: string | null;
}

export interface PortadaPublica {
  src: string;
  alt: string | null;
  credito: string | null;
  licencia: string;
  enlaceOrigen: string | null;
}

/**
 * Portada de una noticia publicada, lista para pintar, o `null`. El público no
 * ve `cover_license_verified_at` (la base lo exige con un CHECK antes de
 * guardar la portada), así que aquí se pide URL permitida y licencia escrita;
 * lo demás lo garantiza la base, y esta guarda es la segunda cerradura.
 */
export function portadaDeRegistro(post: PortadaDeRegistro): PortadaPublica | null {
  const url = sinVacios(post.cover_image_url);
  const licencia = sinVacios(post.cover_license);
  if (url === "" || licencia === "" || licencia.length > LICENCIA_MAX) return null;
  if (!esUrlDePortadaPermitida(url)) return null;
  const enlace = sinVacios(post.cover_source_url);
  const alt = sinVacios(post.cover_alt);
  const credito = sinVacios(post.cover_credit);
  // La marca anterior en el enlace, el crédito o el alt también descarta la portada.
  if ([enlace, alt, credito, licencia].some(nombraMarcaAnterior)) return null;
  return {
    src: url,
    alt: alt === "" ? null : alt.slice(0, ALT_MAX),
    credito: credito === "" ? null : credito.slice(0, CREDITO_MAX),
    licencia,
    enlaceOrigen: esEnlaceDeOrigen(enlace) ? enlace : null,
  };
}
