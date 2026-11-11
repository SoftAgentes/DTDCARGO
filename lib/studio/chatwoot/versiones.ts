/**
 * Vigilante de versiones de Chatwoot (SDD-0588, paso 3.2 de SDD-0582). Parte pura.
 *
 * Compara la versión instalada (`GET <CHATWOOT_URL>/api`, pública: versión y salud
 * de Redis y Postgres) con los releases públicos de `chatwoot/chatwoot` en GitHub, y
 * arma lo que se guarda en `chatwoot_version_checks` (0507).
 *
 * Sin datos personales: de cada release se guardan etiqueta, nombre, fecha, enlace y
 * notas. Las notas de Chatwoot nombran a quien contribuyó (`by @usuario in …` y la
 * sección «New Contributors»); `limpiarNotas` quita los dos antes de guardar.
 *
 * Las notas se muestran como texto plano, nunca como HTML: vienen de un tercero.
 */

export const VERSION_RE = /^[0-9]{1,4}\.[0-9]{1,4}\.[0-9]{1,4}$/;
/** Etiquetas estables de Chatwoot: `v4.19.1`. La imagen CE es la misma con `-ce`. */
const ETIQUETA_RE = /^v?([0-9]{1,4}\.[0-9]{1,4}\.[0-9]{1,4})(?:-ce)?$/;
const URL_RELEASE = "https://github.com/chatwoot/chatwoot/releases/";
const SEGURIDAD_RE = /\b(security|vulnerab\w*|CVE-\d{4}-\d+|XSS|CSRF|RCE)\b/i;

/** Cuántos releases pendientes se guardan como máximo, del más nuevo al más viejo. */
export const MAX_PENDIENTES = 10;
/** Tope de las notas de un release, en caracteres. */
export const MAX_NOTAS = 8_000;

export type EstadoVersiones = "al_dia" | "hay_nueva" | "error";
export type ErrorVersiones =
  | "instalada_no_responde"
  | "instalada_formato"
  | "releases_no_responde"
  | "releases_formato";

export interface ReleaseChatwoot {
  version: string;
  nombre: string;
  /** ISO 8601 de GitHub. */
  publicada: string;
  /** Solo enlaces a los releases de chatwoot/chatwoot; si no, null. */
  url: string | null;
  notas: string;
  /** Las notas mencionan seguridad: el runbook pide subir en la semana. */
  seguridad: boolean;
}

export interface ResultadoVersiones {
  estado: EstadoVersiones;
  instalada: string | null;
  disponible: string | null;
  /** Releases más nuevos que la instalada, del más nuevo al más viejo (≤ MAX_PENDIENTES). */
  pendientes: ReleaseChatwoot[];
  /** Hay más pendientes de los guardados. */
  recortado: boolean;
  error: ErrorVersiones | null;
}

/** −1, 0 o 1, por número (4.9.0 < 4.10.0). Las dos tienen que pasar VERSION_RE. */
export function compararVersiones(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i += 1) {
    if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
  }
  return 0;
}

/** La versión del cuerpo de `GET /api`, o null si no tiene la forma esperada. */
export function versionDeApi(cuerpo: unknown): string | null {
  if (!cuerpo || typeof cuerpo !== "object") return null;
  const version = (cuerpo as { version?: unknown }).version;
  return typeof version === "string" && VERSION_RE.test(version) ? version : null;
}

/** Quita menciones a personas y la sección de contribuidores nuevos; recorta. */
export function limpiarNotas(texto: string): string {
  const sinContribuidores = texto.replace(/(^|\n)#{1,6}\s*New Contributors[\s\S]*?(?=\n#{1,6}\s|\n\*\*Full Changelog|$)/i, "$1");
  const limpio = sinContribuidores
    .replace(/\r\n/g, "\n")
    // Sin HTML crudo: GitHub admite etiquetas en las notas (<img>, <details>…).
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\/?[A-Za-z][^>]*>/g, "")
    .replace(/\s+by @[A-Za-z0-9-]+(?:\[bot\])?(?= in |\s|$)/g, "")
    .replace(/@[A-Za-z0-9-]+(?:\[bot\])?/g, "@…")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return limpio.length > MAX_NOTAS ? `${limpio.slice(0, MAX_NOTAS).trimEnd()}\n…` : limpio;
}

/**
 * Los releases estables de la respuesta de `GET /repos/chatwoot/chatwoot/releases`,
 * del más nuevo al más viejo. null si la respuesta no es una lista.
 */
export function releasesEstables(cuerpo: unknown): ReleaseChatwoot[] | null {
  if (!Array.isArray(cuerpo)) return null;
  const vistos = new Set<string>();
  const out: ReleaseChatwoot[] = [];
  for (const r of cuerpo as Record<string, unknown>[]) {
    if (!r || typeof r !== "object" || r.draft === true || r.prerelease === true) continue;
    const etiqueta = typeof r.tag_name === "string" ? r.tag_name.trim() : "";
    const m = ETIQUETA_RE.exec(etiqueta);
    if (!m || vistos.has(m[1])) continue;
    vistos.add(m[1]);
    const url = typeof r.html_url === "string" && r.html_url.startsWith(URL_RELEASE) ? r.html_url : null;
    const cuerpoNotas = typeof r.body === "string" ? r.body : "";
    out.push({
      version: m[1],
      nombre: typeof r.name === "string" && r.name.trim() ? r.name.trim().slice(0, 120) : etiqueta,
      publicada: typeof r.published_at === "string" ? r.published_at : "",
      url,
      notas: limpiarNotas(cuerpoNotas),
      seguridad: SEGURIDAD_RE.test(cuerpoNotas),
    });
  }
  return out.sort((a, b) => compararVersiones(b.version, a.version));
}

/**
 * Junta las dos lecturas. `instalada`/`releases` en null = esa fuente falló; el
 * código de error dice cuál. Si solo falló la instalada, se guarda igual la
 * disponible: Studio la muestra con el aviso.
 */
export function evaluarVersiones(
  instalada: { ok: true; version: string } | { ok: false; error: "instalada_no_responde" | "instalada_formato" },
  releases: { ok: true; lista: ReleaseChatwoot[] } | { ok: false; error: "releases_no_responde" | "releases_formato" },
): ResultadoVersiones {
  const disponible = releases.ok ? (releases.lista[0]?.version ?? null) : null;
  const version = instalada.ok ? instalada.version : null;
  if (!instalada.ok || !releases.ok) {
    return {
      estado: "error",
      instalada: version,
      disponible,
      pendientes: [],
      recortado: false,
      error: !instalada.ok ? instalada.error : (releases as { error: ErrorVersiones }).error,
    };
  }
  const nuevos = releases.lista.filter((r) => compararVersiones(r.version, instalada.version) > 0);
  return {
    estado: nuevos.length > 0 ? "hay_nueva" : "al_dia",
    instalada: instalada.version,
    disponible,
    pendientes: nuevos.slice(0, MAX_PENDIENTES),
    recortado: nuevos.length > MAX_PENDIENTES,
    error: null,
  };
}
