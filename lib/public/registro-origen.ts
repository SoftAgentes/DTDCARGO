/**
 * Origen del alta self-service — de dónde venía el cliente cuando se registró.
 * SDD-0474.
 *
 * Se escribe en `clients.registration_channel`, que es `text not null default
 * 'admin'` **sin CHECK** (migr 0092). Justamente por eso hace falta un
 * allowlist acá: sin él, cualquiera podría escribir lo que quisiera en una
 * columna del ERP pasando `?origen=` en la URL, y el reporte de canales dejaría
 * de servir para nada.
 *
 * Los valores existentes los fijó SDD-0046: `'admin'` (alta desde el Studio) y
 * `'portal'` (alta self-service). `'portal'` sigue siendo el default de la
 * web, y los nuevos sólo distinguen la puerta por la que entró.
 *
 * Vive en `lib/public/` porque lo leen la página pública de registro y la
 * server action del alta; no toca Supabase ni el dominio de Studio.
 */

/** Canal por defecto del alta self-service (el que escribía SDD-0046). */
export const ORIGEN_DEFAULT = "portal";

/**
 * Orígenes que la web puede declarar por querystring.
 * Al sumar uno nuevo, acordate de que el valor viaja a
 * `clients.registration_channel` y aparece en los reportes por canal.
 */
export const ORIGENES_PERMITIDOS = [
  ORIGEN_DEFAULT,
  /** Landing pública de la Academia (`/academia`). */
  "academia",
  /** Guía interactiva de Alibaba (`/guias/comprar-en-alibaba.html`). */
  "guia-alibaba",
] as const;

export type OrigenRegistro = (typeof ORIGENES_PERMITIDOS)[number];

/**
 * Normaliza un `?origen=` recibido del navegador.
 *
 * Tolerante en la forma (recorta, baja a minúsculas, acepta `_` por `-`) y
 * estricto en el fondo: lo que no esté en el allowlist cae a `'portal'`. Nunca
 * tira, porque un querystring raro no puede impedirle a nadie registrarse.
 *
 * @param raw lo que venga de `searchParams` — string, array o nada.
 */
export function normalizarOrigen(
  raw: string | string[] | undefined | null,
): OrigenRegistro {
  const valor = Array.isArray(raw) ? raw[0] : raw;
  if (typeof valor !== "string") return ORIGEN_DEFAULT;
  const limpio = valor.trim().toLowerCase().replace(/_/g, "-").slice(0, 40);
  return (ORIGENES_PERMITIDOS as readonly string[]).includes(limpio)
    ? (limpio as OrigenRegistro)
    : ORIGEN_DEFAULT;
}
