/**
 * Estado de las publicaciones de la web en el servidor propio (SDD-0547).
 *
 * Desde el 2026-10-16 la web no la publica Vercel: cada merge a `main` construye
 * una imagen y el vigilante del servidor (`infra/ops/web/publicar-web.sh vigilar`,
 * SDD-0541) la publica, la retiene o vuelve atrás. El vigilante deja un archivo
 * JSON pequeño en una carpeta que el contenedor web ve en solo lectura, y la
 * Torre de control (`/studio/debug`, pestaña Estado) lo lee. Este módulo es el
 * contrato de ese archivo: tipos, validación y textos. No toca el disco (eso
 * está en `publicaciones-loader.ts`), así que se puede probar sin archivos.
 *
 * Regla de seguridad del contrato: del archivo solo pasan a la pantalla valores
 * con forma fija (SHA de 40 hex, horas ISO en UTC, códigos de una lista cerrada
 * y nombres de migración). Un texto libre (una ruta, un error de Docker, una URL
 * con credenciales) no cabe en ninguna de esas formas, así que no se muestra
 * aunque el vigilante lo escriba por error. Los motivos se traducen acá, por
 * código (ERR-01: sin rutas internas ni detalles crudos en la interfaz).
 */

/** Única versión del formato que este código entiende. */
export const VERSION_ESTADO_PUBLICACIONES = 1;
/** Eventos del historial que se muestran como máximo (los más nuevos). */
export const MAX_HISTORIAL = 20;
/** Migraciones faltantes que se muestran como máximo por evento. */
export const MAX_FALTAN = 50;
/**
 * El vigilante corre cada minuto. Una publicación con vuelta atrás puede tardar
 * unos 10 minutos con el candado tomado; pasado este margen sin actualizar el
 * archivo, el panel avisa que el vigilante parece detenido.
 */
export const MINUTOS_VIGILANTE_DETENIDO = 15;
/** Commits del repo (privado: el enlace sirve a quien tenga acceso). */
export const URL_COMMITS = "https://github.com/hailuwaycom-sketch/DTDCARGO/commit/";

const SHA = /^[0-9a-f]{40}$/;
const MIGRACION = /^[0-9]{4}[a-z]?_[a-z0-9_]{1,80}$/;
const HORA_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

export type OrigenPublicacion = "vigilante" | "a-mano";

export type ResultadoPublicacion =
  | "publicada"
  | "retenida"
  | "vuelta-atras"
  | "vuelta-atras-fallida"
  | "vuelta-atras-a-mano";

export type MotivoPublicacion =
  | "migraciones"
  | "ledger"
  | "huellas"
  | "sharp"
  | "etiquetas"
  | "imagen"
  | "descarga"
  | "disco"
  | "ensayo"
  | "env"
  | "sin-vuelta-atras"
  | "salud"
  | "prueba-rapida"
  | "compose"
  | "rechazada"
  | "otro";

export type EstadoVigilante = "al-dia" | "retenida" | "detenido" | "congelado";

export type EventoPublicacion = {
  /** Epoch ms. */
  hora: number;
  sha: string;
  origen: OrigenPublicacion;
  resultado: ResultadoPublicacion;
  motivo: MotivoPublicacion | null;
  /** Solo con `motivo: "migraciones"`: nombres de las que faltan en la base. */
  faltan: string[];
};

export type EstadoPublicaciones = {
  /** Última vuelta del vigilante que escribió el archivo (epoch ms). */
  actualizado: number;
  /** Commit de la imagen que el servidor tiene publicada. */
  corre: string | null;
  /** Commit de la vuelta atrás (la imagen anterior). */
  anterior: string | null;
  /** Commit de `:publicable` que vio el vigilante en su última vuelta. */
  publicable: string | null;
  vigilante: {
    estado: EstadoVigilante;
    motivo: MotivoPublicacion | null;
    faltan: string[];
  } | null;
  congelado: { desde: number | null; automatico: boolean } | null;
  /** Más nuevo primero, como máximo `MAX_HISTORIAL`. */
  historial: EventoPublicacion[];
  /** Entradas del historial que no tenían el formato y no se muestran. */
  descartados: number;
};

export type MotivoSinDatos =
  | "sin-archivo"
  | "ilegible"
  | "demasiado-grande"
  | "formato"
  | "version";

export type ResultadoEstadoPublicaciones =
  | { ok: true; estado: EstadoPublicaciones }
  | { ok: false; motivo: MotivoSinDatos };

/** Lo que recibe la pantalla: el resultado y la hora en que se leyó el archivo. */
export type LecturaPublicaciones = ResultadoEstadoPublicaciones & {
  leidoEn: number;
};

const ORIGENES: readonly OrigenPublicacion[] = ["vigilante", "a-mano"];
const RESULTADOS: readonly ResultadoPublicacion[] = [
  "publicada",
  "retenida",
  "vuelta-atras",
  "vuelta-atras-fallida",
  "vuelta-atras-a-mano",
];
const MOTIVOS: readonly MotivoPublicacion[] = [
  "migraciones",
  "ledger",
  "huellas",
  "sharp",
  "etiquetas",
  "imagen",
  "descarga",
  "disco",
  "ensayo",
  "env",
  "sin-vuelta-atras",
  "salud",
  "prueba-rapida",
  "compose",
  "rechazada",
  "otro",
];
const ESTADOS_VIGILANTE: readonly EstadoVigilante[] = [
  "al-dia",
  "retenida",
  "detenido",
  "congelado",
];

// ─── Validación ──────────────────────────────────────────────────────────────

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function sha(v: unknown): string | null {
  return typeof v === "string" && SHA.test(v) ? v : null;
}

function hora(v: unknown): number | null {
  if (typeof v !== "string" || !HORA_UTC.test(v)) return null;
  const ms = Date.parse(v);
  return Number.isFinite(ms) ? ms : null;
}

function deLista<T extends string>(v: unknown, lista: readonly T[]): T | null {
  return typeof v === "string" && (lista as readonly string[]).includes(v)
    ? (v as T)
    : null;
}

/** Un código desconocido se muestra como «otro»; lo que no es texto, como nada. */
function motivo(v: unknown): MotivoPublicacion | null {
  if (typeof v !== "string") return null;
  return deLista(v, MOTIVOS) ?? "otro";
}

function faltan(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const nombres: string[] = [];
  for (const n of v) {
    if (typeof n === "string" && MIGRACION.test(n) && !nombres.includes(n)) {
      nombres.push(n);
      if (nombres.length === MAX_FALTAN) break;
    }
  }
  return nombres;
}

function evento(v: unknown): EventoPublicacion | null {
  if (!esObjeto(v)) return null;
  const h = hora(v.hora);
  const s = sha(v.sha);
  const o = deLista(v.origen, ORIGENES);
  const r = deLista(v.resultado, RESULTADOS);
  if (h === null || s === null || o === null || r === null) return null;
  const m = motivo(v.motivo);
  return {
    hora: h,
    sha: s,
    origen: o,
    resultado: r,
    motivo: m,
    faltan: m === "migraciones" ? faltan(v.faltan) : [],
  };
}

function vigilante(v: unknown): EstadoPublicaciones["vigilante"] {
  if (!esObjeto(v)) return null;
  const estado = deLista(v.estado, ESTADOS_VIGILANTE);
  if (estado === null) return null;
  const m = estado === "retenida" || estado === "detenido" ? motivo(v.motivo) : null;
  return { estado, motivo: m, faltan: m === "migraciones" ? faltan(v.faltan) : [] };
}

function congelado(v: unknown): EstadoPublicaciones["congelado"] {
  if (!esObjeto(v)) return null;
  return { desde: hora(v.desde), automatico: v.automatico === true };
}

/**
 * Valida el JSON del vigilante. El sobre (`version` y `actualizado`) es
 * obligatorio; cada campo de adentro que no tenga su forma queda en `null` y
 * cada entrada inválida del historial se descarta y se cuenta.
 */
export function parseEstadoPublicaciones(raw: unknown): ResultadoEstadoPublicaciones {
  if (!esObjeto(raw)) return { ok: false, motivo: "formato" };
  if (typeof raw.version !== "number") return { ok: false, motivo: "formato" };
  if (raw.version !== VERSION_ESTADO_PUBLICACIONES) return { ok: false, motivo: "version" };
  const actualizado = hora(raw.actualizado);
  if (actualizado === null) return { ok: false, motivo: "formato" };

  const crudo = Array.isArray(raw.historial) ? raw.historial : [];
  const validos: EventoPublicacion[] = [];
  let descartados = 0;
  for (const e of crudo) {
    const ok = evento(e);
    if (ok) validos.push(ok);
    else descartados += 1;
  }
  validos.sort((a, b) => b.hora - a.hora);

  return {
    ok: true,
    estado: {
      actualizado,
      corre: sha(raw.corre),
      anterior: sha(raw.anterior),
      publicable: sha(raw.publicable),
      vigilante: vigilante(raw.vigilante),
      congelado: congelado(raw.congelado),
      historial: validos.slice(0, MAX_HISTORIAL),
      descartados,
    },
  };
}

// ─── Textos y tonos ─────────────────────────────────────────────────────────

export type TonoPublicacion = "success" | "warning" | "danger" | "info" | "neutral";

export function etiquetaResultado(r: ResultadoPublicacion): string {
  switch (r) {
    case "publicada":
      return "Publicada";
    case "retenida":
      return "Retenida";
    case "vuelta-atras":
      return "Falló y volvió";
    case "vuelta-atras-fallida":
      return "Falló la vuelta atrás";
    case "vuelta-atras-a-mano":
      return "Vuelta atrás a mano";
  }
}

export function tonoResultado(r: ResultadoPublicacion): TonoPublicacion {
  switch (r) {
    case "publicada":
      return "success";
    case "retenida":
      return "warning";
    case "vuelta-atras":
    case "vuelta-atras-fallida":
      return "danger";
    case "vuelta-atras-a-mano":
      return "info";
  }
}

export function etiquetaVigilante(e: EstadoVigilante): string {
  switch (e) {
    case "al-dia":
      return "Al día";
    case "retenida":
      return "Retenida";
    case "detenido":
      return "Detenido";
    case "congelado":
      return "Congelado";
  }
}

export function tonoVigilante(
  e: EstadoVigilante,
  congeladoAutomatico = false,
): TonoPublicacion {
  if (e === "al-dia") return "success";
  if (e === "congelado" && congeladoAutomatico) return "danger";
  return "warning";
}

export function etiquetaOrigen(o: OrigenPublicacion): string {
  return o === "vigilante" ? "automática" : "a mano";
}

/** Qué pasó, en palabras, sin rutas ni errores crudos (ERR-01). */
export function textoMotivo(m: MotivoPublicacion): string {
  switch (m) {
    case "migraciones":
      return "Faltan migraciones en la base. La web no sale antes que su migración.";
    case "ledger":
      return "No se pudo leer el registro de migraciones de la base.";
    case "huellas":
      return "El servidor no tiene la misma copia de compose o cron que ese commit.";
    case "sharp":
      return "La conversión de imágenes (sharp) no funciona dentro de la imagen.";
    case "etiquetas":
      return "La imagen no trae las etiquetas de publicación (es anterior a la SDD-0541).";
    case "imagen":
      return "La imagen no es válida: commit, digest u origen inesperados.";
    case "descarga":
      return "No se pudo bajar la imagen de GitHub. Puede haber vencido el acceso al registro.";
    case "disco":
      return "Queda poco disco libre en el servidor.";
    case "ensayo":
      return "Hay un ensayo de la web puesto en el servidor.";
    case "env":
      return "La configuración de la web en el servidor no se pudo cambiar con seguridad.";
    case "sin-vuelta-atras":
      return "La versión anterior no está disponible: no habría vuelta atrás.";
    case "salud":
      return "La versión nueva no arrancó sana.";
    case "prueba-rapida":
      return "La prueba rápida falló dos veces.";
    case "compose":
      return "Docker compose falló al cambiar el contenedor de la web.";
    case "rechazada":
      return "Ya se había rechazado. Se vuelve a intentar con el próximo merge.";
    case "otro":
      return "Motivo no reconocido. La evidencia está en el servidor.";
  }
}

export function textoSinDatos(m: MotivoSinDatos): string {
  switch (m) {
    case "sin-archivo":
      return "El servidor no ha dejado el estado de las publicaciones.";
    case "ilegible":
      return "El archivo de estado existe, pero no se pudo leer.";
    case "demasiado-grande":
      return "El archivo de estado es más grande de lo esperado y no se leyó.";
    case "formato":
      return "El archivo de estado no tiene el formato esperado.";
    case "version":
      return "El archivo de estado es de otra versión del formato.";
  }
}

// ─── Utilidades ─────────────────────────────────────────────────────────────

/** Los mismos 8 caracteres que usan los avisos del vigilante. */
export function shaCorto(s: string): string {
  return s.slice(0, 8);
}

export function urlCommit(s: string): string {
  return `${URL_COMMITS}${s}`;
}

/** `true` si el vigilante lleva más de `MINUTOS_VIGILANTE_DETENIDO` sin escribir. */
export function vigilanteSinVueltas(actualizado: number, ahora: number): boolean {
  return ahora - actualizado > MINUTOS_VIGILANTE_DETENIDO * 60_000;
}

/** «ahora», «hace 3 min», «hace 2 h», «hace 5 d», «hace 2 meses». */
export function tiempoRelativo(epochMs: number, ahora: number): string {
  const min = Math.round((ahora - epochMs) / 60_000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d < 30) return `hace ${d} d`;
  const meses = Math.round(d / 30);
  return `hace ${meses} ${meses === 1 ? "mes" : "meses"}`;
}
