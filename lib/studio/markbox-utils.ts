/**
 * Helpers de validación de formato MARKBOX (SDD-0032).
 *
 * El RPC `next_markbox(tenant_id)` (SDD-0010) sigue siendo la fuente
 * canónica de generación. Estos helpers son **doble check defensivo**
 * para que el frontend rechace cualquier markbox malformado que llegue
 * via path inesperado (e.g. import bulk CSV, edición manual futura).
 */

/**
 * Regex oficial del formato MARKBOX.
 * - Prefijo literal `DTD-`
 * - 4 o 5 dígitos (rango operativo: 1001-99999)
 *
 * Ejemplos válidos: `DTD-1001`, `DTD-5452`, `DTD-99999`
 * Inválidos: `DTD-1` (3 dígitos), `DTDX-5500` (prefijo malo), `dtd-5500` (lowercase)
 */
export const MARKBOX_REGEX = /^DTD-\d{4,5}$/;

/**
 * Valida que un string sea un MARKBOX bien formado.
 * No checa unicidad — eso lo hace el constraint UNIQUE (tenant_id, markbox)
 * de la tabla `clients` a nivel DB.
 */
export function validateMarkboxFormat(code: string | null | undefined): boolean {
  if (!code) return false;
  return MARKBOX_REGEX.test(code);
}

/**
 * Extrae el componente numérico de un MARKBOX. Devuelve null si no es válido.
 * Ej: `DTD-5452` → `5452`.
 */
export function markboxNumber(code: string): number | null {
  const match = code.match(/^DTD-(\d{4,5})$/);
  if (!match) return null;
  return Number.parseInt(match[1], 10);
}

/**
 * Normaliza un MARKBOX al uppercase + sin espacios. Útil para imports
 * o input manual del admin. Devuelve null si no se puede normalizar.
 */
export function normalizeMarkbox(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().toUpperCase().replace(/\s+/g, "");
  return validateMarkboxFormat(cleaned) ? cleaned : null;
}
