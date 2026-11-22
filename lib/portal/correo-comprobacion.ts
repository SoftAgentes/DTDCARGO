/**
 * Comprobación del correo de una cuenta que nació del link de registro
 * (SDD-0646, D-1 opción C).
 *
 * El link de registro llega por WhatsApp: prueba quién es la persona, no que el
 * correo que escribió sea suyo. Hasta que su dueño lo confirme con el enlace de
 * comprobación —con su sesión del portal abierta: el enlace solo no
 * comprueba—, ese correo no sirve para obtener ni recuperar acceso, y la
 * cuenta lleva una dirección interna que no recibe correo.
 *
 * Tipos y textos puros (los importa un componente cliente). Lo que usa
 * `node:crypto` o la base vive en `lib/studio/portal/correo-comprobacion.ts`.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";

/**
 * Dominio de la dirección interna. `.invalid` está reservado (RFC 2606/6761):
 * no existe ni puede existir, así que nada que se le mande llega a nadie. La
 * migración 0559 valida la MISMA forma; `correo-comprobacion.test.ts` compara
 * los dos textos.
 */
export const CORREO_INTERNO_DOMINIO = "sin-comprobar.invalid";

const CORREO_INTERNO_REGEX = /^c-[0-9a-f]{32}@sin-comprobar\.invalid$/;

/** ¿Es una dirección interna bien formada? (la que lleva la cuenta sin comprobar) */
export function esCorreoInterno(email: string | null | undefined): boolean {
  return typeof email === "string" && CORREO_INTERNO_REGEX.test(email.trim().toLowerCase());
}

/**
 * ¿Termina en el dominio interno? Más ancho que `esCorreoInterno` a propósito:
 * es el filtro de los envíos, y a ese dominio no se le manda nada, tenga la
 * forma que tenga.
 */
export function esDominioInterno(email: string | null | undefined): boolean {
  return (
    typeof email === "string" &&
    email.trim().toLowerCase().endsWith(`@${CORREO_INTERNO_DOMINIO}`)
  );
}

/** Días que vive el enlace de comprobación. Lo fija la base (migr 0559). */
export const COMPROBAR_CORREO_TTL_DAYS = 7;

/** URL del enlace de comprobación. Sólo el token. */
export function comprobarCorreoUrl(token: string): string {
  return `${SITE_URL}/registro/correo/${token}`;
}

/**
 * Mensaje único para todo enlace que no comprueba (no existe, usado, vencido,
 * reemplazado, el correo cambió, o el correo ya tiene otra cuenta). Distinguir
 * los casos le diría a un curioso qué tokens son reales y qué correos tienen
 * cuenta.
 */
export const COMPROBAR_CORREO_NO_SIRVE =
  "No pudimos comprobar tu correo con este enlace. Pídele a tu asesor de DTD Cargo uno nuevo.";

/**
 * Sin la sesión del portal del titular no se comprueba nada. El mismo texto
 * para «no hay sesión» y para «la sesión es de otra cuenta»: no dice de quién
 * es la comprobación.
 */
export const COMPROBAR_CORREO_ENTRA_PRIMERO =
  "Para comprobar tu correo, entra primero a tu portal y vuelve a abrir este enlace en el mismo navegador. Si no tienes cómo entrar, pídele a tu asesor de DTD Cargo un acceso por WhatsApp.";

/**
 * «No es mi correo»: no confirma nada (no hay POST) y le dice cómo corregirlo.
 * El equipo corrige el correo en la ficha; el correo nuevo nace sin comprobar y
 * «Reenviar comprobación» le manda su enlace.
 */
export const COMPROBAR_CORREO_NO_ES_MIO =
  "No lo confirmes. Escríbele a tu asesor de DTD Cargo por WhatsApp con el correo correcto: lo corrige en tu ficha y te llega un enlace nuevo a ese correo. Este enlace no cambió nada.";

/** Fallo pasajero: el enlace se soltó y se puede volver a intentar. */
export const COMPROBAR_CORREO_REINTENTA =
  "No pudimos comprobar tu correo en este momento. Intenta de nuevo en un minuto.";

/** Estado de la server action pública del enlace de comprobación. */
export type ComprobarCorreoState = { ok?: boolean; error?: string };

/** Estado del correo de un registro por link, para «Registros por link». */
export type CorreoEstado =
  /** Su dueño lo confirmó con el enlace. */
  | "comprobado"
  /** Todavía no. No sirve para obtener ni recuperar acceso. */
  | "sin_comprobar"
  /** Al confirmar, ese correo ya tenía otra cuenta. Lo resuelve el equipo. */
  | "choque"
  /** Una confirmación quedó a medias; reenviar la comprobación la normaliza. */
  | "revisar"
  /**
   * La cuenta del link ya no es la del cliente (el equipo revocó y volvió a
   * invitar por correo) y ese correo nunca se comprobó. La regla ya no aplica,
   * pero el equipo lo sigue viendo.
   */
  | "nunca_comprobado"
  /** El registro no dejó cuenta (acceso fallido). */
  | "no_aplica";
