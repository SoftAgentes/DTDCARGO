/**
 * Enlaces de acceso al Studio (SDD-0250 · corrección · migr 0354).
 *
 * Para un miembro que YA existe y no puede entrar: se le manda un enlace con
 * el que fija su propia contraseña. NO es la invitación — esa crea la cuenta
 * (`app/invitar/`); esta le devuelve la entrada a quien ya la tiene.
 *
 * ⚠️ LA REGLA QUE ESTE MÓDULO EXISTE PARA PROTEGER: el token se consume en el
 * POST del formulario, JAMÁS al abrir el enlace.
 *
 * La primera versión canjeaba el token de recuperación de Supabase en un GET y
 * fallaba SIEMPRE en producción: el escáner de correo del destinatario (Gmail)
 * abre los enlaces del mensaje apenas llega, y esa apertura automática gastaba
 * el token de un solo uso. Cuando la persona hacía clic, ya estaba muerto.
 * Medido el 2026-08-06 con un experimento controlado sobre el mismo usuario:
 * con envío de correo el token moría en menos de 37 s sin que nadie tocara
 * nada; sin envío seguía vivo. La única variable era el correo.
 *
 * Un GET lo dispara cualquiera —escáneres, vistas previas de WhatsApp,
 * buscadores— así que tiene que ser idempotente. Es el mismo motivo por el que
 * `/invitar/<token>` nunca tuvo este problema.
 *
 * El token viaja en la RUTA (`/acceso/<token>`), no en la query: un enlace sin
 * `?` ni `&` sobrevive el copiar/pegar, el correo y WhatsApp.
 */

// ⚠️ ESTE MÓDULO LO IMPORTA UN COMPONENTE CLIENTE (`SetPasswordForm`), así que
// NO puede importar `node:crypto` ni nada de Node: el bundle del navegador
// revienta con "Reading from node:crypto is not handled by plugins" y se cae el
// build entero (cazado por el paso e2e del gate, 2026-08-06).
//
// Por eso `generateAccessToken()` vive en la server action que lo usa
// (`app/studio/(app)/usuarios/actions.ts`, que es "use server") y acá quedan
// sólo helpers puros, compartibles entre servidor y cliente.

/** Días que vive un enlace. Mismo criterio que la invitación (SDD-0024). */
export const ACCESS_TOKEN_TTL_DAYS = 7;

/**
 * Largo del token en caracteres hex. La server action genera 24 bytes
 * aleatorios (192 bits) → 48 hex, dentro del CHECK de la migración 0354
 * (`studio_access_tokens_token_largo`, entre 32 y 128).
 */
export const ACCESS_TOKEN_HEX_LENGTH = 48;

/** Ruta relativa del enlace. El dominio lo antepone quien arma el correo. */
export function accessTokenPath(token: string): string {
  return `/acceso/${encodeURIComponent(token)}`;
}

/** Fila de `studio_access_tokens` — lo mínimo para decidir si sirve. */
export interface AccessTokenRow {
  id: string;
  tenant_id: string;
  user_id: string;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
}

export type AccessTokenStatus = "valido" | "usado" | "expirado" | "revocado";

/**
 * Estado del enlace. El orden importa: `usado` gana sobre `expirado` porque es
 * el mensaje más útil ("ya lo usaste, entra normal" vs "pide otro").
 */
export function accessTokenStatus(row: AccessTokenRow): AccessTokenStatus {
  if (row.used_at) return "usado";
  if (row.revoked_at) return "revocado";
  if (new Date(row.expires_at).getTime() <= Date.now()) return "expirado";
  return "valido";
}

/** Fecha de expiración para un token que se crea ahora. */
export function accessTokenExpiry(from: Date = new Date()): string {
  return new Date(
    from.getTime() + ACCESS_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
}

/**
 * Mínimo de la contraseña, alineado con el resto del Studio (el tab Contraseña
 * del ProfileModal exige lo mismo). Una sola regla en todo el producto.
 */
export const MIN_PASSWORD_LENGTH = 12;

export function validateNewPassword(
  password: string,
  repeat: string,
): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `La contraseña debe tener mínimo ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (password !== repeat) return "Las contraseñas no coinciden.";
  return null;
}
