/**
 * Buscar un correo escrito por alguien de afuera, sin que funcione como patrón
 * (SDD-0597).
 *
 * `.ilike("email", correo)` parece una igualdad sin mayúsculas, pero `%` y `_` son
 * comodines. `juan_perez@x.com` también coincide con `juan.perez@x.com`, y `_` es
 * común en un correo de verdad, así que tampoco sirve quitarlo ni rechazarlo.
 *
 * 🔴 Hacen falta las dos funciones. PostgREST convierte `*` en `%` antes de llegar a
 * Postgres, y eso no se puede escapar (`\*` quedaría en `\%`, un `%` literal). Con el
 * patrón se busca bien todo lo demás, y con `sameEmail` se descarta lo que `*` traiga.
 */

/** Patrón de `.ilike` donde `%`, `_` y `\` valen por sí mismos. `*` sigue siendo comodín. */
export function emailIlikePattern(email: string): string {
  return email.replace(/[\\%_]/g, "\\$&");
}

/** ¿Son el mismo correo? Sin distinguir mayúsculas ni espacios en los extremos. */
export function sameEmail(stored: string | null | undefined, typed: string): boolean {
  return (stored ?? "").trim().toLowerCase() === typed.trim().toLowerCase();
}
