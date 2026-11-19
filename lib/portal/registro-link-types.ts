/**
 * Link de registro al portal para clientes que YA tienen ficha (SDD-0646).
 *
 * Los 361 clientes del sistema anterior tienen ficha (DTD-8001…8361) pero casi
 * ninguno tiene correo, así que la invitación por correo no les llega. El equipo
 * genera este link desde la ficha y lo manda por WhatsApp; el cliente completa SU
 * ficha con su código ya fijo y queda dentro del portal.
 *
 * ── Seguridad ──────────────────────────────────────────────────────────────
 * - El token son 32 bytes aleatorios (256 bits) en base64url. La base guarda
 *   SOLO su sha256: quien lea la tabla no puede armar el link.
 * - La URL NO lleva el Shipping Mark. Si lo llevara, bastaría cambiar el número
 *   para quedarse con el portal de otro cliente.
 * - Un solo uso, vence a los 14 días, regenerar revoca el anterior (migr 0552).
 * - Abrir la página sólo LEE (el robot de vista previa de WhatsApp hace GET); el
 *   link se gasta en el POST del formulario.
 *
 * Tipos y textos puros: los importa un componente cliente. Lo que usa
 * `node:crypto` vive en `registro-link.ts` (sólo servidor).
 */

import type { CorreoEstado } from "./correo-comprobacion";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";

/** Días que vive un link. Lo fija la base (migr 0552); acá sólo para el texto. */
export const REGISTRO_LINK_TTL_DAYS = 14;

/** Token base64url: 43 caracteres para 32 bytes. */
const TOKEN_REGEX = /^[A-Za-z0-9_-]{43}$/;

/** ¿Tiene forma de token? Lo que no la tiene ni se consulta. */
export function isRegistroTokenShape(token: string | null | undefined): token is string {
  return typeof token === "string" && TOKEN_REGEX.test(token);
}

/** URL que se manda por WhatsApp. Sólo el token: nunca el Shipping Mark. */
export function registroLinkUrl(token: string): string {
  return `${SITE_URL}/registro/link/${token}`;
}

/**
 * SDD-0672 · horas que vive un enlace de autoservicio. Lo fija la base (migr
 * 0562); acá sólo para el texto.
 */
export const REGISTRO_AUTOSERVICIO_TTL_HORAS = 24;

/**
 * SDD-0672 · URL del enlace de autoservicio. Otra ruta que la del equipo, a
 * propósito: la del equipo (`/registro/link/`) no acepta estos enlaces.
 */
export function registroAutoservicioUrl(token: string): string {
  return `${SITE_URL}/registro/activar/${token}`;
}

/** Enlace de autoservicio que no sirve (cualquier causa): un solo mensaje. */
export const REGISTRO_AUTOSERVICIO_INVALIDO =
  "Este enlace ya no está disponible. Pide uno nuevo desde «Entrar» con tu correo, o escríbenos por WhatsApp.";

/**
 * SDD-0672 · los datos no permitieron activar el portal: no coinciden con la
 * ficha, o el correo ya tiene otra cuenta. UN solo mensaje para los dos, y sin
 * decir cuál dato falló: la guarda no revela si el documento coincidió.
 */
export const REGISTRO_AUTOSERVICIO_NO_SIRVEN =
  "No pudimos activar tu portal con estos datos. Revísalos; si siguen sin funcionar, escríbenos por WhatsApp y lo resolvemos.";

/** Mensaje de WhatsApp que arma la ficha para el asesor. */
export function registroLinkWhatsAppText(name: string | null, url: string): string {
  const saludo = name ? `Hola ${name}` : "Hola";
  return `${saludo}, en DTD Cargo ya tienes tu código de siempre. Con este enlace completas tus datos y entras a tu portal: ${url}\n\nEs personal, de un solo uso y vence en ${REGISTRO_LINK_TTL_DAYS} días. No lo reenvíes.`;
}

/**
 * Mensaje único para todo link que no sirve (no existe, usado, revocado, vencido,
 * ficha borrada o ya con acceso). Distinguirlos le diría a un curioso cuáles
 * tokens son reales.
 */
export const REGISTRO_LINK_INVALIDO =
  "Este enlace ya no está disponible. Pídele a tu asesor de DTD Cargo uno nuevo.";

/**
 * Correo con cuenta, sin decirlo: el mensaje no confirma qué correos están
 * registrados (se devuelve en el formulario, no en el campo del correo).
 */
export const REGISTRO_LINK_DATOS_NO_SIRVEN =
  "No pudimos completar tu registro con esos datos. Revísalos o escríbele a tu asesor de DTD Cargo.";

/** Error de la RPC `portal_registration_link_complete` → qué ve el cliente. */
export function registroLinkErrorKind(error: {
  code?: string;
  message?: string;
}): "invalido" | "correo" | "datos" | "otro" {
  if (error.code === "P0002" || /link_invalido/.test(error.message ?? "")) return "invalido";
  if (error.code === "23505" || /correo_en_uso/.test(error.message ?? "")) return "correo";
  if (error.code === "22023" || /datos_incompletos/.test(error.message ?? "")) return "datos";
  return "otro";
}

/** Mensaje final, con el código de siempre del cliente. */
export function registroLinkMensajeFinal(markbox: string): string {
  return `¡Ya eras cliente de DTD Cargo! Este es tu código de siempre: ${markbox}. Ya puedes ver tu portal.`;
}

/** Estado de la server action pública. */
export type RegistroLinkActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<
    Record<
      "name" | "company" | "document" | "email" | "whatsapp" | "officePhone" | "city" | "state" | "address",
      string
    >
  >;
  markbox?: string;
  /** Enlace de un clic al portal (magic-link recién acuñado). */
  portalUrl?: string | null;
  /** Aviso suave: el registro quedó, pero algo del acceso no. */
  warning?: string;
  /** D-1: el correo quedó sin comprobar y se le mandó el enlace de comprobación. */
  correoPorComprobar?: boolean;
};

/** Fila de «Registros por link» (Studio). */
export type RegistroLinkReviewRow = {
  id: string;
  clientId: string;
  markbox: string;
  clientName: string | null;
  usedAt: string;
  prev: Record<string, unknown>;
  submitted: Record<string, unknown>;
  duplicateClientId: string | null;
  duplicateMarkbox: string | null;
  duplicateMatchedBy: string | null;
  rifSkipped: boolean;
  accessError: string | null;
  reviewedAt: string | null;
  /**
   * D-1 (opción C): estado real del correo, de `client_email_checks`.
   * `null` = no se pudo saber (falta la migración 0559).
   */
  correoEstado: CorreoEstado | null;
  /** Cuándo salió el último enlace de comprobación. */
  correoEnviadoAt: string | null;
  /**
   * SDD-0672 · quién emitió el link: el equipo (WhatsApp) o `/entrar`
   * (autoservicio, al correo de la ficha). Sin la 0562, siempre `equipo`.
   */
  origen?: "equipo" | "autoservicio";
};

/** Campos que se comparan en la revisión: [clave en prev, clave en submitted, etiqueta]. */
export const REGISTRO_LINK_CAMPOS: ReadonlyArray<readonly [string, string, string]> = [
  ["name", "name", "Nombre"],
  ["name", "company", "Razón social"],
  ["rif", "document", "Cédula / RIF"],
  ["email", "email", "Correo"],
  ["phone", "phone", "WhatsApp"],
  ["city", "city", "Ciudad"],
  ["state", "state", "Estado"],
  ["address", "address", "Dirección"],
];

/** Texto comparable (vacío = null), para marcar qué cambió. */
export function campoTexto(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}
